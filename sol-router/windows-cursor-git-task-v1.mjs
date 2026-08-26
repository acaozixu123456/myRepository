import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, extname } from 'node:path';

const specPath = process.argv[2];
if (!specPath) throw new Error('spec_path_required');
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const stateFile = String(spec.stateFile || '');
const logFile = String(spec.logFile || '');
const errorFile = String(spec.errorFile || '');
if (!stateFile || !logFile || !errorFile) throw new Error('task_paths_required');
mkdirSync(dirname(stateFile), { recursive: true });

function now() { return Date.now(); }
function readState() {
  try { return JSON.parse(readFileSync(stateFile, 'utf8')); }
  catch { return {}; }
}
function writeJsonAtomic(path, value) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, path);
}
function patchState(patch) {
  const next = { ...readState(), ...patch, updatedAt: now() };
  writeJsonAtomic(stateFile, next);
  return next;
}
function short(value, max = 4000) {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}
function phaseOf(obj) {
  if (!obj || typeof obj !== 'object') return 'running';
  return String(obj.subtype || obj.type || obj.event || obj.kind || 'running');
}
function textOf(obj, raw) {
  if (obj && typeof obj === 'object') {
    for (const key of ['text', 'result', 'content', 'message', 'summary']) {
      if (typeof obj[key] === 'string' && obj[key].trim()) return short(obj[key].trim());
    }
    if (obj.message && typeof obj.message === 'object') {
      for (const key of ['text', 'content']) {
        if (typeof obj.message[key] === 'string' && obj.message[key].trim()) return short(obj.message[key].trim());
      }
    }
  }
  return short(raw);
}

const cli = String(spec.cursorCli || '').trim();
const workspacePath = String(spec.workspacePath || '').trim();
const prompt = String(spec.prompt || '');
if (!cli || !existsSync(cli)) {
  patchState({ state: 'failed', phase: 'startup', error: `cursor_cli_missing:${cli}`, finishedAt: now() });
  process.exit(2);
}
if (!workspacePath || !existsSync(workspacePath)) {
  patchState({ state: 'failed', phase: 'startup', error: `workspace_path_missing:${workspacePath}`, finishedAt: now() });
  process.exit(3);
}
if (!prompt.trim()) {
  patchState({ state: 'failed', phase: 'startup', error: 'prompt_required', finishedAt: now() });
  process.exit(4);
}

const cursorArgs = ['--print', '--output-format', 'stream-json'];
if (spec.model) cursorArgs.push('--model', String(spec.model));
cursorArgs.push(prompt);

let command;
let args;
if (extname(cli).toLowerCase() === '.ps1') {
  command = 'powershell.exe';
  args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', cli, ...cursorArgs];
} else {
  command = cli;
  args = cursorArgs;
}

patchState({ state: 'running', phase: 'launching', cursorCli: cli, workerPid: process.pid, startedAt: now(), lastOutput: '' });
const child = spawn(command, args, {
  cwd: workspacePath,
  env: process.env,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
patchState({ cursorProcessPid: child.pid, phase: 'running' });

let stdoutBuffer = '';
let lastEvent = null;
let finalEvent = null;
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
    phase: phaseOf(obj),
    lastOutput: textOf(obj, line),
    lastEvent,
  });
}

child.stdout.setEncoding('utf8');
child.stdout.on('data', chunk => {
  stdoutBuffer += chunk;
  const lines = stdoutBuffer.split(/\r?\n/);
  stdoutBuffer = lines.pop() || '';
  for (const line of lines) handleLine(line.trim());
});
child.stderr.setEncoding('utf8');
child.stderr.on('data', chunk => {
  appendFileSync(errorFile, chunk, 'utf8');
  patchState({ lastErrorOutput: short(chunk) });
});
child.on('error', error => {
  patchState({ state: 'failed', phase: 'spawn_error', error: String(error?.message || error), finishedAt: now() });
});
child.on('close', code => {
  if (stdoutBuffer.trim()) handleLine(stdoutBuffer.trim());
  if (code === 0) {
    patchState({ state: 'completed', phase: 'completed', exitCode: code, finalEvent, lastEvent, finishedAt: now() });
  } else {
    let stderr = '';
    try { stderr = readFileSync(errorFile, 'utf8'); } catch {}
    patchState({ state: 'failed', phase: 'failed', exitCode: code, finalEvent, lastEvent, error: short(stderr || `cursor_cli_exit_${code}`), finishedAt: now() });
  }
});
