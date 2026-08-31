import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  buildChatGptManagedEnv,
  buildCodexSpawn,
  classifyCodexError,
  createCodexEventContext,
  handleCodexJsonLine,
  resolveCodexTerminal,
  stripChatGptManagedApiEnv,
} from './windows-git-agent-adapter-codex.mjs';
import { resolveExecutorConfig } from './windows-git-agent-executor-config.mjs';
import { clearExecutorProbeCache, probeExecutor } from './windows-git-agent-executor-probe.mjs';
import {
  buildPollerEnvironment,
  decideSupervisorAction,
  heartbeatTimestamp,
  resolveAgentHeartbeatPath,
} from './windows-git-agent-supervisor.mjs';

const __filename = fileURLToPath(import.meta.url);

describe('executor configuration', () => {
  it('defaults new installs to Codex but preserves explicit legacy Cursor config', () => {
    assert.equal(resolveExecutorConfig({}).executorKind, 'codex');
    assert.equal(resolveExecutorConfig({ cursorCli: 'C:\\cursor\\agent.ps1' }).executorKind, 'cursor');
    assert.equal(resolveExecutorConfig({ executorKind: 'codex', cursorCli: 'C:\\cursor\\agent.ps1' }).executorKind, 'codex');
  });
});

describe('ChatGPT-managed authentication boundary', () => {
  it('strips API billing selectors and preserves ChatGPT credential location', () => {
    const env = buildChatGptManagedEnv({
      OPENAI_API_KEY: 'secret-a',
      CODEX_API_KEY: 'secret-b',
      OPENAI_BASE_URL: 'https://example.invalid',
      CODEX_HOME: 'C:\\codex-home',
      PATH: 'C:\\Windows',
    });
    assert.equal(env.OPENAI_API_KEY, undefined);
    assert.equal(env.CODEX_API_KEY, undefined);
    assert.equal(env.OPENAI_BASE_URL, undefined);
    assert.equal(env.CODEX_HOME, 'C:\\codex-home');
    assert.equal(env.PATH, 'C:\\Windows');
  });

  it('never returns secret values when stripping an environment object', () => {
    const target = { OPENAI_API_KEY: 'secret-a', CODEX_API_KEY: 'secret-b', KEEP: 'yes' };
    const removed = stripChatGptManagedApiEnv(target);
    assert.deepEqual(removed.sort(), ['CODEX_API_KEY', 'OPENAI_API_KEY']);
    assert.equal(target.KEEP, 'yes');
    assert.ok(!JSON.stringify(removed).includes('secret-a'));
    assert.ok(!JSON.stringify(removed).includes('secret-b'));
  });

  it('rejects API-key auth mode before Codex spawn', () => {
    assert.throws(
      () => buildCodexSpawn({ authMode: 'api-key', executorBin: 'codex' }, 'prompt.txt', 'task'),
      /codex_auth_mode_not_allowed/,
    );
  });

  it('probe fails closed for unsupported auth without launching Codex', () => {
    clearExecutorProbeCache();
    const result = probeExecutor({ executorKind: 'codex', executorBin: __filename, authMode: 'api-key' }, { force: true });
    assert.equal(result.healthy, false);
    assert.equal(result.authState, 'unsupported_auth_mode');
    assert.equal(result.probeSource, 'policy-gate');
  });
});

describe('Codex JSONL terminal consistency', () => {
  it('accepts only a well-formed started/completed turn with exit 0', () => {
    let ctx = createCodexEventContext();
    ({ ctx } = handleCodexJsonLine(JSON.stringify({ type: 'thread.started', thread_id: 'thread-1' }), ctx));
    ({ ctx } = handleCodexJsonLine(JSON.stringify({ type: 'turn.started', model: 'test-model' }), ctx));
    const fileEvent = handleCodexJsonLine(JSON.stringify({
      type: 'item.completed',
      item: { type: 'file_change', changes: [{ path: 'README.md' }] },
    }), ctx);
    ctx = fileEvent.ctx;
    assert.equal(fileEvent.file, 'README.md');
    ({ ctx } = handleCodexJsonLine(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 2, output_tokens: 3 } }), ctx));
    const terminal = resolveCodexTerminal({ exitCode: 0, ctx, stderr: '' });
    assert.equal(terminal.runState, 'completed');
    assert.deepEqual(ctx.usage, { input_tokens: 2, output_tokens: 3 });
  });

  it('rejects malformed JSON even if completion follows', () => {
    let ctx = createCodexEventContext();
    ({ ctx } = handleCodexJsonLine(JSON.stringify({ type: 'turn.started' }), ctx));
    ({ ctx } = handleCodexJsonLine('{bad-json', ctx));
    ({ ctx } = handleCodexJsonLine(JSON.stringify({ type: 'turn.completed' }), ctx));
    const terminal = resolveCodexTerminal({ exitCode: 0, ctx, stderr: '' });
    assert.equal(terminal.runState, 'failed');
    assert.equal(terminal.errorClass, 'executor_protocol_error');
  });

  it('rejects missing event type and incomplete terminal sequence', () => {
    let missing = createCodexEventContext();
    ({ ctx: missing } = handleCodexJsonLine(JSON.stringify({ message: 'no type' }), missing));
    assert.equal(resolveCodexTerminal({ exitCode: 0, ctx: missing }).errorClass, 'executor_protocol_error');

    let incomplete = createCodexEventContext();
    ({ ctx: incomplete } = handleCodexJsonLine(JSON.stringify({ type: 'turn.started' }), incomplete));
    assert.equal(resolveCodexTerminal({ exitCode: 0, ctx: incomplete }).errorClass, 'executor_protocol_mismatch');
  });

  it('rejects non-zero process exit after turn.completed', () => {
    let ctx = createCodexEventContext();
    ({ ctx } = handleCodexJsonLine(JSON.stringify({ type: 'turn.started' }), ctx));
    ({ ctx } = handleCodexJsonLine(JSON.stringify({ type: 'turn.completed' }), ctx));
    const terminal = resolveCodexTerminal({ exitCode: 7, ctx, stderr: '' });
    assert.equal(terminal.runState, 'failed');
    assert.equal(terminal.errorClass, 'executor_protocol_mismatch');
  });

  it('classifies operational errors', () => {
    assert.equal(classifyCodexError('authentication required'), 'auth_required');
    assert.equal(classifyCodexError('token expired'), 'auth_expired');
    assert.equal(classifyCodexError('quota exhausted'), 'quota_exhausted');
    assert.equal(classifyCodexError('rate limit exceeded'), 'rate_limited');
    assert.equal(classifyCodexError('unknown model'), 'model_unavailable');
    assert.equal(classifyCodexError('sandbox denied'), 'sandbox_denied');
  });
});

describe('poller watchdog', () => {
  it('allows startup grace and then restarts missing heartbeat', () => {
    const wait = decideSupervisorAction({
      childAlive: true,
      startedAt: 1_000,
      now: 20_000,
      startupGraceMs: 30_000,
      snapshot: null,
    });
    assert.equal(wait.action, 'wait');
    const restart = decideSupervisorAction({
      childAlive: true,
      startedAt: 1_000,
      now: 40_001,
      startupGraceMs: 30_000,
      snapshot: null,
    });
    assert.equal(restart.action, 'restart');
  });

  it('restarts stale poller but keeps fresh poller', () => {
    const fresh = decideSupervisorAction({
      childAlive: true,
      startedAt: 1_000,
      now: 100_000,
      heartbeatStaleMs: 60_000,
      snapshot: { heartbeatAt: 90_000 },
    });
    assert.equal(fresh.action, 'healthy');
    const stale = decideSupervisorAction({
      childAlive: true,
      startedAt: 1_000,
      now: 200_001,
      heartbeatStaleMs: 60_000,
      snapshot: { heartbeatAt: 100_000, activeRunId: 'detached-worker-survives' },
    });
    assert.equal(stale.action, 'restart');
    assert.equal(stale.reason, 'poller_heartbeat_stale');
  });

  it('sets unattended Git environment and resolves safe heartbeat path', () => {
    const env = buildPollerEnvironment({ KEEP: 'yes' });
    assert.equal(env.GIT_TERMINAL_PROMPT, '0');
    assert.equal(env.GCM_INTERACTIVE, 'Never');
    assert.equal(env.KEEP, 'yes');
    const path = resolveAgentHeartbeatPath({ stateRelayDir: 'C:\\state', agentId: 'work/windows cursor' }).replaceAll('\\', '/');
    assert.match(path, /work_windows_cursor\.json$/);
    assert.equal(heartbeatTimestamp({ updatedAt: 123 }), 123);
  });
});
