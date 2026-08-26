#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');

const VERSION = '0.8.0';
const AGENT_ID = process.env.SOL_ROUTER_AGENT_ID || 'work-windows-cursor';
const GATEWAY = process.env.SOL_ROUTER_GATEWAY || 'wss://sol-router-gateway.331004814.workers.dev/agent/connect';
const ROUTER_ROOT = process.env.SOL_ROUTER_CURSOR_APP || path.join(process.env.LOCALAPPDATA || '', 'SolRouter', 'app');
const TOKEN_FILE = path.join(os.homedir(), '.sol-router-agent', 'agent-token');
const NODE = process.execPath;
const MCP_ROOT = path.join(ROUTER_ROOT, 'mcp');
const STDIO = path.join(MCP_ROOT, 'dist', 'src', 'stdio.js');
const CONFIG = path.join(MCP_ROOT, 'config', 'config.json');
const JOURNAL_DIR = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'SolRouterGateway', 'start-journal');
fs.mkdirSync(JOURNAL_DIR, { recursive: true });

function log(s) { console.log(`[${new Date().toISOString()}] ${s}`); }
function readToken() {
  const value = String(process.env.SOL_ROUTER_AGENT_TOKEN || '').trim();
  if (value) return value;
  return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
}
function gatewayUrl() {
  const u = new URL(GATEWAY);
  u.searchParams.set('agent_id', AGENT_ID);
  return u;
}
function safeJournalKey(v) { return String(v || '').replace(/[^A-Za-z0-9._-]/g, '_'); }
function startIdentity(payload) {
  const copy = { ...(payload || {}) };
  let prompt = String(copy.prompt || copy.task || '');
  let key = '';
  const match = prompt.match(/^\[\[SOL_ROUTER_COMMAND_ID:([A-Za-z0-9._:-]{1,160})\]\](?:\r?\n)?/);
  if (match) { key = match[1]; prompt = prompt.slice(match[0].length); }
  copy.prompt = prompt;
  delete copy.task;
  return { key, payload: copy };
}

class WsClient extends EventEmitter {
  constructor(url, bearer) {
    super(); this.url = url; this.bearer = bearer; this.socket = null; this.buffer = Buffer.alloc(0); this.open = false; this.fragments = [];
  }
  connect() {
    return new Promise((resolve, reject) => {
      const secure = this.url.protocol === 'wss:';
      const port = Number(this.url.port || (secure ? 443 : 80));
      const key = crypto.randomBytes(16).toString('base64');
      const expected = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      const hostHeader = this.url.port ? `${this.url.hostname}:${port}` : this.url.hostname;
      const target = `${this.url.pathname || '/'}${this.url.search || ''}`;
      const socket = secure
        ? tls.connect({ host: this.url.hostname, port, servername: this.url.hostname })
        : net.connect({ host: this.url.hostname, port });
      this.socket = socket;
      let handshake = Buffer.alloc(0);
      const fail = (err) => { try { socket.destroy(); } catch {} reject(err); };
      socket.once('error', fail);
      socket.once('connect', () => {
        const req = [
          `GET ${target} HTTP/1.1`, `Host: ${hostHeader}`, 'Upgrade: websocket', 'Connection: Upgrade',
          `Sec-WebSocket-Key: ${key}`, 'Sec-WebSocket-Version: 13', `Authorization: Bearer ${this.bearer}`,
          'User-Agent: Sol-Router-Windows-Agent/0.8', '', ''
        ].join('\r\n');
        socket.write(req);
      });
      const onHandshake = (chunk) => {
        handshake = Buffer.concat([handshake, chunk]);
        const end = handshake.indexOf('\r\n\r\n'); if (end < 0) return;
        socket.off('data', onHandshake);
        const header = handshake.subarray(0, end + 4).toString('latin1');
        const lines = header.split('\r\n');
        if (!/^HTTP\/1\.1 101\b/.test(lines[0])) return fail(new Error(`websocket_handshake_failed:${lines[0]}`));
        const headers = Object.fromEntries(lines.slice(1).filter(x => x.includes(':')).map(x => { const i=x.indexOf(':'); return [x.slice(0,i).trim().toLowerCase(), x.slice(i+1).trim()]; }));
        if (headers['sec-websocket-accept'] !== expected) return fail(new Error('invalid_websocket_accept'));
        socket.removeListener('error', fail);
        socket.on('error', e => this.emit('error', e));
        socket.on('close', () => { this.open = false; this.emit('close'); });
        socket.on('data', chunk2 => this._onData(chunk2));
        this.open = true;
        const rest = handshake.subarray(end + 4); if (rest.length) this._onData(rest);
        resolve();
      };
      socket.on('data', onHandshake);
    });
  }
  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const b0 = this.buffer[0], b1 = this.buffer[1];
      const fin = !!(b0 & 0x80), opcode = b0 & 0x0f, masked = !!(b1 & 0x80);
      let len = b1 & 0x7f, offset = 2;
      if (len === 126) { if (this.buffer.length < 4) return; len = this.buffer.readUInt16BE(2); offset = 4; }
      else if (len === 127) { if (this.buffer.length < 10) return; const n = Number(this.buffer.readBigUInt64BE(2)); if (!Number.isSafeInteger(n)) throw new Error('frame_too_large'); len = n; offset = 10; }
      const maskLen = masked ? 4 : 0; if (this.buffer.length < offset + maskLen + len) return;
      let mask; if (masked) { mask = this.buffer.subarray(offset, offset+4); offset += 4; }
      let payload = Buffer.from(this.buffer.subarray(offset, offset+len));
      this.buffer = this.buffer.subarray(offset + len);
      if (masked) for (let i=0;i<payload.length;i++) payload[i] ^= mask[i%4];
      if (opcode === 0x8) { try { this.socket.end(); } catch {} return; }
      if (opcode === 0x9) { this._sendFrame(0xA, payload); continue; }
      if (opcode === 0xA) continue;
      if (opcode === 0x1) this.fragments = [payload];
      else if (opcode === 0x0) this.fragments.push(payload);
      else continue;
      if (fin) { const text = Buffer.concat(this.fragments).toString('utf8'); this.fragments = []; this.emit('message', text); }
    }
  }
  _sendFrame(opcode, payload) {
    if (!this.open || !this.socket) throw new Error('websocket_not_open');
    payload = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const mask = crypto.randomBytes(4); let header;
    if (payload.length < 126) { header = Buffer.alloc(2); header[0]=0x80|opcode; header[1]=0x80|payload.length; }
    else if (payload.length < 65536) { header = Buffer.alloc(4); header[0]=0x80|opcode; header[1]=0x80|126; header.writeUInt16BE(payload.length,2); }
    else { header = Buffer.alloc(10); header[0]=0x80|opcode; header[1]=0x80|127; header.writeBigUInt64BE(BigInt(payload.length),2); }
    const body = Buffer.alloc(payload.length); for (let i=0;i<payload.length;i++) body[i]=payload[i]^mask[i%4];
    this.socket.write(Buffer.concat([header, mask, body]));
  }
  sendJson(v) { this._sendFrame(0x1, JSON.stringify(v)); }
  close() { try { this._sendFrame(0x8, Buffer.alloc(0)); } catch {} try { this.socket?.destroy(); } catch {} }
}

function runMcpCommand(method, payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(NODE, [STDIO, CONFIG], { cwd: MCP_ROOT, stdio: ['pipe','pipe','ignore'], windowsHide: true, env: { ...process.env, NODE_NO_WARNINGS:'1' } });
    let seq=0, buffer='', settled=false, tools={}; const pending=new Map();
    const finish=(err,value)=>{ if(settled)return; settled=true; try{child.kill();}catch{} err?reject(err):resolve(value); };
    const rpc=(rpcMethod,params={},notification=false)=>new Promise((res,rej)=>{ const msg={jsonrpc:'2.0',method:rpcMethod,params}; if(!notification){msg.id=++seq;pending.set(String(msg.id),{res,rej});} child.stdin.write(JSON.stringify(msg)+'\n'); if(notification)res(null); });
    const toolText=r=>(r?.content||[]).filter(x=>x?.type==='text').map(x=>String(x.text||'')).join('\n');
    const parseTool=r=>{ if(r?.isError)throw new Error('tool_error:'+toolText(r).slice(0,2000)); if(r?.structuredContent!=null)return r.structuredContent; const t=toolText(r).trim(); if(t){try{return JSON.parse(t)}catch{return{text:t}}} return r; };
    const call=(name,args={})=>rpc('tools/call',{name,arguments:args}).then(parseTool);
    const props=name=>tools?.[name]?.inputSchema?.properties||tools?.[name]?.input_schema?.properties||{};
    const mapStart=p=>{ const out={}, keys=new Set(Object.keys(props('cursor_start'))); const put=(names,val)=>{if(!val)return;for(const k of names)if(keys.has(k)){out[k]=val;return;}}; put(['workspace','workspace_id','workspaceId','cwd','root'],String(p.workspace||'')); put(['prompt','task','instruction','instructions','objective','message'],String(p.prompt||p.task||'')); put(['model','model_id','modelId'],String(p.model||'')); return out; };
    const mapStatus=p=>{const rid=String(p.runId||p.run_id||p.id||'');if(!rid)throw new Error('run_id_required');const pr=props('cursor_status');for(const k of ['runId','run_id','id','jobId','job_id'])if(Object.prototype.hasOwnProperty.call(pr,k))return{[k]:rid};return{runId:rid};};
    const workspaceNames=v=>{const raw=Array.isArray(v)?v:(Array.isArray(v?.workspaces)?v.workspaces:(Array.isArray(v?.items)?v.items:[]));return raw.map(x=>typeof x==='string'?x:(x?.id||x?.name||x?.workspace||x?.workspace_id||x?.path)).filter(Boolean).map(String);};
    child.stdout.on('data',chunk=>{buffer+=chunk.toString('utf8');for(;;){const i=buffer.indexOf('\n');if(i<0)break;const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);if(!line)continue;let obj;try{obj=JSON.parse(line)}catch{continue}if(obj.id==null)continue;const p=pending.get(String(obj.id));if(!p)continue;pending.delete(String(obj.id));obj.error?p.rej(new Error(`mcp_rpc_error:${obj.error.code}:${obj.error.message}`)):p.res(obj.result);}});
    child.on('error',e=>finish(e)); child.on('exit',code=>{if(!settled)finish(new Error(`mcp_exited:${code}`));});
    (async()=>{try{await rpc('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'sol-router-windows-agent',version:VERSION}});await rpc('notifications/initialized',{},true);const list=await rpc('tools/list',{});tools=Object.fromEntries((list?.tools||[]).filter(t=>t?.name).map(t=>[String(t.name),t]));for(const n of ['cursor_list_workspaces','cursor_start','cursor_status'])if(!tools[n])throw new Error(`tool_missing:${n}`);let result;if(method==='list_workspaces')result={workspaces:workspaceNames(await call('cursor_list_workspaces',{}))};else if(method==='start'){const identity=startIdentity(payload);if(identity.key){const jp=path.join(JOURNAL_DIR,safeJournalKey(identity.key)+'.json');if(fs.existsSync(jp)){finish(null,JSON.parse(fs.readFileSync(jp,'utf8')));return;}result=await call('cursor_start',mapStart(identity.payload));fs.writeFileSync(jp,JSON.stringify(result));}else result=await call('cursor_start',mapStart(payload||{}));}else if(method==='status')result=await call('cursor_status',mapStatus(payload||{}));else throw new Error(`unsupported_method:${method}`);finish(null,result);}catch(e){finish(e);}})();
  });
}

let current = null;
function send(value) { if (!current?.open) return false; try { current.sendJson(value); return true; } catch { return false; } }
async function connectLoop() {
  for (;;) {
    const client = new WsClient(gatewayUrl(), readToken()); current = client;
    try {
      await client.connect();
      log(`connected agent=${AGENT_ID} version=${VERSION}`);
      send({type:'hello',agent_id:AGENT_ID,version:VERSION,provider:'cursor',platform:'windows',default_model:'cursor-default',executor_healthy:true,executor_version:`isolated MCP via ${NODE}`,capabilities:['health','list_workspaces','start','status','restart'],workspaces:[],updated_at:Date.now()});
      await new Promise(resolve => {
        client.on('message', text => {
          if (text === 'pong') return;
          let msg; try { msg = JSON.parse(text); } catch { return; }
          if (msg?.type !== 'command') return;
          const id=String(msg.id||''), method=String(msg.method||''), payload=msg.payload||{}; log(`command=${method} id=${id}`);
          if(method==='health'){send({type:'result',id,ok:true,result:{executor_healthy:true,executor_version:`isolated MCP via ${NODE}`,agent_version:VERSION}});return;}
          if(method==='restart'){send({type:'result',id,ok:true,result:{scheduled:true}});setTimeout(()=>process.exit(0),250);return;}
          runMcpCommand(method,payload).then(result=>{send({type:'result',id,ok:true,result});log(`result=${method} ok id=${id}`);}).catch(err=>{send({type:'result',id,ok:false,error:String(err?.message||err)});log(`result=${method} error=${err?.message||err} id=${id}`);});
        });
        client.once('close', resolve); client.once('error', e => { log(`websocket error=${e.message}`); resolve(); });
      });
    } catch (e) { log(`connect error=${e.message}`); }
    try { client.close(); } catch {} if (current===client) current=null;
    await new Promise(r=>setTimeout(r,1500));
  }
}

if(!fs.existsSync(STDIO))throw new Error(`stdio_missing:${STDIO}`);if(!fs.existsSync(CONFIG))throw new Error(`config_missing:${CONFIG}`);connectLoop().catch(e=>{log(`fatal=${e.message}`);process.exit(1);});
