param(
    [string]$VpsHost = '100.104.108.58',
    [string]$VpsUser = 'user'
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$archivePath = Join-Path $taskRoot 'tricehsk-deploy.tar.gz'
$operatorPath = Join-Path $PSScriptRoot 'update-source.sh'
$statusDirectory = Join-Path $PSScriptRoot 'transfers'
$statusPath = Join-Path $statusDirectory 'source-update-status.json'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Write-DeployStatus([string]$Status, [int]$Code = 0) {
    $value = @{ status = $Status; exitCode = $Code; time = (Get-Date).ToString('o') }
    [System.IO.File]::WriteAllText($statusPath, ($value | ConvertTo-Json), $utf8)
}

try {
    if ($VpsHost -notmatch '^[a-zA-Z0-9.-]+$' -or $VpsUser -notmatch '^[a-zA-Z0-9_-]+$') {
        throw 'Invalid SSH host or user.'
    }
    foreach ($sourcePath in @($archivePath, $operatorPath)) {
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "Required deployment file is missing: $sourcePath"
        }
    }
    Get-Command ssh.exe, scp.exe -ErrorAction Stop | Out-Null
    New-Item -ItemType Directory -Force -Path $statusDirectory | Out-Null
    $Host.UI.RawUI.WindowTitle = 'TriceHSK - updating VPS'
    $archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $destination = '{0}@{1}' -f $VpsUser, $VpsHost
    Write-DeployStatus 'uploading'
    Write-Host 'Uploading tested source to VPS. Enter your VPS password here when asked.' -ForegroundColor Cyan
    Write-Host 'Passwords are entered in this terminal only; typed characters will not appear.'
    & scp.exe -o StrictHostKeyChecking=yes -o ConnectTimeout=15 $archivePath $operatorPath ($destination + ':/home/user/')
    if ($LASTEXITCODE -ne 0) { throw "Upload failed (exit $LASTEXITCODE). The VPS application was not updated." }

    Write-DeployStatus 'deploying'
    Write-Host 'Starting update. SSH and sudo may ask for your VPS password again.' -ForegroundColor Cyan
    Write-Host 'Keep this window open. On the 1 CPU VPS, the two builds may take several minutes.'
    $remoteCommand = 'bash /home/user/update-source.sh --archive /home/user/tricehsk-deploy.tar.gz --sha256 ' +
        $archiveHash + ' --project /home/user/trice_hsk'
    & ssh.exe -t -o StrictHostKeyChecking=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=6 $destination $remoteCommand
    $remoteExitCode = $LASTEXITCODE
    if ($remoteExitCode -ne 0) {
        throw "VPS update stopped (exit $remoteExitCode). Read the error and backup path above."
    }
    Write-DeployStatus 'complete'
    $Host.UI.RawUI.WindowTitle = 'TriceHSK - VPS update complete'
    Write-Host 'VPS UPDATED. Refresh https://admin.tricehsk.id.vn using Ctrl+F5.' -ForegroundColor Green
} catch {
    if (Test-Path -LiteralPath $statusDirectory -PathType Container) {
        Write-DeployStatus 'failed' 1
    }
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host 'Keep the error output. Do not delete database or upload volumes.'
    exit 1
}
