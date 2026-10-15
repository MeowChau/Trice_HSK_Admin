#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[[ ! -f .ci/active-images.env ]] || { echo 'CI/CD is active: publish the dashboard fix through the main workflow instead.' >&2; exit 1; }
compose_files=(-f compose.yaml)
if [[ "${1:-}" == '--tunnel' ]]; then
  compose_files+=(-f compose.tunnel.yaml)
elif [[ -n "${1:-}" ]]; then
  echo 'Usage: bash fix-media-urls.sh [--tunnel]' >&2
  exit 1
fi
compose() { sudo docker compose "${compose_files[@]}" "$@"; }
source_files=(
  src/lib/media-url.ts
  src/components/teachers/TeacherList.tsx
  src/components/teachers/TeacherStats.tsx
  src/components/leaderboard/StreakLeaderboard.tsx
)
for source_file in "${source_files[@]}"; do
  [[ -f "media-fix/$source_file" ]] || { echo "Missing patch source: $source_file" >&2; exit 1; }
done
[[ -f ../fe_admin/dashboard/package.json ]] || { echo 'Cannot find deployed dashboard source.' >&2; exit 1; }
compose config --quiet
admin_container=$(compose ps -q admin)
[[ -n "$admin_container" ]] || { echo 'Start the existing dashboard before applying this fix.' >&2; exit 1; }
stamp="$(date -u +%Y%m%d_%H%M%S)-$$"
backup_dir="backups/media-fix-$stamp"
mkdir -p "$backup_dir"
old_image=$(sudo docker inspect --format '{{.Image}}' "$admin_container")
rollback_image="tricehsk-admin:media-rollback-$stamp"
sudo docker image tag "$old_image" "$rollback_image"
printf 'services:\n  admin:\n    image: %s\n' "$rollback_image" > "$backup_dir/rollback.yaml"
wait_for_signin() {
  curl -fsS --retry 20 --retry-all-errors --retry-delay 2 --retry-max-time 120 \
    --connect-timeout 3 --max-time 10 --header 'Host: admin.tricehsk.id.vn' \
    http://127.0.0.1:8080/signin > /dev/null
}
cutover_started=false
rollback() {
  local status=$?
  trap - ERR
  if [[ "$cutover_started" == true ]]; then
    if sudo docker compose "${compose_files[@]}" -f "$backup_dir/rollback.yaml" up -d --no-deps --no-build --pull never --force-recreate --wait --wait-timeout 120 admin \
        && compose up -d --no-deps --force-recreate web && wait_for_signin; then
      echo 'Previous dashboard image restored. Keep the source/image backup for investigation.' >&2
    else
      echo 'Dashboard rollback could not be confirmed. Keep the backup and send the error output.' >&2
    fi
  else
    echo 'Dashboard build failed; the running application was not replaced.' >&2
  fi
  exit "$status"
}
trap rollback ERR
for source_file in "${source_files[@]}"; do
  destination="../fe_admin/dashboard/$source_file"
  mkdir -p "$backup_dir/$(dirname -- "$source_file")"
  if [[ -f "$destination" ]]; then cp -p -- "$destination" "$backup_dir/$source_file"; fi
  cp -- "media-fix/$source_file" "$destination"
done
compose build admin
cutover_started=true
compose up -d --no-deps --no-build --force-recreate --wait --wait-timeout 120 admin
compose up -d --no-deps --force-recreate web
wait_for_signin
# Verify the client bundle in the running image, not only the source on disk.
compose exec -T admin node -e 'const fs=require("node:fs");let found=false;function scan(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=p+"/"+e.name;if(e.isDirectory())scan(f);else if(e.name.endsWith(".js")&&fs.readFileSync(f,"utf8").includes("http://api-base.invalid"))found=true;}}scan(".next/static/chunks");if(!found)process.exit(1);'
printf '\nMEDIA_URL_FIX_OK: Uploaded photos now use the dashboard API endpoint. Sign in again and refresh the teachers page.\n'
compose ps admin web
