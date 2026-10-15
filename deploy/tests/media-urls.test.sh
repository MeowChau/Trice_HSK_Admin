#!/usr/bin/env bash
set -euo pipefail
root=$(pwd)
fixture=$(mktemp -d "$root/deploy/transfers/media-test.XXXXXX")
mkdir -p "$fixture/bin"
cat > "$fixture/bin/sudo" <<'SH'
#!/usr/bin/env bash
exec "$@"
SH
cat > "$fixture/bin/docker" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$MEDIA_TEST_LOG"
case "$*" in
  *'ps -q admin'*) echo fixture-admin-container ;;
  *'inspect --format'*) echo fixture-existing-image ;;
  *'build admin'*) [[ "${MEDIA_TEST_SCENARIO:-}" != build-failure ]]; exit ;;
  *'exec -T admin node'*) [[ "${MEDIA_TEST_SCENARIO:-}" != bundle-failure ]]; exit ;;
esac
SH
cat > "$fixture/bin/curl" <<'SH'
#!/usr/bin/env bash
[[ "$*" == *'--retry-all-errors'* ]] || exit 56
echo '<button type="submit">Sign in</button>'
SH
chmod +x "$fixture/bin/"*
for scenario in success build-failure bundle-failure; do
  project="$fixture/$scenario"
  mkdir -p "$project/deploy" "$project/fe_admin/dashboard"
  cp "$root/deploy/fix-media-urls.sh" "$project/deploy/"
  printf 'services: {}\n' > "$project/deploy/compose.yaml"
  printf 'services: {}\n' > "$project/deploy/compose.tunnel.yaml"
  printf 'DATABASE_NAME=imported-db\nUPLOADS_VOLUME_NAME=imported-files\n' > "$project/deploy/.env"
  cp "$project/deploy/.env" "$project/env.original"
  printf '{}\n' > "$project/fe_admin/dashboard/package.json"
  for file in src/lib/media-url.ts src/components/teachers/TeacherList.tsx src/components/teachers/TeacherStats.tsx src/components/leaderboard/StreakLeaderboard.tsx; do
    mkdir -p "$project/deploy/media-fix/$(dirname -- "$file")" "$project/fe_admin/dashboard/$(dirname -- "$file")"
    printf 'patched media source\n' > "$project/deploy/media-fix/$file"
    printf 'previous media source\n' > "$project/fe_admin/dashboard/$file"
  done
  export MEDIA_TEST_LOG="$project/commands.log" MEDIA_TEST_SCENARIO="$scenario"
  status=0
  PATH="$fixture/bin:$PATH" bash "$project/deploy/fix-media-urls.sh" --tunnel > "$project/output.log" 2>&1 || status=$?
  cmp "$project/deploy/.env" "$project/env.original"
  if grep -Eq ' (postgres|api)( |$)|volume (create|rm)|pg_restore' "$MEDIA_TEST_LOG"; then echo 'Media repair changed backend data or services.' >&2; exit 1; fi
  if [[ "$scenario" == success ]]; then
    [[ "$status" == 0 ]]
    grep -Fq 'MEDIA_URL_FIX_OK' "$project/output.log"
    grep -Fq 'patched media source' "$project/fe_admin/dashboard/src/lib/media-url.ts"
  else
    [[ "$status" != 0 ]]
    if grep -Fq 'MEDIA_URL_FIX_OK' "$project/output.log"; then echo 'Failed repair reported success.' >&2; exit 1; fi
    if [[ "$scenario" == build-failure ]]; then
      if grep -Fq 'up -d' "$MEDIA_TEST_LOG"; then echo 'Failed build replaced a running container.' >&2; exit 1; fi
    else
      grep -Fq 'rollback.yaml' "$MEDIA_TEST_LOG"
      grep -Fq 'Previous dashboard image restored.' "$project/output.log"
    fi
  fi
  printf 'MEDIA_REPAIR_TEST_OK: %s\n' "$scenario"
done
