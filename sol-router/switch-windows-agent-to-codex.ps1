param(
  [string]$Branch = 'sol-router-gateway-v0.1',
  [string]$StateBranch = 'gateway-state-work-windows-cursor',
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'SolRouterGitAgent'),
  [int]$StaleAfterMinutes = 10
)

$ErrorActionPreference = 'Stop'
$RelayDir = Join-Path $InstallRoot 'relay'
$TempScript = Join-Path $env:TEMP ("sol-router-reviewed-rollout-codex-{0}.ps1" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

function Step([string]$Text) {
  Write-Host "[Sol Router reviewed bootstrap] $Text" -ForegroundColor Cyan
}

function Invoke-Git([string[]]$NativeArgs, [switch]$AllowFailure) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $script:GitPath @NativeArgs 2>&1
    $code = $LASTEXITCODE
    if (-not $AllowFailure -and $code -ne 0) {
      throw ("git failed ({0}): {1}`n{2}" -f $code, ($NativeArgs -join ' '), ($output -join "`n"))
    }
    return [pscustomobject]@{ Code = $code; Output = ($output -join "`n") }
  }
  finally {
    $ErrorActionPreference = $old
  }
}

$git = Get-Command git.exe -ErrorAction SilentlyContinue
if (-not $git) { throw 'git.exe not found' }
$script:GitPath = $git.Source
if (-not (Test-Path $RelayDir)) {
  throw "Existing Sol Router relay checkout not found: $RelayDir"
}

Step 'Fetching command and state branches'
Invoke-Git @('-C', $RelayDir, 'fetch', 'origin', $Branch, $StateBranch) | Out-Null

$recoverStaleRunId = ''
$agentShow = Invoke-Git @('-C', $RelayDir, 'show', "origin/${StateBranch}:gateway-bridge/agents/work-windows-cursor.json") -AllowFailure
if ($agentShow.Code -eq 0 -and $agentShow.Output.Trim()) {
  try { $agent = $agentShow.Output | ConvertFrom-Json } catch { $agent = $null }
  if ($agent -and [string]$agent.agentState -eq 'busy' -and $agent.activeRunId) {
    $heartbeat = 0L
    [void][long]::TryParse([string]$agent.heartbeatAt, [ref]$heartbeat)
    $ageMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $heartbeat
    $minimumStaleMs = [long]$StaleAfterMinutes * 60L * 1000L
    if ($heartbeat -gt 0 -and $ageMs -lt $minimumStaleMs) {
      throw ("ACTIVE_AGENT_BUSY: activeRunId={0}, heartbeat age={1:N1} minutes. Refusing to recycle a fresh run." -f $agent.activeRunId, ($ageMs / 60000.0))
    }
    $recoverStaleRunId = [string]$agent.activeRunId
    Step ("Remote heartbeat is stale; authorizing exact run recovery: {0}" -f $recoverStaleRunId)
  }
}

Step 'Loading reviewed rollout implementation from the private command branch'
$scriptShow = Invoke-Git @('-C', $RelayDir, 'show', "origin/${Branch}:windows-git-agent/rollout-codex.ps1")
[IO.File]::WriteAllText($TempScript, $scriptShow.Output, [Text.UTF8Encoding]::new($false))

Step 'Validating rollout PowerShell syntax before execution'
$tokens = $null
$errors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile($TempScript, [ref]$tokens, [ref]$errors)
if ($errors -and $errors.Count -gt 0) {
  $detail = ($errors | ForEach-Object { "line=$($_.Extent.StartLineNumber) col=$($_.Extent.StartColumnNumber) $($_.Message)" }) -join ' | '
  throw "Reviewed rollout syntax validation failed: $detail"
}

Step 'Executing guarded rollout: full tests, active-run gate, health, isolated canary and automatic rollback'
try {
  $powerShellArgs = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $TempScript,
    '-InstallRoot', $InstallRoot,
    '-Branch', $Branch,
    '-StateBranch', $StateBranch,
    '-StaleAfterMinutes', [string]$StaleAfterMinutes
  )
  if ($recoverStaleRunId) {
    $powerShellArgs += @('-RecoverStaleRunId', $recoverStaleRunId)
  }
  & powershell.exe @powerShellArgs
  if ($LASTEXITCODE -ne 0) { throw "Reviewed Codex rollout exited with code $LASTEXITCODE" }
}
finally {
  Remove-Item -Force $TempScript -ErrorAction SilentlyContinue
}

Step 'Reviewed Codex switch completed and verified'
