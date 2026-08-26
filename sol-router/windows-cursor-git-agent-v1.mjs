import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

const configPath = process.argv[2];
if (!configPath) throw new Error('config_path_required');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

const VERSION = '1.0.0';
const relayDir = String(config.relayDir || '');
const branch = String(config.branch || 'sol-router-gateway-v0.1');
const agentId = String(config.agentId || 'work-windows-cursor');
const cursorCli = String(config.cursorCli || '');
const workerPath = String(config.workerPath || join(dirname(new URL(import.meta.url).pathname), 'windows-cursor-git-task-v1.mjs'));
const workspaces = config.workspaces || {};
const localStateDir = String(config.localStateDir || join(dirname(configPath), 'state'));
const taskDir = join(localStateDir, 'tasks');
const seenFile = join(localStateDir, 'seen-commands.json');
const bridgeRoot = join(relayDir, 'gateway-bridge');
const commandsDir = join(bridgeRoot, 'commands');
const resultsDir = join(bridgeRoot, 'results');
const agentsDir = join(bridgeRoot, 'agents');

for (const path of [localStateDir, taskDir, commandsDir, resultsDir, agentsDir]) mkdirSync(path, { recursive: true });

function log(message) {
  process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);
}
function runGit(args, check = true) {
  const p = spawnSync('git', ['-C', relayDir, ...args], { encoding: 'utf8', windowsHide: true });
  if (check && p.status !== 0) throw new Error(String(p.stderr || p.stdout || `git_exit_${p.status}`).trim());
  return p;
}
function syncRepo() {
  runGit(['pull', '--rebase', 'origin', branch]);
  const push = runGit(['push', 'origin', branch], false);
  if (push.status !== 0 && !String(push.stderr || push.stdout || '').includes('Everything up-to-date')) {
    log(`pending push not flushed yet: ${String(push.stderr || push.stdout || '').trim()}`);
  }
}
function publish(message) {
  runGit(['add', 'gateway-bridge/results', 'gateway-bridge/agents']);
  const staged = runGit(['diff', '--cached', '--quiet'], false);
  if (staged.status === 0) return;
  runGit(['commit', '-m', message]);
  let push = runGit(['push', 'origin', branch], false);
  if (push.status === 0) return;
  runGit(['pull', '--rebase', 'origin', branch]);
  push = runGit(['push', 'origin', branch], false);
  if (push.status !== 0) throw new Error(String(push.stderr || push.stdout || `git_push_exit_${push.status}`).trim());
}
function writeJsonAtomic(path, value) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, path);
}
function safeId(value) {
  return String(value).replace(/[^A-Za-z0-9._-]/g, '_');
}
function taskStatePath(runId) { return join(taskDir, `${safeId(runId)}.state.json`); }
function taskSpecPath(runId) { return join(taskDir, `${safeId(runId)}.spec.json`); }
function taskLogPath(runId) { return join(taskDir, `${safeId(runId)}.stream.jsonl`); }
function taskErrorPath(runId) { return join(taskDir, `${safeId(runId)}.stderr.log`); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function readTask(runId) {
  const path = taskStatePath(runId);
  if (!existsSync(path)) throw new Error(`run_not_found:${runId}`);
  return readJson(path);
}
function cursorCommand(args) {
  if (extname(cursorCli).toLowerCase() === '.ps1') {
    return { command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', cursorCli, ...args] };
  }
  return { command: cursorCli, args };
}
function cursorVersion() {
  if (!cursorCli || !existsSync(cursorCli)) return { healthy: false, version: `missing:${cursorCli}` };
  const invocation = cursorCommand(['--version']);
  const p = spawnSync(invocation.command, invocation.args, { encoding: 'utf8', windowsHide: true });
  return { healthy: p.status === 0, version: String(p.stdout || p.stderr || '').trim().slice(0, 500) };
}
function workspaceNames() { return Object.keys(workspaces); }
function resolveWorkspace(name) {
  const path = String(workspaces[name] || '');
  if (!path) throw new Error(`workspace_not_available:${name}`);
  if (!existsSync(path)) throw new Error(`workspace_path_missing:${name}:${path}`);
  return path;
}
function startTask(commandId, payload) {
  const runId = safeId(String(payload.runId || payload.run_id || commandId));
  const statePath = taskStatePath(runId);
  if (existsSync(statePath)) return readJson(statePath);
  const workspace = String(payload.workspace || '');
  const workspacePath = resolveWorkspace(workspace);
  const prompt = String(payload.prompt || payload.task || '');
  if (!prompt.trim()) throw new Error('prompt_required');
  const initial = {
    runId,
    state: 'accepted',
    phase: 'queued',
    provider: 'cursor',
    workspace,
    workspacePath,
    submittedAt: Date.now(),
    lastOutput: '',
  };
  writeJsonAtomic(statePath, initial);
  const spec = {
    runId,
    workspace,
    workspacePath,
    prompt,
    model: payload.model ? String(payload.model) : '',
    cursorCli,
    stateFile: statePath,
    logFile: taskLogPath(runId),
    errorFile: taskErrorPath(runId),
  };
  const specPath = taskSpecPath(runId);
  writeJsonAtomic(specPath, spec);
  const child = spawn(process.execPath, [workerPath, specPath], {
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
  return { ...initial, workerPid: child.pid };
}
function statusTask(payload) {
  const runId = String(payload.runId || payload.run_id || payload.id || '');
  if (!runId) throw new Error('run_id_required');
  return readTask(runId);
}
function execute(command) {
  const method = String(command.method || '');
  const payload = command.payload || {};
  if (method === 'health') {
    const cv = cursorVersion();
    return {
      agent_id: agentId,
      version: VERSION,
      transport: 'git-polling',
      provider: 'cursor',
      executor_healthy: cv.healthy,
      executor_version: cv.version,
      capabilities: ['health', 'list_workspaces', 'start', 'status'],
      workspaces: workspaceNames(),
      updated_at: Date.now(),
    };
  }
  if (method === 'list_workspaces') return { workspaces: workspaceNames() };
  if (method === 'start') return startTask(String(command.id || ''), payload);
  if (method === 'status') return statusTask(payload);
  throw new Error(`unsupported_method:${method}`);
}
function loadSeen() {
  if (!existsSync(seenFile)) return null;
  try { return new Set(readJson(seenFile)); }
  catch { return new Set(); }
}
function saveSeen(seen) { writeJsonAtomic(seenFile, [...seen].sort()); }
function commandFiles() {
  if (!existsSync(commandsDir)) return [];
  return readdirSync(commandsDir).filter(name => name.endsWith('.json')).sort();
}
function writeAgentDescriptor() {
  const cv = cursorVersion();
  writeJsonAtomic(join(agentsDir, `${safeId(agentId)}.json`), {
    agent_id: agentId,
    version: VERSION,
    transport: 'git-polling',
    provider: 'cursor',
    executor_healthy: cv.healthy,
    executor_version: cv.version,
    capabilities: ['health', 'list_workspaces', 'start', 'status'],
    workspaces: workspaceNames(),
    updated_at: Date.now(),
  });
}

if (!relayDir || !existsSync(join(relayDir, '.git'))) throw new Error(`relay_repo_missing:${relayDir}`);
if (!cursorCli || !existsSync(cursorCli)) throw new Error(`cursor_cli_missing:${cursorCli}`);
if (!workerPath || !existsSync(workerPath)) throw new Error(`worker_missing:${workerPath}`);

runGit(['config', 'user.name', 'sol-router-git-agent']);
runGit(['config', 'user.email', 'sol-router-git-agent@users.noreply.github.com']);
syncRepo();
let seen = loadSeen();
if (seen === null) {
  seen = new Set(commandFiles());
  saveSeen(seen);
  log(`first start baseline captured: ${seen.size} existing commands ignored`);
}
writeAgentDescriptor();
publish(`git-agent: online ${agentId}`);
log(`Sol Router Git Agent ready agent=${agentId} branch=${branch}`);
log(`relay=${relayDir}`);
log(`cursor=${cursorCli}`);
log(`workspaces=${workspaceNames().join(',')}`);

while (true) {
  try {
    syncRepo();
    const files = commandFiles();
    let changed = false;
    for (const name of files) {
      if (seen.has(name)) continue;
      const commandPath = join(commandsDir, name);
      const resultPath = join(resultsDir, name);
      if (existsSync(resultPath)) {
        seen.add(name);
        continue;
      }
      let command;
      try { command = readJson(commandPath); }
      catch (error) {
        writeJsonAtomic(resultPath, { ok: false, command_id: basename(name, '.json'), error: `invalid_command_json:${String(error?.message || error)}`, completed_at: Date.now() });
        seen.add(name);
        changed = true;
        continue;
      }
      if (command.agent_id && String(command.agent_id) !== agentId) {
        seen.add(name);
        continue;
      }
      const commandId = String(command.id || basename(name, '.json'));
      try {
        const result = execute({ ...command, id: commandId });
        writeJsonAtomic(resultPath, { ok: true, command_id: commandId, result, completed_at: Date.now() });
        log(`command=${command.method} id=${commandId} ok`);
      } catch (error) {
        writeJsonAtomic(resultPath, { ok: false, command_id: commandId, error: String(error?.message || error), completed_at: Date.now() });
        log(`command=${command.method} id=${commandId} error=${String(error?.message || error)}`);
      }
      seen.add(name);
      changed = true;
    }
    saveSeen(seen);
    if (changed) publish(`git-agent: results ${agentId}`);
  } catch (error) {
    log(`loop error: ${String(error?.message || error)}`);
  }
  await new Promise(resolve => setTimeout(resolve, 2000));
}
