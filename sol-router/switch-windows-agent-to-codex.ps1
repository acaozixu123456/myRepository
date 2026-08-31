param(
  [string]$Branch = 'sol-router-gateway-v0.1',
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'SolRouterGitAgent')
)

$ErrorActionPreference = 'Stop'
$RelayDir = Join-Path $InstallRoot 'relay'
$TempScript = Join-Path $env:TEMP ("sol-router-rollout-codex-{0}.ps1" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

function Step([string]$Text) {
  Write-Host "[Sol Router bootstrap] $Text" -ForegroundColor Cyan
}

$git = Get-Command git.exe -ErrorAction SilentlyContinue
if (-not $git) { throw 'git.exe not found' }
if (-not (Test-Path $RelayDir)) {
  throw "Existing Sol Router relay checkout not found: $RelayDir"
}

Step 'Fetching latest command branch'
& $git.Source -C $RelayDir fetch origin $Branch
if ($LASTEXITCODE -ne 0) {
  throw "Git fetch failed. Run 'gh auth login' for github.com, then retry."
}

Step 'Loading verified in-repository Codex rollout script'
$lines = & $git.Source -C $RelayDir show "origin/${Branch}:windows-git-agent/rollout-codex.ps1" 2>&1
if ($LASTEXITCODE -ne 0) {
  throw ("Unable to read rollout script from origin/{0}: {1}" -f $Branch, ($lines -join "`n"))
}
[IO.File]::WriteAllText($TempScript, ($lines -join "`r`n"), [Text.UTF8Encoding]::new($false))

Step 'Executing in-place Cursor-to-Codex rollout'
try {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $TempScript -InstallRoot $InstallRoot -Branch $Branch
  if ($LASTEXITCODE -ne 0) { throw "Codex rollout exited with code $LASTEXITCODE" }
}
finally {
  Remove-Item -Force $TempScript -ErrorAction SilentlyContinue
}

Step 'Bootstrap completed'
