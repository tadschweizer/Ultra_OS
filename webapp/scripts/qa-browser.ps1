param(
  [ValidateSet('coach', 'athlete', 'both')][string]$Role = 'both',
  [switch]$Mobile
)
$ErrorActionPreference = 'Stop'
$qaWebapp = Split-Path $PSScriptRoot -Parent
$qaPrivate = Join-Path $qaWebapp '.qa-private'
$qaCredentials = Join-Path $qaPrivate 'accounts.json'
if (!(Test-Path -LiteralPath $qaCredentials)) {
  throw 'QA credentials are missing. Provision an explicitly approved test pair first. See QA_ACCOUNTS.md.'
}
$qaAccounts = Get-Content -LiteralPath $qaCredentials -Raw | ConvertFrom-Json
$qaRoles = if ($Role -eq 'both') { @('coach', 'athlete') } else { @($Role) }
Push-Location $qaWebapp
try {
  foreach ($qaRole in $qaRoles) {
    $qaIdentity = $qaAccounts.$qaRole
    if (!$qaIdentity.email.StartsWith('codex.qa.') -or !$qaIdentity.athleteId) {
      throw 'Only the approved, labeled QA pair can be used by this script.'
    }
    $qaSession = "codex-qa-$qaRole"
    & npx --yes --package=node@22 --package=@playwright/cli playwright-cli "-s=$qaSession" open https://mythreshold.co/login | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not open the QA browser.' }
    $qaViewport = if ($Mobile) { '{width:390,height:844}' } else { '{width:1280,height:900}' }
    $qaCode = @"
async page => {
  await page.context().clearCookies();
  await page.goto('https://mythreshold.co/login');
  await page.evaluate(() => sessionStorage.clear());
  await page.setViewportSize($qaViewport);
  await page.getByRole('textbox', {name:'you@example.com'}).fill($(ConvertTo-Json -Compress $qaIdentity.email));
  await page.getByRole('textbox', {name:'Password',exact:true}).fill($(ConvertTo-Json -Compress $qaIdentity.password));
  await page.getByRole('button', {name:/Log In/}).click();
  await page.waitForURL(url => !url.pathname.includes('login'), {timeout:30000});
  const response = await page.request.get('https://mythreshold.co/api/me');
  const data = await response.json();
  if (!response.ok() || data.athlete?.id !== $(ConvertTo-Json -Compress $qaIdentity.athleteId)
      || data.account?.primary_role !== '$qaRole') throw new Error('QA identity or role verification failed');
  return {role:'$qaRole',verified:true,destination:new URL(page.url()).pathname};
}
"@
    $qaCodeFile = Join-Path $qaPrivate "login-$qaRole.js"
    try {
      Set-Content -LiteralPath $qaCodeFile -Value $qaCode -Encoding utf8
      # Raw mode omits the generated code, which contains the private password.
      $qaResult = & npx --yes --package=node@22 --package=@playwright/cli playwright-cli "-s=$qaSession" --raw run-code --filename $qaCodeFile 2>&1 | Out-String
      $qaExit = $LASTEXITCODE
      Write-Output ($qaResult.Replace($qaIdentity.password, '[REDACTED]'))
      if ($qaExit -ne 0) { throw 'QA login failed. Credentials were not printed.' }
    } finally {
      Remove-Item -LiteralPath $qaCodeFile -ErrorAction SilentlyContinue
    }
    Write-Output "Verified $qaRole in browser session $qaSession."
  }
} finally {
  Pop-Location
}
