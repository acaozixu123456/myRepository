#!/usr/bin/env python3
import base64, hashlib, json, os, platform, re, socket, ssl, struct, subprocess, threading, time
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen

VERSION = '0.2.0-windows'
HOME = Path.home()/'.sol-router-agent'
HOME.mkdir(parents=True, exist_ok=True)

class CursorSolRouterAdapter:
    capabilities = ['health', 'list_workspaces', 'start', 'status']
    required = {'cursor_list_workspaces', 'cursor_start', 'cursor_status'}

    def __init__(self):
        self.app_root = Path(os.environ.get('SOL_ROUTER_CURSOR_APP', str(Path(os.environ.get('LOCALAPPDATA', str(Path.home()/'AppData'/'Local'))) / 'SolRouter' / 'app'))).expanduser()
        self.endpoint = os.environ.get('SOL_ROUTER_CURSOR_MCP_URL', '').strip()
        self.tools = None
        if not self.endpoint:
            self.endpoint = self._discover_endpoint()

    def _json(self, raw, content_type=''):
        text = raw.decode('utf-8', errors='replace').strip()
        if 'text/event-stream' in content_type or text.startswith('event:') or '\ndata:' in text:
            for line in reversed(text.splitlines()):
                if line.startswith('data:'):
                    value = line[5:].strip()
                    if value and value != '[DONE]':
                        try: return json.loads(value)
                        except Exception: pass
        return json.loads(text or '{}')

    def _rpc_to(self, endpoint, method, params=None, timeout=20):
        body = {'jsonrpc':'2.0','id':int(time.time()*1000)%2147483647,'method':method,'params':params or {}}
        req = Request(endpoint, data=json.dumps(body,separators=(',',':')).encode(), headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','User-Agent':'sol-router-windows-agent/0.2'}, method='POST')
        with urlopen(req, timeout=timeout) as res: payload = self._json(res.read(), res.headers.get('content-type',''))
        if not isinstance(payload, dict): raise RuntimeError('invalid_mcp_response')
        if payload.get('error'):
            err = payload['error']; raise RuntimeError(f"mcp_rpc_error:{err.get('code')}:{err.get('message')}")
        if 'result' not in payload: raise RuntimeError('invalid_mcp_response')
        return payload['result']

    def _rpc(self, method, params=None, timeout=20):
        if not self.endpoint: raise RuntimeError('local_solrouter_mcp_not_found')
        return self._rpc_to(self.endpoint, method, params, timeout)

    def _ports_from_windows(self):
        script = r"""
$ErrorActionPreference='SilentlyContinue'
$root = $env:LOCALAPPDATA + '\SolRouter\app'
$pids = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($root) } | Select-Object -ExpandProperty ProcessId
foreach ($pid in $pids) { Get-NetTCPConnection -State Listen -OwningProcess $pid | Select-Object -ExpandProperty LocalPort }
"""
        ports = []
        try:
            p = subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',script], capture_output=True, text=True, timeout=8)
            for line in p.stdout.splitlines():
                line=line.strip()
                if line.isdigit():
                    port=int(line)
                    if 1 <= port <= 65535 and port not in ports: ports.append(port)
        except Exception: pass
        return ports

    def _ports_from_source(self):
        ports=[]
        if not self.app_root.exists(): return ports
        patterns=[re.compile(r'127\.0\.0\.1:(\d{2,5})'),re.compile(r'localhost:(\d{2,5})'),re.compile(r'\.listen\(\s*(\d{2,5})'),re.compile(r'PORT\s*[:=]\s*["\']?(\d{2,5})')]
        checked=0
        for path in self.app_root.rglob('*'):
            if checked > 350: break
            if not path.is_file() or path.suffix.lower() not in {'.js','.mjs','.cjs','.json','.env','.txt'}: continue
            try:
                if path.stat().st_size > 1_000_000: continue
                text=path.read_text(encoding='utf-8',errors='ignore')
            except Exception: continue
            checked += 1
            for pattern in patterns:
                for m in pattern.finditer(text):
                    port=int(m.group(1))
                    if 1 <= port <= 65535 and port not in ports: ports.append(port)
        return ports

    def _probe(self, endpoint):
        try:
            result=self._rpc_to(endpoint,'tools/list',{},timeout=3)
            tools=result.get('tools',[]) if isinstance(result,dict) else []
            names={str(t.get('name','')) for t in tools if isinstance(t,dict)}
            if self.required.issubset(names):
                self.tools={str(t['name']):t for t in tools if isinstance(t,dict) and t.get('name')}; return True
        except Exception: return False
        return False

    def _discover_endpoint(self):
        ports=[]
        for p in self._ports_from_windows()+self._ports_from_source()+[8787,8765,3000,3001,4318]:
            if p not in ports: ports.append(p)
        for port in ports:
            for path in ('/mcp','/api/mcp','/'):
                url=f'http://127.0.0.1:{port}{path}'
                if self._probe(url): return url
        return ''

    def _ensure_tools(self):
        if self.tools is not None: return self.tools
        result=self._rpc('tools/list',{}); tools=result.get('tools',[]) if isinstance(result,dict) else []
        self.tools={str(t['name']):t for t in tools if isinstance(t,dict) and t.get('name')}
        missing=sorted(self.required-set(self.tools))
        if missing: raise RuntimeError('local_solrouter_missing_tools:'+','.join(missing))
        return self.tools

    def _schema(self,name):
        tool=self._ensure_tools().get(name) or {}; schema=tool.get('inputSchema') or tool.get('input_schema') or {}
        return schema if isinstance(schema,dict) else {}

    def _text(self,result):
        parts=[]
        if isinstance(result,dict):
            for item in result.get('content',[]) or []:
                if isinstance(item,dict) and item.get('type')=='text': parts.append(str(item.get('text','')))
        return '\n'.join(parts)

    def _parse_tool(self,result):
        if isinstance(result,dict):
            if result.get('isError'): raise RuntimeError('local_solrouter_tool_error:'+self._text(result)[:2000])
            structured=result.get('structuredContent') or result.get('structured_content')
            if structured is not None: return structured
            text=self._text(result).strip()
            if text:
                try: return json.loads(text)
                except Exception: return {'text':text}
        return result

    def _call(self,name,arguments=None,timeout=60): return self._parse_tool(self._rpc('tools/call',{'name':name,'arguments':arguments or {}},timeout))
    def _props(self,name):
        p=self._schema(name).get('properties') or {}; return p if isinstance(p,dict) else {}

    def _start_args(self,payload):
        props=self._props('cursor_start'); keys=set(props); args={}
        workspace=str(payload.get('workspace','')).strip(); prompt=str(payload.get('prompt') or payload.get('task') or '').strip(); model=str(payload.get('model') or '').strip()
        def put(candidates,value):
            if not value: return False
            for key in candidates:
                if key in keys: args[key]=value; return True
            return False
        put(('workspace','workspace_id','workspaceId','cwd','root'),workspace)
        prompt_set=put(('prompt','task','instruction','instructions','objective','message'),prompt)
        put(('model','model_id','modelId'),model)
        for k,v in payload.items():
            if k in keys and k not in args: args[k]=v
        if prompt and not prompt_set:
            required=self._schema('cursor_start').get('required') or []
            candidates=[k for k in required if k in props and k not in args and isinstance(props.get(k),dict) and props[k].get('type') in (None,'string')]
            if len(candidates)==1: args[candidates[0]]=prompt
        return args

    def _status_args(self,payload):
        props=self._props('cursor_status'); rid=str(payload.get('runId') or payload.get('run_id') or payload.get('id') or '').strip()
        if not rid: raise RuntimeError('run_id_required')
        for key in ('runId','run_id','id','jobId','job_id'):
            if key in props: return {key:rid}
        return {'runId':rid}

    def _workspace_names(self,value):
        if isinstance(value,dict):
            if isinstance(value.get('workspaces'),list): value=value['workspaces']
            elif isinstance(value.get('items'),list): value=value['items']
        if not isinstance(value,list): return []
        out=[]
        for item in value:
            if isinstance(item,str): name=item
            elif isinstance(item,dict): name=item.get('id') or item.get('name') or item.get('workspace') or item.get('workspace_id') or item.get('path')
            else: name=None
            if name: out.append(str(name))
        return out

    def health(self):
        try:
            tools=self._ensure_tools(); return {'executor_healthy':True,'executor_version':f"SolRouter MCP ({len(tools)} tools) {self.endpoint}"}
        except Exception as e: return {'executor_healthy':False,'executor_version':str(e)[:300]}
    def list_workspaces(self): return {'workspaces':self._workspace_names(self._call('cursor_list_workspaces',{},30))}
    def start(self,payload):
        workspace=str(payload.get('workspace','')).strip(); available=set(self.list_workspaces()['workspaces'])
        if workspace and available and workspace not in available: raise RuntimeError(f'workspace_not_available:{workspace}')
        value=self._call('cursor_start',self._start_args(payload),45)
        if isinstance(value,dict):
            value.setdefault('provider','cursor')
            if workspace: value.setdefault('workspace',workspace)
        return value
    def status(self,payload): return self._call('cursor_status',self._status_args(payload),30)
    def execute(self,method,payload):
        if method=='health': return self.health()
        if method=='list_workspaces': return self.list_workspaces()
        if method=='start': return self.start(payload)
        if method=='status': return self.status(payload)
        raise RuntimeError(f'unsupported_method:{method}')

class WSClient:
    GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
    def __init__(self,url,token): self.url=url; self.token=token; self.sock=None; self.lock=threading.Lock()
    def connect(self):
        u=urlparse(self.url); port=u.port or (443 if u.scheme=='wss' else 80); raw=socket.create_connection((u.hostname,port),timeout=15)
        if u.scheme=='wss': raw=ssl.create_default_context().wrap_socket(raw,server_hostname=u.hostname)
        raw.settimeout(30); self.sock=raw; key=base64.b64encode(os.urandom(16)).decode(); host=u.hostname if port in (80,443) else f'{u.hostname}:{port}'; path=u.path or '/'
        if u.query: path+='?'+u.query
        request=(f'GET {path} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'+f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\nAuthorization: Bearer {self.token}\r\n'+'User-Agent: Sol-Router-Windows-Agent/0.2\r\n\r\n')
        raw.sendall(request.encode()); header=self._read_until(b'\r\n\r\n',65536).decode('latin1'); first=header.split('\r\n',1)[0]
        if ' 101 ' not in first: raise RuntimeError(f'websocket_handshake_failed:{first}')
        headers={}
        for line in header.split('\r\n')[1:]:
            if ':' in line:
                k,v=line.split(':',1); headers[k.lower().strip()]=v.strip()
        expected=base64.b64encode(hashlib.sha1((key+self.GUID).encode()).digest()).decode()
        if headers.get('sec-websocket-accept')!=expected: raise RuntimeError('invalid_websocket_accept')
    def _read_until(self,marker,limit):
        data=bytearray()
        while marker not in data:
            chunk=self.sock.recv(4096)
            if not chunk: raise ConnectionError('socket_closed')
            data.extend(chunk)
            if len(data)>limit: raise RuntimeError('header_too_large')
        return bytes(data)
    def _exact(self,n):
        out=bytearray()
        while len(out)<n:
            chunk=self.sock.recv(n-len(out))
            if not chunk: raise ConnectionError('socket_closed')
            out.extend(chunk)
        return bytes(out)
    def send_frame(self,opcode,payload=b''):
        if isinstance(payload,str): payload=payload.encode()
        n=len(payload); head=bytearray([0x80|opcode])
        if n<126: head.append(0x80|n)
        elif n<65536: head.append(0x80|126); head.extend(struct.pack('!H',n))
        else: head.append(0x80|127); head.extend(struct.pack('!Q',n))
        mask=os.urandom(4); head.extend(mask); body=bytes(b^mask[i%4] for i,b in enumerate(payload))
        with self.lock: self.sock.sendall(bytes(head)+body)
    def send_json(self,v): self.send_frame(0x1,json.dumps(v,separators=(',',':')))
    def ping(self): self.send_frame(0x1,'ping')
    def recv_text(self):
        fragments=bytearray(); active=False
        while True:
            first,second=self._exact(2); opcode=first&0x0F; fin=bool(first&0x80); masked=bool(second&0x80); n=second&0x7F
            if n==126: n=struct.unpack('!H',self._exact(2))[0]
            elif n==127: n=struct.unpack('!Q',self._exact(8))[0]
            mask=self._exact(4) if masked else None; payload=self._exact(n) if n else b''
            if mask: payload=bytes(b^mask[i%4] for i,b in enumerate(payload))
            if opcode==0x8: raise ConnectionError('websocket_closed')
            if opcode==0x9: self.send_frame(0xA,payload); continue
            if opcode==0xA: continue
            if opcode==0x1:
                fragments=bytearray(payload); active=True
                if fin: return fragments.decode()
            elif opcode==0x0 and active:
                fragments.extend(payload)
                if fin: return fragments.decode()
    def close(self):
        try: self.send_frame(0x8,b'')
        except Exception: pass
        try: self.sock.close()
        except Exception: pass

def read_token():
    v=os.environ.get('SOL_ROUTER_AGENT_TOKEN','').strip()
    if v: return v
    for path in [HOME/'agent-token',HOME/'token']:
        if path.exists():
            v=path.read_text().strip()
            if v: return v
    return ''

def with_agent_id(base,agent_id):
    u=urlparse(base); q=dict(parse_qsl(u.query)); q['agent_id']=agent_id; return urlunparse((u.scheme,u.netloc,u.path,u.params,urlencode(q),u.fragment))

def main():
    token=read_token()
    if not token: raise SystemExit('Missing ~/.sol-router-agent/agent-token')
    gateway=os.environ.get('SOL_ROUTER_GATEWAY','wss://sol-router-gateway.331004814.workers.dev/agent/connect').strip(); agent_id=os.environ.get('SOL_ROUTER_AGENT_ID','work-windows-cursor').strip(); adapter=CursorSolRouterAdapter(); health=adapter.health(); workspaces=adapter.list_workspaces()['workspaces'] if health['executor_healthy'] else []
    hello={'type':'hello','agent_id':agent_id,'version':VERSION,'provider':'cursor','platform':platform.system().lower(),'default_model':'cursor-default','executor_healthy':health['executor_healthy'],'executor_version':health['executor_version'],'capabilities':adapter.capabilities,'workspaces':workspaces,'updated_at':int(time.time()*1000)}; ws_url=with_agent_id(gateway,agent_id)
    print(f'[Sol Router Agent] id={agent_id} provider=cursor'); print(f'[Sol Router Agent] local={health["executor_version"]}'); print(f'[Sol Router Agent] workspaces={", ".join(workspaces)}')
    backoff=1
    while True:
        client=WSClient(ws_url,token); stop=threading.Event()
        try:
            print('[Sol Router Agent] connecting...'); client.connect(); client.send_json(hello); print('[Sol Router Agent] connected'); backoff=1
            def keepalive():
                while not stop.wait(25):
                    try: client.ping()
                    except Exception: return
            threading.Thread(target=keepalive,daemon=True).start()
            while True:
                try: text=client.recv_text()
                except socket.timeout: client.ping(); continue
                if text=='pong': continue
                try: msg=json.loads(text)
                except Exception: continue
                if msg.get('type')!='command': continue
                cid=str(msg.get('id','')); method=str(msg.get('method','')); payload=msg.get('payload') or {}; print(f'[Sol Router Agent] command={method} id={cid}')
                try:
                    result=adapter.execute(method,payload); client.send_json({'type':'result','id':cid,'ok':True,'result':result}); print(f'[Sol Router Agent] result={method} ok')
                except Exception as e:
                    client.send_json({'type':'result','id':cid,'ok':False,'error':str(e)}); print(f'[Sol Router Agent] result={method} error={e}')
        except KeyboardInterrupt: stop.set(); client.close(); break
        except Exception as e:
            stop.set(); client.close(); print(f'[Sol Router Agent] disconnected: {e}; retry in {backoff}s'); time.sleep(backoff); backoff=min(30,backoff*2)

if __name__=='__main__': main()
