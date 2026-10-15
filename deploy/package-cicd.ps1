$ErrorActionPreference = 'Stop'
$archivePath = Join-Path (Split-Path -Parent $PSScriptRoot) 'tricehsk-cicd-setup.tar.gz'
# Only install tools: never replace the VPS application config or include secrets.
$sourcePaths = @(
    'ci/deploy.py',
    'ci/install.sh',
    'ci/compose.sh',
    'ci/deploy.sh',
    'compose.release.yaml',
    'CI_CD.md'
)
Push-Location -LiteralPath $PSScriptRoot
try {
    foreach ($sourcePath in $sourcePaths) {
        if (-not (Test-Path -LiteralPath $sourcePath)) {
            throw "Missing required tool: $sourcePath"
        }
    }
    $tarArguments = @('-czf', $archivePath, '--') + $sourcePaths
    & tar.exe @tarArguments
    if ($LASTEXITCODE -ne 0) { throw "tar failed with exit code $LASTEXITCODE" }
    $entries = & tar.exe -tzf $archivePath
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the installer archive' }
    if (Compare-Object $sourcePaths $entries) { throw 'Unexpected installer archive contents' }
    Get-Item -LiteralPath $archivePath | Select-Object FullName, Length
}
finally {
    Pop-Location
}
