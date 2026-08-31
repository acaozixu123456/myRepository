#!/usr/bin/env node
/**
 * External poller watchdog for Sol Router Windows Git Agent.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_HEARTBEAT_STALE_MS = 180_000;
export const DEFAULT_STARTUP_GRACE_MS = 60_000;
export const DEFAULT_MONITOR_INTERVAL_MS = 5_000;
export const DEFAULT_RESTART_DELAY_MS = 2_000;
export const MAX_RESTART_DELAY_MS = 15_000;

function safeId(value) {
  return String(value || '').replace(/[^A-Za-z0-9._-]/g, '_');
}

export function readJsonIfExists(path) {
  if (!path || !existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

export function resolveStateRelayDir(config = {}) {
  const configured = String(config.stateRelayDir || '').trim();
  if (configured) return configured;
  const relayDir = String(config.relayDir || '').trim();
  return relayDir ? join(dirname(relayDir), 'state-relay') : '';
}

export function resolveAgentHeartbeatPath(config = {}) {
  const stateRelayDir = resolveStateRelayDir(config);
  if (!stateRelayDir) return '';
  const agentId = safeId(config.agentId || 'work-windows-cursor');
  return join(stateRelayDir, 'gateway-bridge', 'agents', `${agentId}.json`);
}

export function heartbeatTimestamp(snapshot = null) {
  if (!snapshot || typeof snapshot !== 'object') return 0;
  return Number(snapshot.heartbeatAt || snapshot.updatedAt || snapshot.updated_at || 0) || 0;
}

export function decideSupervisorAction({
  childAlive,
  startedAt,
  snapshot,
  now = Date.now(),
  startupGraceMs = DEFAULT_STARTUP_GRACE_MS,
  heartbeatStaleMs = DEFAULT_HEARTBEAT_STALE_MS,
} = {}) {
  if (!childAlive) return { action: 'restart', reason: 'poller_not_running' };
  const age = Math.max(0, Number(now) - Number(startedAt || now));
  const heartbeatAt = heartbeatTimestamp(snapshot);
  if (!heartbeatAt) {
    if (age < startupGraceMs) return { action: 'wait', reason: 'startup_grace', ageMs: age };
    return { action: 'restart', reason: 'heartbeat_missing_after_startup_grace', ageMs: age };
  }
  const staleForMs = Math.max(0, Number(now) - heartbeatAt);
  if (staleForMs > heartbeatStaleMs) {
    return { action: 'restart', reason: 'poller_heartbeat_stale', staleForMs, heartbeatAt };
  }
  return { action: 'healthy', reason: 'heartbeat_fresh', staleForMs, heartbeatAt };
}

export function buildPollerEnvironment(baseEnv = process.env) {
  return {
    ...baseEnv,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'Never',
    GIT_ASKPASS_REQUIRE: 'force',
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function terminatePollerOnly(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/F'], {
      windowsHide: true,
      stdio: 'ignore',
      timeout: 10_000,
    });
    return;
  }
  try { child.kill('SIGKILL'); } catch { /* best effort */ }
}

export async function runSupervisor(configPath, options = {}) {
  if (!configPath) throw new Error('config_path_required');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const installRoot = dirname(configPath);
  const agentPath = String(options.agentPath || config.agentPath || join(installRoot, 'windows-cursor-git-agent-v2.mjs'));
  if (!existsSync(agentPath)) throw new Error(`agent_path_missing:${agentPath}`);

  const heartbeatPath = resolveAgentHeartbeatPath(config);
  if (!heartbeatPath) throw new Error('state_relay_path_required_for_supervisor');
  mkdirSync(dirname(heartbeatPath), { recursive: true });

  const heartbeatStaleMs = Math.max(30_000, Number(config.pollerHeartbeatStaleMs || options.heartbeatStaleMs || DEFAULT_HEARTBEAT_STALE_MS));
  const startupGraceMs = Math.max(15_000, Number(config.pollerStartupGraceMs || options.startupGraceMs || DEFAULT_STARTUP_GRACE_MS));
  const monitorIntervalMs = Math.max(1_000, Number(config.pollerMonitorIntervalMs || options.monitorIntervalMs || DEFAULT_MONITOR_INTERVAL_MS));

  let child = null;
  let childStartedAt = 0;
  let restartDelayMs = DEFAULT_RESTART_DELAY_MS;
  let stopping = false;

  function log(message) {
    process.stdout.write(`[${new Date().toISOString()}] supervisor ${message}\n`);
  }

  function startPoller(reason) {
    childStartedAt = Date.now();
    child = spawn(process.execPath, [agentPath, configPath], {
      cwd: installRoot,
      env: buildPollerEnvironment(process.env),
      windowsHide: true,
      stdio: 'inherit',
    });
    log(`poller_started pid=${child.pid} reason=${reason}`);
    child.once('exit', (code, signal) => {
      log(`poller_exit pid=${child?.pid || 'unknown'} code=${code} signal=${signal || ''}`);
    });
  }

  const stop = () => {
    stopping = true;
    terminatePollerOnly(child);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  startPoller('supervisor_start');
  while (!stopping) {
    await sleep(monitorIntervalMs);
    const childAlive = Boolean(child && child.exitCode === null && !child.killed);
    const snapshot = readJsonIfExists(heartbeatPath);
    const decision = decideSupervisorAction({
      childAlive,
      startedAt: childStartedAt,
      snapshot,
      now: Date.now(),
      startupGraceMs,
      heartbeatStaleMs,
    });
    if (decision.action === 'healthy') {
      restartDelayMs = DEFAULT_RESTART_DELAY_MS;
      continue;
    }
    if (decision.action === 'wait') continue;
    log(`poller_restart_requested reason=${decision.reason} staleForMs=${decision.staleForMs || 0}`);
    terminatePollerOnly(child);
    await sleep(restartDelayMs);
    if (stopping) break;
    startPoller(decision.reason);
    restartDelayMs = Math.min(MAX_RESTART_DELAY_MS, restartDelayMs * 2);
  }
  return { stopped: true };
}

const isMain = process.argv[1]
  && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();
if (isMain) {
  runSupervisor(process.argv[2]).catch((error) => {
    process.stderr.write(`supervisor_fatal:${String(error?.stack || error)}\n`);
    process.exit(1);
  });
}
