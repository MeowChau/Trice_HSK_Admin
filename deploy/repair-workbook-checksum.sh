#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[[ "${1:-}" == '--tunnel' || $# == 0 ]] || { echo 'Usage: bash repair-workbook-checksum.sh [--tunnel]' >&2; exit 1; }
[[ ! -f .ci/active-images.env ]] || { echo 'CI/CD is active; do not apply this manual repair.' >&2; exit 1; }
archive=${WORKBOOK_REPAIR_ARCHIVE:-/home/user/tricehsk-hsk1-rebuild.tar.gz}
expected=3b678a2f148a3fcf08a82c654b93401eacd2cf335ed45aaa3a1450567d5ced8e
[[ -f "$archive" ]] || { echo 'The original workbook archive is missing.' >&2; exit 1; }
if ! printf '%s  %s\n' "$expected" "$archive" | sha256sum --check --status; then
  echo "Original archive checksum differs. Expected SHA256: $expected. Keep the original verified archive." >&2
  exit 1
fi
compose_files=(-f compose.yaml)
if [[ "${1:-}" == '--tunnel' ]]; then compose_files+=(-f compose.tunnel.yaml); fi
compose() { sudo docker compose "${compose_files[@]}" "$@"; }
compose config --quiet
api_container=$(compose ps -q api)
[[ -n "$api_container" ]] || { echo 'Start the current API first.' >&2; exit 1; }
image=$(sudo docker inspect --format '{{.Image}}' "$api_container")
mkdir -p transfers
fresh=$(mktemp -d "$PWD/transfers/workbook-reextract.XXXXXX")
# The original archive is verified above. Always extract into an empty folder,
# not over stale files, hardlinks, symlinks or a partially extracted dataset.
tar -xzf "$archive" -C "$fresh"
sudo docker run --rm --network none --read-only --memory 256m --user 0:0 --entrypoint node \
  -v "$PWD/rebuild-hsk1-workbook.cjs:/operator/rebuild-hsk1-workbook.cjs:ro" \
  -v "$fresh/workbook-hsk1/release:/workbook:ro" \
  "$image" /operator/rebuild-hsk1-workbook.cjs verify-files
stamp="$(date -u +%Y%m%d_%H%M%S)-$$"
previous="$PWD/workbook-hsk1-before-checksum-$stamp"
if [[ -e workbook-hsk1 || -L workbook-hsk1 ]]; then mv -T -- workbook-hsk1 "$previous"; fi
if ! mv -T -- "$fresh/workbook-hsk1" "$PWD/workbook-hsk1"; then
  if [[ -e "$previous" || -L "$previous" ]]; then mv -T -- "$previous" "$PWD/workbook-hsk1"; fi
  echo 'Could not install the verified extraction. The previous folder was restored.' >&2
  exit 1
fi
echo "WORKBOOK_CHECKSUM_REPAIR_OK: All 805 assets verified. Previous extraction kept at $previous"
# The updated operator performs another preflight before builds or source/data
# changes. It backs up the active DB before replacing any questions.
bash "$PWD/rebuild-hsk1-workbook.sh" "$@"
