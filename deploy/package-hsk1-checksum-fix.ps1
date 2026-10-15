$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$archive = Join-Path $taskRoot 'tricehsk-hsk1-checksum-fix.tar.gz'
& tar.exe -czf $archive -C $PSScriptRoot -- repair-workbook-checksum.sh rebuild-hsk1-workbook.sh rebuild-hsk1-workbook.cjs restore-hsk1-questions.sh
if ($LASTEXITCODE -ne 0) { throw 'Could not package the checksum repair.' }
Get-Item -LiteralPath $archive | Select-Object FullName, Length
Write-Output ('SHA256: ' + (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant())
