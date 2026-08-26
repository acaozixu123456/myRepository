param(
  [string]$Gateway = 'wss://sol-router-gateway.331004814.workers.dev/agent/connect',
  [string]$AgentId = 'work-windows-cursor'
)

$ErrorActionPreference = 'Stop'
$InstallRoot = Join-Path $env:LOCALAPPDATA 'SolRouterGateway'
$AgentHome = Join-Path $HOME '.sol-router-agent'
$ExistingRouter = Join-Path $env:LOCALAPPDATA 'SolRouter\app'
$AgentUrl = 'https://raw.githubusercontent.com/acaozixu123456/myRepository/sol-router-agent-dist/sol-router/windows-cursor-agent.ps1'
$LogDir = Join-Path $InstallRoot 'logs'
$StartupDir = [Environment]::GetFolderPath('Startup')

function Step([string]$Text) { Write-Host "[Sol Router Windows] $Text" -ForegroundColor Cyan }
function EnsureDir([string]$Path) { if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null } }

Step 'Checking existing Cursor SolRouter'
if (-not (Test-Path $ExistingRouter)) { throw "Existing SolRouter was not found at $ExistingRouter" }
Write-Host "  existing router: $ExistingRouter"
Write-Host "  runtime: Windows PowerShell + .NET (no Python/Node install required)"

EnsureDir $InstallRoot
EnsureDir $AgentHome
EnsureDir $LogDir

Step 'Downloading pure PowerShell Windows Cursor adapter'
$AgentPath = Join-Path $InstallRoot 'windows-cursor-agent.ps1'
Invoke-WebRequest -UseBasicParsing -Uri $AgentUrl -OutFile $AgentPath

$TokenFile = Join-Path $AgentHome 'agent-token'
if (-not (Test-Path $TokenFile)) {
  Write-Host ''
  Write-Host 'One-time pairing: paste the Cloudflare AGENT_TOKEN used by Sol Router Gateway.' -ForegroundColor Yellow
  Write-Host 'It will be saved only on this PC at ~/.sol-router-agent/agent-token.' -ForegroundColor Yellow
  $Secure = Read-Host 'AGENT_TOKEN' -AsSecureString
  $Ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try { $Plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Ptr) }
  if (-not $Plain) { throw 'AGENT_TOKEN is required.' }
  [IO.File]::WriteAllText($TokenFile, $Plain.Trim())
  $Plain = $null
}

$Runner = Join-Path $InstallRoot 'run-agent.ps1'
$OutLog = Join-Path $LogDir 'agent.log'
$RunnerText = @"
`$ErrorActionPreference = 'Stop'
`$env:SOL_ROUTER_GATEWAY = '$Gateway'
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
Start-Sleep -Seconds 6

Write-Host ''
Step 'Bootstrap result'
Write-Host "  agent id: $AgentId"
Write-Host "  gateway: $Gateway"
Write-Host "  existing SolRouter: $ExistingRouter"
Write-Host "  startup: $StartupCmd"
Write-Host "  log: $OutLog"
if (Test-Path $OutLog) {
  Write-Host ''
  Get-Content $OutLog -Tail 30
}
Write-Host ''
Write-Host 'Windows adapter installation finished.' -ForegroundColor Green
