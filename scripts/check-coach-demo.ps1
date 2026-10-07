$ErrorActionPreference = 'Stop'
$taskNodeDir = 'C:\Users\BAS\AppData\Local\npm-cache\_npx\4bb4bc87b1b72b6c\node_modules\node\bin'
if (Test-Path -LiteralPath $taskNodeDir) { $env:PATH = $taskNodeDir + ';' + $env:PATH }
$taskCode = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'coach-demo-browser-check.js') -Raw
$taskCli = Get-Item -LiteralPath (Join-Path $env:LOCALAPPDATA 'npm-cache/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js') -ErrorAction SilentlyContinue
if (-not $taskCli) { throw 'First run: npx --yes --package @playwright/cli playwright-cli --help' }
# Invoke Node directly so Windows cmd.exe does not impose its smaller argument limit.
node $taskCli.FullName -s=coach-demo run-code $taskCode
exit $LASTEXITCODE
