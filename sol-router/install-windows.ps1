param(
  [string]$Gateway = 'wss://sol-router-gateway.331004814.workers.dev/agent/connect',
  [string]$AgentId = 'work-windows-cursor'
)

$ErrorActionPreference = 'Stop'
$InstallRoot = Join-Path $env:LOCALAPPDATA 'SolRouterGateway'
$AgentHome = Join-Path $HOME '.sol-router-agent'
$ExistingRouter = Join-Path $env:LOCALAPPDATA 'SolRouter\app'
$AgentUrl = 'https://raw.githubusercontent.com/acaozixu123456/myRepository/sol-router-agent-dist/sol-router/windows-cursor-agent.py'
$LogDir = Join-Path $InstallRoot 'logs'
$StartupDir = [Environment]::GetFolderPath('Startup')

function Step([string]$Text) { Write-Host "[Sol Router Windows] $Text" -ForegroundColor Cyan }
function EnsureDir([string]$Path) { if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null } }

function FindPython {
  $tests = @(
    @{ Exe='py.exe'; Args=@('-3') },
    @{ Exe='python.exe'; Args=@() },
    @{ Exe='python3.exe'; Args=@() }
  )
  foreach ($t in $tests) {
    $cmd = Get-Command $t.Exe -ErrorAction SilentlyContinue
    if (-not $cmd) { continue }
    try {
      $resolved = & $cmd.Source @($t.Args) -c "import sys;print(sys.executable)" 2>$null | Select-Object -First 1
      if ($LASTEXITCODE -eq 0 -and $resolved) { return @{ Exe=$cmd.Source; Args=$t.Args } }
    } catch {}
  }
  throw 'Python 3 was not found. Install Python 3 and rerun this command.'
}

Step 'Checking existing Cursor SolRouter'
if (-not (Test-Path $ExistingRouter)) { throw "Existing SolRouter was not found at $ExistingRouter" }
Write-Host "  existing router: $ExistingRouter"

$Python = FindPython
Write-Host "  python: $($Python.Exe) $($Python.Args -join ' ')"
EnsureDir $InstallRoot
EnsureDir $AgentHome
EnsureDir $LogDir

Step 'Downloading Windows Cursor adapter'
$AgentPath = Join-Path $InstallRoot 'windows-cursor-agent.py'
Invoke-WebRequest -UseBasicParsing -Uri $AgentUrl -OutFile $AgentPath

$TokenFile = Join-Path $AgentHome 'agent-token'
if (-not (Test-Path $TokenFile)) {
  Write-Host ''
  Write-Host 'One-time pairing: paste the Cloudflare AGENT_TOKEN used by Sol Router Gateway.' -ForegroundColor Yellow
  Write-Host 'It will be saved only on this PC at ~/.sol-router-agent/agent-token.' -ForegroundColor Yellow
  $Secure = Read-Host 'AGENT_TOKEN' -AsSecureString
  $Ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try { $Plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Ptr) }
  if (-not $Plain) { throw 'AGENT_TOKEN is required.' }
  [IO.File]::WriteAllText($TokenFile, $Plain.Trim())
  $Plain = $null
}

$Runner = Join-Path $InstallRoot 'run-agent.ps1'
$OutLog = Join-Path $LogDir 'agent.log'
$Prefix = if ($Python.Args.Count -gt 0) { ($Python.Args | ForEach-Object { "'$_'" }) -join ',' } else { '' }
$RunnerText = @"
`$ErrorActionPreference = 'Stop'
`$env:SOL_ROUTER_GATEWAY = '$Gateway'
`$env:SOL_ROUTER_AGENT_ID = '$AgentId'
`$env:SOL_ROUTER_CURSOR_APP = '$ExistingRouter'
`$prefix = @($Prefix)
`$argsList = @()
`$argsList += `$prefix
`$argsList += '$AgentPath'
& '$($Python.Exe)' @argsList *>> '$OutLog'
"@
[IO.File]::WriteAllText($Runner, $RunnerText)

Step 'Enabling login auto-start'
$StartupCmd = Join-Path $StartupDir 'SolRouterGatewayAgent.cmd'
$Cmd = "@echo off`r`nstart `"Sol Router Gateway Agent`" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$Runner`"`r`n"
[IO.File]::WriteAllText($StartupCmd, $Cmd)

Step 'Restarting only the Gateway adapter (existing SolRouter is untouched)'
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine.Contains($AgentPath) } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 500
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$Runner)
Start-Sleep -Seconds 5

Write-Host ''
Step 'Bootstrap result'
Write-Host "  agent id: $AgentId"
Write-Host "  gateway: $Gateway"
Write-Host "  existing SolRouter: $ExistingRouter"
Write-Host "  startup: $StartupCmd"
Write-Host "  log: $OutLog"
if (Test-Path $OutLog) {
  Write-Host ''
  Get-Content $OutLog -Tail 25
}
Write-Host ''
Write-Host 'Windows adapter installation finished.' -ForegroundColor Green
