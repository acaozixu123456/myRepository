param([switch]$SelfTest)

$ErrorActionPreference = 'Stop'
$AgentId = if ($env:SOL_ROUTER_AGENT_ID) { $env:SOL_ROUTER_AGENT_ID } else { 'work-windows-cursor' }
$Gateway = if ($env:SOL_ROUTER_GATEWAY) { $env:SOL_ROUTER_GATEWAY } else { 'wss://sol-router-gateway.331004814.workers.dev/agent/connect' }
$RouterRoot = if ($env:SOL_ROUTER_CURSOR_APP) { $env:SOL_ROUTER_CURSOR_APP } else { Join-Path $env:LOCALAPPDATA 'SolRouter\app' }
$AgentHome = Join-Path $HOME '.sol-router-agent'
$TokenFile = Join-Path $AgentHome 'agent-token'
$McpRoot = Join-Path $RouterRoot 'mcp'
$StdioEntry = Join-Path $McpRoot 'dist\src\stdio.js'
$ConfigPath = Join-Path $McpRoot 'config\config.json'
$script:Mcp = $null
$script:McpSeq = 0
$script:Tools = @{}
$script:Runtime = ''
$script:McpGeneration = 0

function Log([string]$Text) { Write-Output "[$([DateTime]::Now.ToString('HH:mm:ss'))] $Text" }

function Find-NodeRuntime {
  if ($env:SOL_ROUTER_NODE_EXE -and (Test-Path $env:SOL_ROUTER_NODE_EXE)) { return $env:SOL_ROUTER_NODE_EXE }
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($node) { return $node.Source }
  throw 'node.exe was not found. The existing SolRouter requires Node >=22.'
}

function Stop-Mcp([string]$Reason='stop') {
  $old = $script:Mcp
  if ($old) {
    Log "stdio reset reason=$Reason pid=$($old.Id) generation=$script:McpGeneration"
    try { if (-not $old.HasExited) { $old.Kill() } } catch {}
    try { $old.WaitForExit(1500) | Out-Null } catch {}
    try { $old.Dispose() } catch {}
  }
  $script:Mcp = $null
  $script:McpSeq = 0
  $script:Tools = @{}
}

function Reset-McpAndThrow([string]$Message,[string]$Reason) {
  Stop-Mcp $Reason
  throw $Message
}

function Invoke-Mcp {
  param([string]$Method,[object]$Params=@{},[switch]$Notification,[int]$TimeoutMs=12000)
  if (-not $script:Mcp -or $script:Mcp.HasExited) { throw 'MCP process is not running.' }
  if ($Notification) {
    try {
      $msg = @{ jsonrpc='2.0'; method=$Method; params=$Params } | ConvertTo-Json -Depth 40 -Compress
      $script:Mcp.StandardInput.WriteLine($msg); $script:Mcp.StandardInput.Flush(); return $null
    } catch {
      Reset-McpAndThrow "MCP notification write failed: $Method : $($_.Exception.Message)" 'notification-write-failed'
    }
  }

  $script:McpSeq += 1
  $id = $script:McpSeq
  try {
    $msg = @{ jsonrpc='2.0'; id=$id; method=$Method; params=$Params } | ConvertTo-Json -Depth 40 -Compress
    $script:Mcp.StandardInput.WriteLine($msg); $script:Mcp.StandardInput.Flush()
  } catch {
    Reset-McpAndThrow "MCP request write failed: $Method : $($_.Exception.Message)" 'request-write-failed'
  }

  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMs)
  while ([DateTime]::UtcNow -lt $deadline) {
    $remaining = [Math]::Max(50,[int]($deadline-[DateTime]::UtcNow).TotalMilliseconds)
    try {
      $task = $script:Mcp.StandardOutput.ReadLineAsync()
    } catch {
      Reset-McpAndThrow "MCP stdout reader was already occupied during $Method; the STDIO session was reset. $($_.Exception.Message)" 'stdout-reader-conflict'
    }

    try {
      if (-not $task.Wait($remaining)) {
        # IMPORTANT: ReadLineAsync cannot be cancelled. Never reuse this process after
        # a timeout because the pending read would poison the next request.
        Reset-McpAndThrow "MCP request timed out after $TimeoutMs ms: $Method; STDIO session reset to clear pending reader" 'read-timeout'
      }
    } catch {
      $message = $_.Exception.Message
      if ($message -match 'currently in use|previous operation|ReadLineAsync|stream') {
        Reset-McpAndThrow "MCP stdout reader conflict during $Method; STDIO session reset. $message" 'stdout-reader-conflict'
      }
      if (-not $script:Mcp -or $script:Mcp.HasExited) {
        Reset-McpAndThrow "SolRouter STDIO MCP exited while waiting for $Method: $message" 'process-exited'
      }
      throw
    }

    $line = $task.Result
    if ($null -eq $line) {
      if ($script:Mcp.HasExited) { Reset-McpAndThrow "SolRouter STDIO MCP exited with code $($script:Mcp.ExitCode) during $Method" 'process-exited' }
      continue
    }
    $line = $line.Trim(); if (-not $line) { continue }
    try { $parsed = $line | ConvertFrom-Json } catch { continue }
    if ($null -eq $parsed.id -or [string]$parsed.id -ne [string]$id) { continue }
    if ($parsed.error) { throw "MCP RPC error $($parsed.error.code): $($parsed.error.message)" }
    return $parsed.result
  }
  Reset-McpAndThrow "MCP request timed out after $TimeoutMs ms: $Method; STDIO session reset" 'request-timeout'
}

function Start-Mcp {
  if ($script:Mcp -and -not $script:Mcp.HasExited) { return }
  if (-not (Test-Path $StdioEntry)) { throw "STDIO entry not found: $StdioEntry" }
  if (-not (Test-Path $ConfigPath)) { throw "SolRouter config not found: $ConfigPath" }
  $node = Find-NodeRuntime
  Log "stdio runtime=$node"
  Log "stdio entry=$StdioEntry"
  Log "stdio config=$ConfigPath"

  $psi = [Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $node
  $psi.Arguments = '"' + $StdioEntry + '" "' + $ConfigPath + '"'
  $psi.WorkingDirectory = $McpRoot
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $psi.EnvironmentVariables['NODE_NO_WARNINGS'] = '1'

  $script:Mcp = [Diagnostics.Process]::new(); $script:Mcp.StartInfo = $psi
  if (-not $script:Mcp.Start()) { throw 'Failed to start SolRouter STDIO MCP.' }
  $script:Runtime = $node; $script:McpSeq = 0; $script:Tools = @{}; $script:McpGeneration += 1
  Log "stdio pid=$($script:Mcp.Id) generation=$script:McpGeneration"

  try {
    $init = @{ protocolVersion='2025-03-26'; capabilities=@{}; clientInfo=@{ name='sol-router-windows-agent'; version='0.5.1' } }
    $r = Invoke-Mcp -Method 'initialize' -Params $init -TimeoutMs 12000
    Log "initialize ok server=$($r.serverInfo.name) version=$($r.serverInfo.version)"
    $null = Invoke-Mcp -Method 'notifications/initialized' -Params @{} -Notification
    $tools = Invoke-Mcp -Method 'tools/list' -Params @{} -TimeoutMs 12000
    foreach ($tool in @($tools.tools)) { if ($tool.name) { $script:Tools[[string]$tool.name] = $tool } }
    foreach ($required in 'cursor_list_workspaces','cursor_start','cursor_status') {
      if (-not $script:Tools.ContainsKey($required)) { throw "Missing required tool: $required" }
    }
    Log "tools/list ok count=$($script:Tools.Count)"
  } catch {
    $message = $_.Exception.Message
    Stop-Mcp 'initialization-failed'
    throw $message
  }
}

function Tool-Text($Result) {
  $parts=@(); foreach ($item in @($Result.content)) { if ($item.type -eq 'text') { $parts += [string]$item.text } }; return ($parts -join "`n")
}
function Parse-ToolResult($Result) {
  if ($Result.isError) { throw "Local SolRouter tool error: $(Tool-Text $Result)" }
  if ($null -ne $Result.structuredContent) { return $Result.structuredContent }
  $text=(Tool-Text $Result).Trim(); if ($text) { try { return $text|ConvertFrom-Json } catch { return @{text=$text} } }
  return $Result
}
function Call-Tool([string]$Name,[hashtable]$Arguments=@{},[int]$TimeoutMs=30000) {
  Start-Mcp
  return Parse-ToolResult (Invoke-Mcp -Method 'tools/call' -Params @{name=$Name;arguments=$Arguments} -TimeoutMs $TimeoutMs)
}
function Tool-Props([string]$Name) {
  $tool=$script:Tools[$Name]; $out=@{}; if (-not $tool) { return $out }
  $schema=if($tool.inputSchema){$tool.inputSchema}else{$tool.input_schema}
  if($schema.properties){foreach($p in $schema.properties.PSObject.Properties){$out[$p.Name]=$p.Value}}
  return $out
}
function Workspace-Names($Value) {
  $raw=if($Value.workspaces){@($Value.workspaces)}elseif($Value.items){@($Value.items)}else{@($Value)}
  $names=@(); foreach($item in $raw){ if($item -is [string]){$names+=$item;continue}; foreach($k in 'id','name','workspace','workspace_id','path'){if($item.$k){$names+=[string]$item.$k;break}} }; return @($names)
}
function Map-StartArgs($Payload) {
  $props=Tool-Props 'cursor_start'; $args=@{}; $workspace=[string]$Payload.workspace; $prompt=[string]$(if($Payload.prompt){$Payload.prompt}elseif($Payload.task){$Payload.task}else{''}); $model=[string]$Payload.model
  foreach($k in 'workspace','workspace_id','workspaceId','cwd','root'){if($workspace -and $props.ContainsKey($k)){$args[$k]=$workspace;break}}
  foreach($k in 'prompt','task','instruction','instructions','objective','message'){if($prompt -and $props.ContainsKey($k)){$args[$k]=$prompt;break}}
  foreach($k in 'model','model_id','modelId'){if($model -and $props.ContainsKey($k)){$args[$k]=$model;break}}
  foreach($p in $Payload.PSObject.Properties){if($props.ContainsKey($p.Name)-and -not $args.ContainsKey($p.Name)){$args[$p.Name]=$p.Value}}
  return $args
}
function Map-StatusArgs($Payload) {
  $props=Tool-Props 'cursor_status'; $rid=[string]$(if($Payload.runId){$Payload.runId}elseif($Payload.run_id){$Payload.run_id}else{$Payload.id}); if(-not $rid){throw 'run_id_required'}
  foreach($k in 'runId','run_id','id','jobId','job_id'){if($props.ContainsKey($k)){return @{$k=$rid}}}; return @{runId=$rid}
}
function Execute-Command([string]$Method,$Payload) {
  Start-Mcp
  switch($Method){
    'health' { return @{executor_healthy=$true;executor_version="SolRouter STDIO MCP $($script:Runtime) generation=$script:McpGeneration"} }
    'list_workspaces' { return @{workspaces=@(Workspace-Names (Call-Tool 'cursor_list_workspaces' @{} 12000))} }
    'start' { $w=[string]$Payload.workspace; $available=@(Workspace-Names (Call-Tool 'cursor_list_workspaces' @{} 12000)); if($w -and $available.Count -gt 0 -and $available -notcontains $w){throw "workspace_not_available:$w"}; return Call-Tool 'cursor_start' (Map-StartArgs $Payload) 30000 }
    'status' { return Call-Tool 'cursor_status' (Map-StatusArgs $Payload) 12000 }
    default { throw "unsupported_method:$Method" }
  }
}

function Read-Token { if($env:SOL_ROUTER_AGENT_TOKEN){return $env:SOL_ROUTER_AGENT_TOKEN.Trim()}; if(Test-Path $TokenFile){return (Get-Content $TokenFile -Raw).Trim()}; throw "Missing token file: $TokenFile" }
function Ws-SendText($Ws,[string]$Text){$bytes=[Text.Encoding]::UTF8.GetBytes($Text);$seg=[ArraySegment[byte]]::new($bytes);$Ws.SendAsync($seg,[Net.WebSockets.WebSocketMessageType]::Text,$true,[Threading.CancellationToken]::None).GetAwaiter().GetResult()}
function Ws-SendJson($Ws,$Value){Ws-SendText $Ws ($Value|ConvertTo-Json -Depth 40 -Compress)}
function Ws-ReceiveText($Ws){$buffer=New-Object byte[] 65536;$stream=New-Object IO.MemoryStream;try{do{$seg=[ArraySegment[byte]]::new($buffer);$r=$Ws.ReceiveAsync($seg,[Threading.CancellationToken]::None).GetAwaiter().GetResult();if($r.MessageType -eq [Net.WebSockets.WebSocketMessageType]::Close){throw 'websocket_closed'};$stream.Write($buffer,0,$r.Count)}while(-not $r.EndOfMessage);return [Text.Encoding]::UTF8.GetString($stream.ToArray())}finally{$stream.Dispose()}}

if (-not (Test-Path $RouterRoot)) { throw "Existing SolRouter app not found: $RouterRoot" }
Start-Mcp
$workspaces=@(Workspace-Names (Call-Tool 'cursor_list_workspaces' @{} 12000))
Log "workspaces=$($workspaces -join ', ')"
if ($SelfTest) { Log 'SELFTEST PASS'; Stop-Mcp 'selftest-complete'; exit 0 }

$token=Read-Token; $wsUrl="$Gateway$(if($Gateway.Contains('?')){'&'}else{'?'})agent_id=$([Uri]::EscapeDataString($AgentId))"
$backoff=1
while($true){
  $ws=[Net.WebSockets.ClientWebSocket]::new(); try{$ws.Options.SetRequestHeader('Authorization',"Bearer $token");try{$ws.Options.KeepAliveInterval=[TimeSpan]::FromSeconds(20)}catch{};Log "connecting $wsUrl";$ws.ConnectAsync([Uri]$wsUrl,[Threading.CancellationToken]::None).GetAwaiter().GetResult();$hello=@{type='hello';agent_id=$AgentId;version='0.5.1';provider='cursor';platform='windows';default_model='cursor-default';executor_healthy=$true;executor_version="SolRouter STDIO MCP via $script:Runtime generation=$script:McpGeneration";capabilities=@('health','list_workspaces','start','status');workspaces=$workspaces;updated_at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()};Ws-SendJson $ws $hello;Log 'connected';$backoff=1;while($ws.State -eq [Net.WebSockets.WebSocketState]::Open){$text=Ws-ReceiveText $ws;if($text -eq 'pong'){continue};try{$msg=$text|ConvertFrom-Json}catch{continue};if($msg.type -ne 'command'){continue};$cid=[string]$msg.id;$method=[string]$msg.method;$payload=if($msg.payload){$msg.payload}else{@{}};Log "command=$method id=$cid";try{$result=Execute-Command $method $payload;Ws-SendJson $ws @{type='result';id=$cid;ok=$true;result=$result};Log "result=$method ok"}catch{Ws-SendJson $ws @{type='result';id=$cid;ok=$false;error=$_.Exception.Message};Log "result=$method error=$($_.Exception.Message)"}}}catch{Log "disconnected: $($_.Exception.Message); retry in ${backoff}s"}finally{try{$ws.Dispose()}catch{}};Start-Sleep -Seconds $backoff;$backoff=[Math]::Min(30,$backoff*2)
}
