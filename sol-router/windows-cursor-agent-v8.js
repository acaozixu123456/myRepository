#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const VERSION = '0.8.0';
const AGENT_ID = process.env.SOL_ROUTER_AGENT_ID || 'work-windows-cursor';
const GATEWAY = process.env.SOL_ROUTER_GATEWAY || 'wss://sol-router-gateway.331004814.workers.dev/agent/connect';
const ROUTER_ROOT = process.env.SOL_ROUTER_CURSOR_APP || path.join(process.env.LOCALAPPDATA || '', 'SolRouter', 'app');
const TOKEN_FILE = path.join(os.homedir(), '.sol-router-agent', 'agent-token');
const NODE = process.execPath;
const STDIO = path.join(ROUTER_ROOT, 'mcp', 'dist', 'src', 'stdio.js');
const CONFIG = path.join(ROUTER_ROOT, 'mcp', 'config', 'config.json');
const JOURNAL_DIR = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'SolRouterGateway', 'start-journal');

fs.mkdirSync(JOURNAL_DIR, { recursive: true });

function log(s) { console.log(`[${new Date().toLocaleTimeString()}] ${s}`); }
function token() {
  const env = (process.env.SOL_ROUTER_AGENT_TOKEN || '').trim();
  if (env) return env;
  return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
}
function wsUrl() {
  const u = new URL(GATEWAY);
  u.searchParams.set('agent_id', AGENT_ID);
  return u.toString();
}
function safeJournalKey(v) { return String(v || '').replace(/[^A-Za-z0-9._-]/g, '_'); }
function parseIdentity(payload) {
  const copy = { ...(payload || {}) };
  let prompt = String(copy.prompt || copy.task || '');
  let key = '';
  const m = prompt.match(/^\[\[SOL_ROUTER_COMMAND_ID:([A-Za-z0-9._:-]{1,160})\]\](?:\r?\n)?/);
  if (m) { key = m[1]; prompt = prompt.slice(m[0].length); }
  copy.prompt = prompt;
  delete copy.task;
  return { key, payload: copy };
}

function runMcpCommand(method, payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(NODE, [STDIO, CONFIG], {
      cwd: path.dirname(CONFIG),
      stdio: ['pipe', 'pipe', 'ignore'],
      windowsHide: true,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });
    let seq = 0;
    let buffer = '';
    const pending = new Map();
    let tools = null;
    let settled = false;

    const done = (err, value) => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch {}
      err ? reject(err) : resolve(value);
    };
    const rpc = (rpcMethod, params = {}, notification = false) => new Promise((res, rej) => {
      const msg = { jsonrpc: '2.0', method: rpcMethod, params };
      if (!notification) { msg.id = ++seq; pending.set(String(msg.id), { res, rej }); }
      child.stdin.write(JSON.stringify(msg) + '\n');
      if (notification) res(null);
    });
    const textContent = (r) => Array.isArray(r?.content) ? r.content.filter(x => x?.type === 'text').map(x => String(x.text || '')).join('\n') : '';
    const parseTool = (r) => {
      if (r?.isError) throw new Error('tool_error:' + textContent(r).slice(0, 2000));
      if (r?.structuredContent != null) return r.structuredContent;
      const t = textContent(r).trim();
      if (t) { try { return JSON.parse(t); } catch { return { text: t }; } }
      return r;
    };
    const call = async (name, args = {}) => parseTool(await rpc('tools/call', { name, arguments: args }));
    const props = (name) => tools?.[name]?.inputSchema?.properties || tools?.[name]?.input_schema?.properties || {};
    const workspaceNames = (v) => {
      let raw = Array.isArray(v) ? v : (Array.isArray(v?.workspaces) ? v.workspaces : (Array.isArray(v?.items) ? v.items : []));
      return raw.map(x => typeof x === 'string' ? x : (x?.id || x?.name || x?.workspace || x?.workspace_id || x?.path)).filter(Boolean).map(String);
    };
    const mapStart = (p) => {
      const out = {}; const pr = props('cursor_start'); const keys = new Set(Object.keys(pr));
      const put = (cands, val) => { if (!val) return; for (const k of cands) if (keys.has(k)) { out[k] = val; return; } };
      put(['workspace','workspace_id','workspaceId','cwd','root'], String(p.workspace || ''));
      put(['prompt','task','instruction','instructions','objective','message'], String(p.prompt || p.task || ''));
      put(['model','model_id','modelId'], String(p.model || ''));
      return out;
    };
    const mapStatus = (p) => {
      const rid = String(p.runId || p.run_id || p.id || ''); if (!rid) throw new Error('run_id_required');
      const pr = props('cursor_status'); for (const k of ['runId','run_id','id','jobId','job_id']) if (Object.prototype.hasOwnProperty.call(pr, k)) return { [k]: rid };
      return { runId: rid };
    };

    child.stdout.on('data', chunk => {
      buffer += chunk.toString('utf8');
      for (;;) {
        const i = buffer.indexOf('\n'); if (i < 0) break;
        const line = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1);
        if (!line) continue;
        let obj; try { obj = JSON.parse(line); } catch { continue; }
        if (obj.id == null) continue;
        const p = pending.get(String(obj.id)); if (!p) continue;
        pending.delete(String(obj.id));
        obj.error ? p.rej(new Error(`mcp_rpc_error:${obj.error.code}:${obj.error.message}`)) : p.res(obj.result);
      }
    });
    child.on('error', e => done(e));
    child.on('exit', code => { if (!settled && code !== 0) done(new Error(`mcp_exited:${code}`)); });

    (async () => {
      try {
        await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'sol-router-windows-agent', version: VERSION } });
        await rpc('notifications/initialized', {}, true);
        const list = await rpc('tools/list', {});
        tools = Object.fromEntries((list?.tools || []).filter(t => t?.name).map(t => [String(t.name), t]));
        for (const name of ['cursor_list_workspaces','cursor_start','cursor_status']) if (!tools[name]) throw new Error(`tool_missing:${name}`);
        let result;
        if (method === 'list_workspaces') result = { workspaces: workspaceNames(await call('cursor_list_workspaces', {})) };
        else if (method === 'start') {
          const identity = parseIdentity(payload);
          if (identity.key) {
            const jp = path.join(JOURNAL_DIR, safeJournalKey(identity.key) + '.json');
            if (fs.existsSync(jp)) { done(null, JSON.parse(fs.readFileSync(jp, 'utf8'))); return; }
            result = await call('cursor_start', mapStart(identity.payload));
            fs.writeFileSync(jp, JSON.stringify(result));
          } else result = await call('cursor_start', mapStart(payload || {}));
        }
        else if (method === 'status') result = await call('cursor_status', mapStatus(payload || {}));
        else throw new Error(`unsupported_method:${method}`);
        done(null, result);
      } catch (e) { done(e); }
    })();
  });
}

function main() {
  if (!fs.existsSync(STDIO)) throw new Error(`stdio_missing:${STDIO}`);
  if (!fs.existsSync(CONFIG)) throw new Error(`config_missing:${CONFIG}`);
  const ws = new WebSocket(wsUrl(), { headers: { Authorization: `Bearer ${token()}` } });
  ws.on('open', () => {
    log(`connected agent=${AGENT_ID} version=${VERSION}`);
    ws.send(JSON.stringify({ type:'hello', agent_id:AGENT_ID, version:VERSION, provider:'cursor', platform:'windows', default_model:'cursor-default', executor_healthy:true, executor_version:`isolated MCP via ${NODE}`, capabilities:['health','list_workspaces','start','status','restart'], workspaces:[], updated_at:Date.now() }));
  });
  ws.on('message', raw => {
    const text = raw.toString(); if (text === 'pong') return;
    let msg; try { msg = JSON.parse(text); } catch { return; }
    if (msg?.type !== 'command') return;
    const id = String(msg.id || ''); const method = String(msg.method || ''); const payload = msg.payload || {};
    log(`command=${method} id=${id}`);
    if (method === 'health') { ws.send(JSON.stringify({ type:'result', id, ok:true, result:{ executor_healthy:true, executor_version:`isolated MCP via ${NODE}`, agent_version:VERSION } })); return; }
    if (method === 'restart') { ws.send(JSON.stringify({ type:'result', id, ok:true, result:{ scheduled:true } })); setTimeout(() => process.exit(0), 250); return; }
    runMcpCommand(method, payload)
      .then(result => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type:'result', id, ok:true, result })); log(`result=${method} ok id=${id}`); })
      .catch(err => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type:'result', id, ok:false, error:String(err?.message || err) })); log(`result=${method} error=${err?.message || err} id=${id}`); });
  });
  ws.on('close', () => { log('disconnected'); setTimeout(main, 1500); });
  ws.on('error', err => log(`websocket error=${err.message}`));
}

main();
