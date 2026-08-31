/**
 * Executor-neutral configuration resolution (protocol 2.6.0).
 * Preserves legacy Cursor-only configs; new installs default to Codex.
 */

export const EXECUTOR_KINDS = new Set(['codex', 'cursor']);
export const DEFAULT_EXECUTOR_KIND = 'codex';
export const DEFAULT_CODEX_BIN = 'codex';
export const DEFAULT_SANDBOX_MODE = 'workspace-write';
export const DEFAULT_AUTH_MODE = 'chatgpt-managed';
export const DEFAULT_MODEL_POLICY = 'config-default';

export function resolveExecutorConfig(config = {}) {
  const cursorCli = String(config.cursorCli || '').trim() || null;
  let executorKind = String(config.executorKind || config.executor_kind || '').trim().toLowerCase();
  if (!EXECUTOR_KINDS.has(executorKind)) {
    executorKind = cursorCli ? 'cursor' : DEFAULT_EXECUTOR_KIND;
  }
  const executorBin = String(
    config.executorBin || config.executor_bin || (executorKind === 'codex' ? DEFAULT_CODEX_BIN : cursorCli || ''),
  ).trim();
  return {
    executorKind,
    executorBin,
    cursorCli: executorKind === 'cursor' ? (cursorCli || executorBin) : cursorCli,
    authMode: String(config.authMode || config.auth_mode || DEFAULT_AUTH_MODE),
    sandboxMode: String(config.sandboxMode || config.sandbox_mode || DEFAULT_SANDBOX_MODE),
    modelPolicy: String(config.modelPolicy || config.model_policy || DEFAULT_MODEL_POLICY),
    executionCore: 'windows-git-agent-v2',
    provider: executorKind,
  };
}

export function buildWorkerExecutorFields(executorConfig, payloadModel = '') {
  const model = payloadModel ? String(payloadModel) : '';
  return {
    executorKind: executorConfig.executorKind,
    executorBin: executorConfig.executorBin,
    cursorCli: executorConfig.executorKind === 'cursor' ? executorConfig.executorBin : executorConfig.cursorCli,
    authMode: executorConfig.authMode,
    sandboxMode: executorConfig.sandboxMode,
    modelPolicy: executorConfig.modelPolicy,
    model: model || null,
    provider: executorConfig.provider,
  };
}
