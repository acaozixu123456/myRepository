param()

$ErrorActionPreference = 'Stop'
$AgentId = if ($env:SOL_ROUTER_AGENT_ID) { $env:SOL_ROUTER_AGENT_ID } else { 'work-windows-cursor' }
$Gateway = if ($env:SOL_ROUTER_GATEWAY) { $env:SOL_ROUTER_GATEWAY } else { 'wss://sol-router-gateway.331004814.workers.dev/agent/connect' }
$RouterRoot = if ($env:SOL_ROUTER_CURSOR_APP) { $env:SOL_ROUTER_CURSOR_APP } else { Join-Path $env:LOCALAPPDATA 'SolRouter\app' }
$AgentHome = Join-Path $HOME '.sol-router-agent'
$TokenFile = Join-Path $AgentHome 'agent-token'
$StdioEntry = Join-Path $RouterRoot 'mcp\dist\src\stdio.js'
$McpWorkingDir = Join-Path $RouterRoot 'mcp'
$script:McpProcess = $null
$script:McpSeq = 0
$script:Tools = @{}
$script:RuntimeDescription = ''

function Log([string]$Text) { Write-Output "[$([DateTime]::Now.ToString('HH:mm:ss'))] $Text" }

function Find-McpRuntime {
  if ($env:SOL_ROUTER_NODE_EXE -and (Test-Path $env:SOL_ROUTER_NODE_EXE)) {
    return @{ Path=$env:SOL_ROUTER_NODE_EXE; Electron=$false; Description="node:$env:SOL_ROUTER_NODE_EXE" }
  }

  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($node) { return @{ Path=$node.Source; Electron=$false; Description="node:$($node.Source)" } }

  try {
    $running = Get-CimInstance Win32_Process | Where-Object {
      $_.ExecutablePath -and $_.CommandLine -and $_.CommandLine.Contains($StdioEntry)
    } | Select-Object -First 1
    if ($running -and (Test-Path $running.ExecutablePath)) {
      return @{ Path=$running.ExecutablePath; Electron=($running.ExecutablePath -match '(?i)cursor\.exe$'); Description="running:$($running.ExecutablePath)" }
    }
  } catch {}

  try {
    $bundled = Get-ChildItem (Split-Path $RouterRoot -Parent) -Filter node.exe -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($bundled) { return @{ Path=$bundled.FullName; Electron=$false; Description="bundled-node:$($bundled.FullName)" } }
  } catch {}

  $cursorCandidates = New-Object System.Collections.Generic.List[string]
  try {
    foreach ($p in @(Get-Process Cursor -ErrorAction SilentlyContinue)) {
      if ($p.Path -and -not $cursorCandidates.Contains($p.Path)) { $cursorCandidates.Add($p.Path) }
    }
  } catch {}
  foreach ($candidate in @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Cursor\Cursor.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\cursor\Cursor.exe'),
    (Join-Path $env:ProgramFiles 'Cursor\Cursor.exe')
  )) {
    if ($candidate -and (Test-Path $candidate) -and -not $cursorCandidates.Contains($candidate)) { $cursorCandidates.Add($candidate) }
  }
  foreach ($cursor in $cursorCandidates) {
    if (Test-Path $cursor) {
      return @{ Path=$cursor; Electron=$true; Description="cursor-electron-as-node:$cursor" }
    }
  }

  throw 'No Node-compatible runtime found for the existing SolRouter STDIO server. Cursor.exe was also not found.'
}

function Start-McpStdio {
  if (-not (Test-Path $StdioEntry)) { throw "SolRouter STDIO entry not found: $StdioEntry" }
  if ($script:McpProcess -and -not $script:McpProcess.HasExited) { return }

  $runtime = Find-McpRuntime
  $psi = [Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $runtime.Path
  $psi.Arguments = '"' + $StdioEntry + '"'
  $psi.WorkingDirectory = $McpWorkingDir
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $false
  $psi.CreateNoWindow = $true
  $psi.EnvironmentVariables['NODE_NO_WARNINGS'] = '1'
  if ($runtime.Electron) { $psi.EnvironmentVariables['ELECTRON_RUN_AS_NODE'] = '1' }

  $script:McpProcess = [Diagnostics.Process]::new()
  $script:McpProcess.StartInfo = $psi
  if (-not $script:McpProcess.Start()) { throw 'Failed to start SolRouter STDIO MCP process.' }
  $script:RuntimeDescription = $runtime.Description
  $script:McpSeq = 0
  $script:Tools = @{}

  $init = @{ protocolVersion='2025-03-26'; capabilities=@{}; clientInfo=@{ name='sol-router-windows-agent'; version='0.4.0' } }
  $null = Invoke-McpStdioRequest -Method 'initialize' -Params $init
  $null = Invoke-McpStdioRequest -Method 'notifications/initialized' -Params @{} -Notification
  $toolsResult = Invoke-McpStdioRequest -Method 'tools/list' -Params @{}
  foreach ($tool in @($toolsResult.tools)) {
    if ($tool.name) { $script:Tools[[string]$tool.name] = $tool }
  }
  foreach ($required in 'cursor_list_workspaces','cursor_start','cursor_status') {
    if (-not $script:Tools.ContainsKey($required)) { throw "Existing SolRouter STDIO MCP missing required tool: $required" }
  }
}

function Ensure-McpStdio {
  if (-not $script:McpProcess -or $script:McpProcess.HasExited) { Start-McpStdio }
}

function Invoke-McpStdioRequest {
  param([string]$Method,[object]$Params=@{},[switch]$Notification)
  if (-not $script:McpProcess -or $script:McpProcess.HasExited) {
    if ($Method -ne 'initialize') { Start-McpStdio }
    elseif (-not $script:McpProcess) { throw 'MCP process is not running.' }
  }

  if ($Notification) {
    $message = @{ jsonrpc='2.0'; method=$Method; params=$Params }
    $script:McpProcess.StandardInput.WriteLine(($message | ConvertTo-Json -Depth 40 -Compress))
    $script:McpProcess.StandardInput.Flush()
    return $null
  }

  $script:McpSeq += 1
  $id = $script:McpSeq
  $message = @{ jsonrpc='2.0'; id=$id; method=$Method; params=$Params }
  $script:McpProcess.StandardInput.WriteLine(($message | ConvertTo-Json -Depth 40 -Compress))
  $script:McpProcess.StandardInput.Flush()

  while ($true) {
    $line = $script:McpProcess.StandardOutput.ReadLine()
    if ($null -eq $line) {
      if ($script:McpProcess.HasExited) { throw "SolRouter STDIO MCP exited with code $($script:McpProcess.ExitCode) while waiting for $Method" }
      continue
    }
    $line = $line.Trim()
    if (-not $line) { continue }
    try { $parsed = $line | ConvertFrom-Json } catch { continue }
    if ($null -eq $parsed.id -or [string]$parsed.id -ne [string]$id) { continue }
    if ($parsed.error) { throw "MCP RPC error $($parsed.error.code): $($parsed.error.message)" }
    return $parsed.result
  }
}

function Tool-Text($Result) {
  $parts = @()
  foreach ($item in @($Result.content)) { if ($item.type -eq 'text') { $parts += [string]$item.text } }
  return ($parts -join "`n")
}
function Parse-ToolResult($Result) {
  if ($Result.isError) { throw "Local SolRouter tool error: $(Tool-Text $Result)" }
  if ($null -ne $Result.structuredContent) { return $Result.structuredContent }
  $text = (Tool-Text $Result).Trim()
  if ($text) { try { return $text | ConvertFrom-Json } catch { return @{ text=$text } } }
  return $Result
}
function Call-Tool([string]$Name,[hashtable]$Arguments=@{}) {
  Ensure-McpStdio
  $r = Invoke-McpStdioRequest -Method 'tools/call' -Params @{ name=$Name; arguments=$Arguments }
  return Parse-ToolResult $r
}
function Tool-Properties([string]$Name) {
  Ensure-McpStdio
  $tool = $script:Tools[$Name]
  if ($null -eq $tool) { return @{} }
  $schema = if ($tool.inputSchema) { $tool.inputSchema } else { $tool.input_schema }
  $h = @{}
  if ($schema.properties) { foreach ($p in $schema.properties.PSObject.Properties) { $h[$p.Name] = $p.Value } }
  return $h
}
function Map-StartArgs($Payload) {
  $props = Tool-Properties 'cursor_start'; $args=@{}
  $workspace=[string]$Payload.workspace
  $prompt=[string]$(if ($Payload.prompt) { $Payload.prompt } elseif ($Payload.task) { $Payload.task } else { '' })
  $model=[string]$Payload.model
  foreach ($k in 'workspace','workspace_id','workspaceId','cwd','root') { if ($workspace -and $props.ContainsKey($k)) { $args[$k]=$workspace; break } }
  foreach ($k in 'prompt','task','instruction','instructions','objective','message') { if ($prompt -and $props.ContainsKey($k)) { $args[$k]=$prompt; break } }
  foreach ($k in 'model','model_id','modelId') { if ($model -and $props.ContainsKey($k)) { $args[$k]=$model; break } }
  foreach ($p in $Payload.PSObject.Properties) { if ($props.ContainsKey($p.Name) -and -not $args.ContainsKey($p.Name)) { $args[$p.Name]=$p.Value } }
  return $args
}
function Map-StatusArgs($Payload) {
  $props=Tool-Properties 'cursor_status'
  $rid=[string]$(if ($Payload.runId) { $Payload.runId } elseif ($Payload.run_id) { $Payload.run_id } else { $Payload.id })
  if (-not $rid) { throw 'run_id_required' }
  foreach ($k in 'runId','run_id','id','jobId','job_id') { if ($props.ContainsKey($k)) { return @{ $k=$rid } } }
  return @{ runId=$rid }
}
function Workspace-Names($Value) {
  $raw = if ($Value.workspaces) { @($Value.workspaces) } elseif ($Value.items) { @($Value.items) } else { @($Value) }
  $names=@()
  foreach ($item in $raw) {
    if ($item -is [string]) { $names += $item; continue }
    foreach ($k in 'id','name','workspace','workspace_id','path') { if ($item.$k) { $names += [string]$item.$k; break } }
  }
  return @($names)
}
function Execute-Command([string]$Method,$Payload) {
  Ensure-McpStdio
  switch ($Method) {
    'health' { return @{ executor_healthy=$true; executor_version="SolRouter STDIO MCP ($($script:Tools.Count) tools) via $script:RuntimeDescription" } }
    'list_workspaces' { return @{ workspaces=@(Workspace-Names (Call-Tool 'cursor_list_workspaces' @{})) } }
    'start' {
      $available=@(Workspace-Names (Call-Tool 'cursor_list_workspaces' @{})); $workspace=[string]$Payload.workspace
      if ($workspace -and $available.Count -gt 0 -and $available -notcontains $workspace) { throw "workspace_not_available:$workspace" }
      return Call-Tool 'cursor_start' (Map-StartArgs $Payload)
    }
    'status' { return Call-Tool 'cursor_status' (Map-StatusArgs $Payload) }
    default { throw "unsupported_method:$Method" }
  }
}

function Read-Token {
  if ($env:SOL_ROUTER_AGENT_TOKEN) { return $env:SOL_ROUTER_AGENT_TOKEN.Trim() }
  if (Test-Path $TokenFile) { return (Get-Content $TokenFile -Raw).Trim() }
  throw "Missing token file: $TokenFile"
}
function Ws-SendText($Ws,[string]$Text) {
  $bytes=[Text.Encoding]::UTF8.GetBytes($Text); $segment=[ArraySegment[byte]]::new($bytes)
  $Ws.SendAsync($segment,[Net.WebSockets.WebSocketMessageType]::Text,$true,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
}
function Ws-SendJson($Ws,$Value) { Ws-SendText $Ws ($Value | ConvertTo-Json -Depth 40 -Compress) }
function Ws-ReceiveText($Ws) {
  $buffer=New-Object byte[] 65536; $stream=New-Object IO.MemoryStream
  try {
    do {
      $segment=[ArraySegment[byte]]::new($buffer)
      $r=$Ws.ReceiveAsync($segment,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
      if ($r.MessageType -eq [Net.WebSockets.WebSocketMessageType]::Close) { throw 'websocket_closed' }
      $stream.Write($buffer,0,$r.Count)
    } while (-not $r.EndOfMessage)
    return [Text.Encoding]::UTF8.GetString($stream.ToArray())
  } finally { $stream.Dispose() }
}

if (-not (Test-Path $RouterRoot)) { throw "Existing SolRouter app not found: $RouterRoot" }
if (-not (Test-Path $StdioEntry)) { throw "Existing SolRouter STDIO MCP entry not found: $StdioEntry" }
Start-McpStdio
$health = Execute-Command 'health' @{}
$workspaces = @((Execute-Command 'list_workspaces' @{}).workspaces)
$token = Read-Token
$wsUrl = "$Gateway$(if ($Gateway.Contains('?')) {'&'} else {'?'})agent_id=$([Uri]::EscapeDataString($AgentId))"
Log "id=$AgentId provider=cursor"
Log "local=$($health.executor_version)"
Log "workspaces=$($workspaces -join ', ')"

$backoff=1
while ($true) {
  $ws=[Net.WebSockets.ClientWebSocket]::new()
  try {
    $ws.Options.SetRequestHeader('Authorization',"Bearer $token")
    Log "connecting $wsUrl"
    $ws.ConnectAsync([Uri]$wsUrl,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $hello=@{ type='hello'; agent_id=$AgentId; version='0.4.0'; provider='cursor'; platform='windows'; default_model='cursor-default'; executor_healthy=$true; executor_version=$health.executor_version; capabilities=@('health','list_workspaces','start','status'); workspaces=$workspaces; updated_at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
    Ws-SendJson $ws $hello; Log 'connected'; $backoff=1
    while ($ws.State -eq [Net.WebSockets.WebSocketState]::Open) {
      $text=Ws-ReceiveText $ws
      if ($text -eq 'pong') { continue }
      if ($text -eq 'ping') { Ws-SendText $ws 'pong'; continue }
      try { $msg=$text | ConvertFrom-Json } catch { continue }
      if ($msg.type -ne 'command') { continue }
      $cid=[string]$msg.id; $method=[string]$msg.method; $payload=if ($msg.payload) { $msg.payload } else { @{} }
      Log "command=$method id=$cid"
      try { $result=Execute-Command $method $payload; Ws-SendJson $ws @{ type='result'; id=$cid; ok=$true; result=$result }; Log "result=$method ok" }
      catch { Ws-SendJson $ws @{ type='result'; id=$cid; ok=$false; error=$_.Exception.Message }; Log "result=$method error=$($_.Exception.Message)" }
    }
  } catch { Log "disconnected: $($_.Exception.Message); retry in ${backoff}s" }
  finally { try { $ws.Dispose() } catch {} }
  Start-Sleep -Seconds $backoff; $backoff=[Math]::Min(30,$backoff*2)
}
