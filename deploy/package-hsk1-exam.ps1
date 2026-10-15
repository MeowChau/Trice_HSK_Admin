$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$archive = Join-Path $taskRoot 'tricehsk-hsk1-exam.tar.gz'
$stage = Join-Path $PSScriptRoot ('transfers/hsk1-exam-' + [guid]::NewGuid().ToString('N'))
$utf8 = [System.Text.UTF8Encoding]::new($false)
# Include workbook editor dependencies: the exam update works even if the
# earlier question-bank deployment stopped at checksum/permission preflight.
$sourcePaths = @(
  'backend/src/questions/question-validation.ts', 'backend/src/questions/questions.service.ts',
  'backend/src/questions/questions.controller.ts', 'backend/src/questions/dto/question.dto.ts',
  'backend/src/questions/questions.module.ts', 'backend/src/roles/content-editor.decorator.ts',
  'backend/src/utils/dto/content-query.dto.ts', 'backend/src/utils/dto/question-links.dto.ts',
  'backend/src/audit-logs/types/audit-actor.type.ts',
  'backend/src/exams/exam-view.ts', 'backend/src/exams/dto/exam.dto.ts',
  'backend/src/exams/exams.service.ts', 'backend/src/exams/exams.controller.ts',
  'fe_admin/dashboard/src/lib/question-editor.ts', 'fe_admin/dashboard/src/lib/media-url.ts',
  'fe_admin/dashboard/src/lib/error-message.ts', 'fe_admin/dashboard/src/lib/latest-request.ts',
  'fe_admin/dashboard/src/hooks/useLatestRequest.ts', 'fe_admin/dashboard/src/constants/hsk.ts',
  'fe_admin/dashboard/src/components/questions/QuestionCreateForm.tsx',
  'fe_admin/dashboard/src/components/questions/QuestionList.tsx',
  'fe_admin/dashboard/src/components/questions/QuestionPreview.tsx',
  'fe_admin/dashboard/src/components/questions/AudioClipPlayer.tsx',
  'fe_admin/dashboard/src/app/(admin)/questions/[id]/edit/page.tsx',
  'fe_admin/dashboard/src/components/exams/ExamList.tsx',
  'fe_admin/dashboard/src/components/exams/ExamEditor.tsx',
  'fe_admin/dashboard/src/app/(admin)/exams/[id]/edit/page.tsx'
)
$hashes = @()
foreach ($file in $sourcePaths) {
  $original = Join-Path $taskRoot $file
  $destination = Join-Path $stage "hsk1-exam/source/$file"
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
  Copy-Item -LiteralPath $original -Destination $destination
  $hashes += (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + $file
}
[IO.File]::WriteAllText((Join-Path $stage 'hsk1-exam/source-files.txt'), ($sourcePaths -join "`n") + "`n", $utf8)
[IO.File]::WriteAllText((Join-Path $stage 'hsk1-exam/source-sha256.txt'), ($hashes -join "`n") + "`n", $utf8)
$release = Join-Path $taskRoot 'backend/workbook-hsk1/release'
$data = Get-Content -LiteralPath "$release/questions.json" -Raw -Encoding utf8 | ConvertFrom-Json
$questions = @($data.questions | Where-Object { $_.payload.source.lesson -eq 0 -and $_.payload.source.section -eq 'mock-test' } | Sort-Object { $_.payload.source.item })
if ($questions.Count -ne 40) { throw 'Incomplete mock exam.' }
$names = [Collections.Generic.HashSet[string]]::new()
foreach ($question in $questions) {
  $payload = $question.payload
  foreach ($url in @($payload.imageUrl, $payload.contextImageUrl, $payload.continuationImageUrl, $payload.source.scanUrl) + @($payload.optionImages)) {
    if ($url) {
      if (-not $url.StartsWith('/api/v1/files/')) { throw 'Invalid media path.' }
      [void]$names.Add($url.Substring('/api/v1/files/'.Length))
    }
  }
}
$assets = @($data.assets | Where-Object { $names.Contains($_.name) })
if ($assets.Count -ne $names.Count) { throw 'Missing mock asset.' }
$target = Join-Path $stage 'hsk1-exam/release'
New-Item -ItemType Directory -Force -Path "$target/assets" | Out-Null
foreach ($asset in $assets) {
  $original = Join-Path "$release/assets" $asset.name
  if ((Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asset.sha256) { throw "Asset checksum mismatch: $($asset.name)" }
  Copy-Item -LiteralPath $original -Destination "$target/assets/$($asset.name)"
}
$manifest = [ordered]@{ formatVersion = 1; sourcePdfSha256 = $data.sourcePdfSha256; sourcePdfPages = 139; audioIncluded = $false; answerKeyIncluded = $false; questions = $questions; assets = $assets }
[IO.File]::WriteAllText("$target/questions.json", ($manifest | ConvertTo-Json -Depth 30), $utf8)
foreach ($file in @('replace-hsk1-exam.sh', 'replace-hsk1-exam.cjs', 'HSK1_EXAM.md')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $stage $file) }
& tar.exe -czf $archive -C $stage -- replace-hsk1-exam.sh replace-hsk1-exam.cjs HSK1_EXAM.md hsk1-exam
if ($LASTEXITCODE -ne 0) { throw 'Exam package creation failed.' }
Get-Item -LiteralPath $archive | Select-Object FullName, Length
Write-Output ('SHA256: ' + (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant())
