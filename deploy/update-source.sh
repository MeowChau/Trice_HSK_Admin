#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

archive=''
expected_hash=''
project='/home/user/trice_hsk'
while (($#)); do
  case "$1" in
    --archive) archive=${2:?Missing archive}; shift 2 ;;
    --sha256) expected_hash=${2:?Missing SHA256}; shift 2 ;;
    --project) project=${2:?Missing project}; shift 2 ;;
    *) echo 'Usage: bash update-source.sh --archive FILE --sha256 SHA256 [--project DIRECTORY]' >&2; exit 1 ;;
  esac
done
fail() { echo "SOURCE_UPDATE_STOPPED: $*" >&2; exit 1; }
[[ "$expected_hash" =~ ^[a-f0-9]{64}$ && -f "$archive" ]] || fail 'Missing package or invalid checksum.'
project=$(realpath -e -- "$project")
[[ "$project" != / && "$project" != /home && "$project" != /home/user && -d "$project/deploy" ]] || fail 'Invalid project directory.'
cd -- "$project/deploy"
[[ -f .env && -f compose.yaml ]] || fail 'Cannot find the existing deployment configuration.'
[[ ! -f .ci/active-images.env ]] || fail 'CI/CD manages these images. Publish through the existing workflow.'
for program in sudo docker curl tar sha256sum flock; do command -v "$program" >/dev/null || fail "Missing command: $program"; done
exec 9>.source-update.lock
flock -n 9 || fail 'Another source update is already running.'
actual_hash=$(sha256sum -- "$archive")
[[ "${actual_hash%% *}" == "$expected_hash" ]] || fail 'Uploaded package checksum does not match Windows.'
# This trusted package is still checked before extracting into a fresh directory.
while IFS= read -r member; do
  [[ "$member" != /* && "$member" != *\\* && "$member" != .. && "$member" != ../* && "$member" != */../* && "$member" != */.. ]] || fail 'Unsafe archive path.'
  case "$member" in .env|*/.env|*/cloudflare.env|*.dump|*.sqlite|*/node_modules/*) fail 'Package unexpectedly contains private data.' ;; esac
done < <(tar -tzf "$archive")
while IFS= read -r entry; do
  [[ "${entry:0:1}" == '-' || "${entry:0:1}" == d ]] || fail 'Archive contains a link or special file.'
done < <(tar -tvzf "$archive")
stamp="$(date -u +%Y%m%d_%H%M%S)-$$"
mkdir -p -- .source-updates backups
stage="$PWD/.source-updates/$stamp"
backup="$PWD/backups/source-update-$stamp"
mkdir -- "$stage" "$backup"
tar --no-same-owner --no-same-permissions -xzf "$archive" -C "$stage"
# Build input permissions must also work for the non-root runtime users. The
# parent staging/backup directories remain private, and contain no live secrets.
find "$stage" -type d -exec chmod 755 {} +
find "$stage" -type f -exec chmod 644 {} +
# Only these build inputs are promoted. Existing Compose, nginx, .env, upload
# volumes, workbook assets and datasets remain in their existing locations.
sources=(
  backend/src backend/package.json backend/package-lock.json backend/nest-cli.json
  backend/tsconfig.json backend/tsconfig.build.json backend/.dockerignore
  fe_admin/dashboard/src fe_admin/dashboard/public fe_admin/dashboard/package.json
  fe_admin/dashboard/package-lock.json fe_admin/dashboard/next.config.ts
  fe_admin/dashboard/postcss.config.js fe_admin/dashboard/tsconfig.json
  fe_admin/dashboard/.dockerignore fe_admin/dashboard/tests
  fe_admin/dashboard/eslint.config.mjs fe_admin/dashboard/prettier.config.js
  deploy/backend.Dockerfile deploy/admin.Dockerfile deploy/update-source.sh
  deploy/update-source.cjs deploy/deploy-windows.ps1 deploy/UPDATE.md
  docs/refactor-2026-10-14.md
)
for file in "${sources[@]}"; do
  [[ -e "$stage/$file" && ! -L "$stage/$file" ]] || fail "Missing source: $file"
  cursor="$project/$file"
  while [[ "$cursor" != "$project" ]]; do
    [[ ! -L "$cursor" ]] || fail "Source destination is a symbolic link: $file"
    cursor=$(dirname -- "$cursor")
  done
done
compose_files=(-f "$PWD/compose.yaml")
config_files=(.env compose.yaml nginx.conf)
if [[ -f cloudflare.env ]]; then
  [[ -f compose.tunnel.yaml && -f nginx.tunnel.conf ]] || fail 'Incomplete existing tunnel configuration.'
  compose_files+=(-f "$PWD/compose.tunnel.yaml")
  config_files+=(cloudflare.env compose.tunnel.yaml nginx.tunnel.conf)
fi
compose() { sudo docker compose "${compose_files[@]}" "$@"; }
sudo -v
compose config --quiet
declare -A old_images old_tags containers
for service in api admin web postgres; do
  containers[$service]=$(compose ps -q "$service")
  [[ -n "${containers[$service]}" && "${containers[$service]}" != *$'\n'* ]] || fail "Expected one running $service container."
done
for service in api admin; do
  old_images[$service]=$(sudo docker inspect --format '{{.Image}}' "${containers[$service]}")
  old_tags[$service]=$(sudo docker inspect --format '{{.Config.Image}}' "${containers[$service]}")
  [[ "${old_tags[$service]}" =~ ^tricehsk-$service:[a-zA-Z0-9_.-]+$ ]] || fail 'This deployment uses externally managed application images.'
  sudo docker image tag "${old_images[$service]}" "tricehsk-$service:source-rollback-$stamp"
done
db_name=$(compose exec -T api printenv DATABASE_NAME | tr -d '\r')
db_host=$(compose exec -T api printenv DATABASE_HOST | tr -d '\r')
# shellcheck disable=SC2016
db_url=$(compose exec -T api sh -c 'printf %s "${DATABASE_URL:-}"')
[[ "$db_name" =~ ^[a-zA-Z0-9_]+$ && "$db_host" == postgres && -z "$db_url" ]] || fail 'Cannot safely identify the active API database.'
unset db_url
# Check the effective volume name against the running container, even if .env
# was edited without recreating API. Never switch to an empty uploads volume.
active_uploads=$(sudo docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/files"}}{{.Name}}{{end}}{{end}}' "${containers[api]}")
configured_uploads=$(compose config --format json | compose exec -T api node -e 'let input="";process.stdin.on("data",chunk=>input+=chunk);process.stdin.on("end",()=>{const c=JSON.parse(input);const m=c.services.api.volumes.find(v=>v.target==="/app/files"&&v.type==="volume");if(!m||!c.volumes[m.source]?.name)process.exit(1);console.log(c.volumes[m.source].name);});')
[[ -n "$active_uploads" && "$active_uploads" == "$configured_uploads" ]] || fail 'Configured upload volume differs from the running API; existing files retained.'
cp -p -- .env "$backup/config.env"
for file in "${config_files[@]}"; do cp -p -- "$file" "$backup/$file"; done
sha256sum -- "${config_files[@]}" > "$backup/config.sha256"
printf 'services:\n  api:\n    image: tricehsk-api:source-%s\n  admin:\n    image: tricehsk-admin:source-%s\n' "$stamp" "$stamp" > "$backup/candidate.yaml"
printf 'services:\n  api:\n    image: tricehsk-api:source-rollback-%s\n  admin:\n    image: tricehsk-admin:source-rollback-%s\n' "$stamp" "$stamp" > "$backup/rollback.yaml"
candidate() { sudo docker compose "${compose_files[@]}" -f "$backup/candidate.yaml" "$@"; }
previous() { sudo docker compose "${compose_files[@]}" -f "$backup/rollback.yaml" "$@"; }
check_routes() {
  for route in health signin; do
    curl -fsS --retry 20 --retry-all-errors --retry-delay 2 --retry-max-time 120 \
      --connect-timeout 3 --max-time 10 --header 'Host: admin.tricehsk.id.vn' \
      "http://127.0.0.1:8080/$route" >/dev/null || return
  done
  curl -fsS --retry 20 --retry-all-errors --retry-delay 2 --retry-max-time 120 \
    --connect-timeout 3 --max-time 10 --header 'Host: api.tricehsk.id.vn' \
    http://127.0.0.1:8080/health >/dev/null
}
operator() {
  candidate run --rm --no-deps -T --user 0:0 -e "EXPECTED_DATABASE=$db_name" \
    -v "$stage/deploy/update-source.cjs:/operator/check.cjs:ro" \
    -v "$backup:/backup" api node /operator/check.cjs "$1"
}
installed=()
api_stopped=false
cutover_started=false
rollback() {
  local status=$1
  trap - ERR HUP INT TERM
  set +e
  for file in "${installed[@]}"; do
    mkdir -p -- "$backup/failed-source/$(dirname -- "$file")"
    if [[ -e "$project/$file" ]]; then mv -- "$project/$file" "$backup/failed-source/$file"; fi
    if [[ -e "$backup/source/$file" ]]; then cp -a -- "$backup/source/$file" "$project/$file"; fi
  done
  for service in api admin; do sudo docker image tag "${old_images[$service]}" "${old_tags[$service]}"; done
  if [[ "$cutover_started" == true ]]; then
    if sha256sum --check --quiet "$backup/config.sha256" && \
       previous up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 180 api admin && \
       compose up -d --no-deps --no-build --pull never --force-recreate web && check_routes; then
      echo 'SOURCE_UPDATE_ROLLED_BACK: previous API/dashboard images restored.' >&2
    else
      echo 'SOURCE_ROLLBACK_UNCONFIRMED: keep the backup and send the error output.' >&2
    fi
  elif [[ "$api_stopped" == true ]]; then
    compose start api
    check_routes || echo 'SOURCE_RESTART_UNCONFIRMED: keep the backup and send the error output.' >&2
  else
    echo 'SOURCE_UPDATE_NOT_APPLIED: existing running containers retained.' >&2
  fi
  echo "Backup: $backup" >&2
  exit "$status"
}
trap 'rollback $?' ERR
trap 'rollback 130' INT
trap 'rollback 143' TERM
trap 'rollback 129' HUP
echo 'SOURCE_UPDATE_BUILDING: building API, then dashboard; the current site stays online.'
sudo docker build --label "io.tricehsk.source.sha256=$expected_hash" \
  -f "$stage/deploy/backend.Dockerfile" -t "tricehsk-api:source-$stamp" "$stage/backend"
sudo docker build --label "io.tricehsk.source.sha256=$expected_hash" \
  --build-arg NEXT_PUBLIC_API_URL=/api/v1 -f "$stage/deploy/admin.Dockerfile" \
  -t "tricehsk-admin:source-$stamp" "$stage/fe_admin/dashboard"
operator preflight
sha256sum --check --quiet "$backup/config.sha256"
echo 'SOURCE_UPDATE_SWITCHING: saving the active database/uploads before the short restart.'
api_stopped=true
compose stop api
operator snapshot
if [[ -f "$backup/counts-before.json" ]]; then sudo chown --reference=.env -- "$backup/counts-before.json"; fi
# Back up the database actually used by API, rather than the initial POSTGRES_DB.
# shellcheck disable=SC2016
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$1" -Fc' sh "$db_name" > "$backup/database.dump"
[[ -s "$backup/database.dump" ]]
compose exec -T postgres sh -c 'pg_restore --list' < "$backup/database.dump" > "$backup/database-contents.txt"
candidate run --rm --no-deps -T --user 0:0 --entrypoint tar api -czf - -C /app/files . > "$backup/uploads.tar.gz"
tar -tzf "$backup/uploads.tar.gz" >/dev/null
sha256sum --check --quiet "$backup/config.sha256"
cutover_started=true
candidate up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 180 api admin
api_stopped=false
compose up -d --no-deps --no-build --pull never --force-recreate web
check_routes
operator verify
for service in api admin; do
  container=$(candidate ps -q "$service")
  label=$(sudo docker inspect --format '{{index .Config.Labels "io.tricehsk.source.sha256"}}' "$container")
  [[ "$label" == "$expected_hash" ]]
done
# Promote complete source directories only after the new images pass checks,
# so removed components cannot survive through an archive overlay.
for file in "${sources[@]}"; do
  mkdir -p -- "$project/$(dirname -- "$file")" "$backup/source/$(dirname -- "$file")"
  if [[ -e "$project/$file" ]]; then cp -a -- "$project/$file" "$backup/source/$file"; fi
done
for file in "${sources[@]}"; do
  installed+=("$file")
  mkdir -p -- "$backup/replaced-source/$(dirname -- "$file")"
  if [[ -e "$project/$file" ]]; then mv -- "$project/$file" "$backup/replaced-source/$file"; fi
  cp -a -- "$stage/$file" "$project/$file"
done
# Retain the original Compose tags, so ordinary future restarts use this build.
for service in api admin; do sudo docker image tag "tricehsk-$service:source-$stamp" "${old_tags[$service]}"; done
sha256sum --check --quiet "$backup/config.sha256"
printf 'archive_sha256=%s\ndatabase=%s\nupdated_at=%s\nbackup=%s\n' \
  "$expected_hash" "$db_name" "$stamp" "$backup" > .source-update-version
trap - ERR HUP INT TERM
compose ps api admin web || true
printf '\nSOURCE_UPDATE_OK: new API/dashboard verified; existing data/configuration retained.\nBackup: %s\n' "$backup"
