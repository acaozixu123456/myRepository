import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import os from 'node:os';

const specPath = process.argv[2];
if (!specPath) throw new Error('spec_path_required');
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const stateFile = String(spec.stateFile || '');
const logFile = String(spec.logFile || '');
const errorFile = String(spec.errorFile || '');
if (!stateFile || !logFile || !errorFile) throw new Error('task_paths_required');
mkdirSync(dirname(stateFile), { recursive: true });

function writeJson(path, value) { writeFileSync(path, JSON.stringify(value)); }
function now() { return Date.now(); }
function readState() {
  try { return JSON.parse(readFileSync(stateFile, 'utf8')); }
  catch { return {}; }
}
function patchState(patch) {
  const next = { ...readState(), ...patch, updatedAt: now() };
  writeJson(stateFile, next);
  return next;
}
function where(name) {
  try {
    const out = spawnSync('where.exe', [name], { encoding: 'utf8', windowsHide: true });
    if (out.status === 0) {
      const first = String(out.stdout || '').split(/\r?\n/).map(s => s.trim()).find(Boolean);
      if (first && existsSync(first)) return first;
    }
  } catch {}
  return '';
}
function discoverCli() {
  const env = String(process.env.CURSOR_AGENT_BIN || '').trim();
  if (env && existsSync(env)) return env;
  for (const name of ['agent.exe', 'cursor-agent.exe', 'agent', 'cursor-agent']) {
    const p = where(name);
    if (p) return p;
  }
  const home = os.homedir();
  const local = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local');
  const candidates = [
    join(home, '.local', 'bin', 'agent.exe'),
    join(home, '.local', 'bin', 'cursor-agent.exe'),
    join(local, 'cursor-agent', 'current', 'agent.exe'),
    join(local, 'cursor-agent', 'current', 'cursor-agent.exe'),
  ];
  return candidates.find(existsSync) || '';
}
function short(value, max = 1600) {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}
function eventText(obj, raw) {
  if (!obj || typeof obj !== 'object') return short(raw);
  for (const key of ['text', 'result', 'content', 'message', 'summary']) {
    if (typeof obj[key] === 'string' && obj[key].trim()) return short(obj[key].trim());
  }
  if (obj.message && typeof obj.message === 'object') {
    for (const key of ['text', 'content']) {
      if (typeof obj.message[key] === 'string' && obj.message[key].trim()) return short(obj.message[key].trim());
    }
  }
  return short(raw);
}
function eventPhase(obj) {
  if (!obj || typeof obj !== 'object') return 'running';
  return String(obj.subtype || obj.type || obj.event || obj.kind || 'running');
}

const cli = discoverCli();
if (!cli) {
  patchState({ state: 'failed', phase: 'startup', error: 'cursor_cli_not_found', finishedAt: now() });
  process.exit(2);
}
const workspacePath = String(spec.workspacePath || '');
if (!workspacePath || !existsSync(workspacePath)) {
  patchState({ state: 'failed', phase: 'startup', error: `workspace_path_missing:${workspacePath}`, finishedAt: now() });
  process.exit(3);
}
const prompt = String(spec.prompt || '');
if (!prompt.trim()) {
  patchState({ state: 'failed', phase: 'startup', error: 'prompt_required', finishedAt: now() });
  process.exit(4);
}

const cursorArgs = ['--print', '--output-format', 'stream-json'];
if (spec.model) cursorArgs.push('--model', String(spec.model));
cursorArgs.push(prompt);

let executable = cli;
let args = cursorArgs;
if (/\.ps1$/i.test(cli)) {
  executable = 'powershell.exe';
  args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', cli, ...cursorArgs];
}

patchState({ state: 'running', phase: 'launching', cli, workerPid: process.pid, startedAt: now(), lastOutput: '' });
const child = spawn(executable, args, {
  cwd: workspacePath,
  env: process.env,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
patchState({ cursorProcessPid: child.pid || 0, phase: 'running' });

let stdoutBuffer = '';
let lastEvent = null;
let finalEvent = null;
let spawnFailed = false;

function handleLine(line) {
  if (!line) return;
  appendFileSync(logFile, `${line}\n`, 'utf8');
  let obj = null;
  try { obj = JSON.parse(line); } catch {}
  if (obj) {
    lastEvent = obj;
    if (obj.type === 'result') finalEvent = obj;
  }
  patchState({
    state: 'running',
    phase: eventPhase(obj),
    lastOutput: eventText(obj, line),
    requestId: obj?.request_id || obj?.requestId || readState().requestId || '',
  });
}

child.stdout?.setEncoding('utf8');
child.stdout?.on('data', chunk => {
  stdoutBuffer += chunk;
  const lines = stdoutBuffer.split(/\r?\n/);
  stdoutBuffer = lines.pop() || '';
  for (const line of lines) handleLine(line.trim());
});
child.stderr?.setEncoding('utf8');
child.stderr?.on('data', chunk => appendFileSync(errorFile, chunk, 'utf8'));
child.on('error', err => {
  spawnFailed = true;
  patchState({ state: 'failed', phase: 'spawn_error', error: String(err?.message || err), finishedAt: now() });
});
child.on('close', code => {
  if (spawnFailed) return;
  if (stdoutBuffer.trim()) handleLine(stdoutBuffer.trim());
  const base = { exitCode: code, finishedAt: now(), phase: code === 0 ? 'completed' : 'failed', finalEvent, lastEvent };
  if (code === 0) patchState({ ...base, state: 'completed' });
  else {
    let stderr = '';
    try { stderr = readFileSync(errorFile, 'utf8'); } catch {}
    patchState({ ...base, state: 'failed', error: short(stderr || `cursor_cli_exit_${code}`) });
  }
});
