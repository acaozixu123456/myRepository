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
$AgentPath=Join-Path $InstallRoot 'windows-cursor-git-agent-v1.mjs'
$WorkerPath=Join-Path $InstallRoot 'windows-cursor-git-task-v1.mjs'
$ConfigPath=Join-Path $InstallRoot 'config.json'
$RunnerPath=Join-Path $InstallRoot 'run-git-agent.ps1'
$Startup=[Environment]::GetFolderPath('Startup')
$StartupCmd=Join-Path $Startup 'SolRouterGitAgent.cmd'
$OldStartupCmd=Join-Path $Startup 'SolRouterGatewayAgent.cmd'
$Release='24882349447dd8c9a6a44e0cf48458a1f230c21c'
$AgentUrl="https://raw.githubusercontent.com/acaozixu123456/myRepository/$Release/sol-router/windows-cursor-git-agent-v1.mjs"
$WorkerUrl="https://raw.githubusercontent.com/acaozixu123456/myRepository/$Release/sol-router/windows-cursor-git-task-v1.mjs"

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
function Test-RepoAccess([string]$GitExe,[string]$Url,[string]$Ref){
  & $GitExe ls-remote --exit-code $Url "refs/heads/$Ref" *> $null
  return ($LASTEXITCODE -eq 0)
}
function Ensure-GitHubAuth([string]$GitExe,[string]$Url,[string]$Ref){
  if(Test-RepoAccess $GitExe $Url $Ref){
    Step 'GitHub private repository access already works'
    return
  }

  Step 'Private GitHub access is not configured on this Windows PC'
  $gh=Get-Command gh.exe -ErrorAction SilentlyContinue
  if($gh){
    Step 'Trying existing GitHub CLI authentication'
    & $gh.Source auth status --hostname github.com *> $null
    if($LASTEXITCODE -eq 0){
      & $gh.Source auth setup-git --hostname github.com
      if(Test-RepoAccess $GitExe $Url $Ref){return}
    }
    Step 'Opening one-time GitHub browser sign-in via GitHub CLI'
    & $gh.Source auth login --hostname github.com --git-protocol https --web
    if($LASTEXITCODE -ne 0){throw 'GitHub CLI login failed'}
    & $gh.Source auth setup-git --hostname github.com
    if(Test-RepoAccess $GitExe $Url $Ref){return}
  }

  $gcmOk=$false
  try {
    & $GitExe credential-manager --version *> $null
    $gcmOk=($LASTEXITCODE -eq 0)
  } catch {}
  if($gcmOk){
    Step 'Opening one-time GitHub browser sign-in via Git Credential Manager'
    & $GitExe credential-manager github login --web
    if($LASTEXITCODE -ne 0){throw 'Git Credential Manager GitHub login failed'}
    if(Test-RepoAccess $GitExe $Url $Ref){return}
  }

  throw 'GitHub authentication completed but private repository access still failed'
}

Step 'Checking prerequisites'
$node=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $node){throw 'node.exe not found'}
$git=Get-Command git.exe -ErrorAction SilentlyContinue
if(-not $git){throw 'git.exe not found'}
$cursor=Find-CursorCli
if(-not $cursor){throw 'Cursor CLI not found'}
$posif='C:\work\dxif-pos'
if(-not(Test-Path $posif)){throw ('POSIF workspace path missing: {0}' -f $posif)}
Step ('Cursor CLI: {0}' -f $cursor)
if($cursor.ToLower().EndsWith('.ps1')){
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $cursor --version
}else{
  & $cursor --version
}
if($LASTEXITCODE -ne 0){throw 'Cursor CLI version check failed'}

# Authentication is verified before any running transport is touched.
Ensure-GitHubAuth $git.Source $RepoUrl $Branch

EnsureDir $InstallRoot; EnsureDir $StateDir; EnsureDir $LogDir
$StageAgent=Join-Path $InstallRoot 'windows-cursor-git-agent-v1.stage.mjs'
$StageWorker=Join-Path $InstallRoot 'windows-cursor-git-task-v1.stage.mjs'
Step 'Downloading Git Agent payload'
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $AgentUrl -OutFile $StageAgent
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $WorkerUrl -OutFile $StageWorker
& $node.Source --check $StageAgent
if($LASTEXITCODE -ne 0){throw 'Git Agent syntax check failed'}
& $node.Source --check $StageWorker
if($LASTEXITCODE -ne 0){throw 'Cursor worker syntax check failed'}

Step 'Preparing direct Git relay clone'
if(Test-Path (Join-Path $RelayDir '.git')){
  & $git.Source -C $RelayDir fetch origin $Branch
  if($LASTEXITCODE -ne 0){throw 'git fetch failed after authentication'}
  & $git.Source -C $RelayDir checkout $Branch
  if($LASTEXITCODE -ne 0){throw 'git checkout failed'}
  & $git.Source -C $RelayDir reset --hard "origin/$Branch"
  if($LASTEXITCODE -ne 0){throw 'git reset failed'}
}else{
  if(Test-Path $RelayDir){Remove-Item -Recurse -Force $RelayDir}
  & $git.Source clone --branch $Branch --single-branch $RepoUrl $RelayDir
  if($LASTEXITCODE -ne 0){throw 'git clone failed after successful authentication check'}
}

# Verify write access before switching transports. This leaves no permanent test commit.
Step 'Verifying GitHub write access'
$probe=Join-Path $RelayDir 'gateway-bridge/.windows-git-agent-write-probe'
EnsureDir (Split-Path -Parent $probe)
[IO.File]::WriteAllText($probe,([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()))
& $git.Source -C $RelayDir add gateway-bridge/.windows-git-agent-write-probe
& $git.Source -C $RelayDir -c user.name='sol-router-windows-agent' -c user.email='sol-router-windows-agent@users.noreply.github.com' commit -m 'git-agent: verify Windows relay write access' *> $null
if($LASTEXITCODE -ne 0){throw 'local write-access probe commit failed'}
& $git.Source -C $RelayDir push origin "HEAD:$Branch"
if($LASTEXITCODE -ne 0){throw 'GitHub write access failed; authentication is read-only or insufficient'}
Remove-Item -Force $probe
& $git.Source -C $RelayDir add -u gateway-bridge/.windows-git-agent-write-probe
& $git.Source -C $RelayDir -c user.name='sol-router-windows-agent' -c user.email='sol-router-windows-agent@users.noreply.github.com' commit -m 'git-agent: remove Windows relay write probe' *> $null
if($LASTEXITCODE -eq 0){
  & $git.Source -C $RelayDir push origin "HEAD:$Branch"
  if($LASTEXITCODE -ne 0){throw 'failed to remove write-access probe from relay branch'}
}

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

Step 'Activating Git-only transport and stopping old Cloudflare Gateway Agent'
$self=$PID
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue|Where-Object{
  $_.ProcessId -ne $self -and $_.CommandLine -and (
    $_.CommandLine -match 'SolRouterGateway\\run-agent\.ps1' -or
    $_.CommandLine -match 'windows-cursor-agent-v[0-9_]+\.ps1' -or
    $_.CommandLine -match 'SolRouterGitAgent\\run-git-agent\.ps1' -or
    $_.CommandLine -match 'windows-cursor-git-agent-v1\.mjs'
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
Start-Sleep -Seconds 4

Step 'Git-only Windows Agent installation finished'
Write-Host ('  agent id: {0}' -f $AgentId)
Write-Host ('  transport: Git polling only (Cloudflare removed from runtime path)')
Write-Host ('  branch: {0}' -f $Branch)
Write-Host ('  relay: {0}' -f $RelayDir)
Write-Host ('  cursor: {0}' -f $cursor)
Write-Host ('  workspaces: {0}' -f (($workspaces.Keys) -join ', '))
Write-Host ('  startup: {0}' -f $StartupCmd)
Write-Host ('  log: {0}' -f $LogFile)
if(Test-Path $LogFile){Get-Content $LogFile -Tail 30}
