#!/usr/bin/env bash
set -euo pipefail
root=$(pwd)
fixture=$(mktemp -d "$root/deploy/transfers/import-test.XXXXXX")
mkdir -p "$fixture/bin"
cat > "$fixture/bin/sudo" <<'SH'
#!/usr/bin/env bash
exec "$@"
SH
cat > "$fixture/bin/docker" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$IMPORT_TEST_LOG"
case "$*" in
  *'volume inspect'*) [[ "${IMPORT_TEST_SCENARIO:-}" != missing-volume ]]; exit ;;
  *'images -q api'*) echo fixture-api ;;
  *'ps -q api'*) echo fixture-api-container ;;
  *'inspect --format'*) echo original-uploads ;;
  *'printenv DATABASE_NAME'*) echo original-db ;;
  *'require("/transfer/manifest.json")'* | *'function walk(p)'*) echo 6 ;;
  *'verify-local-import.cjs database'*)
    if [[ "${IMPORT_TEST_SCENARIO:-}" == invalid-data ]]; then exit 1; fi
    echo 'IMPORT_DATABASE_OK: fixture verified'
    ;;
esac
SH
cat > "$fixture/bin/curl" <<'SH'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >> "$IMPORT_TEST_LOG"
[[ "$*" == *'--retry-all-errors'* && "$*" == *'--retry-max-time 120'* ]] || exit 56
if [[ "${IMPORT_TEST_SCENARIO:-}" == health-failure && ! -f "$IMPORT_TEST_LOG.health-failed" ]]; then
  touch "$IMPORT_TEST_LOG.health-failed"
  exit 56
fi
echo '{"name":"TriceHSK API"}'
SH
chmod +x "$fixture/bin/"*
for scenario in fresh resume health-failure missing-volume invalid-data invalid-stamp; do
  project="$fixture/$scenario"
  transfer="$project/transfers/local-data-import"
  mkdir -p "$transfer"
  cp "$root/deploy/import-local-data.sh" "$transfer/"
  cp "$root/deploy/compose.yaml" "$root/deploy/compose.tunnel.yaml" "$project/"
  fixture_admin_password=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')
  printf 'DATABASE_NAME=original-db\nDATABASE_URL=\nUPLOADS_VOLUME_NAME=original-uploads\nSEED_ADMIN_PASSWORD=%s\n' "$fixture_admin_password" > "$project/.env"
  cp "$project/.env" "$project/env.original"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$project/backup.sh"
  touch "$transfer/database.dump"
  args=(--tunnel --resume 20261012_094732)
  if [[ "$scenario" == fresh ]]; then args=(--tunnel); fi
  if [[ "$scenario" == invalid-stamp ]]; then args=(--resume '../unsafe'); fi
  export IMPORT_TEST_LOG="$project/commands.log" IMPORT_TEST_SCENARIO="$scenario"
  status=0
  PATH="$fixture/bin:$PATH" bash "$transfer/import-local-data.sh" "${args[@]}" > "$project/output.log" 2>&1 || status=$?
  if [[ "$scenario" == fresh || "$scenario" == resume ]]; then
    [[ "$status" == 0 ]]
    grep -Fq 'LOCAL_DATA_IMPORTED' "$project/output.log"
    grep -Fxq "SEED_ADMIN_PASSWORD=$fixture_admin_password" "$project/.env"
    if [[ "$scenario" == resume ]]; then
      grep -Fxq 'DATABASE_NAME=tricehsk_import_20261012_094732' "$project/.env"
      if grep -Eq 'createdb|pg_restore|volume create|tar -xzf' "$IMPORT_TEST_LOG"; then echo 'Resume unexpectedly restored or created data.' >&2; exit 1; fi
    else
      grep -Fq 'createdb' "$IMPORT_TEST_LOG"
      grep -Fq 'pg_restore' "$IMPORT_TEST_LOG"
    fi
  else
    [[ "$status" != 0 ]]
    cmp "$project/.env" "$project/env.original"
    if grep -Fq 'LOCAL_DATA_IMPORTED' "$project/output.log"; then echo 'A failed import reported success.' >&2; exit 1; fi
    if [[ "$scenario" == health-failure ]]; then
      grep -Fq 'Previous database and upload volume restored.' "$project/output.log"
    elif [[ -f "$IMPORT_TEST_LOG" ]]; then
      if grep -Fq 'stop api' "$IMPORT_TEST_LOG"; then echo 'API was stopped before preparation passed.' >&2; exit 1; fi
    fi
  fi
  printf 'IMPORT_SCRIPT_TEST_OK: %s\n' "$scenario"
done
