$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$archivePath = Join-Path $taskRoot 'tricehsk-hsk1-rebuild.tar.gz'
$bundleRoot = Join-Path $PSScriptRoot ('transfers/hsk1-workbook-update-' + [guid]::NewGuid().ToString('N'))
$sourcePaths = @(
    'backend/src/questions/question-validation.ts',
    'backend/src/questions/questions.service.ts',
    'backend/src/questions/questions.controller.ts',
    'backend/src/questions/dto/question.dto.ts',
    'backend/src/questions/questions.module.ts',
    'backend/src/roles/content-editor.decorator.ts',
    'backend/src/utils/dto/content-query.dto.ts',
    'backend/src/audit-logs/types/audit-actor.type.ts',
    'fe_admin/dashboard/src/lib/question-editor.ts',
    'fe_admin/dashboard/src/lib/api-types.ts',
    'fe_admin/dashboard/src/lib/error-message.ts',
    'fe_admin/dashboard/src/lib/latest-request.ts',
    'fe_admin/dashboard/src/hooks/useLatestRequest.ts',
    'fe_admin/dashboard/src/constants/hsk.ts',
    'fe_admin/dashboard/src/lib/media-url.ts',
    'fe_admin/dashboard/src/components/questions/QuestionCreateForm.tsx',
    'fe_admin/dashboard/src/components/questions/QuestionList.tsx',
    'fe_admin/dashboard/src/components/questions/QuestionPreview.tsx',
    'fe_admin/dashboard/src/components/questions/AudioClipPlayer.tsx',
    'fe_admin/dashboard/src/app/(admin)/questions/[id]/edit/page.tsx',
    'fe_admin/dashboard/src/components/teachers/TeacherList.tsx',
    'fe_admin/dashboard/src/components/teachers/TeacherStats.tsx',
    'fe_admin/dashboard/src/components/leaderboard/StreakLeaderboard.tsx'
)
New-Item -ItemType Directory -Force -Path $bundleRoot | Out-Null
$utf8 = [System.Text.UTF8Encoding]::new($false)
foreach ($sourcePath in $sourcePaths) {
    $original = Join-Path $taskRoot $sourcePath
    if (-not (Test-Path -LiteralPath $original -PathType Leaf)) { throw "Missing source: $sourcePath" }
    $destination = Join-Path $bundleRoot "workbook-hsk1/source/$sourcePath"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
    Copy-Item -LiteralPath $original -Destination $destination -Force
}
[System.IO.File]::WriteAllText((Join-Path $bundleRoot 'workbook-hsk1/source-files.txt'), ($sourcePaths -join "`n") + "`n", $utf8)
$release = Join-Path $taskRoot 'backend/workbook-hsk1/release'
$destinationRelease = Join-Path $bundleRoot 'workbook-hsk1/release'
New-Item -ItemType Directory -Force -Path "$destinationRelease/assets" | Out-Null
Copy-Item -LiteralPath "$release/questions.json" -Destination "$destinationRelease/questions.json" -Force
Copy-Item -LiteralPath "$release/review.html" -Destination "$destinationRelease/review.html" -Force
$manifest = Get-Content -LiteralPath "$release/questions.json" -Raw -Encoding utf8 | ConvertFrom-Json
foreach ($asset in $manifest.assets) {
    if ($asset.name -notmatch '^hsk1-workbook-[a-f0-9]{12}-[a-zA-Z0-9-]+\.webp$') { throw 'Unsafe asset name.' }
    $original = Join-Path "$release/assets" $asset.name
    $actual = (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $asset.sha256) { throw "Checksum mismatch: $($asset.name)" }
    Copy-Item -LiteralPath $original -Destination "$destinationRelease/assets/$($asset.name)" -Force
}
foreach ($script in @('rebuild-hsk1-workbook.sh', 'rebuild-hsk1-workbook.cjs', 'restore-hsk1-questions.sh', 'HSK1_WORKBOOK.md')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $script) -Destination (Join-Path $bundleRoot $script) -Force
}
# Explicit top-level entries: includes no .env, source database, credentials,
# original 74 MB scan, node_modules, backups, or unrelated question data.
& tar.exe -czf $archivePath -C $bundleRoot -- rebuild-hsk1-workbook.sh rebuild-hsk1-workbook.cjs restore-hsk1-questions.sh HSK1_WORKBOOK.md workbook-hsk1
if ($LASTEXITCODE -ne 0) { throw 'Workbook archive creation failed.' }
Get-Item -LiteralPath $archivePath | Select-Object FullName, Length
Write-Output ('SHA256: ' + (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant())
