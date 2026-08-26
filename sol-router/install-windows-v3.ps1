param(
  [string]$GatewayHttps = 'https://sol-router-gateway.331004814.workers.dev',
  [string]$GatewayWss = 'wss://sol-router-gateway.331004814.workers.dev/agent/connect',
  [string]$AgentId = 'work-windows-cursor',
  [switch]$ForcePair
)

$ErrorActionPreference = 'Stop'
$InstallRoot = Join-Path $env:LOCALAPPDATA 'SolRouterGateway'
$AgentHome = Join-Path $HOME '.sol-router-agent'
$ExistingRouter = Join-Path $env:LOCALAPPDATA 'SolRouter\app'
$AgentUrl = 'https://raw.githubusercontent.com/acaozixu123456/myRepository/d47758a530b5a122ebe67c639533ceb3fa1fa0e7/sol-router/windows-cursor-agent.ps1'
$LogDir = Join-Path $InstallRoot 'logs'
$StartupDir = [Environment]::GetFolderPath('Startup')

function Step([string]$Text) { Write-Host "[Sol Router Windows] $Text" -ForegroundColor Cyan }
function EnsureDir([string]$Path) { if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null } }

Step 'Checking existing Cursor SolRouter'
if (-not (Test-Path $ExistingRouter)) { throw "Existing SolRouter was not found at $ExistingRouter" }
Write-Host "  existing router: $ExistingRouter"
Write-Host '  runtime: Windows PowerShell + .NET (no Python/Node install required)'

EnsureDir $InstallRoot
EnsureDir $AgentHome
EnsureDir $LogDir

Step 'Downloading pure PowerShell Windows Cursor adapter'
$AgentPath = Join-Path $InstallRoot 'windows-cursor-agent.ps1'
Invoke-WebRequest -UseBasicParsing -Headers @{ 'Cache-Control'='no-cache' } -Uri $AgentUrl -OutFile $AgentPath

$TokenFile = Join-Path $AgentHome 'agent-token'
if ($ForcePair -and (Test-Path $TokenFile)) { Remove-Item -Force $TokenFile }
if (-not (Test-Path $TokenFile)) {
  Write-Host ''
  Write-Host 'One-time pairing required.' -ForegroundColor Yellow
  Write-Host 'Ask ChatGPT Sol Router for a Windows Pair Code, then paste the 8-character code below.' -ForegroundColor Yellow
  $PairCode = if ($env:SOL_ROUTER_PAIR_CODE) { $env:SOL_ROUTER_PAIR_CODE.Trim().ToUpperInvariant() } else { (Read-Host 'PAIR_CODE').Trim().ToUpperInvariant() }
  if ($PairCode -notmatch '^[A-Z2-9]{8}$') { throw 'PAIR_CODE must be exactly 8 characters (A-Z, 2-9).' }

  Step 'Exchanging one-time Pair Code for this PC credential'
  $pairBody = @{ agent_id=$AgentId; code=$PairCode } | ConvertTo-Json -Compress
  try {
    $pair = Invoke-RestMethod -Method Post -Uri ($GatewayHttps.TrimEnd('/') + '/agent/pair') -ContentType 'application/json' -Body $pairBody -TimeoutSec 20
  } catch {
    $detail = $_.ErrorDetails.Message
    if (-not $detail) { $detail = $_.Exception.Message }
    throw "Pairing failed: $detail"
  }
  if (-not $pair.ok -or -not $pair.agent_token) { throw 'Pairing response did not contain an agent credential.' }
  [IO.File]::WriteAllText($TokenFile, [string]$pair.agent_token)
  try {
    $acl = Get-Acl $TokenFile
    $acl.SetAccessRuleProtection($true,$false)
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($env:USERNAME,'FullControl','Allow')
    $acl.SetAccessRule($rule)
    Set-Acl -Path $TokenFile -AclObject $acl
  } catch {}
  $PairCode = $null
  $pair = $null
  Write-Host '  pairing: successful (one-time code consumed)' -ForegroundColor Green
} else {
  Write-Host '  pairing: existing per-PC credential found'
}

$Runner = Join-Path $InstallRoot 'run-agent.ps1'
$OutLog = Join-Path $LogDir 'agent.log'
$RunnerText = @"
`$ErrorActionPreference = 'Stop'
`$env:SOL_ROUTER_GATEWAY = '$GatewayWss'
`$env:SOL_ROUTER_AGENT_ID = '$AgentId'
`$env:SOL_ROUTER_CURSOR_APP = '$ExistingRouter'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File '$AgentPath' *>> '$OutLog'
"@
[IO.File]::WriteAllText($Runner, $RunnerText)

Step 'Enabling login auto-start'
$StartupCmd = Join-Path $StartupDir 'SolRouterGatewayAgent.cmd'
$Cmd = "@echo off`r`nstart `"Sol Router Gateway Agent`" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$Runner`"`r`n"
[IO.File]::WriteAllText($StartupCmd, $Cmd)

Step 'Restarting only the Gateway adapter (existing SolRouter is untouched)'
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine.Contains($AgentPath) } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 500
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$Runner)
Start-Sleep -Seconds 7

Write-Host ''
Step 'Bootstrap result'
Write-Host "  agent id: $AgentId"
Write-Host "  gateway: $GatewayWss"
Write-Host "  existing SolRouter: $ExistingRouter"
Write-Host "  startup: $StartupCmd"
Write-Host "  log: $OutLog"
if (Test-Path $OutLog) {
  Write-Host ''
  Get-Content $OutLog -Tail 35
}
Write-Host ''
Write-Host 'Windows adapter installation finished.' -ForegroundColor Green
