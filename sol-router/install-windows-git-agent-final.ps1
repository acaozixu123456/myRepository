param(
  [string]$RepoUrl='https://github.com/acaozixu123456/sol-luna-accelerator.git',
  [string]$Branch='sol-router-gateway-v0.1',
  [string]$AgentId='work-windows-cursor'
)

$ErrorActionPreference='Stop'
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
$GhVersion='2.98.0'
$GhZipUrl="https://github.com/cli/cli/releases/download/v$GhVersion/gh_${GhVersion}_windows_amd64.zip"
$GhZipSha256='c28c7b3b584967a05b74d9eaf7481bff24ddc34930bf2d6e442c148236561eb1'
$ToolsDir=Join-Path $InstallRoot 'tools'
$GhDir=Join-Path $ToolsDir 'gh'
$GhExe=Join-Path $GhDir 'gh.exe'

function Step([string]$Text){Write-Host "[Sol Router Git Agent] $Text" -ForegroundColor Cyan}
function EnsureDir([string]$Path){if(-not(Test-Path $Path)){New-Item -ItemType Directory -Force -Path $Path|Out-Null}}
function Assert-PowerShellSyntax([string]$Path){
  $tokens=$null; $errors=$null
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
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\agent.ps1'),
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\current\agent.exe'),
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\current\cursor-agent.exe'),
    (Join-Path $HOME '.local\bin\agent.exe'),
    (Join-Path $HOME '.local\bin\cursor-agent.exe')
  )
  foreach($candidate in $candidates){if(Test-Path $candidate){return $candidate}}
  return $null
}
function Invoke-Native([string]$File,[string[]]$Args){
  $old=$ErrorActionPreference
  $ErrorActionPreference='Continue'
  try {
    & $File @Args
    return $LASTEXITCODE
  } finally {
    $ErrorActionPreference=$old
  }
}
function Install-PortableGh{
  if(Test-Path $GhExe){return}
  Step "Downloading portable GitHub CLI $GhVersion"
  EnsureDir $ToolsDir
  $zip=Join-Path $env:TEMP "gh_${GhVersion}_windows_amd64.zip"
  $extract=Join-Path $env:TEMP "sol-router-gh-$GhVersion"
  if(Test-Path $zip){Remove-Item -Force $zip}
  if(Test-Path $extract){Remove-Item -Recurse -Force $extract}
  Invoke-WebRequest -UseBasicParsing -Uri $GhZipUrl -OutFile $zip
  $actual=(Get-FileHash -Algorithm SHA256 $zip).Hash.ToLowerInvariant()
  if($actual -ne $GhZipSha256){throw "GitHub CLI checksum mismatch: $actual"}
  Expand-Archive -Path $zip -DestinationPath $extract -Force
  $found=Get-ChildItem -Path $extract -Recurse -Filter gh.exe -File | Select-Object -First 1
  if(-not $found){throw 'Portable GitHub CLI archive did not contain gh.exe'}
  EnsureDir $GhDir
  Copy-Item -Force $found.FullName $GhExe
  Remove-Item -Force $zip -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force $extract -ErrorAction SilentlyContinue
}
function Ensure-GitHubAuth{
  Install-PortableGh
  $status=Invoke-Native $GhExe @('auth','status','--hostname','github.com')
  if($status -ne 0){
    Step 'One-time GitHub sign-in is required; a browser page will open'
    $login=Invoke-Native $GhExe @('auth','login','--hostname','github.com','--git-protocol','https','--web')
    if($login -ne 0){throw 'GitHub browser sign-in failed'}
  }
  $setup=Invoke-Native $GhExe @('auth','setup-git','--hostname','github.com')
  if($setup -ne 0){throw 'GitHub CLI could not configure Git authentication'}
}

Step 'Checking only required local files'
$node=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $node){throw 'node.exe not found'}
$git=Get-Command git.exe -ErrorAction SilentlyContinue
if(-not $git){throw 'git.exe not found'}
$cursor=Find-CursorCli
if(-not $cursor){throw 'Cursor CLI file not found'}
$posif='C:\work\dxif-pos'
if(-not(Test-Path $posif)){throw ('POSIF workspace path missing: {0}' -f $posif)}
Step ('Cursor CLI file: {0}' -f $cursor)

EnsureDir $InstallRoot; EnsureDir $StateDir; EnsureDir $LogDir
$StageAgent=Join-Path $InstallRoot 'windows-cursor-git-agent-v2.stage.mjs'
$StageWorker=Join-Path $InstallRoot 'windows-cursor-git-task-v2.stage.mjs'
Step 'Downloading and validating Git Agent payload'
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $AgentUrl -OutFile $StageAgent
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $WorkerUrl -OutFile $StageWorker
& $node.Source --check $StageAgent
if($LASTEXITCODE -ne 0){throw 'Git Agent syntax check failed'}
& $node.Source --check $StageWorker
if($LASTEXITCODE -ne 0){throw 'Cursor worker syntax check failed'}

Ensure-GitHubAuth

Step 'Cloning private Git relay repository'
if(Test-Path $RelayDir){Remove-Item -Recurse -Force $RelayDir}
$clone=Invoke-Native $git.Source @('clone','--branch',$Branch,'--single-branch',$RepoUrl,$RelayDir)
if($clone -ne 0){throw 'Private relay clone failed after GitHub authentication'}
$pushCheck=Invoke-Native $git.Source @('-C',$RelayDir,'push','--dry-run','origin',"HEAD:$Branch")
if($pushCheck -ne 0){throw 'GitHub authentication does not have write access to the relay branch'}

$workspaces=[ordered]@{posif=$posif}
$solRouter=Join-Path $env:LOCALAPPDATA 'SolRouter\app'
if(Test-Path $solRouter){$workspaces['sol-router']=$solRouter}
$cfg=[ordered]@{
  relayDir=$RelayDir
  branch=$Branch
  agentId=$AgentId
  cursorCli=$cursor
  workerPath=$WorkerPath
  localStateDir=$StateDir
  workspaces=$workspaces
}
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
Assert-PowerShellSyntax $RunnerStage

Step 'Activating Git-only transport; old Cloudflare Agent will be stopped now'
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
Write-Host ('  agent id: {0}' -f $AgentId)
Write-Host ('  transport: Git polling only')
Write-Host ('  relay: {0}' -f $RelayDir)
Write-Host ('  cursor: {0}' -f $cursor)
Write-Host ('  workspaces: {0}' -f (($workspaces.Keys) -join ', '))
Write-Host ('  startup: {0}' -f $StartupCmd)
Write-Host ('  log: {0}' -f $LogFile)
if(Test-Path $LogFile){Get-Content $LogFile -Tail 20}
