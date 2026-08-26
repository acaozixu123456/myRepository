param(
  [string]$GatewayWss = 'wss://sol-router-gateway.331004814.workers.dev/agent/connect',
  [string]$AgentId = 'work-windows-cursor'
)

$ErrorActionPreference='Stop'
$InstallRoot=Join-Path $env:LOCALAPPDATA 'SolRouterGateway'
$AgentHome=Join-Path $HOME '.sol-router-agent'
$TokenFile=Join-Path $AgentHome 'agent-token'
$ExistingRouter=Join-Path $env:LOCALAPPDATA 'SolRouter\app'
$AgentUrl='https://raw.githubusercontent.com/acaozixu123456/myRepository/6f6aff567a8a0369b02fa99c7a502bfeb3de40c6/sol-router/windows-cursor-agent-v6.ps1'
$AgentPath=Join-Path $InstallRoot 'windows-cursor-agent-v6.ps1'
$Runner=Join-Path $InstallRoot 'run-agent.ps1'
$LogDir=Join-Path $InstallRoot 'logs'
$OutLog=Join-Path $LogDir 'agent.log'
$Startup=[Environment]::GetFolderPath('Startup')
$StartupCmd=Join-Path $Startup 'SolRouterGatewayAgent.cmd'

function Step([string]$t){Write-Host "[Sol Router Windows] $t" -ForegroundColor Cyan}
function EnsureDir([string]$p){if(-not(Test-Path $p)){New-Item -ItemType Directory -Force -Path $p|Out-Null}}

Step 'Checking existing SolRouter STDIO MCP'
$stdio=Join-Path $ExistingRouter 'mcp\dist\src\stdio.js'
$config=Join-Path $ExistingRouter 'mcp\config\config.json'
if(-not(Test-Path $stdio)){throw "STDIO entry missing: $stdio"}
if(-not(Test-Path $config)){throw "SolRouter config missing: $config"}
if(-not(Test-Path $TokenFile)){throw 'Windows per-PC credential is missing; pair this PC first.'}
$node=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $node){throw 'node.exe not found; existing SolRouter declares Node >=22.'}

EnsureDir $InstallRoot;EnsureDir $LogDir
Step 'Downloading Windows Cursor Agent v0.6.0'
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $AgentUrl -OutFile $AgentPath

$env:SOL_ROUTER_GATEWAY=$GatewayWss
$env:SOL_ROUTER_AGENT_ID=$AgentId
$env:SOL_ROUTER_CURSOR_APP=$ExistingRouter
Step 'Running local MCP self-test'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $AgentPath -SelfTest
if($LASTEXITCODE -ne 0){throw "STDIO self-test failed with exit code $LASTEXITCODE"}

$RunnerText=@"
`$ErrorActionPreference='Stop'
`$env:SOL_ROUTER_GATEWAY='$GatewayWss'
`$env:SOL_ROUTER_AGENT_ID='$AgentId'
`$env:SOL_ROUTER_CURSOR_APP='$ExistingRouter'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File '$AgentPath' *>> '$OutLog'
"@
[IO.File]::WriteAllText($Runner,$RunnerText)
$Cmd="@echo off`r`nstart `"Sol Router Gateway Agent`" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$Runner`"`r`n"
[IO.File]::WriteAllText($StartupCmd,$Cmd)

Step 'Restarting Gateway Agent only'
$selfPid=$PID
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object {
    $_.ProcessId -ne $selfPid -and $_.CommandLine -and (
      $_.CommandLine.Contains('windows-cursor-agent-v5.ps1') -or
      $_.CommandLine.Contains('windows-cursor-agent-v6.ps1') -or
      $_.CommandLine.Contains($Runner)
    )
  } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 900
if(Test-Path $OutLog){Clear-Content $OutLog -ErrorAction SilentlyContinue}
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$Runner)
Start-Sleep -Seconds 4

Step 'v0.6.0 installation finished'
Write-Host "  agent id: $AgentId"
Write-Host "  agent: $AgentPath"
Write-Host "  runner: $Runner"
Write-Host "  startup: $StartupCmd"
Write-Host "  log: $OutLog"
if(Test-Path $OutLog){Get-Content $OutLog -Tail 40}
