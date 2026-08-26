param()

$ErrorActionPreference = 'Stop'
$AgentId = if ($env:SOL_ROUTER_AGENT_ID) { $env:SOL_ROUTER_AGENT_ID } else { 'work-windows-cursor' }
$Gateway = if ($env:SOL_ROUTER_GATEWAY) { $env:SOL_ROUTER_GATEWAY } else { 'wss://sol-router-gateway.331004814.workers.dev/agent/connect' }
$RouterRoot = if ($env:SOL_ROUTER_CURSOR_APP) { $env:SOL_ROUTER_CURSOR_APP } else { Join-Path $env:LOCALAPPDATA 'SolRouter\app' }
$AgentHome = Join-Path $HOME '.sol-router-agent'
$TokenFile = Join-Path $AgentHome 'agent-token'
$script:McpEndpoint = $env:SOL_ROUTER_CURSOR_MCP_URL
$script:McpSessionId = $null
$script:Tools = @{}

function Log([string]$Text) { Write-Output "[$([DateTime]::Now.ToString('HH:mm:ss'))] $Text" }

function Parse-McpBody([string]$Text) {
  $Text = ($Text | Out-String).Trim()
  if (-not $Text) { return $null }
  if ($Text.StartsWith('event:') -or $Text.Contains("`ndata:")) {
    $lines = $Text -split "`r?`n"
    [Array]::Reverse($lines)
    foreach ($line in $lines) {
      if ($line.StartsWith('data:')) {
        $v = $line.Substring(5).Trim()
        if ($v -and $v -ne '[DONE]') {
          try { return $v | ConvertFrom-Json } catch {}
        }
      }
    }
  }
  return $Text | ConvertFrom-Json
}

function Invoke-McpRequest {
  param([string]$Endpoint,[string]$Method,[object]$Params=@{},[int]$TimeoutSec=20,[switch]$Notification)
  $headers = @{ Accept='application/json, text/event-stream'; 'Content-Type'='application/json'; 'User-Agent'='Sol-Router-Windows-Agent/0.3' }
  if ($script:McpSessionId) { $headers['Mcp-Session-Id'] = $script:McpSessionId }
  $body = if ($Notification) {
    @{ jsonrpc='2.0'; method=$Method; params=$Params } | ConvertTo-Json -Depth 30 -Compress
  } else {
    @{ jsonrpc='2.0'; id=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); method=$Method; params=$Params } | ConvertTo-Json -Depth 30 -Compress
  }
  $response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $Endpoint -Headers $headers -Body $body -TimeoutSec $TimeoutSec
  if ($response.Headers['Mcp-Session-Id']) { $script:McpSessionId = [string]$response.Headers['Mcp-Session-Id'] }
  if ($Notification) { return $null }
  $parsed = Parse-McpBody $response.Content
  if ($parsed.error) { throw "MCP RPC error $($parsed.error.code): $($parsed.error.message)" }
  if ($null -eq $parsed.result) { throw 'Invalid MCP response: result missing' }
  return $parsed.result
}

function Get-ToolsFromResult($Result) {
  $out = @{}
  foreach ($tool in @($Result.tools)) {
    if ($tool.name) { $out[[string]$tool.name] = $tool }
  }
  return $out
}

function Probe-McpEndpoint([string]$Endpoint) {
  $script:McpSessionId = $null
  try {
    $r = Invoke-McpRequest -Endpoint $Endpoint -Method 'tools/list' -Params @{} -TimeoutSec 3
    $tools = Get-ToolsFromResult $r
    if ($tools.ContainsKey('cursor_list_workspaces') -and $tools.ContainsKey('cursor_start') -and $tools.ContainsKey('cursor_status')) {
      $script:Tools = $tools; return $true
    }
  } catch {}
  $script:McpSessionId = $null
  try {
    $init = @{ protocolVersion='2025-03-26'; capabilities=@{}; clientInfo=@{ name='sol-router-windows-agent'; version='0.3.0' } }
    $null = Invoke-McpRequest -Endpoint $Endpoint -Method 'initialize' -Params $init -TimeoutSec 4
    $null = Invoke-McpRequest -Endpoint $Endpoint -Method 'notifications/initialized' -Params @{} -TimeoutSec 4 -Notification
    $r = Invoke-McpRequest -Endpoint $Endpoint -Method 'tools/list' -Params @{} -TimeoutSec 4
    $tools = Get-ToolsFromResult $r
    if ($tools.ContainsKey('cursor_list_workspaces') -and $tools.ContainsKey('cursor_start') -and $tools.ContainsKey('cursor_status')) {
      $script:Tools = $tools; return $true
    }
  } catch {}
  $script:McpSessionId = $null
  return $false
}

function Discover-McpEndpoint {
  if ($script:McpEndpoint) {
    if (Probe-McpEndpoint $script:McpEndpoint) { return $script:McpEndpoint }
    throw "Configured SOL_ROUTER_CURSOR_MCP_URL is not a compatible MCP endpoint: $script:McpEndpoint"
  }
  $ports = New-Object System.Collections.Generic.List[int]
  try {
    $pids = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($RouterRoot) } | Select-Object -ExpandProperty ProcessId
    foreach ($pid in $pids) {
      foreach ($conn in @(Get-NetTCPConnection -State Listen -OwningProcess $pid -ErrorAction SilentlyContinue)) {
        if (-not $ports.Contains([int]$conn.LocalPort)) { $ports.Add([int]$conn.LocalPort) }
      }
    }
  } catch {}
  if (Test-Path $RouterRoot) {
    try {
      $patterns = @('127\.0\.0\.1:(\d{2,5})','localhost:(\d{2,5})','\.listen\(\s*(\d{2,5})','PORT\s*[:=]\s*["'']?(\d{2,5})')
      $files = Get-ChildItem $RouterRoot -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in '.js','.mjs','.cjs','.json','.env','.txt' -and $_.Length -lt 1000000 } | Select-Object -First 350
      foreach ($file in $files) {
        $text = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
        foreach ($pattern in $patterns) {
          foreach ($m in [regex]::Matches($text,$pattern)) {
            $port = [int]$m.Groups[1].Value
            if ($port -gt 0 -and -not $ports.Contains($port)) { $ports.Add($port) }
          }
        }
      }
    } catch {}
  }
  foreach ($fallback in 8787,8765,3000,3001,4318) { if (-not $ports.Contains($fallback)) { $ports.Add($fallback) } }
  foreach ($port in $ports) {
    foreach ($path in '/mcp','/api/mcp','/') {
      $endpoint = "http://127.0.0.1:$port$path"
      if (Probe-McpEndpoint $endpoint) { return $endpoint }
    }
  }
  throw 'Could not discover the existing SolRouter MCP endpoint. Make sure the existing SolRouter is running.'
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
function Call-Tool([string]$Name,[hashtable]$Arguments=@{},[int]$TimeoutSec=60) {
  $r = Invoke-McpRequest -Endpoint $script:McpEndpoint -Method 'tools/call' -Params @{ name=$Name; arguments=$Arguments } -TimeoutSec $TimeoutSec
  return Parse-ToolResult $r
}
function Tool-Properties([string]$Name) {
  $tool = $script:Tools[$Name]
  if ($null -eq $tool) { return @{} }
  $schema = if ($tool.inputSchema) { $tool.inputSchema } else { $tool.input_schema }
  $h = @{}
  if ($schema.properties) { foreach ($p in $schema.properties.PSObject.Properties) { $h[$p.Name] = $p.Value } }
  return $h
}
function Map-StartArgs($Payload) {
  $props = Tool-Properties 'cursor_start'; $args=@{}
  $workspace=[string]$Payload.workspace; $prompt=[string]$(if ($Payload.prompt) { $Payload.prompt } elseif ($Payload.task) { $Payload.task } else { '' }); $model=[string]$Payload.model
  foreach ($k in 'workspace','workspace_id','workspaceId','cwd','root') { if ($workspace -and $props.ContainsKey($k)) { $args[$k]=$workspace; break } }
  foreach ($k in 'prompt','task','instruction','instructions','objective','message') { if ($prompt -and $props.ContainsKey($k)) { $args[$k]=$prompt; break } }
  foreach ($k in 'model','model_id','modelId') { if ($model -and $props.ContainsKey($k)) { $args[$k]=$model; break } }
  foreach ($p in $Payload.PSObject.Properties) { if ($props.ContainsKey($p.Name) -and -not $args.ContainsKey($p.Name)) { $args[$p.Name]=$p.Value } }
  return $args
}
function Map-StatusArgs($Payload) {
  $props=Tool-Properties 'cursor_status'; $rid=[string]$(if ($Payload.runId) { $Payload.runId } elseif ($Payload.run_id) { $Payload.run_id } else { $Payload.id })
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
  switch ($Method) {
    'health' { return @{ executor_healthy=$true; executor_version="SolRouter MCP ($($script:Tools.Count) tools) $script:McpEndpoint" } }
    'list_workspaces' { return @{ workspaces=@(Workspace-Names (Call-Tool 'cursor_list_workspaces' @{} 30)) } }
    'start' {
      $available=@(Workspace-Names (Call-Tool 'cursor_list_workspaces' @{} 30)); $workspace=[string]$Payload.workspace
      if ($workspace -and $available.Count -gt 0 -and $available -notcontains $workspace) { throw "workspace_not_available:$workspace" }
      return Call-Tool 'cursor_start' (Map-StartArgs $Payload) 45
    }
    'status' { return Call-Tool 'cursor_status' (Map-StatusArgs $Payload) 30 }
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
function Ws-SendJson($Ws,$Value) { Ws-SendText $Ws ($Value | ConvertTo-Json -Depth 30 -Compress) }
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
$script:McpEndpoint = Discover-McpEndpoint
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
    $hello=@{ type='hello'; agent_id=$AgentId; version='0.3.0'; provider='cursor'; platform='windows'; default_model='cursor-default'; executor_healthy=$true; executor_version=$health.executor_version; capabilities=@('health','list_workspaces','start','status'); workspaces=$workspaces; updated_at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
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
