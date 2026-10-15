#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
transfer_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd -- "$transfer_dir/../.."
[[ -f compose.yaml && -f .env && -f backup.sh ]] || { echo 'Run the extracted script under deploy/transfers/local-data-import.' >&2; exit 1; }
chmod 700 "$transfer_dir"
compose_files=(-f compose.yaml)
resume_stamp=
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tunnel) compose_files+=(-f compose.tunnel.yaml); shift ;;
    --resume)
      [[ "${2:-}" =~ ^[0-9]{8}_[0-9]{6}$ ]] || { echo 'Expected an existing import timestamp: YYYYMMDD_HHMMSS.' >&2; exit 1; }
      resume_stamp=$2
      shift 2
      ;;
    *) echo 'Usage: bash import-local-data.sh [--tunnel] [--resume YYYYMMDD_HHMMSS]' >&2; exit 1 ;;
  esac
done
compose() { sudo docker compose "${compose_files[@]}" "$@"; }
wait_for_api() {
  # Docker "Started" precedes Nginx readiness. Retry resets as well as refused connections.
  curl -fsS --retry 20 --retry-all-errors --retry-delay 2 --retry-max-time 120 \
    --connect-timeout 3 --max-time 10 --header 'Host: api.tricehsk.id.vn' http://127.0.0.1:8080/health
}
[[ ! -f .ci/active-images.env ]] || { echo 'CI/CD already manages these images. Use an import procedure with the active CI overlay before switching data.' >&2; exit 1; }
compose config --quiet
api_image=$(compose images -q api | head -n 1)
api_container=$(compose ps -q api)
[[ -n "$api_image" && -n "$api_container" ]] || { echo 'Start the existing API before importing.' >&2; exit 1; }
old_upload_volume=$(sudo docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/files"}}{{.Name}}{{end}}{{end}}' "$api_container")
[[ "$old_upload_volume" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || { echo 'Expected a named upload volume.' >&2; exit 1; }

stamp=$(date -u +%Y%m%d_%H%M%S)
if [[ -n "$resume_stamp" ]]; then stamp=$resume_stamp; fi
target_db="tricehsk_import_$stamp"
target_uploads="tricehsk_import_uploads_$stamp"
if [[ -n "$resume_stamp" ]]; then
  # Inspect first: --mount with a missing volume would silently create an empty volume.
  sudo docker volume inspect "$target_uploads" > /dev/null
  active_db=$(compose exec -T api printenv DATABASE_NAME)
  [[ "$active_db" != "$target_db" ]] || { echo 'This import database is already active; check the running API instead.' >&2; exit 1; }
fi
attempt_stamp="$(date -u +%Y%m%d_%H%M%S)-$$"
previous_env="$transfer_dir/env-before-$attempt_stamp"
previous_compose="$transfer_dir/compose-before-$attempt_stamp.yaml"
cp -p -- .env "$previous_env"
cp -p -- compose.yaml "$previous_compose"
cutover_started=false
rollback() {
  local exit_status=$?
  trap - ERR
  if [[ "$cutover_started" == true ]]; then
    echo 'Import cutover failed. Restoring the previous configuration.' >&2
    cp -p -- "$previous_env" .env
    cp -p -- "$previous_compose" compose.yaml
    if compose up -d --no-deps --force-recreate --wait postgres api && compose up -d --no-deps --force-recreate web && wait_for_api; then
      echo 'Previous database and upload volume restored.' >&2
    else
      echo 'Automatic rollback failed. Keep the backups and send the error output for recovery.' >&2
    fi
  else
    echo 'Import preparation failed. The live database configuration was unchanged.' >&2
  fi
  exit "$exit_status"
}
trap rollback ERR

# All validation, restore and migration work happens before the running DB changes.
sudo docker run --rm --network none --user 0 --mount "type=bind,source=$transfer_dir,target=/transfer,readonly" --mount "type=bind,source=$transfer_dir/verify-local-import.cjs,target=/app/verify-local-import.cjs,readonly" --entrypoint node "$api_image" /app/verify-local-import.cjs files
sudo bash backup.sh
if [[ -z "$resume_stamp" ]]; then
  # Expand POSTGRES_USER and positional arguments inside the container shell.
  # shellcheck disable=SC2016
  compose exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" --template=template0 --encoding=UTF8 "$1"' sh "$target_db"
  # shellcheck disable=SC2016
  compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --no-acl --single-transaction' sh "$target_db" < "$transfer_dir/database.dump"
  compose run --rm --no-deps -T -e "DATABASE_NAME=$target_db" -e DATABASE_URL= -v "$transfer_dir/run-import-migrations.cjs:/app/run-import-migrations.cjs:ro" api node /app/run-import-migrations.cjs
fi
compose run --rm --no-deps -T --user 0 -e "DATABASE_NAME=$target_db" -e DATABASE_URL= -v "$transfer_dir:/transfer:ro" -v "$transfer_dir/verify-local-import.cjs:/app/verify-local-import.cjs:ro" -v "$transfer_dir/reset-admin-login.cjs:/app/reset-admin-login.cjs:ro" api node /app/verify-local-import.cjs database
if [[ -z "$resume_stamp" ]]; then
  sudo docker volume create "$target_uploads" > /dev/null
  sudo docker run --rm --network none --user 0 --mount "type=volume,source=$target_uploads,target=/app/files" --mount "type=bind,source=$transfer_dir,target=/transfer,readonly" --entrypoint sh "$api_image" -c 'tar -xzf /transfer/uploads.tar.gz -C /app/files && chown -R node:node /app/files'
fi
upload_count=$(sudo docker run --rm --network none --user 0 --mount "type=volume,source=$target_uploads,target=/app/files,readonly" --entrypoint node "$api_image" -e 'const fs=require("node:fs");let n=0;function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=p+"/"+e.name;if(e.isDirectory())walk(f);else if(e.isFile())n++;}}walk("/app/files");console.log(n);')
expected_upload_count=$(sudo docker run --rm --network none --user 0 --mount "type=bind,source=$transfer_dir,target=/transfer,readonly" --entrypoint node "$api_image" -e 'console.log(require("/transfer/manifest.json").uploadsFileCount)')
[[ "$upload_count" == "$expected_upload_count" ]] || { echo 'Upload file count mismatch.' >&2; false; }

# Preserve the previous DB and volume; switch only the connection and volume name.
cutover_started=true
compose stop api
if ! grep -Fq 'UPLOADS_VOLUME_NAME' compose.yaml; then
  [[ $(grep -c '^  uploads:$' compose.yaml) == 1 ]] || { echo 'Unexpected Compose uploads configuration.' >&2; false; }
  sed -i "/^  uploads:$/a\    name: \${UPLOADS_VOLUME_NAME:-$old_upload_volume}" compose.yaml
fi
sed -i '/^DATABASE_NAME=/d; /^DATABASE_URL=/d; /^UPLOADS_VOLUME_NAME=/d' .env
printf '\nDATABASE_NAME=%s\nDATABASE_URL=\nUPLOADS_VOLUME_NAME=%s\n' "$target_db" "$target_uploads" >> .env
compose config --quiet
compose up -d --no-deps --force-recreate --wait postgres
compose up -d --no-deps --force-recreate --wait api
compose up -d --no-deps --force-recreate web
wait_for_api
printf '\nLOCAL_DATA_IMPORTED: database=%s; upload_files=%s. Sign in again with the current VPS admin credentials.\n' "$target_db" "$upload_count"
compose ps
