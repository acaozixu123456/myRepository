param(
  [string]$RepoUrl = 'https://github.com/acaozixu123456/sol-luna-accelerator.git',
  [string]$SourceBranch = 'sol-router-codex-hardening-review-20260831',
  [string]$AgentId = 'work-windows-cursor',
  [string]$WorkspacePath = 'C:\work\dxif-pos',
  [switch]$ValidateOnly,
  [switch]$RunCanary
)

$ErrorActionPreference = 'Stop'
$InstallRoot = Join-Path $env:LOCALAPPDATA 'SolRouterGitAgent'
$RelayDirDefault = Join-Path $InstallRoot 'relay'
$StateRelayDirDefault = Join-Path $InstallRoot 'state-relay'
$StateDirDefault = Join-Path $InstallRoot 'state'
$LogDir = Join-Path $InstallRoot 'logs'
$LogFile = Join-Path $LogDir 'agent.log'
$ConfigPath = Join-Path $InstallRoot 'config.json'
$RunnerPath = Join-Path $InstallRoot 'run-git-agent.ps1'
$Startup = [Environment]::GetFolderPath('Startup')
$StartupCmd = Join-Path $Startup 'SolRouterGitAgent.cmd'
$BackupRoot = Join-Path $InstallRoot 'backups'
$CanaryWorkspace = Join-Path $InstallRoot 'canary-workspace'
$CommandBranchDefault = 'sol-router-gateway-v0.1'
$StateBranchDefault = 'gateway-state-work-windows-cursor'

$RuntimeFiles = @(
  'windows-cursor-git-agent-v2.mjs',
  'windows-cursor-git-task-v2.mjs',
  'windows-cursor-git-agent-core.mjs',
  'windows-cursor-git-agent-durability.mjs',
  'windows-cursor-git-agent-context.mjs',
  'windows-cursor-git-agent-scope.mjs',
  'windows-git-agent-executor-config.mjs',
  'windows-git-agent-executor-probe.mjs',
  'windows-git-agent-adapter-codex.mjs',
  'windows-git-agent-adapter-cursor.mjs',
  'windows-git-agent-supervisor.mjs'
)

$ApiBillingEnvironmentKeys = @(
  'OPENAI_API_KEY',
  'CODEX_API_KEY',
  'AZURE_OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_API_BASE',
  'OPENAI_API_TYPE',
  'OPENAI_API_VERSION',
  'OPENAI_ORG_ID',
  'OPENAI_ORGANIZATION',
  'OPENAI_PROJECT_ID',
  'OPENAI_PROJECT',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_VERSION'
)

function Step([string]$Text) {
  Write-Host "[Sol Router Codex 2.6] $Text" -ForegroundColor Cyan
}

function Ensure-Directory([string]$Path) {
  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
  }
}

function Assert-PowerShellSyntax([string]$Path) {
  $tokens = $null
  $errors = $null
  [void][System.Management.Automation.Language.Parser]::ParseFile($Path, [ref]$tokens, [ref]$errors)
  if ($errors -and $errors.Count -gt 0) {
    $detail = ($errors | ForEach-Object {
      'line={0} col={1} {2}' -f $_.Extent.StartLineNumber, $_.Extent.StartColumnNumber, $_.Message
    }) -join ' | '
    throw "PowerShell syntax check failed for $Path`: $detail"
  }
}

function Find-CommandPath([string[]]$Names) {
  foreach ($name in $Names) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -and (Test-Path $cmd.Source)) {
      return $cmd.Source
    }
  }
  return $null
}

function Invoke-NativeCapture(
  [string]$File,
  [string[]]$Arguments,
  [switch]$ChatGptManagedEnvironment
) {
  $saved = @{}
  if ($ChatGptManagedEnvironment) {
    foreach ($key in $ApiBillingEnvironmentKeys) {
      $exists = Test-Path "Env:$key"
      $saved[$key] = [ordered]@{
        Exists = $exists
        Value = if ($exists) { [Environment]::GetEnvironmentVariable($key, 'Process') } else { $null }
      }
      [Environment]::SetEnvironmentVariable($key, $null, 'Process')
    }
  }

  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = (& $File @Arguments 2>&1 | Out-String)
    $code = $LASTEXITCODE
    return [ordered]@{ Code = $code; Output = $output.Trim() }
  } finally {
    $ErrorActionPreference = $oldPreference
    if ($ChatGptManagedEnvironment) {
      foreach ($key in $ApiBillingEnvironmentKeys) {
        $entry = $saved[$key]
        if ($entry.Exists) {
          [Environment]::SetEnvironmentVariable($key, $entry.Value, 'Process')
        } else {
          [Environment]::SetEnvironmentVariable($key, $null, 'Process')
        }
      }
    }
  }
}

function Get-JsonProperty($Object, [string]$Name, $DefaultValue = $null) {
  if ($null -eq $Object) { return $DefaultValue }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) { return $DefaultValue }
  return $property.Value
}

function Read-JsonFile([string]$Path) {
  if (-not (Test-Path $Path)) { return $null }
  try { return Get-Content $Path -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return $null }
}

function Write-JsonAtomic([string]$Path, $Value) {
  $tmp = "$Path.new"
  [IO.File]::WriteAllText($tmp, ($Value | ConvertTo-Json -Depth 30), [Text.UTF8Encoding]::new($false))
  Move-Item -Force $tmp $Path
}

function Get-ActiveLocalRuns([string]$LocalStateDir) {
  $taskDir = Join-Path $LocalStateDir 'tasks'
  if (-not (Test-Path $taskDir)) { return @() }
  $activeStates = @('queued', 'starting', 'accepted', 'running', 'cancel_requested')
  $found = @()
  Get-ChildItem $taskDir -Filter '*.state.json' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $state = Read-JsonFile $_.FullName
    if ($null -eq $state) { return }
    $livePath = $_.FullName -replace '\.state\.json$', '.live.json'
    $live = Read-JsonFile $livePath
    $runState = if ($live -and (Get-JsonProperty $live 'runState')) {
      [string](Get-JsonProperty $live 'runState')
    } else {
      [string](Get-JsonProperty $state 'runState' (Get-JsonProperty $state 'state' 'unknown'))
    }
    if ($activeStates -contains $runState.ToLowerInvariant()) {
      $found += [ordered]@{
        RunId = [string](Get-JsonProperty $state 'runId' $_.BaseName)
        RunState = $runState
      }
    }
  }
  return $found
}

function Stop-AgentProcesses {
  $self = $PID
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessId -ne $self -and $_.CommandLine -and (
      $_.CommandLine -match 'SolRouterGitAgent\\run-git-agent\.ps1' -or
      $_.CommandLine -match 'windows-git-agent-supervisor\.mjs' -or
      ($_.CommandLine -match 'windows-cursor-git-agent-v2\.mjs' -and
       $_.CommandLine -notmatch 'windows-cursor-git-task-v2\.mjs')
    )
  } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Milliseconds 800
}

function Wait-AgentHealth(
  [string]$StateRelayDir,
  [string]$ExpectedAgentId,
  [long]$NotBeforeEpochMs,
  [int]$TimeoutSeconds = 150
) {
  $safeAgent = $ExpectedAgentId -replace '[^A-Za-z0-9._-]', '_'
  $healthPath = Join-Path $StateRelayDir "gateway-bridge\agents\$safeAgent.json"
  $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTimeOffset]::UtcNow -lt $deadline) {
    Start-Sleep -Seconds 3
    $health = Read-JsonFile $healthPath
    if ($null -eq $health) { continue }
    $heartbeat = [long](Get-JsonProperty $health 'heartbeatAt' 0)
    if ($heartbeat -lt $NotBeforeEpochMs) { continue }
    if ([string](Get-JsonProperty $health 'version') -ne '2.6.0') { continue }
    if ([string](Get-JsonProperty $health 'provider') -ne 'codex') { continue }
    if (-not [bool](Get-JsonProperty $health 'executor_healthy' $false)) { continue }
    $authState = [string](Get-JsonProperty $health 'authState' '')
    if ($authState -notin @('ready', 'unknown')) { continue }
    return $health
  }
  throw "Timed out waiting for fresh protocol 2.6.0 Codex health at $healthPath"
}

function Invoke-Canary(
  [string]$GitPath,
  [string]$Repo,
  [string]$CommandBranch,
  [string]$StateBranch,
  [string]$ExpectedAgentId,
  [string]$ExpectedWorkspace,
  [string]$ExpectedWorkspacePath
) {
  Step 'Running non-destructive Codex canary in isolated workspace'
  Ensure-Directory $ExpectedWorkspacePath
  $expectedText = "sol-router-codex-canary-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
  $outputFile = Join-Path $ExpectedWorkspacePath 'canary-output.txt'
  Remove-Item -Force $outputFile -ErrorAction SilentlyContinue

  $root = Join-Path $env:TEMP ("sol-router-codex-canary-" + [Guid]::NewGuid().ToString('N'))
  $commandClone = Join-Path $root 'command'
  $stateClone = Join-Path $root 'state'
  Ensure-Directory $root
  try {
    $cloneCommand = Invoke-NativeCapture $GitPath @('clone', '--depth', '1', '--branch', $CommandBranch, '--single-branch', $Repo, $commandClone)
    if ($cloneCommand.Code -ne 0) { throw "Canary command clone failed: $($cloneCommand.Output)" }
    $cloneState = Invoke-NativeCapture $GitPath @('clone', '--depth', '1', '--branch', $StateBranch, '--single-branch', $Repo, $stateClone)
    if ($cloneState.Code -ne 0) { throw "Canary state clone failed: $($cloneState.Output)" }
    & $GitPath -C $commandClone config user.name 'sol-router-codex-installer'
    & $GitPath -C $commandClone config user.email 'sol-router-codex-installer@users.noreply.github.com'

    $id = 'installer-codex-canary-' + [Guid]::NewGuid().ToString('N')
    $runId = $id + '-run'
    $commandDir = Join-Path $commandClone 'gateway-bridge\commands'
    Ensure-Directory $commandDir
    $command = [ordered]@{
      id = $id
      method = 'start'
      agent_id = $ExpectedAgentId
      payload = [ordered]@{
        workspace = $ExpectedWorkspace
        runId = $runId
        clientRequestId = $id
        prompt = "In the current isolated canary workspace only, create canary-output.txt containing exactly: $expectedText . Then read the file back and finish. Do not use network, do not touch any other workspace, and do not modify Git branches."
      }
    }
    Write-JsonAtomic (Join-Path $commandDir "$id.json") $command
    & $GitPath -C $commandClone add -- "gateway-bridge/commands/$id.json"
    & $GitPath -C $commandClone commit -m "installer: Codex canary $id" | Out-Null
    & $GitPath -C $commandClone push origin $CommandBranch | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Canary command push failed' }

    $statusPath = Join-Path $stateClone "gateway-bridge\runs\$runId\status.json"
    $deadline = [DateTimeOffset]::UtcNow.AddMinutes(8)
    $terminal = $null
    while ([DateTimeOffset]::UtcNow -lt $deadline) {
      Start-Sleep -Seconds 5
      & $GitPath -C $stateClone pull --rebase origin $StateBranch | Out-Null
      if (Test-Path $statusPath) {
        $terminal = Read-JsonFile $statusPath
        $runState = [string](Get-JsonProperty $terminal 'runState' '')
        if ($runState -in @('completed', 'failed', 'cancelled')) { break }
      }
    }
    if ($null -eq $terminal) { throw 'Canary status was never published' }
    $finalState = [string](Get-JsonProperty $terminal 'runState' '')
    if ($finalState -ne 'completed') {
      $errorText = [string](Get-JsonProperty $terminal 'error' '')
      throw "Codex canary did not complete: runState=$finalState error=$errorText"
    }
    if (-not (Test-Path $outputFile)) { throw 'Codex canary output file missing' }
    $actual = (Get-Content $outputFile -Raw -Encoding UTF8).Trim()
    if ($actual -ne $expectedText) { throw "Codex canary output mismatch: $actual" }
    Step "PASS live Codex canary runId=$runId"
    return $terminal
  } finally {
    Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
  }
}

Step 'Resolving required tools'
$node = Find-CommandPath @('node.exe', 'node')
$npm = Find-CommandPath @('npm.cmd', 'npm')
$git = Find-CommandPath @('git.exe', 'git')
$gh = Find-CommandPath @((Join-Path $InstallRoot 'tools\gh\gh.exe'), 'gh.exe', 'gh')
$codex = Find-CommandPath @('codex.cmd', 'codex.exe', 'codex')
if (-not $node) { throw 'node not found' }
if (-not $npm) { throw 'npm not found' }
if (-not $git) { throw 'git not found' }
if (-not $gh) { throw 'GitHub CLI not found; install/authenticate gh before migration' }
if (-not $codex) { throw 'Codex CLI not found; install the official Codex CLI before migration' }
if (-not (Test-Path $WorkspacePath)) { throw "Workspace path missing: $WorkspacePath" }

Step 'Verifying GitHub and ChatGPT-managed Codex authentication'
$ghStatus = Invoke-NativeCapture $gh @('auth', 'status', '--hostname', 'github.com')
if ($ghStatus.Code -ne 0) { throw 'GitHub CLI is not authenticated for github.com' }
$ghSetup = Invoke-NativeCapture $gh @('auth', 'setup-git', '--hostname', 'github.com')
if ($ghSetup.Code -ne 0) { throw 'GitHub CLI could not configure Git authentication' }
$codexVersion = Invoke-NativeCapture $codex @('--version') -ChatGptManagedEnvironment
if ($codexVersion.Code -ne 0) { throw "Codex CLI version probe failed: $($codexVersion.Output)" }
$codexAuth = Invoke-NativeCapture $codex @('login', 'status') -ChatGptManagedEnvironment
if ($codexAuth.Code -ne 0 -or $codexAuth.Output -notmatch '(?i)logged in.*chatgpt') {
  throw 'Codex is not authenticated using ChatGPT. Run codex login under this Windows user; API-key mode is not accepted.'
}
Step "Codex ready: $($codexVersion.Output.Split([Environment]::NewLine)[0]) / ChatGPT login confirmed"

Ensure-Directory $InstallRoot
Ensure-Directory $LogDir
Ensure-Directory $BackupRoot
$sourceRoot = Join-Path $env:TEMP ("sol-router-source-" + [Guid]::NewGuid().ToString('N'))
try {
  Step "Cloning verified source branch $SourceBranch"
  $clone = Invoke-NativeCapture $git @('clone', '--depth', '1', '--branch', $SourceBranch, '--single-branch', $RepoUrl, $sourceRoot)
  if ($clone.Code -ne 0) { throw "Source clone failed: $($clone.Output)" }

  $sourceRuntime = Join-Path $sourceRoot 'windows-git-agent'
  foreach ($file in $RuntimeFiles) {
    $path = Join-Path $sourceRuntime $file
    if (-not (Test-Path $path)) { throw "Required runtime module missing: $file" }
    & $node --check $path
    if ($LASTEXITCODE -ne 0) { throw "Node syntax validation failed: $file" }
  }
  $coreText = Get-Content (Join-Path $sourceRuntime 'windows-cursor-git-agent-core.mjs') -Raw -Encoding UTF8
  if ($coreText -notmatch "PROTOCOL_VERSION\s*=\s*'2\.6\.0'") {
    throw 'Source branch is not protocol 2.6.0'
  }

  Step 'Running complete Windows Agent source suite before installation'
  Push-Location $sourceRoot
  try {
    & $npm run test:windows
    if ($LASTEXITCODE -ne 0) { throw "Windows Agent test suite failed with exit code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }

  if ($ValidateOnly) {
    Step 'PASS validation-only mode; no live files or processes changed'
    exit 0
  }

  $existing = Read-JsonFile $ConfigPath
  $relayDir = [string](Get-JsonProperty $existing 'relayDir' $RelayDirDefault)
  $stateRelayDir = [string](Get-JsonProperty $existing 'stateRelayDir' $StateRelayDirDefault)
  $localStateDir = [string](Get-JsonProperty $existing 'localStateDir' $StateDirDefault)
  $commandBranch = [string](Get-JsonProperty $existing 'branch' (Get-JsonProperty $existing 'commandBranch' $CommandBranchDefault))
  $stateBranch = [string](Get-JsonProperty $existing 'stateBranch' $StateBranchDefault)

  $active = @(Get-ActiveLocalRuns $localStateDir)
  if ($active.Count -gt 0) {
    $detail = ($active | ForEach-Object { "$($_.RunId):$($_.RunState)" }) -join ', '
    throw "SAFE_RECYCLE_BLOCKED_ACTIVE_RUN: $detail"
  }

  $timestamp = [DateTime]::Now.ToString('yyyyMMdd-HHmmss')
  $backup = Join-Path $BackupRoot $timestamp
  $stage = Join-Path $InstallRoot "stage-$timestamp"
  Ensure-Directory $backup
  Ensure-Directory $stage

  Step "Backing up current runtime to $backup"
  foreach ($file in ($RuntimeFiles + @('config.json', 'run-git-agent.ps1'))) {
    $existingPath = Join-Path $InstallRoot $file
    if (Test-Path $existingPath) { Copy-Item -Force $existingPath (Join-Path $backup $file) }
  }

  foreach ($file in $RuntimeFiles) {
    Copy-Item -Force (Join-Path $sourceRuntime $file) (Join-Path $stage $file)
  }

  $workspaces = [ordered]@{}
  $existingWorkspaces = Get-JsonProperty $existing 'workspaces' $null
  if ($existingWorkspaces) {
    foreach ($property in $existingWorkspaces.PSObject.Properties) {
      $workspaces[$property.Name] = [string]$property.Value
    }
  }
  $workspaces['posif'] = $WorkspacePath
  $workspaces['sol-router-canary'] = $CanaryWorkspace
  Ensure-Directory $CanaryWorkspace

  $newConfig = [ordered]@{
    relayDir = $relayDir
    commandBranch = $commandBranch
    branch = $commandBranch
    stateBranch = $stateBranch
    stateRelayDir = $stateRelayDir
    legacyResultMirrorEnabled = [bool](Get-JsonProperty $existing 'legacyResultMirrorEnabled' $true)
    agentId = $AgentId
    executorKind = 'codex'
    executorBin = $codex
    authMode = 'chatgpt-managed'
    sandboxMode = 'workspace-write'
    modelPolicy = 'config-default'
    executionCore = 'windows-git-agent-v2'
    cursorCli = [string](Get-JsonProperty $existing 'cursorCli' '')
    workerPath = Join-Path $InstallRoot 'windows-cursor-git-task-v2.mjs'
    agentPath = Join-Path $InstallRoot 'windows-cursor-git-agent-v2.mjs'
    localStateDir = $localStateDir
    maxConcurrentRuns = 1
    heartbeatPublishMs = [int](Get-JsonProperty $existing 'heartbeatPublishMs' 60000)
    pollerHeartbeatStaleMs = 180000
    pollerStartupGraceMs = 60000
    pollerMonitorIntervalMs = 5000
    workspaces = $workspaces
  }
  Write-JsonAtomic (Join-Path $stage 'config.json') $newConfig

  $supervisorPath = Join-Path $InstallRoot 'windows-git-agent-supervisor.mjs'
  $runnerText = @"
`$ErrorActionPreference = 'Continue'
`$created = `$false
`$mutex = [Threading.Mutex]::new(`$true, 'SolRouterGitAgentRunner', [ref]`$created)
if (-not `$created) { exit 0 }
`$env:GIT_TERMINAL_PROMPT = '0'
`$env:GCM_INTERACTIVE = 'Never'
while (`$true) {
  & '$node' '$supervisorPath' '$ConfigPath' *>> '$LogFile'
  `$code = `$LASTEXITCODE
  Add-Content -Path '$LogFile' -Value "[`$([DateTime]::Now.ToString('HH:mm:ss'))] supervisor exited code=`$code; restarting"
  Start-Sleep -Seconds 2
}
"@
  [IO.File]::WriteAllText((Join-Path $stage 'run-git-agent.ps1'), $runnerText, [Text.UTF8Encoding]::new($false))
  Assert-PowerShellSyntax (Join-Path $stage 'run-git-agent.ps1')

  Step 'Activating protocol 2.6.0 Codex runtime (no active run detected)'
  Stop-AgentProcesses
  foreach ($file in $RuntimeFiles) {
    Move-Item -Force (Join-Path $stage $file) (Join-Path $InstallRoot $file)
  }
  Move-Item -Force (Join-Path $stage 'config.json') $ConfigPath
  Move-Item -Force (Join-Path $stage 'run-git-agent.ps1') $RunnerPath
  Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
  $cmdText = "@echo off`r`nstart `"Sol Router Git Agent`" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$RunnerPath`"`r`n"
  [IO.File]::WriteAllText($StartupCmd, $cmdText, [Text.UTF8Encoding]::new($false))
  $activatedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $RunnerPath)

  try {
    $health = Wait-AgentHealth $stateRelayDir $AgentId $activatedAt 150
    Step "PASS health version=$($health.version) provider=$($health.provider) authState=$($health.authState)"
    if ($RunCanary) {
      [void](Invoke-Canary $git $RepoUrl $commandBranch $stateBranch $AgentId 'sol-router-canary' $CanaryWorkspace)
    }
  } catch {
    Step "Activation verification failed; restoring backup $backup"
    Stop-AgentProcesses
    Get-ChildItem $backup -File | ForEach-Object {
      Copy-Item -Force $_.FullName (Join-Path $InstallRoot $_.Name)
    }
    if (Test-Path $RunnerPath) {
      Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $RunnerPath)
    }
    throw
  }

  Step 'Codex protocol 2.6.0 installation completed'
  Write-Host "  source branch: $SourceBranch"
  Write-Host "  executor: Codex / ChatGPT-managed"
  Write-Host "  capacity: 1"
  Write-Host "  backup: $backup"
  Write-Host "  log: $LogFile"
  Write-Host "  canary: $([bool]$RunCanary)"
} finally {
  Remove-Item -Recurse -Force $sourceRoot -ErrorAction SilentlyContinue
}
