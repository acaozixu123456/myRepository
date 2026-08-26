param(
  [string]$GatewayWss='wss://sol-router-gateway.331004814.workers.dev/agent/connect',
  [string]$AgentId='work-windows-cursor'
)

$ErrorActionPreference='Stop'
$InstallRoot=Join-Path $env:LOCALAPPDATA 'SolRouterGateway'
$AgentHome=Join-Path $HOME '.sol-router-agent'
$TokenFile=Join-Path $AgentHome 'agent-token'
$ExistingRouter=Join-Path $env:LOCALAPPDATA 'SolRouter\app'
$AgentUrl='https://raw.githubusercontent.com/acaozixu123456/myRepository/f41fbd2f4420e0bfd7583cdb1c05700d513ac50a/sol-router/windows-cursor-agent-v7.ps1'
$HelperUrl='https://raw.githubusercontent.com/acaozixu123456/myRepository/ccc602ce14234ef12075962e5335f66a9a6124ae/sol-router/windows-cursor-mcp-helper-v7.ps1'
$AgentPath=Join-Path $InstallRoot 'windows-cursor-agent-v7.ps1'
$HelperPath=Join-Path $InstallRoot 'windows-cursor-mcp-helper-v7.ps1'
$Runner=Join-Path $InstallRoot 'run-agent.ps1'
$LogDir=Join-Path $InstallRoot 'logs'
$OutLog=Join-Path $LogDir 'agent.log'
$Startup=[Environment]::GetFolderPath('Startup')
$StartupCmd=Join-Path $Startup 'SolRouterGatewayAgent.cmd'

function Step([string]$t){Write-Host "[Sol Router Windows] $t" -ForegroundColor Cyan}
function EnsureDir([string]$p){if(-not(Test-Path $p)){New-Item -ItemType Directory -Force -Path $p|Out-Null}}
function Assert-PowerShellSyntax([string]$Path){
  $tokens=$null;$errors=$null
  [void][System.Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$errors)
  if($errors -and $errors.Count -gt 0){
    $detail=($errors|ForEach-Object{('line={0} col={1} {2}' -f $_.Extent.StartLineNumber,$_.Extent.StartColumnNumber,$_.Message)}) -join ' | '
    throw ('PowerShell syntax check failed for {0}: {1}' -f $Path,$detail)
  }
}

Step 'Checking prerequisites'
$stdio=Join-Path $ExistingRouter 'mcp\dist\src\stdio.js';$config=Join-Path $ExistingRouter 'mcp\config\config.json'
if(-not(Test-Path $stdio)){throw "STDIO entry missing: $stdio"}
if(-not(Test-Path $config)){throw "SolRouter config missing: $config"}
if(-not(Test-Path $TokenFile)){throw 'Windows per-PC credential is missing.'}
$node=Get-Command node.exe -ErrorAction SilentlyContinue;if(-not $node){throw 'node.exe not found'}
EnsureDir $InstallRoot;EnsureDir $LogDir

Step 'Disabling legacy Local MCP auto-start'
try{Disable-ScheduledTask -TaskName 'Sol Router Secure Tunnel' -ErrorAction SilentlyContinue|Out-Null}catch{}

Step 'Stopping legacy/local and old Gateway processes'
$self=$PID
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue|Where-Object{
  $_.ProcessId -ne $self -and $_.CommandLine -and (
    $_.CommandLine -match 'windows-cursor-agent-v[567]\.ps1' -or
    $_.CommandLine -match 'SolRouterGateway\\run-agent\.ps1' -or
    $_.CommandLine -match 'Start-SecureTunnel' -or
    $_.CommandLine -match 'Start-SolRouterMcp' -or
    ($_.Name -eq 'tunnel-client.exe' -and $_.CommandLine -match 'sol-router-local') -or
    ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'SolRouter\\app\\mcp\\dist\\src\\stdio\.js')
  )
}|ForEach-Object{Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
Start-Sleep -Seconds 1

Step 'Downloading resilient Agent v0.7.1'
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $AgentUrl -OutFile $AgentPath
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $HelperUrl -OutFile $HelperPath

Step 'Validating PowerShell syntax before launch'
Assert-PowerShellSyntax $AgentPath
Assert-PowerShellSyntax $HelperPath

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
  Add-Content -Path '$OutLog' -Value "[`$([DateTime]::Now.ToString('HH:mm:ss'))] agent exited code=`$code; supervisor restart in 2s"
  Start-Sleep -Seconds 2
}
"@
[IO.File]::WriteAllText($Runner,$RunnerText)
Assert-PowerShellSyntax $Runner
$Cmd="@echo off`r`nstart `"Sol Router Gateway Agent`" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$Runner`"`r`n"
[IO.File]::WriteAllText($StartupCmd,$Cmd)

Step 'Starting Gateway supervisor'
if(Test-Path $OutLog){Clear-Content $OutLog -ErrorAction SilentlyContinue}
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$Runner)
Start-Sleep -Seconds 3

Step 'v0.7.1 installation finished'
Write-Host "  agent id: $AgentId"
Write-Host "  agent: $AgentPath"
Write-Host "  helper: $HelperPath"
Write-Host "  runner: $Runner"
Write-Host "  startup: $StartupCmd"
Write-Host "  log: $OutLog"
if(Test-Path $OutLog){Get-Content $OutLog -Tail 30}
