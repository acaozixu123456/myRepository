import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const installRoot = process.env.SOL_ROUTER_INSTALL_ROOT || join(process.env.LOCALAPPDATA || '.', 'SolRouterGateway');
const taskDir = join(installRoot, 'tasks');
const workerPath = join(installRoot, 'windows-cursor-task-v8_2.mjs');
const once = process.env.SOL_ROUTER_DISPATCHER_ONCE === '1';
mkdirSync(taskDir, { recursive: true });

function now() { return Date.now(); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function writeJson(path, value) { writeFileSync(path, JSON.stringify(value)); }
function patchState(path, patch) {
  let current = {};
  try { current = readJson(path); } catch {}
  writeJson(path, { ...current, ...patch, updatedAt: now() });
}

function dispatch(queuePath) {
  const queued = readJson(queuePath);
  const taskId = String(queued.taskId || '');
  const specPath = String(queued.specPath || '');
  const statePath = String(queued.statePath || '');
  if (!taskId || !specPath || !statePath) throw new Error('queue_invalid');
  if (!existsSync(workerPath)) throw new Error(`worker_missing:${workerPath}`);
  if (!existsSync(specPath)) throw new Error(`spec_missing:${specPath}`);

  const child = spawn(process.execPath, [workerPath, specPath], {
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
  patchState(statePath, { state: 'accepted', phase: 'dispatched', dispatcherPid: process.pid, workerPid: child.pid || 0 });
  renameSync(queuePath, `${queuePath}.launched`);
}

async function tick() {
  const files = readdirSync(taskDir).filter(name => name.endsWith('.queue.json'));
  for (const name of files) {
    const queuePath = join(taskDir, name);
    try {
      dispatch(queuePath);
    } catch (error) {
      let queued = null;
      try { queued = readJson(queuePath); } catch {}
      if (queued?.statePath) {
        patchState(String(queued.statePath), {
          state: 'failed',
          phase: 'dispatch_error',
          error: String(error?.message || error),
          finishedAt: now(),
        });
      }
      try { renameSync(queuePath, `${queuePath}.error`); } catch {}
    }
  }
}

if (once) {
  await tick();
  process.exit(0);
}

for (;;) {
  await tick();
  await new Promise(resolve => setTimeout(resolve, 250));
}
