param()

$ErrorActionPreference='Stop'
$AgentVersion='0.7.1'
$AgentId=if($env:SOL_ROUTER_AGENT_ID){$env:SOL_ROUTER_AGENT_ID}else{'work-windows-cursor'}
$Gateway=if($env:SOL_ROUTER_GATEWAY){$env:SOL_ROUTER_GATEWAY}else{'wss://sol-router-gateway.331004814.workers.dev/agent/connect'}
$RouterRoot=if($env:SOL_ROUTER_CURSOR_APP){$env:SOL_ROUTER_CURSOR_APP}else{Join-Path $env:LOCALAPPDATA 'SolRouter\app'}
$InstallRoot=Join-Path $env:LOCALAPPDATA 'SolRouterGateway'
$AgentHome=Join-Path $HOME '.sol-router-agent'
$TokenFile=Join-Path $AgentHome 'agent-token'
$HelperPath=Join-Path $InstallRoot 'windows-cursor-mcp-helper-v7_1.ps1'
$JournalDir=Join-Path $InstallRoot 'start-journal'
$script:LastMcpError=''
$script:KnownWorkspaces=@()

function Log([string]$Text){[Console]::WriteLine("[$([DateTime]::Now.ToString('HH:mm:ss'))] $Text")}
function EnsureDir([string]$p){if(-not(Test-Path $p)){New-Item -ItemType Directory -Force -Path $p|Out-Null}}
EnsureDir $InstallRoot;EnsureDir $JournalDir

$created=$false
$script:Mutex=[Threading.Mutex]::new($true,"SolRouterGatewayAgent-$AgentId",[ref]$created)
if(-not $created){Log 'another Gateway Agent instance is already running; exiting';exit 23}

function Read-Token{
  if($env:SOL_ROUTER_AGENT_TOKEN){return $env:SOL_ROUTER_AGENT_TOKEN.Trim()}
  if(Test-Path $TokenFile){return(Get-Content $TokenFile -Raw).Trim()}
  throw "token_missing:$TokenFile"
}
function Check-LocalPrereqs{
  $stdio=Join-Path $RouterRoot 'mcp\dist\src\stdio.js'
  $config=Join-Path $RouterRoot 'mcp\config\config.json'
  if(-not(Test-Path $stdio)){throw "stdio_missing:$stdio"}
  if(-not(Test-Path $config)){throw "config_missing:$config"}
  if(-not(Test-Path $HelperPath)){throw "helper_missing:$HelperPath"}
  $node=Get-Command node.exe -ErrorAction SilentlyContinue
  if(-not $node){throw 'node.exe_not_found'}
  return $node.Source
}
function Ws-SendText($Ws,[string]$Text){
  $b=[Text.Encoding]::UTF8.GetBytes($Text)
  $s=[ArraySegment[byte]]::new($b)
  $Ws.SendAsync($s,[Net.WebSockets.WebSocketMessageType]::Text,$true,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
}
function Ws-SendJson($Ws,$Value){Ws-SendText $Ws ($Value|ConvertTo-Json -Depth 60 -Compress)}
function Ws-ReceiveText($Ws){
  $buffer=New-Object byte[] 65536
  $stream=New-Object IO.MemoryStream
  try{
    do{
      $seg=[ArraySegment[byte]]::new($buffer)
      $r=$Ws.ReceiveAsync($seg,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
      if($r.MessageType -eq [Net.WebSockets.WebSocketMessageType]::Close){throw 'websocket_closed'}
      $stream.Write($buffer,0,$r.Count)
    }while(-not $r.EndOfMessage)
    return[Text.Encoding]::UTF8.GetString($stream.ToArray())
  }finally{$stream.Dispose()}
}
function Invoke-Helper([string]$Method,$Payload,[int]$TimeoutMs){
  $id=[Guid]::NewGuid().ToString('N')
  $payloadFile=Join-Path $env:TEMP "sol-router-$id-in.json"
  $resultFile=Join-Path $env:TEMP "sol-router-$id-out.json"
  try{
    [IO.File]::WriteAllText($payloadFile,($Payload|ConvertTo-Json -Depth 60 -Compress))
    $args=@('-NoProfile','-ExecutionPolicy','Bypass','-File',$HelperPath,'-Method',$Method,'-PayloadFile',$payloadFile,'-ResultFile',$resultFile,'-RouterRoot',$RouterRoot)
    $p=Start-Process powershell.exe -WindowStyle Hidden -ArgumentList $args -PassThru
    if(-not $p.WaitForExit($TimeoutMs)){
      try{& taskkill.exe /PID $p.Id /T /F|Out-Null}catch{}
      $script:LastMcpError=('helper_timeout:{0}:{1}ms' -f $Method,$TimeoutMs)
      throw $script:LastMcpError
    }
    if(-not(Test-Path $resultFile)){throw ('helper_result_missing:{0}:exit={1}' -f $Method,$p.ExitCode)}
    $envResult=Get-Content $resultFile -Raw|ConvertFrom-Json
    if(-not $envResult.ok){$script:LastMcpError=[string]$envResult.error;throw $script:LastMcpError}
    $script:LastMcpError=''
    return $envResult.result
  }finally{
    Remove-Item $payloadFile,$resultFile -Force -ErrorAction SilentlyContinue
  }
}
function Start-Identity($Payload){
  $prompt=[string]$(if($Payload.prompt){$Payload.prompt}elseif($Payload.task){$Payload.task}else{''})
  $key=''
  if($prompt -match '^\[\[SOL_ROUTER_COMMAND_ID:([A-Za-z0-9._:-]{1,160})\]\](?:\r?\n)?'){
    $key=[string]$Matches[1]
    $prompt=$prompt.Substring($Matches[0].Length)
  }
  $copy=@{}
  foreach($p in $Payload.PSObject.Properties){$copy[$p.Name]=$p.Value}
  $copy['prompt']=$prompt
  $copy.Remove('task')|Out-Null
  return @{key=$key;payload=$copy}
}
function JournalPath([string]$Key){
  $safe=$Key -replace '[^A-Za-z0-9._-]','_'
  return Join-Path $JournalDir "$safe.json"
}
function Execute-Command([string]$Method,$Payload){
  switch($Method){
    'health'{
      $node=Check-LocalPrereqs
      return @{executor_healthy=$true;executor_version="isolated-per-command MCP via $node";agent_version=$AgentVersion;mcp_mode='isolated-per-command';last_mcp_error=$script:LastMcpError}
    }
    'list_workspaces'{
      $r=Invoke-Helper 'list_workspaces' @{} 30000
      $script:KnownWorkspaces=@($r.workspaces)
      return $r
    }
    'start'{
      $identity=Start-Identity $Payload
      if($identity.key){
        $jp=JournalPath $identity.key
        if(Test-Path $jp){return(Get-Content $jp -Raw|ConvertFrom-Json)}
      }
      $r=Invoke-Helper 'start' $identity.payload 120000
      if($identity.key){[IO.File]::WriteAllText((JournalPath $identity.key),($r|ConvertTo-Json -Depth 60 -Compress))}
      return $r
    }
    'status'{return Invoke-Helper 'status' $Payload 30000}
    'restart'{return @{scheduled=$true;mode='supervisor-restart'}}
    default{throw "unsupported_method:$Method"}
  }
}

$node=Check-LocalPrereqs
$token=Read-Token
$wsUrl="$Gateway$(if($Gateway.Contains('?')){'&'}else{'?'})agent_id=$([Uri]::EscapeDataString($AgentId))"
Log "agent=$AgentId version=$AgentVersion node=$node"
$backoff=1
while($true){
  $ws=[Net.WebSockets.ClientWebSocket]::new()
  try{
    $ws.Options.SetRequestHeader('Authorization',"Bearer $token")
    try{$ws.Options.KeepAliveInterval=[TimeSpan]::FromSeconds(20)}catch{}
    Log "connecting $wsUrl"
    $ws.ConnectAsync([Uri]$wsUrl,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $hello=@{type='hello';agent_id=$AgentId;version=$AgentVersion;provider='cursor';platform='windows';default_model='cursor-default';executor_healthy=$true;executor_version="isolated-per-command MCP via $node";capabilities=@('health','list_workspaces','start','status','restart');workspaces=$script:KnownWorkspaces;updated_at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()}
    Ws-SendJson $ws $hello
    Log 'connected'
    $backoff=1
    while($ws.State -eq [Net.WebSockets.WebSocketState]::Open){
      $text=Ws-ReceiveText $ws
      if($text -eq 'pong'){continue}
      try{$msg=$text|ConvertFrom-Json}catch{continue}
      if($msg.type -ne 'command'){continue}
      $cid=[string]$msg.id
      $method=[string]$msg.method
      $payload=if($msg.payload){$msg.payload}else{@{}}
      Log "command=$method id=$cid"
      try{
        $result=Execute-Command $method $payload
        Ws-SendJson $ws @{type='result';id=$cid;ok=$true;result=$result}
        Log "result=$method ok"
        if($method -eq 'restart'){Start-Sleep -Milliseconds 200;exit 0}
      }catch{
        Ws-SendJson $ws @{type='result';id=$cid;ok=$false;error=$_.Exception.Message}
        Log "result=$method error=$($_.Exception.Message)"
      }
    }
  }catch{Log "disconnected: $($_.Exception.Message); retry in ${backoff}s"}
  finally{try{$ws.Dispose()}catch{}}
  Start-Sleep -Seconds $backoff
  $backoff=[Math]::Min(30,$backoff*2)
}
