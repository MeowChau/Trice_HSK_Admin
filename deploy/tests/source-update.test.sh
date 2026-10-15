#!/usr/bin/env bash
set -euo pipefail
root=$(pwd)
mkdir -p "$root/deploy/transfers"
fixture=$(mktemp -d "$root/deploy/transfers/source-update-test.XXXXXX")
mkdir -p "$fixture/bin"
cat > "$fixture/bin/sudo" <<'SH'
#!/usr/bin/env bash
if [[ "${1:-}" == -v ]]; then exit 0; fi
exec "$@"
SH
cat > "$fixture/bin/flock" <<'SH'
#!/usr/bin/env bash
[[ "$SOURCE_TEST_SCENARIO" != busy ]]
SH
cat > "$fixture/bin/docker" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$SOURCE_TEST_LOG"
case "$*" in
  *'ps -q api'*) echo existing-api ;;
  *'ps -q admin'*) echo existing-admin ;;
  *'ps -q web'*) echo existing-web ;;
  *'ps -q postgres'*) echo existing-postgres ;;
  *'inspect --format {{.Config.Image}} existing-api'*) echo tricehsk-api:local ;;
  *'inspect --format {{.Config.Image}} existing-admin'*) echo tricehsk-admin:local ;;
  *'inspect --format {{.Image}}'*) echo previous-image ;;
  *'inspect --format'*'.Mounts'*) echo existing-uploads ;;
  *'inspect --format'*'source.sha256'*) echo "$SOURCE_TEST_HASH" ;;
  *'printenv DATABASE_NAME'*) echo tricehsk_import_active ;;
  *'printenv DATABASE_HOST'*) echo postgres ;;
  *'DATABASE_URL'*) exit 0 ;;
  *'config --format json'*) echo '{"volumes":{"uploads":{"name":"existing-uploads"}}}' ;;
  *'exec -T api node -e'*) cat >/dev/null; if [[ "$SOURCE_TEST_SCENARIO" == wrong-volume ]]; then echo empty-uploads; else echo existing-uploads; fi ;;
  'build '*backend)
    [[ "$SOURCE_TEST_SCENARIO" != build-failure ]] || exit 1
    if [[ "$SOURCE_TEST_SCENARIO" == config-changed ]]; then echo 'operator-added-setting=yes' >> "$SOURCE_TEST_PROJECT/deploy/.env"; fi ;;
  *'/operator/check.cjs preflight'*) [[ "$SOURCE_TEST_SCENARIO" != schema-failure ]] || exit 1 ;;
  *'/operator/check.cjs snapshot'*) echo snapshot-ok ;;
  *'/operator/check.cjs verify'*) [[ "$SOURCE_TEST_SCENARIO" != verify-failure ]] || exit 1 ;;
  *'pg_dump'*) [[ "$SOURCE_TEST_SCENARIO" != backup-failure ]] || exit 1; echo mock-database ;;
  *'pg_restore --list'*) cat >/dev/null; echo mock-contents ;;
  *'--entrypoint tar'*) tar -czf - -C "$SOURCE_TEST_PROJECT/uploads" . ;;
  *'candidate.yaml'*'up -d'*) [[ "$SOURCE_TEST_SCENARIO" != start-failure ]] || exit 1 ;;
  *'rollback.yaml'*'up -d'*) touch "$SOURCE_TEST_PROJECT/rolled-back" ;;
esac
SH
cat > "$fixture/bin/curl" <<'SH'
#!/usr/bin/env bash
[[ "$*" == *'--retry-all-errors'* ]] || exit 56
if [[ "$SOURCE_TEST_SCENARIO" == route-failure && ! -f "$SOURCE_TEST_PROJECT/rolled-back" ]]; then exit 56; fi
echo ready
SH
cat > "$fixture/bin/cp" <<'SH'
#!/usr/bin/env bash
if [[ "$SOURCE_TEST_SCENARIO" == promote-failure && "$*" == *'.source-updates/'* && "${@: -1}" == "$SOURCE_TEST_PROJECT/fe_admin/dashboard/src" && ! -f "$SOURCE_TEST_PROJECT/copy-failed" ]]; then
  touch "$SOURCE_TEST_PROJECT/copy-failed"
  exit 1
fi
exec /usr/bin/cp "$@"
SH
chmod +x "$fixture/bin/"*

for scenario in success build-failure schema-failure backup-failure start-failure route-failure verify-failure promote-failure config-changed bad-checksum ci-active unsafe-archive wrong-volume busy; do
  project="$fixture/$scenario"
  package="$project/package"
  mkdir -p "$package/backend/src" "$package/fe_admin/dashboard/src" "$package/fe_admin/dashboard/public" "$package/fe_admin/dashboard/tests" "$package/deploy" "$package/docs" "$project/deploy" "$project/uploads"
  echo new-backend > "$package/backend/src/new.ts"
  echo new-frontend > "$package/fe_admin/dashboard/src/new.ts"
  echo demo-page-retained > "$package/fe_admin/dashboard/public/demo.txt"
  for file in backend/package.json backend/package-lock.json backend/nest-cli.json backend/tsconfig.json backend/tsconfig.build.json backend/.dockerignore fe_admin/dashboard/package.json fe_admin/dashboard/package-lock.json fe_admin/dashboard/next.config.ts fe_admin/dashboard/postcss.config.js fe_admin/dashboard/tsconfig.json fe_admin/dashboard/.dockerignore fe_admin/dashboard/eslint.config.mjs fe_admin/dashboard/prettier.config.js docs/refactor-2026-10-14.md; do
    echo package-file > "$package/$file"
  done
  for file in backend.Dockerfile admin.Dockerfile update-source.sh update-source.cjs deploy-windows.ps1 UPDATE.md; do cp "$root/deploy/$file" "$package/deploy/$file"; done
  echo existing-file > "$project/uploads/photo.jpg"
  mkdir -p "$project/backend/src" "$project/fe_admin/dashboard/src"
  echo old-backend > "$project/backend/src/obsolete.ts"
  echo old-frontend > "$project/fe_admin/dashboard/src/obsolete.ts"
  echo private-local-dataset > "$project/backend/db.sqlite"
  printf 'DATABASE_NAME=tricehsk_import_active\nUPLOADS_VOLUME_NAME=existing-files\n' > "$project/deploy/.env"
  cp "$project/deploy/.env" "$project/env.original"
  for file in compose.yaml compose.tunnel.yaml nginx.conf nginx.tunnel.conf cloudflare.env; do echo "original-$file" > "$project/deploy/$file"; done
  cp "$project/deploy/cloudflare.env" "$project/cloudflare.original"
  if [[ "$scenario" == ci-active ]]; then mkdir -p "$project/deploy/.ci"; echo managed > "$project/deploy/.ci/active-images.env"; fi
  if [[ "$scenario" == unsafe-archive ]]; then
    tar --transform='s|^backend/src/new.ts$|../outside|' -czf "$project/package.tar.gz" -C "$package" backend fe_admin deploy docs
  else
    tar -czf "$project/package.tar.gz" -C "$package" backend fe_admin deploy docs
  fi
  package_hash=$(sha256sum "$project/package.tar.gz")
  package_hash=${package_hash%% *}
  if [[ "$scenario" == bad-checksum ]]; then package_hash=$(printf '%064d' 0); fi
  export SOURCE_TEST_LOG="$project/commands.log" SOURCE_TEST_SCENARIO="$scenario" SOURCE_TEST_PROJECT="$project" SOURCE_TEST_HASH="$package_hash"
  touch "$SOURCE_TEST_LOG"
  status=0
  PATH="$fixture/bin:$PATH" bash "$root/deploy/update-source.sh" --archive "$project/package.tar.gz" --sha256 "$package_hash" --project "$project" > "$project/output.log" 2>&1 || status=$?
  cmp "$project/deploy/cloudflare.env" "$project/cloudflare.original"
  grep -Fq private-local-dataset "$project/backend/db.sqlite"
  grep -Fq existing-file "$project/uploads/photo.jpg"
  if [[ "$scenario" == config-changed ]]; then
    grep -Fq 'operator-added-setting=yes' "$project/deploy/.env"
  else
    cmp "$project/deploy/.env" "$project/env.original"
  fi
  if grep -Eq ' migration:run|run-seed| schema:drop| down .* -v| volume (rm|prune)|pg_restore.*database.dump| up -d .* (postgres|redis|cloudflared)( |$)' "$SOURCE_TEST_LOG"; then echo 'Updater mutated unrelated services or database.' >&2; exit 1; fi
  if [[ "$scenario" == success ]]; then
    [[ "$status" == 0 ]] || { cat "$project/output.log"; exit 1; }
    grep -Fq SOURCE_UPDATE_OK "$project/output.log"
    grep -Fq 'sh tricehsk_import_active' "$SOURCE_TEST_LOG"
    [[ ! -e "$project/backend/src/obsolete.ts" && ! -e "$project/fe_admin/dashboard/src/obsolete.ts" ]]
    grep -Fq new-backend "$project/backend/src/new.ts"
    grep -Fq demo-page-retained "$project/fe_admin/dashboard/public/demo.txt"
    [[ -s "$project/deploy/.source-update-version" ]]
  else
    [[ "$status" != 0 ]]
    if grep -Fq SOURCE_UPDATE_OK "$project/output.log"; then echo 'Failed update reported success.' >&2; exit 1; fi
    grep -Fq old-backend "$project/backend/src/obsolete.ts"
    grep -Fq old-frontend "$project/fe_admin/dashboard/src/obsolete.ts"
    case "$scenario" in
      start-failure|route-failure|verify-failure|promote-failure)
        [[ -f "$project/rolled-back" ]]
        grep -Fq SOURCE_UPDATE_ROLLED_BACK "$project/output.log" ;;
      backup-failure)
        grep -Fq 'start api' "$SOURCE_TEST_LOG"
        if grep -Fq 'up -d' "$SOURCE_TEST_LOG"; then echo 'Backup failure replaced containers.' >&2; exit 1; fi ;;
      *)
        if grep -Eq 'stop api|up -d' "$SOURCE_TEST_LOG"; then echo 'Preflight failure stopped running application.' >&2; exit 1; fi ;;
    esac
  fi
  printf 'SOURCE_UPDATE_TEST_OK: %s\n' "$scenario"
done
