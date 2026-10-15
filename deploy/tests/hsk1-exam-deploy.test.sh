#!/usr/bin/env bash
set -euo pipefail
root=$(pwd)
mkdir -p "$root/deploy/transfers"
fixture=$(mktemp -d "$root/deploy/transfers/exam-shell-test.XXXXXX")
mkdir -p "$fixture/bin"
cat > "$fixture/bin/sudo" <<'SH'
#!/usr/bin/env bash
exec "$@"
SH
cat > "$fixture/bin/docker" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$EXAM_TEST_LOG"
case "$*" in
  *'ps -q api'*) echo existing-api ;;
  *'ps -q admin'*) echo existing-admin ;;
  *'inspect --format'*) echo existing-image ;;
  *'exam.cjs verify-files'*) [[ "$*" == *'--user 0:0'* ]] || exit 1; [[ "$EXAM_TEST_SCENARIO" != invalid-data ]] || exit 1; echo MOCK_EXAM_FILES_OK ;;
  *'printenv DATABASE_NAME'*) echo tricehsk_import_active ;;
  *'printenv DATABASE_HOST'*) echo postgres ;;
  *'DATABASE_URL'*) exit 0 ;;
  *'build api'*) [[ "$EXAM_TEST_SCENARIO" != build-failure ]]; exit ;;
  *'exam.cjs verify'*) exit 0 ;;
  *'exam.cjs prepare'*) [[ "$EXAM_TEST_SCENARIO" != ambiguous ]] || exit 1; [[ "$*" == *'--user 0:0'* && "$*" == *'EXPECTED_DATABASE=tricehsk_import_active'* ]] || exit 1; echo HSK1_EXAM_PREPARED ;;
  *'pg_dump'*) [[ "$EXAM_TEST_SCENARIO" != backup-failure ]] || exit 1; echo database-backup ;;
  *'tar -czf'*) echo uploads-backup ;;
  *'exam.cjs replace'*) [[ "$EXAM_TEST_SCENARIO" != import-failure ]] || exit 1; echo HSK1_MOCK_EXAM_REPLACED ;;
esac
SH
cat > "$fixture/bin/curl" <<'SH'
#!/usr/bin/env bash
[[ "$*" == *'--retry-all-errors'* ]] || exit 56
[[ "$EXAM_TEST_SCENARIO" != web-failure ]] || exit 56
echo ready
SH
chmod +x "$fixture/bin/"*
for scenario in success build-failure invalid-data invalid-source ambiguous backup-failure import-failure web-failure; do
  project="$fixture/$scenario"
  mkdir -p "$project/deploy/hsk1-exam/release" "$project/deploy/hsk1-exam/source/backend/src/exams" "$project/backend/src/exams"
  cp "$root/deploy/replace-hsk1-exam.sh" "$root/deploy/replace-hsk1-exam.cjs" "$project/deploy/"
  printf 'services: {}\n' > "$project/deploy/compose.yaml"
  printf 'services: {}\n' > "$project/deploy/compose.tunnel.yaml"
  printf 'DATABASE_NAME=tricehsk_import_active\nUPLOADS_VOLUME_NAME=active-uploads\n' > "$project/deploy/.env"
  cp "$project/deploy/.env" "$project/original.env"
  printf 'backend/src/exams/exams.service.ts\n' > "$project/deploy/hsk1-exam/source-files.txt"
  echo new-source > "$project/deploy/hsk1-exam/source/backend/src/exams/exams.service.ts"
  (cd "$project/deploy/hsk1-exam/source" && sha256sum backend/src/exams/exams.service.ts) > "$project/deploy/hsk1-exam/source-sha256.txt"
  if [[ "$scenario" == invalid-source ]]; then echo corrupted-source > "$project/deploy/hsk1-exam/source/backend/src/exams/exams.service.ts"; fi
  echo old-source > "$project/backend/src/exams/exams.service.ts"
  echo '{}' > "$project/deploy/hsk1-exam/release/questions.json"
  export EXAM_TEST_LOG="$project/commands.log" EXAM_TEST_SCENARIO="$scenario"
  touch "$EXAM_TEST_LOG"
  status=0
  PATH="$fixture/bin:$PATH" bash "$project/deploy/replace-hsk1-exam.sh" --tunnel > "$project/output.log" 2>&1 || status=$?
  cmp "$project/deploy/.env" "$project/original.env"
  if [[ "$scenario" == success ]]; then
    [[ "$status" == 0 ]]
    grep -Fq 'HSK1_EXAM_UPDATE_OK' "$project/output.log"
    grep -Fq 'sh tricehsk_import_active' "$EXAM_TEST_LOG"
    grep -Fq 'new-source' "$project/backend/src/exams/exams.service.ts"
  else
    [[ "$status" != 0 ]]
    if grep -Fq 'HSK1_EXAM_UPDATE_OK' "$project/output.log"; then echo 'Failure reported success.' >&2; exit 1; fi
    if [[ "$scenario" == import-failure || "$scenario" == web-failure ]]; then
      grep -Fq 'do not rerun blindly' "$project/output.log"
      grep -Fq 'new-source' "$project/backend/src/exams/exams.service.ts"
    else
      if grep -Fq 'exam.cjs replace' "$EXAM_TEST_LOG"; then echo 'Import before successful preparation.' >&2; exit 1; fi
      grep -Fq 'old-source' "$project/backend/src/exams/exams.service.ts"
    fi
    if [[ "$scenario" == build-failure || "$scenario" == invalid-data || "$scenario" == invalid-source || "$scenario" == ambiguous ]]; then
      if grep -Fq 'stop api' "$EXAM_TEST_LOG"; then echo 'Preparation failure stopped API.' >&2; exit 1; fi
    fi
    if [[ "$scenario" == invalid-data || "$scenario" == invalid-source ]]; then
      if grep -Fq 'build api' "$EXAM_TEST_LOG"; then echo 'Corrupt package triggered build.' >&2; exit 1; fi
    fi
  fi
  printf 'HSK1_EXAM_DEPLOY_TEST_OK: %s\n' "$scenario"
done
