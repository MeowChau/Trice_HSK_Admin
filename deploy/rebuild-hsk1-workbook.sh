#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[[ ! -f .ci/active-images.env ]] || { echo 'CI/CD is active. Deploy these source changes through CI before replacing the bank.' >&2; exit 1; }
compose_files=(-f compose.yaml)
if [[ "${1:-}" == '--tunnel' ]]; then compose_files+=(-f compose.tunnel.yaml)
elif [[ -n "${1:-}" ]]; then echo 'Usage: bash rebuild-hsk1-workbook.sh [--tunnel]' >&2; exit 1; fi
compose() { sudo docker compose "${compose_files[@]}" "$@"; }
[[ -f .env && -f workbook-hsk1/source-files.txt && -f workbook-hsk1/release/questions.json ]] || { echo 'Extract the complete workbook update archive under deploy first.' >&2; exit 1; }
mapfile -t sources < workbook-hsk1/source-files.txt
for file in "${sources[@]}"; do
  case "$file" in backend/src/*|fe_admin/dashboard/src/*) ;; *) echo "Invalid source path: $file" >&2; exit 1 ;; esac
  [[ "$file" != *'..'* && "$file" != *\\* && -f "workbook-hsk1/source/$file" && ! -L "workbook-hsk1/source/$file" && ! -L "../$file" ]] || { echo "Invalid or missing source: $file" >&2; exit 1; }
done
compose config --quiet
api_container=$(compose ps -q api)
admin_container=$(compose ps -q admin)
[[ -n "$api_container" && -n "$admin_container" ]] || { echo 'Start the current API and dashboard first.' >&2; exit 1; }
preflight_image=$(sudo docker inspect --format '{{.Image}}' "$api_container")
sudo docker run --rm --network none --read-only --memory 256m --user 0:0 --entrypoint node \
  -v "$PWD/rebuild-hsk1-workbook.cjs:/operator/rebuild-hsk1-workbook.cjs:ro" \
  -v "$PWD/workbook-hsk1/release:/workbook:ro" \
  "$preflight_image" /operator/rebuild-hsk1-workbook.cjs verify-files
db_name=$(compose exec -T api printenv DATABASE_NAME | tr -d '\r')
db_host=$(compose exec -T api printenv DATABASE_HOST | tr -d '\r')
# Expand the variable inside the container, never in the operator's shell.
# shellcheck disable=SC2016
db_url=$(compose exec -T api sh -c 'printf %s "${DATABASE_URL:-}"')
[[ "$db_name" =~ ^[a-zA-Z0-9_]+$ && "$db_host" == postgres && -z "$db_url" ]] || { echo 'The database backup needs the local PostgreSQL service. Import aborted.' >&2; exit 1; }
unset db_url
stamp="$(date -u +%Y%m%d_%H%M%S)-$$"
backup_dir="backups/hsk1-workbook-$stamp"
mkdir -p "$backup_dir/source"
cp -p -- .env "$backup_dir/config.env"
for service in api admin; do
  container_variable="${service}_container"
  old_image=$(sudo docker inspect --format '{{.Image}}' "${!container_variable}")
  sudo docker image tag "$old_image" "tricehsk-$service:workbook-rollback-$stamp"
done
printf 'services:\n  api:\n    image: tricehsk-api:workbook-rollback-%s\n  admin:\n    image: tricehsk-admin:workbook-rollback-%s\n' "$stamp" "$stamp" > "$backup_dir/rollback.yaml"
printf '%s\n' "${sources[@]}" > "$backup_dir/source-files.txt"
cutover_started=false
api_stopped=false
import_attempted=false
wait_for_web() {
  curl -fsS --retry 20 --retry-all-errors --retry-delay 2 --retry-max-time 120 --connect-timeout 3 --max-time 10 \
    --header 'Host: api.tricehsk.id.vn' http://127.0.0.1:8080/health > /dev/null
  curl -fsS --retry 20 --retry-all-errors --retry-delay 2 --retry-max-time 120 --connect-timeout 3 --max-time 10 \
    --header 'Host: admin.tricehsk.id.vn' http://127.0.0.1:8080/signin > /dev/null
}
rollback() {
  local status=$?
  trap - ERR
  if [[ "$import_attempted" == true ]]; then
    # A commit can precede a later process/web failure. Keep the compatible new
    # application and backup rather than guessing whether to undo the dataset.
    compose up -d --no-deps --no-build --wait --wait-timeout 120 api || true
    compose up -d --no-deps --force-recreate web || true
    echo "Import/verification stopped. Keep $backup_dir and send the error output. Do not rerun or restore the whole database blindly." >&2
  else
    if [[ "$cutover_started" == true ]]; then
      sudo docker compose "${compose_files[@]}" -f "$backup_dir/rollback.yaml" up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 120 api admin || true
      compose up -d --no-deps --force-recreate web || true
    elif [[ "$api_stopped" == true ]]; then compose start api || true; fi
    if [[ -f "$backup_dir/sources-backed-up" ]]; then
      for file in "${sources[@]}"; do
        if [[ -f "$backup_dir/source/$file" ]]; then cp -p -- "$backup_dir/source/$file" "../$file"
        elif [[ -f "../$file" ]]; then rm -- "../$file"; fi
      done
    fi
    echo "Question replacement did not start. Previous source/images retained; backup: $backup_dir" >&2
  fi
  exit "$status"
}
trap rollback ERR
for file in "${sources[@]}"; do
  mkdir -p "$backup_dir/source/$(dirname -- "$file")" "../$(dirname -- "$file")"
  if [[ -f "../$file" ]]; then cp -p -- "../$file" "$backup_dir/source/$file"; fi
done
touch "$backup_dir/sources-backed-up"
for file in "${sources[@]}"; do cp -- "workbook-hsk1/source/$file" "../$file"; done
# Build while the previous application is still serving requests. No deletion
# or database change happens if either image cannot be built.
compose build api
compose build admin
operator() {
  compose run --rm --no-deps -T --user 0:0 \
    -v "$PWD/rebuild-hsk1-workbook.cjs:/operator/rebuild-hsk1-workbook.cjs:ro" \
    -v "$PWD/workbook-hsk1/release:/workbook:ro" \
    -v "$PWD/$backup_dir:/backup" api node /operator/rebuild-hsk1-workbook.cjs "$1"
  # The maintenance UID may differ from the VPS account's UID. Keep newly
  # written backup JSON private and readable by the owner of the deployment.
  for file in questions-before.json questions-imported.json; do
    if [[ -f "$backup_dir/$file" ]]; then sudo chown --reference=.env -- "$backup_dir/$file"; fi
  done
}
operator verify
cutover_started=true
compose up -d --no-deps --no-build --force-recreate --wait --wait-timeout 180 api admin
compose up -d --no-deps --force-recreate web
wait_for_web
compose stop api
api_stopped=true
# The API's active imported DB can differ from POSTGRES_DB. Back up the actual
# database used by the running app, along with its active upload volume.
# The container owns POSTGRES_USER; $1 is the verified active database name.
# shellcheck disable=SC2016
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$1" -Fc' sh "$db_name" > "$backup_dir/database.dump"
[[ -s "$backup_dir/database.dump" ]]
compose run --rm --no-deps -T api tar -czf - -C /app/files . > "$backup_dir/uploads.tar.gz"
[[ -s "$backup_dir/uploads.tar.gz" ]]
operator prepare
import_attempted=true
operator replace-all
compose up -d --no-deps --no-build --wait --wait-timeout 180 api
api_stopped=false
compose up -d --no-deps --force-recreate web
wait_for_web
compose exec -T api node -e 'const {AppDataSource:d}=require("./dist/database/data-source.js");d.setOptions({logging:false});d.initialize().then(async()=>{const [r]=await d.query("SELECT count(*)::int AS count FROM question WHERE payload->\u0027source\u0027->>\u0027bookId\u0027 LIKE \u0027hsk1-workbook-%\u0027");if(r.count!==367)throw Error("Question count mismatch");console.log("WORKBOOK_DATABASE_VERIFIED: "+r.count);}).finally(()=>d.isInitialized&&d.destroy()).catch(e=>{console.error(e.message);process.exitCode=1;});'
printf '\nHSK1_WORKBOOK_UPDATE_OK: 367 items, including 140 reading answers. Upload listening audio from Questions > Edit. Backup: %s\n' "$backup_dir"
compose ps api admin web
