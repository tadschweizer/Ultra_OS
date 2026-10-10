$ErrorActionPreference = 'Stop'
$taskRepoRoot = (git -C $PSScriptRoot rev-parse --show-toplevel)
if ($LASTEXITCODE -ne 0) { throw 'Run from the reviewed repository checkout.' }
$taskFixtureRoot = Join-Path $env:TEMP ('threshold-main-gap-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $taskFixtureRoot | Out-Null
foreach ($taskFile in @('gap-reproduction.test.mjs', 'fixture-store.mjs', 'isolation-loader.mjs')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $taskFile) -Destination $taskFixtureRoot
}
$taskArchive = Join-Path $taskFixtureRoot 'main.zip'
git -C $taskRepoRoot archive --format=zip --output=$taskArchive fa8ebe2b377784007b4a40b4e982f92a11224075
if ($LASTEXITCODE -ne 0) { throw 'Baseline archive failed; fetch this exact revision first.' }
Expand-Archive -LiteralPath $taskArchive -DestinationPath (Join-Path $taskFixtureRoot 'source')
Push-Location -LiteralPath $taskFixtureRoot
try {
  $env:TZ = 'UTC'
  node --import ./isolation-loader.mjs --test gap-reproduction.test.mjs *> test-output.txt
  if ($LASTEXITCODE -ne 0) { throw 'Baseline reproduction failed; inspect local output.' }
} finally { Pop-Location }
Write-Output "Baseline reproduction and synthetic results: $taskFixtureRoot"
