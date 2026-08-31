/**
 * Bounded cached executor health probe (no model turn, no secrets).
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extname } from 'node:path';
import {
  buildChatGptManagedEnv,
  CHATGPT_MANAGED_ENV_DENYLIST,
} from './windows-git-agent-adapter-codex.mjs';

const PROBE_TTL_MS = 60_000;
const cache = new Map();

function cacheKey(kind, bin, authMode) {
  return `${kind}:${bin}:${authMode || ''}`;
}

function run(cmd, args, timeoutMs = 8000, env = process.env) {
  return spawnSync(cmd, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: timeoutMs,
    shell: process.platform === 'win32' && !extname(cmd),
    env,
  });
}

function resolveCommand(bin) {
  if (!bin) return { command: '', argsPrefix: [] };
  const ext = extname(bin).toLowerCase();
  if (ext === '.ps1') {
    return { command: 'powershell.exe', argsPrefix: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', bin] };
  }
  if (ext === '.mjs' || ext === '.js' || ext === '.cjs') {
    return { command: process.execPath, argsPrefix: [bin] };
  }
  return { command: bin, argsPrefix: [] };
}

function probeCursor(bin) {
  const healthy = Boolean(bin && existsSync(bin));
  return {
    healthy,
    version: healthy ? 'present-not-probed' : `missing:${bin}`,
    authMode: null,
    authState: healthy ? 'not_applicable' : 'executor_missing',
    executorKind: 'cursor',
    probeSource: 'file-exists',
    apiCredentialEnvBlocked: false,
    blockedApiCredentialEnvKeys: [],
  };
}

function classifyAuthState(output) {
  const text = String(output || '').toLowerCase();
  if (/logged in using chatgpt|logged in/i.test(text)) return 'ready';
  if (/not logged in|login required/i.test(text)) return 'auth_required';
  return 'unknown';
}

function apiCredentialKeysPresent(baseEnv = process.env) {
  return CHATGPT_MANAGED_ENV_DENYLIST.filter((key) => Object.prototype.hasOwnProperty.call(baseEnv, key));
}

function probeCodex(bin, authMode = 'chatgpt-managed') {
  const normalizedAuthMode = String(authMode || '').trim().toLowerCase();
  const blockedKeys = apiCredentialKeysPresent(process.env);
  if (normalizedAuthMode !== 'chatgpt-managed') {
    return {
      healthy: false,
      version: 'unsupported_auth_mode',
      authMode: normalizedAuthMode || null,
      authState: 'unsupported_auth_mode',
      executorKind: 'codex',
      probeSource: 'policy-gate',
      apiCredentialEnvBlocked: blockedKeys.length > 0,
      blockedApiCredentialEnvKeys: blockedKeys,
    };
  }

  const { command, argsPrefix } = resolveCommand(bin);
  if (!command) {
    return {
      healthy: false,
      version: 'missing:executorBin',
      authMode: 'chatgpt-managed',
      authState: 'executor_missing',
      executorKind: 'codex',
      probeSource: 'missing-bin',
      apiCredentialEnvBlocked: blockedKeys.length > 0,
      blockedApiCredentialEnvKeys: blockedKeys,
    };
  }

  const env = buildChatGptManagedEnv(process.env);
  const versionRun = run(command, [...argsPrefix, '--version'], 8000, env);
  const versionText = String(versionRun.stdout || versionRun.stderr || '').trim().split('\n')[0] || '';
  const healthy = versionRun.status === 0 && versionText.length > 0;
  let authState = 'unknown';
  if (healthy) {
    const authRun = run(command, [...argsPrefix, 'login', 'status'], 8000, env);
    const authOut = `${authRun.stdout || ''}\n${authRun.stderr || ''}`;
    authState = authRun.status === 0 ? classifyAuthState(authOut) : 'auth_probe_failed';
  }
  return {
    healthy,
    version: healthy ? versionText.slice(0, 200) : `probe_failed:${versionText.slice(0, 120) || bin}`,
    authMode: 'chatgpt-managed',
    authState: healthy ? authState : 'executor_missing',
    executorKind: 'codex',
    probeSource: 'cli-probe-sanitized-env',
    apiCredentialEnvBlocked: blockedKeys.length > 0,
    blockedApiCredentialEnvKeys: blockedKeys,
  };
}

export function probeExecutor(cfg = {}, { force = false, now = Date.now() } = {}) {
  const kind = String(cfg.executorKind || 'codex');
  const bin = String(cfg.executorBin || cfg.cursorCli || '').trim();
  const authMode = String(cfg.authMode || 'chatgpt-managed');
  const key = cacheKey(kind, bin, authMode);
  const hit = cache.get(key);
  if (!force && hit && now - hit.at < PROBE_TTL_MS) return { ...hit.snapshot, cached: true };

  const snapshot = kind === 'cursor'
    ? probeCursor(bin)
    : probeCodex(bin || 'codex', authMode);

  cache.set(key, { at: now, snapshot });
  return { ...snapshot, cached: false };
}

export function clearExecutorProbeCache() {
  cache.clear();
}
