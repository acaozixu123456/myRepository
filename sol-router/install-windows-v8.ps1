param(
  [string]$GatewayWss='wss://sol-router-gateway.331004814.workers.dev/agent/connect',
  [string]$AgentId='work-windows-cursor'
)

$ErrorActionPreference='Stop'
$InstallRoot=Join-Path $env:LOCALAPPDATA 'SolRouterGateway'
$ExistingRouter=Join-Path $env:LOCALAPPDATA 'SolRouter\app'
$AgentUrl='https://raw.githubusercontent.com/acaozixu123456/myRepository/e438f0329dd3d18a329a5214871fade106ff6cdf/sol-router/windows-cursor-agent-v8.js'
$AgentPath=Join-Path $InstallRoot 'windows-cursor-agent-v8.js'
$StagedPath=Join-Path $InstallRoot 'windows-cursor-agent-v8.js.new'
$Runner=Join-Path $InstallRoot 'run-agent.ps1'
$LogDir=Join-Path $InstallRoot 'logs'
$OutLog=Join-Path $LogDir 'agent.log'
$Startup=[Environment]::GetFolderPath('Startup')
$StartupCmd=Join-Path $Startup 'SolRouterGatewayAgent.cmd'
$Node=(Get-Command node.exe -ErrorAction Stop).Source

New-Item -ItemType Directory -Force -Path $InstallRoot,$LogDir|Out-Null
Write-Host '[Sol Router Windows] Downloading async Agent v0.8.0'
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $AgentUrl -OutFile $StagedPath
Write-Host '[Sol Router Windows] Validating Node syntax before activation'
& $Node --check $StagedPath
if($LASTEXITCODE -ne 0){throw 'node syntax validation failed'}

Write-Host '[Sol Router Windows] Stopping old Gateway supervisor/agent only'
$self=$PID
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue|Where-Object{
  $_.ProcessId -ne $self -and $_.CommandLine -and (
    $_.CommandLine -match 'SolRouterGateway\\run-agent\.ps1' -or
    $_.CommandLine -match 'windows-cursor-agent-v[567]' -or
    $_.CommandLine -match 'windows-cursor-agent-v8\.js'
  )
}|ForEach-Object{Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
Start-Sleep -Milliseconds 500

Move-Item -Force $StagedPath $AgentPath
$RunnerText=@"
`$ErrorActionPreference='Continue'
`$env:SOL_ROUTER_GATEWAY='$GatewayWss'
`$env:SOL_ROUTER_AGENT_ID='$AgentId'
`$env:SOL_ROUTER_CURSOR_APP='$ExistingRouter'
while(`$true){
  & '$Node' '$AgentPath' *>> '$OutLog'
  Add-Content -Path '$OutLog' -Value ('['+[DateTime]::Now.ToString('HH:mm:ss')+'] agent exited; supervisor restart in 2s')
  Start-Sleep -Seconds 2
}
"@
[IO.File]::WriteAllText($Runner,$RunnerText)
$Cmd='@echo off'+"`r`n"+'start "Sol Router Gateway Agent" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "'+$Runner+'"'+"`r`n"
[IO.File]::WriteAllText($StartupCmd,$Cmd)

Write-Host '[Sol Router Windows] Starting async Gateway Agent v0.8.0'
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$Runner)
Start-Sleep -Seconds 2
Write-Host '[Sol Router Windows] v0.8.0 activation requested'
Write-Host ('  agent: '+$AgentPath)
Write-Host ('  log: '+$OutLog)
if(Test-Path $OutLog){Get-Content $OutLog -Tail 20}
