$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$archivePath = Join-Path $taskRoot 'tricehsk-deploy.tar.gz'
# Explicit source allowlist: do not package local .env, datasets or backups.
$sourcePaths = @(
    'docs/refactor-2026-10-14.md',
    'docs/signin-fix-2026-10-14.md',
    'backend/src',
    'backend/package.json',
    'backend/package-lock.json',
    'backend/nest-cli.json',
    'backend/tsconfig.json',
    'backend/tsconfig.build.json',
    'backend/.dockerignore',
    'backend/maildev.Dockerfile',
    'backend/docs/backend-review.md',
    'fe_admin/dashboard/src',
    'fe_admin/dashboard/public',
    'fe_admin/dashboard/package.json',
    'fe_admin/dashboard/package-lock.json',
    'fe_admin/dashboard/next.config.ts',
    'fe_admin/dashboard/postcss.config.js',
    'fe_admin/dashboard/tsconfig.json',
    'fe_admin/dashboard/.dockerignore',
    'fe_admin/dashboard/tests/media-url.test.mjs',
    'fe_admin/dashboard/tests/question-editor.test.mjs',
    'fe_admin/dashboard/tests/requests.test.mjs',
    'fe_admin/dashboard/tests/login.test.mjs',
    'fe_admin/dashboard/eslint.config.mjs',
    'fe_admin/dashboard/prettier.config.js',
    'deploy/update-source.sh',
    'deploy/update-source.cjs',
    'deploy/deploy-windows.ps1',
    'deploy/UPDATE.md',
    'deploy/tests/source-update.test.sh',
    'deploy/tests/source-update.test.cjs',
    'deploy/README.md',
    'deploy/LOCAL_DATA.md',
    'deploy/HSK1_WORKBOOK.md',
    'deploy/HSK1_EXAM.md',
    'deploy/package-hsk1-exam.ps1',
    'deploy/replace-hsk1-exam.sh',
    'deploy/replace-hsk1-exam.cjs',
    'deploy/tests/hsk1-exam.test.cjs',
    'deploy/tests/query-performance.test.cjs',
    'deploy/tests/hsk1-exam-deploy.test.sh',
    'deploy/package-hsk1-workbook.ps1',
    'deploy/rebuild-hsk1-workbook.sh',
    'deploy/rebuild-hsk1-workbook.cjs',
    'deploy/repair-workbook-checksum.sh',
    'deploy/package-hsk1-checksum-fix.ps1',
    'deploy/restore-hsk1-questions.sh',
    'deploy/tests/workbook-import.test.cjs',
    'deploy/tests/workbook-rebuild.test.sh',
    'deploy/tests/workbook-checksum-repair.test.sh',
    'deploy/tests/workbook-permissions.test.cjs',
    'deploy/compose.yaml',
    'deploy/compose.tunnel.yaml',
    'deploy/start-cloudflare-tunnel.sh',
    'deploy/cloudflare.env.example',
    'deploy/CLOUDFLARE.md',
    'deploy/CI_CD.md',
    'deploy/package-cicd.ps1',
    'deploy/compose.release.yaml',
    'deploy/ci/deploy.py',
    'deploy/ci/install.sh',
    'deploy/ci/compose.sh',
    'deploy/ci/deploy.sh',
    'deploy/ci/make-release.py',
    'deploy/ci/release.Dockerfile',
    'deploy/ci/tests/test_deploy.py',
    'deploy/nginx.tunnel.conf',
    'deploy/nginx.conf',
    'deploy/backend.Dockerfile',
    'deploy/admin.Dockerfile',
    'deploy/.env.example',
    'deploy/init-env.sh',
    'deploy/fix-admin-login.sh',
    'deploy/fix-media-urls.sh',
    'deploy/check-admin-login.cjs',
    'deploy/check-admin-credentials.cjs',
    'deploy/reset-admin-login.cjs',
    'deploy/export-local-data.ps1',
    'deploy/import-local-data.sh',
    'deploy/tests/import-local-data.test.sh',
    'deploy/tests/media-urls.test.sh',
    'deploy/run-import-migrations.cjs',
    'deploy/verify-local-import.cjs',
    'deploy/backup.sh',
    'deploy/package.ps1',
    'deploy/.gitignore',
    'deploy/.gitattributes'
)
Push-Location -LiteralPath $taskRoot
try {
    foreach ($sourcePath in $sourcePaths) {
        if (-not (Test-Path -LiteralPath $sourcePath)) {
            throw "Missing required source file: $sourcePath"
        }
    }
    $tarArguments = @('-czf', $archivePath, '--') + $sourcePaths
    & tar.exe @tarArguments
    if ($LASTEXITCODE -ne 0) { throw "tar failed with exit code $LASTEXITCODE" }
    Get-Item -LiteralPath $archivePath | Select-Object FullName, Length
}
finally {
    Pop-Location
}
