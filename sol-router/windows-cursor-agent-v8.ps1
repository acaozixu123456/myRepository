param()

$ErrorActionPreference='Stop'
$AgentVersion='0.8.0'
$AgentId=if($env:SOL_ROUTER_AGENT_ID){$env:SOL_ROUTER_AGENT_ID}else{'work-windows-cursor'}
$Gateway=if($env:SOL_ROUTER_GATEWAY){$env:SOL_ROUTER_GATEWAY}else{'wss://sol-router-gateway.331004814.workers.dev/agent/connect'}
$InstallRoot=Join-Path $env:LOCALAPPDATA 'SolRouterGateway'
$AgentHome=Join-Path $HOME '.sol-router-agent'
$TokenFile=Join-Path $AgentHome 'agent-token'
$WorkerPath=Join-Path $InstallRoot 'windows-cursor-task-v8.mjs'
$WorkspaceFile=Join-Path $InstallRoot 'workspaces.json'
$TaskDir=Join-Path $InstallRoot 'tasks'

function Log([string]$Text){[Console]::WriteLine("[$([DateTime]::Now.ToString('HH:mm:ss'))] $Text")}
function EnsureDir([string]$Path){if(-not(Test-Path $Path)){New-Item -ItemType Directory -Force -Path $Path|Out-Null}}
function Read-Token{
  if($env:SOL_ROUTER_AGENT_TOKEN){return $env:SOL_ROUTER_AGENT_TOKEN.Trim()}
  if(Test-Path $TokenFile){return(Get-Content $TokenFile -Raw).Trim()}
  throw "token_missing:$TokenFile"
}
function Read-Workspaces{
  if(-not(Test-Path $WorkspaceFile)){throw "workspace_config_missing:$WorkspaceFile"}
  $cfg=Get-Content $WorkspaceFile -Raw|ConvertFrom-Json
  if(-not $cfg.workspaces){throw 'workspace_config_invalid'}
  return $cfg.workspaces
}
function Workspace-Names{
  $w=Read-Workspaces
  return @($w.PSObject.Properties|ForEach-Object{$_.Name})
}
function Resolve-Workspace([string]$Name){
  $w=Read-Workspaces
  $p=$w.PSObject.Properties[$Name]
  if(-not $p){throw "workspace_not_available:$Name"}
  $path=[string]$p.Value
  if(-not(Test-Path $path)){throw ('workspace_path_missing:{0}:{1}' -f $Name,$path)}
  return $path
}
function Safe-Id([string]$Value){return($Value -replace '[^A-Za-z0-9._-]','_')}
function Task-StatePath([string]$TaskId){return Join-Path $TaskDir ((Safe-Id $TaskId)+'.state.json')}
function Task-SpecPath([string]$TaskId){return Join-Path $TaskDir ((Safe-Id $TaskId)+'.spec.json')}
function Read-Task([string]$TaskId){
  $path=Task-StatePath $TaskId
  if(-not(Test-Path $path)){return $null}
  try{return Get-Content $path -Raw|ConvertFrom-Json}catch{return $null}
}
function Write-JsonAtomic([string]$Path,$Value){
  $tmp="$Path.$PID.tmp"
  [IO.File]::WriteAllText($tmp,($Value|ConvertTo-Json -Depth 40 -Compress))
  Move-Item -Force $tmp $Path
}
function Start-Identity($Payload,[string]$FallbackId){
  $prompt=[string]$(if($Payload.prompt){$Payload.prompt}elseif($Payload.task){$Payload.task}else{''})
  $key=$FallbackId
  if($prompt -match '^\[\[SOL_ROUTER_COMMAND_ID:([A-Za-z0-9._:-]{1,160})\]\](?:\r?\n)?'){
    $key=[string]$Matches[1]
    $prompt=$prompt.Substring($Matches[0].Length)
  }
  return @{taskId=$key;prompt=$prompt}
}
function Start-CursorTask([string]$CommandId,$Payload){
  $identity=Start-Identity $Payload $CommandId
  $taskId=[string]$identity.taskId
  $existing=Read-Task $taskId
  if($existing){return $existing}
  $workspace=[string]$Payload.workspace
  if(-not $workspace){throw 'workspace_required'}
  $workspacePath=Resolve-Workspace $workspace
  $statePath=Task-StatePath $taskId
  $specPath=Task-SpecPath $taskId
  $logPath=Join-Path $TaskDir ((Safe-Id $taskId)+'.stream.jsonl')
  $errPath=Join-Path $TaskDir ((Safe-Id $taskId)+'.stderr.log')
  $model=if($Payload.model){[string]$Payload.model}else{''}
  $initial=@{runId=$taskId;state='accepted';phase='queued';provider='cursor-cli';workspace=$workspace;workspacePath=$workspacePath;submittedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();lastOutput=''}
  Write-JsonAtomic $statePath $initial
  $spec=@{taskId=$taskId;workspace=$workspace;workspacePath=$workspacePath;prompt=[string]$identity.prompt;model=$model;stateFile=$statePath;logFile=$logPath;errorFile=$errPath}
  Write-JsonAtomic $specPath $spec
  $node=(Get-Command node.exe -ErrorAction Stop).Source
  $argLine='"'+$WorkerPath+'" "'+$specPath+'"'
  $proc=Start-Process -FilePath $node -WindowStyle Hidden -ArgumentList $argLine -PassThru
  $initial.workerPid=$proc.Id
  Write-JsonAtomic $statePath $initial
  return $initial
}
function Get-CursorTask($Payload){
  $rid=[string]$(if($Payload.runId){$Payload.runId}elseif($Payload.run_id){$Payload.run_id}else{$Payload.id})
  if(-not $rid){throw 'run_id_required'}
  $state=Read-Task $rid
  if(-not $state){throw "run_not_found:$rid"}
  return $state
}
function Execute-Command([string]$CommandId,[string]$Method,$Payload){
  switch($Method){
    'health'{
      $node=(Get-Command node.exe -ErrorAction Stop).Source
      if(-not(Test-Path $WorkerPath)){throw "worker_missing:$WorkerPath"}
      return @{executor_healthy=$true;executor_version="direct Cursor CLI via $node";agent_version=$AgentVersion;mode='thin-direct-cli';workspaces=@(Workspace-Names)}
    }
    'list_workspaces'{return @{workspaces=@(Workspace-Names)}}
    'start'{return Start-CursorTask $CommandId $Payload}
    'status'{return Get-CursorTask $Payload}
    'restart'{return @{scheduled=$true;mode='supervisor-restart'}}
    default{throw "unsupported_method:$Method"}
  }
}
function Ws-SendText($Ws,[string]$Text){
  $bytes=[Text.Encoding]::UTF8.GetBytes($Text)
  $seg=[ArraySegment[byte]]::new($bytes)
  $Ws.SendAsync($seg,[Net.WebSockets.WebSocketMessageType]::Text,$true,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
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

EnsureDir $InstallRoot
EnsureDir $TaskDir
$created=$false
$script:Mutex=[Threading.Mutex]::new($true,"SolRouterGatewayAgent-$AgentId",[ref]$created)
if(-not $created){Log 'another Gateway Agent instance is already running; exiting';exit 23}
$token=Read-Token
$null=Read-Workspaces
$node=(Get-Command node.exe -ErrorAction Stop).Source
if(-not(Test-Path $WorkerPath)){throw "worker_missing:$WorkerPath"}
$wsUrl="$Gateway$(if($Gateway.Contains('?')){'&'}else{'?'})agent_id=$([Uri]::EscapeDataString($AgentId))"
Log "agent=$AgentId version=$AgentVersion node=$node mode=thin-direct-cli"
$backoff=1
while($true){
  $ws=[Net.WebSockets.ClientWebSocket]::new()
  try{
    $ws.Options.SetRequestHeader('Authorization',"Bearer $token")
    try{$ws.Options.KeepAliveInterval=[TimeSpan]::FromSeconds(20)}catch{}
    Log "connecting $wsUrl"
    $ws.ConnectAsync([Uri]$wsUrl,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $hello=@{type='hello';agent_id=$AgentId;version=$AgentVersion;provider='cursor';platform='windows';default_model='cursor-default';executor_healthy=$true;executor_version="direct Cursor CLI via $node";capabilities=@('health','list_workspaces','start','status','restart');workspaces=@(Workspace-Names);updated_at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()}
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
        $result=Execute-Command $cid $method $payload
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
