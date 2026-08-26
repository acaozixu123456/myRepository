param(
  [string]$RepoSsh='ssh://git@ssh.github.com:443/acaozixu123456/sol-luna-accelerator.git',
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
$KeyDir=Join-Path $InstallRoot 'ssh'
$KeyPath=Join-Path $KeyDir 'id_ed25519'
$PubKeyPath="$KeyPath.pub"
$Startup=[Environment]::GetFolderPath('Startup')
$StartupCmd=Join-Path $Startup 'SolRouterGitAgent.cmd'
$OldStartupCmd=Join-Path $Startup 'SolRouterGatewayAgent.cmd'
$PayloadRelease='368769f8f68ba0b8c65ed46718ea34ad6395adc8'
$AgentUrl="https://raw.githubusercontent.com/acaozixu123456/myRepository/$PayloadRelease/sol-router/windows-cursor-git-agent-v2.mjs"
$WorkerUrl="https://raw.githubusercontent.com/acaozixu123456/myRepository/$PayloadRelease/sol-router/windows-cursor-git-task-v2.mjs"
$DeployKeyPage='https://github.com/acaozixu123456/sol-luna-accelerator/settings/keys'

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
  foreach($candidate in @(
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\agent.ps1'),
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\current\agent.exe'),
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\current\cursor-agent.exe')
  )){if(Test-Path $candidate){return $candidate}}
  return $null
}
function Invoke-Native([string]$File,[string[]]$Args){
  $old=$ErrorActionPreference
  $ErrorActionPreference='Continue'
  try { & $File @Args; return $LASTEXITCODE } finally { $ErrorActionPreference=$old }
}
function Find-SshKeygen([string]$GitExe){
  $cmd=Get-Command ssh-keygen.exe -ErrorAction SilentlyContinue
  if($cmd){return $cmd.Source}
  $gitCmdDir=Split-Path $GitExe -Parent
  $gitRoot=Split-Path $gitCmdDir -Parent
  foreach($candidate in @((Join-Path $gitRoot 'usr\bin\ssh-keygen.exe'),'C:\Windows\System32\OpenSSH\ssh-keygen.exe')){if(Test-Path $candidate){return $candidate}}
  return $null
}
function New-RepositorySshKey([string]$SshKeygen,[string]$PrivateKeyPath,[string]$PublicKeyPath,[string]$Comment){
  if((Test-Path $PrivateKeyPath) -and (Test-Path $PublicKeyPath)){return}
  Remove-Item -Force $PrivateKeyPath,$PublicKeyPath -ErrorAction SilentlyContinue
  $safeComment=$Comment.Replace('"','')
  $argLine=('-q -t ed25519 -N "" -C "{0}" -f "{1}"' -f $safeComment,$PrivateKeyPath)
  $proc=Start-Process -FilePath $SshKeygen -ArgumentList $argLine -NoNewWindow -Wait -PassThru
  if($proc.ExitCode -ne 0 -or -not(Test-Path $PrivateKeyPath) -or -not(Test-Path $PublicKeyPath)){throw ('SSH key generation failed exit={0}' -f $proc.ExitCode)}
}

Step 'Checking required local files only'
$node=Get-Command node.exe -ErrorAction SilentlyContinue
if(-not $node){throw 'node.exe not found'}
$git=Get-Command git.exe -ErrorAction SilentlyContinue
if(-not $git){throw 'git.exe not found'}
$cursor=Find-CursorCli
if(-not $cursor){throw 'Cursor CLI file not found'}
$sshKeygen=Find-SshKeygen $git.Source
if(-not $sshKeygen){throw 'ssh-keygen.exe not found'}
$posif='C:\work\dxif-pos'
if(-not(Test-Path $posif)){throw ('POSIF workspace path missing: {0}' -f $posif)}
Step ('Cursor CLI file: {0}' -f $cursor)

EnsureDir $InstallRoot; EnsureDir $StateDir; EnsureDir $LogDir; EnsureDir $KeyDir
$StageAgent=Join-Path $InstallRoot 'windows-cursor-git-agent-v2.stage.mjs'
$StageWorker=Join-Path $InstallRoot 'windows-cursor-git-task-v2.stage.mjs'
Step 'Downloading and validating Git Agent payload'
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $AgentUrl -OutFile $StageAgent
Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} -Uri $WorkerUrl -OutFile $StageWorker
& $node.Source --check $StageAgent
if($LASTEXITCODE -ne 0){throw 'Git Agent syntax check failed'}
& $node.Source --check $StageWorker
if($LASTEXITCODE -ne 0){throw 'Cursor worker syntax check failed'}

Step 'Preparing repository-only SSH key'
New-RepositorySshKey $sshKeygen $KeyPath $PubKeyPath "sol-router-$AgentId@$env:COMPUTERNAME"
$SshCommand=('ssh -i "{0}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes -p 443' -f $KeyPath)
$oldGitSsh=$env:GIT_SSH_COMMAND
$env:GIT_SSH_COMMAND=$SshCommand
try {
  Step 'Testing existing deploy key over GitHub SSH port 443'
  $read=Invoke-Native $git.Source @('ls-remote','--exit-code',$RepoSsh,"refs/heads/$Branch")
  if($read -ne 0){
    $pub=(Get-Content $PubKeyPath -Raw).Trim()
    try { Set-Clipboard -Value $pub } catch { $pub | clip.exe }
    Write-Host ''
    Write-Host 'Deploy key is not active for this repository yet.' -ForegroundColor Yellow
    Write-Host ('Title: {0}' -f $AgentId) -ForegroundColor Yellow
    Write-Host 'Key is already copied. Ensure "Allow write access" is checked.' -ForegroundColor Yellow
    Start-Process $DeployKeyPage
    Step 'Waiting for the deploy key over SSH 443 (Ctrl+C cancels)'
    while($true){
      Start-Sleep -Seconds 2
      $read=Invoke-Native $git.Source @('ls-remote','--exit-code',$RepoSsh,"refs/heads/$Branch")
      if($read -eq 0){break}
    }
  }

  Step 'Deploy key works; cloning private relay repository over SSH 443'
  if(Test-Path $RelayDir){Remove-Item -Recurse -Force $RelayDir}
  $clone=Invoke-Native $git.Source @('clone','--branch',$Branch,'--single-branch',$RepoSsh,$RelayDir)
  if($clone -ne 0){throw 'SSH relay clone failed over port 443'}
  & $git.Source -C $RelayDir config core.sshCommand $SshCommand
  if($LASTEXITCODE -ne 0){throw 'Could not persist repository SSH command'}
  $pushCheck=Invoke-Native $git.Source @('-C',$RelayDir,'push','--dry-run','origin',"HEAD:$Branch")
  if($pushCheck -ne 0){throw 'Deploy key can read but cannot write; enable Allow write access'}
} finally {
  $env:GIT_SSH_COMMAND=$oldGitSsh
}

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
Assert-PowerShellSyntax $RunnerStage

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
Write-Host ('  agent id: {0}' -f $AgentId)
Write-Host '  transport: Git polling over SSH 443 deploy key'
Write-Host ('  relay: {0}' -f $RelayDir)
Write-Host ('  cursor: {0}' -f $cursor)
Write-Host ('  workspaces: {0}' -f (($workspaces.Keys) -join ', '))
Write-Host ('  startup: {0}' -f $StartupCmd)
Write-Host ('  log: {0}' -f $LogFile)
if(Test-Path $LogFile){Get-Content $LogFile -Tail 20}
