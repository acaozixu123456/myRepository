param(
  [string]$RepoUrl=$env:SOL_ROUTER_REPO_URL,
  [string]$Branch='sol-router-gateway-v0.1',
  [string]$AgentId='work-windows-cursor'
)

$ErrorActionPreference='Stop'
if([string]::IsNullOrWhiteSpace($RepoUrl)){throw 'SOL_ROUTER_REPO_URL is empty'}

$InstallRoot=Join-Path $env:LOCALAPPDATA 'SolRouterGitAgent'
$RelayDir=Join-Path $InstallRoot 'relay'
$StateDir=Join-Path $InstallRoot 'state'
$LogDir=Join-Path $InstallRoot 'logs'
$LogFile=Join-Path $LogDir 'agent.log'
$AgentPath=Join-Path $InstallRoot 'windows-cursor-git-agent-v2.mjs'
$WorkerPath=Join-Path $InstallRoot 'windows-cursor-git-task-v2.mjs'
$ConfigPath=Join-Path $InstallRoot 'config.json'
$RunnerPath=Join-Path $InstallRoot 'run-git-agent.ps1'
$Startup=[Environment]::GetFolderPath('Startup')
$StartupCmd=Join-Path $Startup 'SolRouterGitAgent.cmd'
$OldStartupCmd=Join-Path $Startup 'SolRouterGatewayAgent.cmd'
$PayloadRelease='368769f8f68ba0b8c65ed46718ea34ad6395adc8'
$AgentUrl="https://raw.githubusercontent.com/acaozixu123456/myRepository/$PayloadRelease/sol-router/windows-cursor-git-agent-v2.mjs"
$WorkerUrl="https://raw.githubusercontent.com/acaozixu123456/myRepository/$PayloadRelease/sol-router/windows-cursor-git-task-v2.mjs"

function Step([string]$Text){Write-Host "[Sol Router Git Agent] $Text" -ForegroundColor Cyan}
function EnsureDir([string]$Path){if(-not(Test-Path $Path)){New-Item -ItemType Directory -Force -Path $Path|Out-Null}}
function Find-CursorCli{
  foreach($candidate in @(
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\agent.ps1'),
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\current\agent.exe'),
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\current\cursor-agent.exe')
  )){if(Test-Path $candidate){return $candidate}}
  foreach($name in @('agent.exe','cursor-agent.exe','agent','cursor-agent')){
    $cmd=Get-Command $name -ErrorAction SilentlyContinue
    if($cmd -and $cmd.Source -and (Test-Path $cmd.Source)){return $cmd.Source}
  }
  return $null
}
function GitCode([string[]]$Args){
  $old=$ErrorActionPreference
  $ErrorActionPreference='Continue'
  try { & git.exe @Args | Out-Host; return [int]$LASTEXITCODE } finally {$ErrorActionPreference=$old}
}
function GitRequired([string[]]$Args){$code=GitCode $Args;if($code -ne 0){throw "git failed exit=$code"}}

Step 'Checking required local files'
$node=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $node){throw 'node.exe not found'}
$git=Get-Command git.exe -ErrorAction SilentlyContinue
if(-not $git){throw 'git.exe not found'}
$cursor=Find-CursorCli
if(-not $cursor){throw 'Cursor CLI file not found'}
$posif='C:\work\dxif-pos'
if(-not(Test-Path $posif)){throw "POSIF workspace path missing: $posif"}
Step ("Cursor CLI: $cursor")

EnsureDir $InstallRoot; EnsureDir $StateDir; EnsureDir $LogDir
$StageAgent=Join-Path $InstallRoot 'windows-cursor-git-agent-v2.stage.mjs'
$StageWorker=Join-Path $InstallRoot 'windows-cursor-git-task-v2.stage.mjs'
Step 'Downloading Git Agent payload'
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $AgentUrl -OutFile $StageAgent
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $WorkerUrl -OutFile $StageWorker
& $node.Source --check $StageAgent
if($LASTEXITCODE -ne 0){throw 'Git Agent syntax check failed'}
& $node.Source --check $StageWorker
if($LASTEXITCODE -ne 0){throw 'Cursor worker syntax check failed'}

Step 'Verifying the already-tested repository URL'
$probe=GitCode @('ls-remote','--exit-code',$RepoUrl,"refs/heads/$Branch")
if($probe -ne 0){throw 'Repository URL cannot read the relay branch'}

Step 'Cloning relay'
if(Test-Path $RelayDir){Remove-Item -Recurse -Force $RelayDir}
GitRequired @('clone','--branch',$Branch,'--single-branch',$RepoUrl,$RelayDir)
GitRequired @('-C',$RelayDir,'config','user.name','sol-router-git-agent')
GitRequired @('-C',$RelayDir,'config','user.email','sol-router-git-agent@users.noreply.github.com')
GitRequired @('-C',$RelayDir,'remote','set-url','origin',$RepoUrl)
$pushProbe=GitCode @('-C',$RelayDir,'push','--dry-run','origin',"HEAD:$Branch")
if($pushProbe -ne 0){throw 'Repository URL can read but cannot write the relay branch'}

$workspaces=[ordered]@{posif=$posif}
$solRouter=Join-Path $env:LOCALAPPDATA 'SolRouter\app'
if(Test-Path $solRouter){$workspaces['sol-router']=$solRouter}
$cfg=[ordered]@{relayDir=$RelayDir;branch=$Branch;agentId=$AgentId;cursorCli=$cursor;workerPath=$WorkerPath;localStateDir=$StateDir;workspaces=$workspaces}
$ConfigStage="$ConfigPath.new"
[IO.File]::WriteAllText($ConfigStage,($cfg|ConvertTo-Json -Depth 20))

$RunnerText=@"
`$ErrorActionPreference='Continue'
`$created=`$false
`$mutex=[Threading.Mutex]::new(`$true,'SolRouterGitAgentRunner',[ref]`$created)
if(-not `$created){exit 0}
while(`$true){
  & '$($node.Source)' '$AgentPath' '$ConfigPath' *>> '$LogFile'
  `$code=`$LASTEXITCODE
  Add-Content -Path '$LogFile' -Value "[`$([DateTime]::Now.ToString('HH:mm:ss'))] git agent exited code=`$code; restarting"
  Start-Sleep -Seconds 2
}
"@
$RunnerStage="$RunnerPath.new"
[IO.File]::WriteAllText($RunnerStage,$RunnerText)
$tokens=$null;$errors=$null
[System.Management.Automation.Language.Parser]::ParseFile($RunnerStage,[ref]$tokens,[ref]$errors)|Out-Null
if($errors.Count -gt 0){throw 'Generated runner syntax invalid'}

Step 'Activating Git-only transport'
$self=$PID
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue|Where-Object{
  $_.ProcessId -ne $self -and $_.CommandLine -and (
    $_.CommandLine -match 'SolRouterGateway\\run-agent\.ps1' -or
    $_.CommandLine -match 'windows-cursor-agent-v[0-9_]+\.ps1' -or
    $_.CommandLine -match 'SolRouterGitAgent\\run-git-agent\.ps1' -or
    $_.CommandLine -match 'windows-cursor-git-agent-v[12]\.mjs'
  )
}|ForEach-Object{Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue}
Start-Sleep -Milliseconds 500
if(Test-Path $OldStartupCmd){Remove-Item -Force $OldStartupCmd}
Move-Item -Force $StageAgent $AgentPath
Move-Item -Force $StageWorker $WorkerPath
Move-Item -Force $ConfigStage $ConfigPath
Move-Item -Force $RunnerStage $RunnerPath
$Cmd="@echo off`r`nstart `"Sol Router Git Agent`" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$RunnerPath`"`r`n"
[IO.File]::WriteAllText($StartupCmd,$Cmd)
if(Test-Path $LogFile){Clear-Content $LogFile -ErrorAction SilentlyContinue}
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$RunnerPath)
Start-Sleep -Seconds 3

Step 'Git-only Windows Agent installation finished'
Write-Host ("  agent id: $AgentId")
Write-Host '  transport: Git polling over the verified HTTPS repository URL'
Write-Host ("  relay: $RelayDir")
Write-Host ("  cursor: $cursor")
Write-Host ("  workspaces: $($workspaces.Keys -join ', ')")
Write-Host ("  startup: $StartupCmd")
Write-Host ("  log: $LogFile")
if(Test-Path $LogFile){Get-Content $LogFile -Tail 20}
