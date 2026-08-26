$ErrorActionPreference='Stop'
$RouterRoot = Join-Path $env:LOCALAPPDATA 'SolRouter\app'
$StdioEntry = Join-Path $RouterRoot 'mcp\dist\src\stdio.js'
$McpWorkingDir = Join-Path $RouterRoot 'mcp'

Write-Host '=== Sol Router Windows STDIO Probe ===' -ForegroundColor Cyan
Write-Host "router: $RouterRoot"
Write-Host "stdio : $StdioEntry"
if (-not (Test-Path $StdioEntry)) { throw "Missing STDIO entry: $StdioEntry" }

$candidates = New-Object System.Collections.Generic.List[object]
function Add-Candidate([string]$Path,[bool]$Electron,[string]$Source) {
  if (-not $Path -or -not (Test-Path $Path)) { return }
  foreach ($x in $candidates) { if ($x.Path -eq $Path -and $x.Electron -eq $Electron) { return } }
  $candidates.Add([pscustomobject]@{Path=$Path;Electron=$Electron;Source=$Source})
}

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if ($node) { Add-Candidate $node.Source $false 'PATH node.exe' }
try {
  Get-ChildItem (Split-Path $RouterRoot -Parent) -Filter node.exe -File -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 10 | ForEach-Object { Add-Candidate $_.FullName $false 'SolRouter bundled node.exe' }
} catch {}
try {
  foreach ($p in @(Get-Process Cursor -ErrorAction SilentlyContinue)) {
    if ($p.Path) { Add-Candidate $p.Path $true 'running Cursor.exe as Node' }
  }
} catch {}
foreach ($p in @(
  (Join-Path $env:LOCALAPPDATA 'Programs\Cursor\Cursor.exe'),
  (Join-Path $env:LOCALAPPDATA 'Programs\cursor\Cursor.exe'),
  (Join-Path $env:ProgramFiles 'Cursor\Cursor.exe')
)) { Add-Candidate $p $true 'installed Cursor.exe as Node' }

if ($candidates.Count -eq 0) {
  Write-Host 'NO_RUNTIME_CANDIDATES' -ForegroundColor Red
} else {
  Write-Host "runtime candidates: $($candidates.Count)"
}

$index=0
foreach ($c in $candidates) {
  $index++
  Write-Host ''
  Write-Host "--- Candidate $index ---" -ForegroundColor Yellow
  Write-Host "source  : $($c.Source)"
  Write-Host "path    : $($c.Path)"
  Write-Host "electron: $($c.Electron)"

  $psi=[Diagnostics.ProcessStartInfo]::new()
  $psi.FileName=$c.Path
  $psi.Arguments='"'+$StdioEntry+'"'
  $psi.WorkingDirectory=$McpWorkingDir
  $psi.UseShellExecute=$false
  $psi.RedirectStandardInput=$true
  $psi.RedirectStandardOutput=$true
  $psi.RedirectStandardError=$true
  $psi.CreateNoWindow=$true
  $psi.EnvironmentVariables['NODE_NO_WARNINGS']='1'
  if ($c.Electron) { $psi.EnvironmentVariables['ELECTRON_RUN_AS_NODE']='1' }

  $p=[Diagnostics.Process]::new(); $p.StartInfo=$psi
  try {
    if (-not $p.Start()) { Write-Host 'start: FAILED'; continue }
    Write-Host "pid     : $($p.Id)"
    $msg=@{jsonrpc='2.0';id=1;method='initialize';params=@{protocolVersion='2025-03-26';capabilities=@{};clientInfo=@{name='sol-router-stdio-probe';version='1'}}}|ConvertTo-Json -Depth 20 -Compress
    $p.StandardInput.WriteLine($msg); $p.StandardInput.Flush()

    $deadline=[DateTime]::UtcNow.AddSeconds(5)
    $lines=New-Object System.Collections.Generic.List[string]
    $matched=$false
    while ([DateTime]::UtcNow -lt $deadline -and -not $matched) {
      $remaining=[Math]::Max(100,[int](($deadline-[DateTime]::UtcNow).TotalMilliseconds))
      $task=$p.StandardOutput.ReadLineAsync()
      if (-not $task.Wait($remaining)) { break }
      $line=$task.Result
      if ($null -eq $line) { break }
      $lines.Add($line)
      try {
        $obj=$line|ConvertFrom-Json
        if ([string]$obj.id -eq '1') { $matched=$true }
      } catch {}
      if ($lines.Count -ge 20) { break }
    }

    if ($matched) { Write-Host 'initialize: RESPONSE RECEIVED' -ForegroundColor Green }
    else { Write-Host 'initialize: NO MATCHING RESPONSE WITHIN 5s' -ForegroundColor Red }
    if ($lines.Count) {
      Write-Host 'stdout:'
      foreach($line in $lines){ Write-Host "  $line" }
    } else { Write-Host 'stdout: <empty>' }

    if (-not $p.HasExited) { try { $p.Kill() } catch {} }
    try { $p.WaitForExit(2000) | Out-Null } catch {}
    $stderr=''
    try { $stderr=$p.StandardError.ReadToEnd() } catch {}
    if ($stderr.Trim()) {
      Write-Host 'stderr:'
      $stderr.Trim().Split("`n") | Select-Object -First 30 | ForEach-Object { Write-Host "  $($_.TrimEnd())" }
    } else { Write-Host 'stderr: <empty>' }
    if ($p.HasExited) { Write-Host "exitCode: $($p.ExitCode)" }
  } catch {
    Write-Host "probe error: $($_.Exception.Message)" -ForegroundColor Red
    try { if (-not $p.HasExited) { $p.Kill() } } catch {}
  } finally { try { $p.Dispose() } catch {} }
}

Write-Host ''
Write-Host '=== Package metadata ===' -ForegroundColor Cyan
$pkg=Join-Path $McpWorkingDir 'package.json'
if (Test-Path $pkg) {
  Get-Content $pkg -Raw
} else { Write-Host 'package.json: missing' }

Write-Host ''
Write-Host '=== stdio.js first 80 lines ===' -ForegroundColor Cyan
Get-Content $StdioEntry -TotalCount 80
