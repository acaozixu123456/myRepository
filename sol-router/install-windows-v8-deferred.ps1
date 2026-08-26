param(
  [int]$DelaySeconds = 8
)

$ErrorActionPreference = 'Stop'
$InstallRoot = Join-Path $env:LOCALAPPDATA 'SolRouterGateway'
$ActivationPath = Join-Path $InstallRoot 'activate-v8-deferred.ps1'
$ActivationLog = Join-Path $InstallRoot 'activate-v8-deferred.log'
$InstallerUrl = 'https://raw.githubusercontent.com/acaozixu123456/myRepository/sol-router-agent-dist/sol-router/install-windows-v8.ps1'

if (-not (Test-Path $InstallRoot)) {
  New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
}

$activation = @"
`$ErrorActionPreference = 'Stop'
Start-Sleep -Seconds $DelaySeconds
try {
  Add-Content -Path '$ActivationLog' -Value "[`$([DateTime]::Now.ToString('s'))] deferred v0.8.0 activation starting"
  `$installer = (Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri '$InstallerUrl').Content
  Invoke-Expression `$installer
  Add-Content -Path '$ActivationLog' -Value "[`$([DateTime]::Now.ToString('s'))] deferred v0.8.0 activation finished"
} catch {
  Add-Content -Path '$ActivationLog' -Value "[`$([DateTime]::Now.ToString('s'))] deferred v0.8.0 activation failed: `$(`$_.Exception.Message)"
  exit 1
}
"@

[IO.File]::WriteAllText($ActivationPath, $activation)
$tokens = $null
$errors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile($ActivationPath, [ref]$tokens, [ref]$errors)
if ($errors -and $errors.Count -gt 0) {
  throw ('Deferred activation syntax check failed: ' + (($errors | ForEach-Object { $_.Message }) -join ' | '))
}

Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', $ActivationPath
) | Out-Null

Write-Output ('gateway-v8-upgrade-scheduled delay_seconds={0} activation={1} log={2}' -f $DelaySeconds, $ActivationPath, $ActivationLog)
