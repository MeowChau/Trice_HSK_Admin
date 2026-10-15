#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[[ $# -ge 1 ]] || { echo 'Usage: bash restore-hsk1-questions.sh backups/hsk1-workbook-TIMESTAMP [--tunnel]' >&2; exit 1; }
backup_directory=$(realpath -e -- "$1")
[[ "$backup_directory" == "$PWD"/backups/hsk1-workbook-* && -f "$backup_directory/questions-before.json" && -f "$backup_directory/questions-imported.json" ]] || { echo 'Expected the backup created by the workbook replacement.' >&2; exit 1; }
compose_files=(-f compose.yaml)
if [[ "${2:-}" == '--tunnel' ]]; then compose_files+=(-f compose.tunnel.yaml)
elif [[ -n "${2:-}" ]]; then echo 'Use --tunnel when Cloudflare Tunnel is active.' >&2; exit 1; fi
[[ ! -f .ci/active-images.env ]] || { echo 'CI/CD is active; use its current image overlay for restoration.' >&2; exit 1; }
compose() { sudo docker compose "${compose_files[@]}" "$@"; }
compose config --quiet
recover_api() { local status=$?; trap - ERR; compose start api || true; exit "$status"; }
trap recover_api ERR
compose stop api
compose run --rm --no-deps -T --user 0:0 \
  -v "$PWD/rebuild-hsk1-workbook.cjs:/operator/rebuild-hsk1-workbook.cjs:ro" \
  -v "$PWD/workbook-hsk1/release:/workbook:ro" \
  -v "$backup_directory:/backup:ro" api node /operator/rebuild-hsk1-workbook.cjs restore-questions
compose up -d --no-deps --no-build --wait --wait-timeout 180 api
compose up -d --no-deps --force-recreate web
echo 'Previous question bank and its links restored. Accounts, vocabulary and uploads were preserved.'
