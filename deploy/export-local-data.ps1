param([string]$Container = 'backend-postgres-1')
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$transferStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$transferDir = Join-Path $PSScriptRoot "transfers/local-data-$transferStamp"
$dumpInContainer = '/tmp/tricehsk-export-' + [guid]::NewGuid().ToString('N') + '.dump'

$inspection = docker inspect $Container | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $inspection.Count -ne 1) { throw 'Cannot inspect source PostgreSQL container.' }
if (-not $inspection[0].State.Running) { throw 'Start the source PostgreSQL container before exporting.' }
$databaseUser = ($inspection[0].Config.Env | Where-Object { $_ -like 'POSTGRES_USER=*' }) -replace '^POSTGRES_USER=', ''
$databaseName = ($inspection[0].Config.Env | Where-Object { $_ -like 'POSTGRES_DB=*' }) -replace '^POSTGRES_DB=', ''
if (-not $databaseUser -or -not $databaseName) { throw 'Source database name/user missing.' }

New-Item -ItemType Directory -Path $transferDir | Out-Null
try {
    # Write binary data inside the container; PowerShell 5 text redirection corrupts dumps.
    docker exec $Container pg_dump -U $databaseUser -d $databaseName --format=custom --no-owner --no-acl --file=$dumpInContainer
    if ($LASTEXITCODE -ne 0) { throw 'Database export failed.' }
    $databaseDump = Join-Path $transferDir 'database.dump'
    docker cp "${Container}:$dumpInContainer" $databaseDump
    if ($LASTEXITCODE -ne 0) { throw 'Cannot copy database dump.' }
    $uploadsDir = Join-Path $taskRoot 'backend/files'
    if (-not (Test-Path -LiteralPath $uploadsDir -PathType Container)) { throw 'Local upload directory missing.' }
    $uploadsArchive = Join-Path $transferDir 'uploads.tar.gz'
    tar.exe -czf $uploadsArchive -C $uploadsDir .
    if ($LASTEXITCODE -ne 0) { throw 'Upload archive failed.' }
    $manifest = @{
        formatVersion = 1
        createdAt = (Get-Date).ToUniversalTime().ToString('o')
        sourceContainer = $Container
        sourceDatabase = $databaseName
        uploadsFileCount = @(Get-ChildItem -LiteralPath $uploadsDir -File -Recurse).Count
        databaseSha256 = (Get-FileHash -LiteralPath $databaseDump -Algorithm SHA256).Hash.ToLowerInvariant()
        uploadsSha256 = (Get-FileHash -LiteralPath $uploadsArchive -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    [IO.File]::WriteAllText((Join-Path $transferDir 'manifest.json'), ($manifest | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    $transferArchive = "$transferDir.tar.gz"
    tar.exe -czf $transferArchive -C $transferDir database.dump uploads.tar.gz manifest.json
    if ($LASTEXITCODE -ne 0) { throw 'Transfer archive failed.' }
    Get-Item -LiteralPath $transferArchive | Select-Object FullName, Length
}
finally {
    # Only remove the single temporary dump created above inside the Linux container.
    docker exec $Container rm -f -- $dumpInContainer
}
