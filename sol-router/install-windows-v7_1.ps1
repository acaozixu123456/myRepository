param(
  [string]$GatewayWss='wss://sol-router-gateway.331004814.workers.dev/agent/connect',
  [string]$AgentId='work-windows-cursor'
)

$ErrorActionPreference='Stop'
$InstallRoot=Join-Path $env:LOCALAPPDATA 'SolRouterGateway'
$AgentHome=Join-Path $HOME '.sol-router-agent'
$TokenFile=Join-Path $AgentHome 'agent-token'
$ExistingRouter=Join-Path $env:LOCALAPPDATA 'SolRouter\app'
$AgentPath=Join-Path $InstallRoot 'windows-cursor-agent-v7_1.ps1'
$HelperPath=Join-Path $InstallRoot 'windows-cursor-mcp-helper-v7_1.ps1'
$Runner=Join-Path $InstallRoot 'run-agent.ps1'
$LogDir=Join-Path $InstallRoot 'logs'
$OutLog=Join-Path $LogDir 'agent.log'
$Startup=[Environment]::GetFolderPath('Startup')
$StartupCmd=Join-Path $Startup 'SolRouterGatewayAgent.cmd'
$AgentNew="$AgentPath.new"
$HelperNew="$HelperPath.new"
$RunnerNew="$Runner.new"

$AgentUrl='https://raw.githubusercontent.com/acaozixu123456/myRepository/13315bdd5333eb7bb30fb62512e8de6174bde840/sol-router/windows-cursor-agent-v7_1.ps1'
$HelperUrl='https://raw.githubusercontent.com/acaozixu123456/myRepository/43567f56121f3483ed2072c5fdb9228faa84b8d8/sol-router/windows-cursor-mcp-helper-v7_1.ps1'

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

Step 'Checking prerequisites'
$stdio=Join-Path $ExistingRouter 'mcp\dist\src\stdio.js'
$config=Join-Path $ExistingRouter 'mcp\config\config.json'
if(-not(Test-Path $stdio)){throw ('STDIO entry missing: {0}' -f $stdio)}
if(-not(Test-Path $config)){throw ('SolRouter config missing: {0}' -f $config)}
if(-not(Test-Path $TokenFile)){throw 'Windows per-PC credential is missing.'}
$node=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $node){throw 'node.exe not found'}
EnsureDir $InstallRoot
EnsureDir $LogDir

Step 'Downloading v0.7.1 to staging files'
Remove-Item $AgentNew,$HelperNew,$RunnerNew -Force -ErrorAction SilentlyContinue
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $AgentUrl -OutFile $AgentNew
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $HelperUrl -OutFile $HelperNew

Step 'Validating staged PowerShell files'
Assert-PowerShellSyntax $AgentNew
Assert-PowerShellSyntax $HelperNew

$RunnerText=@"
`$ErrorActionPreference='Continue'
`$created=`$false
`$mutex=[Threading.Mutex]::new(`$true,'SolRouterGatewayRunner-$AgentId',[ref]`$created)
if(-not `$created){exit 0}
`$env:SOL_ROUTER_GATEWAY='$GatewayWss'
`$env:SOL_ROUTER_AGENT_ID='$AgentId'
`$env:SOL_ROUTER_CURSOR_APP='$ExistingRouter'
while(`$true){
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File '$AgentPath' *>> '$OutLog'
  `$code=`$LASTEXITCODE
  Add-Content -Path '$OutLog' -Value ('[{0}] agent exited code={1}; supervisor restart in 2s' -f [DateTime]::Now.ToString('HH:mm:ss'),`$code)
  Start-Sleep -Seconds 2
}
"@
[IO.File]::WriteAllText($RunnerNew,$RunnerText)
Assert-PowerShellSyntax $RunnerNew

Step 'Staged files passed syntax validation'
Step 'Disabling legacy Local MCP auto-start'
try{Disable-ScheduledTask -TaskName 'Sol Router Secure Tunnel' -ErrorAction SilentlyContinue|Out-Null}catch{}

Step 'Stopping old Gateway and legacy processes'
$self=$PID
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue|Where-Object{
  $_.ProcessId -ne $self -and $_.CommandLine -and (
    $_.CommandLine -match 'windows-cursor-agent-v[567](?:_1)?\.ps1' -or
    $_.CommandLine -match 'SolRouterGateway\\run-agent\.ps1' -or
    $_.CommandLine -match 'Start-SecureTunnel' -or
    $_.CommandLine -match 'Start-SolRouterMcp' -or
    ($_.Name -eq 'tunnel-client.exe' -and $_.CommandLine -match 'sol-router-local') -or
    ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'SolRouter\\app\\mcp\\dist\\src\\stdio\.js')
  )
}|ForEach-Object{Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
Start-Sleep -Seconds 2

Step 'Activating validated v0.7.1 files'
Move-Item -Force $AgentNew $AgentPath
Move-Item -Force $HelperNew $HelperPath
Move-Item -Force $RunnerNew $Runner

$Cmd="@echo off`r`nstart `"Sol Router Gateway Agent`" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$Runner`"`r`n"
[IO.File]::WriteAllText($StartupCmd,$Cmd)

Step 'Starting Gateway supervisor'
if(Test-Path $OutLog){Clear-Content $OutLog -ErrorAction SilentlyContinue}
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$Runner)
Start-Sleep -Seconds 4

Step 'v0.7.1 installation finished'
Write-Host ('  agent id: {0}' -f $AgentId)
Write-Host ('  agent: {0}' -f $AgentPath)
Write-Host ('  helper: {0}' -f $HelperPath)
Write-Host ('  runner: {0}' -f $Runner)
Write-Host ('  startup: {0}' -f $StartupCmd)
Write-Host ('  log: {0}' -f $OutLog)
if(Test-Path $OutLog){Get-Content $OutLog -Tail 30}
