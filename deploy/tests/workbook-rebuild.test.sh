#!/usr/bin/env bash
set -euo pipefail
root=$(pwd)
mkdir -p "$root/deploy/transfers"
fixture=$(mktemp -d "$root/deploy/transfers/workbook-shell-test.XXXXXX")
mkdir -p "$fixture/bin"
cat > "$fixture/bin/sudo" <<'SH'
#!/usr/bin/env bash
exec "$@"
SH
cat > "$fixture/bin/docker" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$WORKBOOK_TEST_LOG"
case "$*" in
  *'ps -q api'*) echo existing-api ;;
  *'ps -q admin'*) echo existing-admin ;;
  *'inspect --format'*) echo existing-image ;;
  *'rebuild-hsk1-workbook.cjs verify-files'*) [[ "$*" == *'--user 0:0'* ]] || exit 1; [[ "$WORKBOOK_TEST_SCENARIO" != invalid-data ]] || exit 1; echo WORKBOOK_ASSETS_VERIFIED ;;
  *'printenv DATABASE_NAME'*) echo tricehsk_import_active ;;
  *'printenv DATABASE_HOST'*) echo postgres ;;
  *'DATABASE_URL'*) exit 0 ;;
  *'build api'*) [[ "$WORKBOOK_TEST_SCENARIO" != build-failure ]]; exit ;;
  *'rebuild-hsk1-workbook.cjs verify'*) [[ "$WORKBOOK_TEST_SCENARIO" != invalid-data ]]; exit ;;
  *'pg_dump'*) [[ "$WORKBOOK_TEST_SCENARIO" != backup-failure ]] || exit 1; echo database-backup ;;
  *'tar -czf'*) echo uploads-backup ;;
  *'rebuild-hsk1-workbook.cjs prepare'*) echo WORKBOOK_REPLACEMENT_PREPARED ;;
  *'rebuild-hsk1-workbook.cjs replace-all'*) [[ "$WORKBOOK_TEST_SCENARIO" != import-failure ]] || exit 1; echo HSK1_QUESTION_BANK_REBUILT ;;
  *'exec -T api node'*) echo 'WORKBOOK_DATABASE_VERIFIED: 367' ;;
esac
SH
cat > "$fixture/bin/curl" <<'SH'
#!/usr/bin/env bash
[[ "$*" == *'--retry-all-errors'* ]] || exit 56
echo ready
SH
chmod +x "$fixture/bin/"*
for scenario in success build-failure invalid-data backup-failure import-failure; do
  project="$fixture/$scenario"
  mkdir -p "$project/deploy/workbook-hsk1/release" "$project/deploy/workbook-hsk1/source/backend/src/questions" "$project/backend/src/questions"
  cp "$root/deploy/rebuild-hsk1-workbook.sh" "$root/deploy/rebuild-hsk1-workbook.cjs" "$project/deploy/"
  printf 'services: {}\n' > "$project/deploy/compose.yaml"
  printf 'services: {}\n' > "$project/deploy/compose.tunnel.yaml"
  printf 'DATABASE_NAME=tricehsk_import_active\nUPLOADS_VOLUME_NAME=active-uploads\n' > "$project/deploy/.env"
  cp "$project/deploy/.env" "$project/original.env"
  printf 'backend/src/questions/question-validation.ts\n' > "$project/deploy/workbook-hsk1/source-files.txt"
  echo new-source > "$project/deploy/workbook-hsk1/source/backend/src/questions/question-validation.ts"
  echo old-source > "$project/backend/src/questions/question-validation.ts"
  echo '{}' > "$project/deploy/workbook-hsk1/release/questions.json"
  export WORKBOOK_TEST_LOG="$project/commands.log" WORKBOOK_TEST_SCENARIO="$scenario"
  status=0
  PATH="$fixture/bin:$PATH" bash "$project/deploy/rebuild-hsk1-workbook.sh" --tunnel > "$project/output.log" 2>&1 || status=$?
  cmp "$project/deploy/.env" "$project/original.env"
  if [[ "$scenario" == success ]]; then
    [[ "$status" == 0 ]]
    grep -Fq 'HSK1_WORKBOOK_UPDATE_OK' "$project/output.log"
    grep -Fq 'pg_dump' "$WORKBOOK_TEST_LOG"
    grep -Fq 'sh tricehsk_import_active' "$WORKBOOK_TEST_LOG"
    grep -Fq 'new-source' "$project/backend/src/questions/question-validation.ts"
  else
    [[ "$status" != 0 ]]
    if grep -Fq 'HSK1_WORKBOOK_UPDATE_OK' "$project/output.log"; then echo 'Failed replacement reported success.' >&2; exit 1; fi
    if [[ "$scenario" != import-failure ]]; then
      if grep -Fq 'rebuild-hsk1-workbook.cjs replace-all' "$WORKBOOK_TEST_LOG"; then echo 'Import started before preflight succeeded.' >&2; exit 1; fi
      grep -Fq 'old-source' "$project/backend/src/questions/question-validation.ts"
    else grep -Fq 'Do not rerun or restore the whole database blindly' "$project/output.log"; fi
    if [[ "$scenario" == build-failure || "$scenario" == invalid-data ]]; then
      if grep -Fq 'stop api' "$WORKBOOK_TEST_LOG"; then echo 'Preparation failure stopped the API.' >&2; exit 1; fi
    fi
    if [[ "$scenario" == invalid-data ]]; then
      if grep -Fq 'build api' "$WORKBOOK_TEST_LOG" || grep -Fq 'image tag' "$WORKBOOK_TEST_LOG"; then echo 'Invalid assets triggered a build or changed image tags.' >&2; exit 1; fi
    fi
  fi
  printf 'WORKBOOK_REBUILD_TEST_OK: %s\n' "$scenario"
done
