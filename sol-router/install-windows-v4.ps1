param(
  [string]$GatewayHttps = 'https://sol-router-gateway.331004814.workers.dev',
  [string]$GatewayWss = 'wss://sol-router-gateway.331004814.workers.dev/agent/connect',
  [string]$AgentId = 'work-windows-cursor'
)

$ErrorActionPreference = 'Stop'
$InstallRoot = Join-Path $env:LOCALAPPDATA 'SolRouterGateway'
$AgentHome = Join-Path $HOME '.sol-router-agent'
$ExistingRouter = Join-Path $env:LOCALAPPDATA 'SolRouter\app'
$AgentUrl = 'https://raw.githubusercontent.com/acaozixu123456/myRepository/94bf81218c3370ab7b14d3bfa6bed7db04f5fb34/sol-router/windows-cursor-agent.ps1'
$LogDir = Join-Path $InstallRoot 'logs'
$StartupDir = [Environment]::GetFolderPath('Startup')

function Step([string]$Text) { Write-Host "[Sol Router Windows] $Text" -ForegroundColor Cyan }
function EnsureDir([string]$Path) { if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null } }

Step 'Checking existing Cursor SolRouter STDIO MCP'
if (-not (Test-Path $ExistingRouter)) { throw "Existing SolRouter was not found at $ExistingRouter" }
$StdioEntry = Join-Path $ExistingRouter 'mcp\dist\src\stdio.js'
if (-not (Test-Path $StdioEntry)) { throw "Existing SolRouter STDIO entry was not found at $StdioEntry" }
Write-Host "  existing router: $ExistingRouter"
Write-Host "  stdio entry: $StdioEntry"
Write-Host '  transport: STDIO MCP (no localhost HTTP discovery)'
Write-Host '  runtime: existing Node or Cursor Electron-as-Node fallback'

EnsureDir $InstallRoot
EnsureDir $AgentHome
EnsureDir $LogDir

$TokenFile = Join-Path $AgentHome 'agent-token'
if (-not (Test-Path $TokenFile)) {
  throw 'Windows per-PC credential is missing. Pair this PC again with install-windows-v3.ps1 first.'
}
Write-Host '  pairing: existing per-PC credential found'

Step 'Downloading STDIO Windows Cursor adapter'
$AgentPath = Join-Path $InstallRoot 'windows-cursor-agent.ps1'
Invoke-WebRequest -UseBasicParsing -Headers @{ 'Cache-Control'='no-cache' } -Uri $AgentUrl -OutFile $AgentPath

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

Step 'Refreshing login auto-start'
$StartupCmd = Join-Path $StartupDir 'SolRouterGatewayAgent.cmd'
$Cmd = "@echo off`r`nstart `"Sol Router Gateway Agent`" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$Runner`"`r`n"
[IO.File]::WriteAllText($StartupCmd, $Cmd)

Step 'Restarting only the Gateway adapter'
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and ($_.CommandLine.Contains($AgentPath) -or $_.CommandLine.Contains($Runner)) } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 700
if (Test-Path $OutLog) { Clear-Content $OutLog -ErrorAction SilentlyContinue }
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$Runner)
Start-Sleep -Seconds 8

Write-Host ''
Step 'Bootstrap result'
Write-Host "  agent id: $AgentId"
Write-Host "  gateway: $GatewayWss"
Write-Host "  startup: $StartupCmd"
Write-Host "  log: $OutLog"
if (Test-Path $OutLog) {
  Write-Host ''
  Get-Content $OutLog -Tail 50
}
Write-Host ''
Write-Host 'Windows STDIO adapter update finished.' -ForegroundColor Green
