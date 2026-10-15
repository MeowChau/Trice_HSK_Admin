#!/usr/bin/env bash
set -euo pipefail
root=$(pwd)
archive="$root/tricehsk-hsk1-rebuild.tar.gz"
[[ -f "$archive" ]] || { echo 'This incident regression test needs the original verified workbook archive.' >&2; exit 1; }
fixture=$(mktemp -d "$root/deploy/transfers/checksum-repair-test.XXXXXX")
mkdir -p "$fixture/bin"
cat > "$fixture/bin/sudo" <<'SH'
#!/usr/bin/env bash
exec "$@"
SH
cat > "$fixture/bin/docker" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$WORKBOOK_REPAIR_TEST_LOG"
case "$*" in
  *'config --quiet'*) exit 0 ;;
  *'ps -q api'*) echo running-api; exit 0 ;;
  *'inspect --format'*) echo running-image; exit 0 ;;
  *'verify-files'*)
    [[ "$*" == *'--user 0:0'* && "$*" == *'--read-only'* && "$*" == *'--network none'* ]] || exit 1
    directory=
    for arg in "$@"; do
      if [[ "$arg" == *':/workbook:ro' ]]; then directory=${arg%:/workbook:ro}; fi
    done
    [[ -n "$directory" ]]
    if [[ "$WORKBOOK_REPAIR_TEST_SCENARIO" == bad-extraction ]]; then
      printf 'damaged\n' > "$directory/assets/hsk1-workbook-63d36e483fa6-p023-l04-q01-optB.webp"
    fi
    if command -v cygpath > /dev/null 2>&1; then directory=$(cygpath -w "$directory"); fi
    WORKBOOK_DIRECTORY="$directory" WORKBOOK_APP_ROOT=missing-app node "$WORKBOOK_REPAIR_TEST_OPERATOR" verify-files
    ;;
  *) echo 'Unexpected Docker operation during archive repair.' >&2; exit 1 ;;
esac
SH
chmod +x "$fixture/bin/"*
for scenario in success bad-extraction wrong-archive; do
  project="$fixture/$scenario"
  mkdir -p "$project/deploy/workbook-hsk1/release/assets"
  cp "$root/deploy/repair-workbook-checksum.sh" "$root/deploy/rebuild-hsk1-workbook.cjs" "$project/deploy/"
  printf 'services: {}\n' > "$project/deploy/compose.yaml"
  printf 'services: {}\n' > "$project/deploy/compose.tunnel.yaml"
  printf 'DATABASE_NAME=preserved-database\n' > "$project/deploy/.env"
  cp "$project/deploy/.env" "$project/original.env"
  printf 'old corrupted extraction\n' > "$project/deploy/workbook-hsk1/release/assets/hsk1-workbook-63d36e483fa6-p023-l04-q01-optB.webp"
  cat > "$project/deploy/rebuild-hsk1-workbook.sh" <<'SH'
#!/usr/bin/env bash
printf 'REBUILD_REQUESTED: %s\n' "$*"
SH
  export WORKBOOK_REPAIR_ARCHIVE="$archive" WORKBOOK_REPAIR_TEST_LOG="$project/docker.log" WORKBOOK_REPAIR_TEST_SCENARIO="$scenario" WORKBOOK_REPAIR_TEST_OPERATOR="$project/deploy/rebuild-hsk1-workbook.cjs"
  if [[ "$scenario" == wrong-archive ]]; then
    printf 'invalid archive\n' > "$project/bad.tar.gz"
    export WORKBOOK_REPAIR_ARCHIVE="$project/bad.tar.gz"
  fi
  status=0
  PATH="$fixture/bin:$PATH" bash "$project/deploy/repair-workbook-checksum.sh" --tunnel > "$project/output.log" 2>&1 || status=$?
  cmp "$project/original.env" "$project/deploy/.env"
  if [[ "$scenario" == success ]]; then
    [[ "$status" == 0 ]]
    grep -Fq 'WORKBOOK_ASSETS_VERIFIED' "$project/output.log"
    grep -Fq 'REBUILD_REQUESTED: --tunnel' "$project/output.log"
    expected=73522121349d785305a1c9a2ee5c31e29223949f454db986598791f8a37fcc78
    printf '%s  %s\n' "$expected" "$project/deploy/workbook-hsk1/release/assets/hsk1-workbook-63d36e483fa6-p023-l04-q01-optB.webp" | sha256sum --check --status
    old=("$project"/deploy/workbook-hsk1-before-checksum-*)
    [[ ${#old[@]} == 1 ]]
    grep -Fq 'old corrupted extraction' "${old[0]}/release/assets/hsk1-workbook-63d36e483fa6-p023-l04-q01-optB.webp"
  else
    [[ "$status" != 0 ]]
    grep -Fq 'old corrupted extraction' "$project/deploy/workbook-hsk1/release/assets/hsk1-workbook-63d36e483fa6-p023-l04-q01-optB.webp"
    if grep -Fq 'REBUILD_REQUESTED' "$project/output.log"; then echo 'Failed verification started the update.' >&2; exit 1; fi
  fi
  printf 'WORKBOOK_CHECKSUM_REPAIR_TEST_OK: %s\n' "$scenario"
done
