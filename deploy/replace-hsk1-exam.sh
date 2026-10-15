#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[[ ! -f .ci/active-images.env ]] || { echo 'CI/CD is active; deploy source through CI first.' >&2; exit 1; }
compose_files=(-f compose.yaml)
exam_id=''
while (($#)); do
  case "$1" in
    --tunnel) compose_files+=(-f compose.tunnel.yaml); shift ;;
    --exam-id) [[ "${2:-}" =~ ^[1-9][0-9]*$ ]] || { echo 'Invalid --exam-id' >&2; exit 1; }; exam_id=$2; shift 2 ;;
    *) echo 'Usage: bash replace-hsk1-exam.sh [--tunnel] [--exam-id NUMBER]' >&2; exit 1 ;;
  esac
done
compose() { sudo docker compose "${compose_files[@]}" "$@"; }
[[ -f .env && -f hsk1-exam/source-files.txt && -f hsk1-exam/release/questions.json ]] || { echo 'Extract the complete exam package first.' >&2; exit 1; }
mapfile -t sources < hsk1-exam/source-files.txt
for file in "${sources[@]}"; do
  case "$file" in backend/src/*|fe_admin/dashboard/src/*) ;; *) echo "Invalid source: $file" >&2; exit 1 ;; esac
  [[ "$file" != *'..'* && "$file" != *\\* && -f "hsk1-exam/source/$file" && ! -L "hsk1-exam/source/$file" && ! -L "../$file" ]] || { echo "Invalid source: $file" >&2; exit 1; }
done
(cd hsk1-exam/source && sha256sum --check --quiet ../source-sha256.txt)
compose config --quiet
api_container=$(compose ps -q api)
admin_container=$(compose ps -q admin)
[[ -n "$api_container" && -n "$admin_container" ]] || { echo 'Start the current API/dashboard first.' >&2; exit 1; }
preflight_image=$(sudo docker inspect --format '{{.Image}}' "$api_container")
sudo docker run --rm --network none --read-only --memory 256m --user 0:0 --entrypoint node \
  -v "$PWD/replace-hsk1-exam.cjs:/operator/exam.cjs:ro" -v "$PWD/hsk1-exam/release:/exam:ro" \
  "$preflight_image" /operator/exam.cjs verify-files
db_name=$(compose exec -T api printenv DATABASE_NAME | tr -d '\r')
db_host=$(compose exec -T api printenv DATABASE_HOST | tr -d '\r')
# shellcheck disable=SC2016
db_url=$(compose exec -T api sh -c 'printf %s "${DATABASE_URL:-}"')
[[ "$db_name" =~ ^[a-zA-Z0-9_]+$ && "$db_host" == postgres && -z "$db_url" ]] || { echo 'Cannot back up the active API database; stopped.' >&2; exit 1; }
unset db_url
stamp="$(date -u +%Y%m%d_%H%M%S)-$$"
backup_dir="backups/hsk1-exam-$stamp"
mkdir -p "$backup_dir/source"
cp -p -- .env "$backup_dir/config.env"
for service in api admin; do
  container_variable="${service}_container"
  old_image=$(sudo docker inspect --format '{{.Image}}' "${!container_variable}")
  sudo docker image tag "$old_image" "tricehsk-$service:exam-rollback-$stamp"
done
printf 'services:\n  api:\n    image: tricehsk-api:exam-rollback-%s\n  admin:\n    image: tricehsk-admin:exam-rollback-%s\n' "$stamp" "$stamp" > "$backup_dir/rollback.yaml"
printf '%s\n' "${sources[@]}" > "$backup_dir/source-files.txt"
import_attempted=false
api_stopped=false
rollback() {
  local status=$?
  trap - ERR
  if [[ "$import_attempted" == true ]]; then
    compose up -d --no-deps --no-build --wait --wait-timeout 180 api admin || true
    compose up -d --no-deps --force-recreate web || true
    echo "Import/health check stopped. Keep backup $backup_dir and send the error; do not rerun blindly." >&2
  else
    for file in "${sources[@]}"; do
      if [[ -f "$backup_dir/source/$file" ]]; then cp -p -- "$backup_dir/source/$file" "../$file"
      elif [[ -f "../$file" ]]; then rm -- "../$file"; fi
    done
    if [[ "$api_stopped" == true ]]; then compose start api || true; fi
    echo "Exam replacement did not start. Existing exam retained; backup: $backup_dir" >&2
  fi
  exit "$status"
}
# Back up every source before installing any source, so an interrupted backup
# cannot cause the failure handler to delete files it never backed up.
for file in "${sources[@]}"; do
  mkdir -p "$backup_dir/source/$(dirname -- "$file")" "../$(dirname -- "$file")"
  if [[ -f "../$file" ]]; then cp -p -- "../$file" "$backup_dir/source/$file"; fi
done
trap rollback ERR
for file in "${sources[@]}"; do cp -- "hsk1-exam/source/$file" "../$file"; done
compose build api
compose build admin
operator() {
  compose run --rm --no-deps -T --user 0:0 -e "EXAM_ID=$exam_id" -e "EXPECTED_DATABASE=$db_name" \
    -v "$PWD/replace-hsk1-exam.cjs:/operator/exam.cjs:ro" \
    -v "$PWD/hsk1-exam/release:/exam:ro" -v "$PWD/$backup_dir:/backup" api node /operator/exam.cjs "$1"
  for file in exam-before.json exam-imported.json; do
    if [[ -f "$backup_dir/$file" ]]; then sudo chown --reference=.env -- "$backup_dir/$file"; fi
  done
}
operator verify
# Preparation selects an existing HSK 1 ID and aborts on ambiguity, before
# stopping the API. It never creates another HSK 1 exam.
operator prepare
compose stop api
api_stopped=true
# shellcheck disable=SC2016
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$1" -Fc' sh "$db_name" > "$backup_dir/database.dump"
[[ -s "$backup_dir/database.dump" ]]
compose run --rm --no-deps -T api tar -czf - -C /app/files . > "$backup_dir/uploads.tar.gz"
[[ -s "$backup_dir/uploads.tar.gz" ]]
import_attempted=true
operator replace
compose up -d --no-deps --no-build --force-recreate --wait --wait-timeout 180 api admin
api_stopped=false
compose up -d --no-deps --force-recreate web
for route in health signin; do
  curl -fsS --retry 20 --retry-all-errors --retry-delay 2 --retry-max-time 120 --connect-timeout 3 --max-time 10 "http://127.0.0.1:8080/$route" > /dev/null
done
printf '\nHSK1_EXAM_UPDATE_OK: 40 questions, 2 sections. Open Exams > Edit to upload listening audio/answers. Backup: %s\n' "$backup_dir"
compose ps api admin web
