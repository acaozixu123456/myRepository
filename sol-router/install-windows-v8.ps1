param(
  [string]$GatewayWss='wss://sol-router-gateway.331004814.workers.dev/agent/connect',
  [string]$AgentId='work-windows-cursor'
)

$ErrorActionPreference='Stop'
$InstallRoot=Join-Path $env:LOCALAPPDATA 'SolRouterGateway'
$AgentHome=Join-Path $HOME '.sol-router-agent'
$TokenFile=Join-Path $AgentHome 'agent-token'
$Release='898a3e86198d830d2910d123765334d038f0eda4'
$AgentUrl="https://raw.githubusercontent.com/acaozixu123456/myRepository/$Release/sol-router/windows-cursor-agent-v8.ps1"
$WorkerUrl="https://raw.githubusercontent.com/acaozixu123456/myRepository/$Release/sol-router/windows-cursor-task-v8.mjs"
$AgentPath=Join-Path $InstallRoot 'windows-cursor-agent-v8.ps1'
$WorkerPath=Join-Path $InstallRoot 'windows-cursor-task-v8.mjs'
$StageAgent="$AgentPath.new"
$StageWorker=Join-Path $InstallRoot 'windows-cursor-task-v8.stage.mjs'
$WorkspaceFile=Join-Path $InstallRoot 'workspaces.json'
$Runner=Join-Path $InstallRoot 'run-agent.ps1'
$LogDir=Join-Path $InstallRoot 'logs'
$OutLog=Join-Path $LogDir 'agent.log'
$Startup=[Environment]::GetFolderPath('Startup')
$StartupCmd=Join-Path $Startup 'SolRouterGatewayAgent.cmd'

function Step([string]$Text){Write-Host "[Sol Router Windows] $Text" -ForegroundColor Cyan}
function EnsureDir([string]$Path){if(-not(Test-Path $Path)){New-Item -ItemType Directory -Force -Path $Path|Out-Null}}
function Assert-PowerShellSyntax([string]$Path){
  $tokens=$null
  $errors=$null
  [void][System.Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$errors)
  if($errors -and $errors.Count -gt 0){
    $detail=($errors|ForEach-Object{('line={0} col={1} {2}' -f $_.Extent.StartLineNumber,$_.Extent.StartColumnNumber,$_.Message)}) -join ' | '
    throw ('PowerShell syntax check failed for {0}: {1}' -f $Path,$detail)
  }
}
function Find-CursorCli{
  foreach($name in @('agent.exe','cursor-agent.exe','agent','cursor-agent')){
    $cmd=Get-Command $name -ErrorAction SilentlyContinue
    if($cmd -and $cmd.Source -and (Test-Path $cmd.Source)){return $cmd.Source}
  }
  $candidates=@(
    (Join-Path $HOME '.local\bin\agent.exe'),
    (Join-Path $HOME '.local\bin\cursor-agent.exe'),
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\current\agent.exe'),
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\current\cursor-agent.exe')
  )
  foreach($candidate in $candidates){if(Test-Path $candidate){return $candidate}}
  return $null
}

Step 'Checking prerequisites without touching the running Agent'
if(-not(Test-Path $TokenFile)){throw 'Windows per-PC credential is missing.'}
$node=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $node){throw 'node.exe not found'}
EnsureDir $InstallRoot
EnsureDir $LogDir

Step 'Downloading v0.8.0 to staging files'
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $AgentUrl -OutFile $StageAgent
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $WorkerUrl -OutFile $StageWorker

Step 'Validating staged files before activation'
Assert-PowerShellSyntax $StageAgent
& $node.Source --check $StageWorker
if($LASTEXITCODE -ne 0){throw 'Node syntax check failed for staged Cursor task worker.'}

$cli=Find-CursorCli
if(-not $cli){
  Step 'Cursor CLI not found; installing the official Windows Cursor CLI'
  Invoke-Expression (Invoke-RestMethod 'https://cursor.com/install?win32=true')
  $cli=Find-CursorCli
}
if(-not $cli){throw 'Cursor CLI is still not available after installation.'}
Step ('Cursor CLI found: {0}' -f $cli)
& $cli --version
if($LASTEXITCODE -ne 0){throw 'Cursor CLI version check failed.'}

$posif='C:\work\dxif-pos'
$solRouter=Join-Path $env:LOCALAPPDATA 'SolRouter\app'
if(-not(Test-Path $posif)){throw ('POSIF workspace path missing: {0}' -f $posif)}
$workspaces=[ordered]@{posif=$posif}
if(Test-Path $solRouter){$workspaces['sol-router']=$solRouter}
$workspaceConfig=@{workspaces=$workspaces}
$workspaceStage="$WorkspaceFile.new"
[IO.File]::WriteAllText($workspaceStage,($workspaceConfig|ConvertTo-Json -Depth 10))

$RunnerText=@"
`$ErrorActionPreference='Continue'
`$created=`$false
`$mutex=[Threading.Mutex]::new(`$true,'SolRouterGatewayRunner-$AgentId',[ref]`$created)
if(-not `$created){exit 0}
`$env:SOL_ROUTER_GATEWAY='$GatewayWss'
`$env:SOL_ROUTER_AGENT_ID='$AgentId'
`$env:CURSOR_AGENT_BIN='$cli'
while(`$true){
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File '$AgentPath' *>> '$OutLog'
  `$code=`$LASTEXITCODE
  Add-Content -Path '$OutLog' -Value "[`$([DateTime]::Now.ToString('HH:mm:ss'))] agent exited code=`$code; supervisor restart in 2s"
  Start-Sleep -Seconds 2
}
"@
$RunnerStage="$Runner.new"
[IO.File]::WriteAllText($RunnerStage,$RunnerText)
Assert-PowerShellSyntax $RunnerStage

Step 'All staged checks passed; switching only the Gateway Agent'
$self=$PID
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue|Where-Object{
  $_.ProcessId -ne $self -and $_.CommandLine -and (
    $_.CommandLine -match 'SolRouterGateway\\run-agent\.ps1' -or
    $_.CommandLine -match 'windows-cursor-agent-v[0-9_]+\.ps1' -or
    $_.CommandLine -match 'windows-cursor-agent-v8\.js'
  )
}|ForEach-Object{Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
Start-Sleep -Milliseconds 600

Move-Item -Force $StageAgent $AgentPath
Move-Item -Force $StageWorker $WorkerPath
Move-Item -Force $workspaceStage $WorkspaceFile
Move-Item -Force $RunnerStage $Runner
$Cmd="@echo off`r`nstart `"Sol Router Gateway Agent`" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$Runner`"`r`n"
[IO.File]::WriteAllText($StartupCmd,$Cmd)

Step 'Starting thin direct-Cursor Gateway Agent v0.8.0'
if(Test-Path $OutLog){Clear-Content $OutLog -ErrorAction SilentlyContinue}
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$Runner)
Start-Sleep -Seconds 3

Step 'v0.8.0 installation finished'
Write-Host ('  agent id: {0}' -f $AgentId)
Write-Host ('  cursor cli: {0}' -f $cli)
Write-Host ('  workspaces: {0}' -f (($workspaces.Keys) -join ', '))
Write-Host ('  startup: {0}' -f $StartupCmd)
Write-Host ('  log: {0}' -f $OutLog)
if(Test-Path $OutLog){Get-Content $OutLog -Tail 20}
