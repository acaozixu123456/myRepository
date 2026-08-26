param(
  [Parameter(Mandatory=$true)][string]$Method,
  [Parameter(Mandatory=$true)][string]$PayloadFile,
  [Parameter(Mandatory=$true)][string]$ResultFile,
  [Parameter(Mandatory=$true)][string]$RouterRoot
)

$ErrorActionPreference='Stop'
$McpRoot=Join-Path $RouterRoot 'mcp'
$StdioEntry=Join-Path $McpRoot 'dist\src\stdio.js'
$ConfigPath=Join-Path $McpRoot 'config\config.json'
$script:Mcp=$null
$script:Seq=0
$script:Tools=@{}

function Write-Envelope($Value){[IO.File]::WriteAllText($ResultFile,($Value|ConvertTo-Json -Depth 60 -Compress))}
function Find-Node{
  $n=Get-Command node.exe -ErrorAction SilentlyContinue
  if($n){return $n.Source}
  $fallback=Join-Path $env:LOCALAPPDATA 'cursor-agent\current\node.exe'
  if(Test-Path $fallback){return $fallback}
  throw 'node.exe_not_found'
}
function Stop-Mcp{
  if($script:Mcp){
    try{if(-not $script:Mcp.HasExited){$script:Mcp.Kill()}}catch{}
    try{$script:Mcp.WaitForExit(1200)|Out-Null}catch{}
    try{$script:Mcp.Dispose()}catch{}
  }
  $script:Mcp=$null
}
function Rpc([string]$RpcMethod,[object]$Params=@{},[switch]$Notification){
  if(-not $script:Mcp -or $script:Mcp.HasExited){throw 'mcp_not_running'}
  if($Notification){
    $msg=@{jsonrpc='2.0';method=$RpcMethod;params=$Params}|ConvertTo-Json -Depth 50 -Compress
    $script:Mcp.StandardInput.WriteLine($msg)
    $script:Mcp.StandardInput.Flush()
    return $null
  }
  $script:Seq+=1
  $id=$script:Seq
  $msg=@{jsonrpc='2.0';id=$id;method=$RpcMethod;params=$Params}|ConvertTo-Json -Depth 50 -Compress
  $script:Mcp.StandardInput.WriteLine($msg)
  $script:Mcp.StandardInput.Flush()
  while($true){
    $line=$script:Mcp.StandardOutput.ReadLine()
    if($null -eq $line){
      if($script:Mcp.HasExited){throw "mcp_exited:$($script:Mcp.ExitCode)"}
      continue
    }
    $line=$line.Trim()
    if(-not $line){continue}
    try{$obj=$line|ConvertFrom-Json}catch{continue}
    if($null -eq $obj.id -or [string]$obj.id -ne [string]$id){continue}
    if($obj.error){throw "mcp_rpc_error:$($obj.error.code):$($obj.error.message)"}
    return $obj.result
  }
}
function Start-Mcp{
  if(-not(Test-Path $StdioEntry)){throw "stdio_missing:$StdioEntry"}
  if(-not(Test-Path $ConfigPath)){throw "config_missing:$ConfigPath"}
  $psi=[Diagnostics.ProcessStartInfo]::new()
  $psi.FileName=Find-Node
  $psi.Arguments='"'+$StdioEntry+'" "'+$ConfigPath+'"'
  $psi.WorkingDirectory=$McpRoot
  $psi.UseShellExecute=$false
  $psi.RedirectStandardInput=$true
  $psi.RedirectStandardOutput=$true
  $psi.RedirectStandardError=$false
  $psi.CreateNoWindow=$true
  $psi.EnvironmentVariables['NODE_NO_WARNINGS']='1'
  $script:Mcp=[Diagnostics.Process]::new()
  $script:Mcp.StartInfo=$psi
  if(-not $script:Mcp.Start()){throw 'mcp_start_failed'}
  $init=@{protocolVersion='2025-03-26';capabilities=@{};clientInfo=@{name='sol-router-windows-helper';version='0.7.1'}}
  $null=Rpc 'initialize' $init
  $null=Rpc 'notifications/initialized' @{} -Notification
  $tools=Rpc 'tools/list' @{}
  foreach($t in @($tools.tools)){if($t.name){$script:Tools[[string]$t.name]=$t}}
  foreach($required in 'cursor_list_workspaces','cursor_start','cursor_status'){
    if(-not $script:Tools.ContainsKey($required)){throw "tool_missing:$required"}
  }
}
function ToolText($r){$p=@();foreach($i in @($r.content)){if($i.type -eq 'text'){$p+=[string]$i.text}};return($p -join "`n")}
function ParseTool($r){
  if($r.isError){throw "tool_error:$(ToolText $r)"}
  if($null -ne $r.structuredContent){return $r.structuredContent}
  $t=(ToolText $r).Trim()
  if($t){try{return $t|ConvertFrom-Json}catch{return @{text=$t}}}
  return $r
}
function CallTool([string]$Name,[hashtable]$Args=@{}){return ParseTool (Rpc 'tools/call' @{name=$Name;arguments=$Args})}
function ToolProps([string]$Name){
  $tool=$script:Tools[$Name]
  $h=@{}
  if(-not $tool){return $h}
  $schema=if($tool.inputSchema){$tool.inputSchema}else{$tool.input_schema}
  if($schema.properties){foreach($p in $schema.properties.PSObject.Properties){$h[$p.Name]=$p.Value}}
  return $h
}
function WorkspaceNames($v){
  $raw=if($v.workspaces){@($v.workspaces)}elseif($v.items){@($v.items)}else{@($v)}
  $out=@()
  foreach($item in $raw){
    if($item -is [string]){$out+=$item;continue}
    foreach($k in 'id','name','workspace','workspace_id','path'){if($item.$k){$out+=[string]$item.$k;break}}
  }
  return @($out)
}
function MapStart($p){
  $props=ToolProps 'cursor_start'
  $a=@{}
  $w=[string]$p.workspace
  $prompt=[string]$(if($p.prompt){$p.prompt}elseif($p.task){$p.task}else{''})
  $model=[string]$p.model
  foreach($k in 'workspace','workspace_id','workspaceId','cwd','root'){if($w -and $props.ContainsKey($k)){$a[$k]=$w;break}}
  foreach($k in 'prompt','task','instruction','instructions','objective','message'){if($prompt -and $props.ContainsKey($k)){$a[$k]=$prompt;break}}
  foreach($k in 'model','model_id','modelId'){if($model -and $props.ContainsKey($k)){$a[$k]=$model;break}}
  return $a
}
function MapStatus($p){
  $props=ToolProps 'cursor_status'
  $rid=[string]$(if($p.runId){$p.runId}elseif($p.run_id){$p.run_id}else{$p.id})
  if(-not $rid){throw 'run_id_required'}
  foreach($k in 'runId','run_id','id','jobId','job_id'){if($props.ContainsKey($k)){return @{$k=$rid}}}
  return @{runId=$rid}
}

try{
  $payload=if(Test-Path $PayloadFile){Get-Content $PayloadFile -Raw|ConvertFrom-Json}else{@{}}
  Start-Mcp
  switch($Method){
    'list_workspaces'{$result=@{workspaces=@(WorkspaceNames (CallTool 'cursor_list_workspaces' @{}))}}
    'start'{
      $w=[string]$payload.workspace
      $available=@(WorkspaceNames (CallTool 'cursor_list_workspaces' @{}))
      if($w -and $available.Count -gt 0 -and $available -notcontains $w){throw "workspace_not_available:$w"}
      $result=CallTool 'cursor_start' (MapStart $payload)
    }
    'status'{$result=CallTool 'cursor_status' (MapStatus $payload)}
    default{throw "unsupported_helper_method:$Method"}
  }
  Write-Envelope @{ok=$true;result=$result}
  exit 0
}catch{
  Write-Envelope @{ok=$false;error=$_.Exception.Message}
  exit 1
}finally{Stop-Mcp}
