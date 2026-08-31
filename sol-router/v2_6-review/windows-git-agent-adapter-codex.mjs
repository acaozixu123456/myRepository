/**
 * Codex JSONL event adapter + terminal consistency + error classification.
 *
 * ChatGPT-managed authentication is the only supported Codex auth mode for this
 * runtime. API-key variables are removed inside the worker process before Codex
 * is spawned so a host-level OPENAI_API_KEY cannot silently switch billing away
 * from the user's ChatGPT subscription.
 */

export const CODEX_ERROR_CLASSES = new Set([
  'auth_required',
  'auth_expired',
  'quota_exhausted',
  'rate_limited',
  'model_unavailable',
  'sandbox_denied',
  'approval_required',
  'executor_protocol_error',
  'executor_protocol_mismatch',
  'executor_process_lost',
]);

export const CHATGPT_MANAGED_ENV_DENYLIST = Object.freeze([
  'OPENAI_API_KEY',
  'CODEX_API_KEY',
  'AZURE_OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_API_BASE',
  'OPENAI_API_TYPE',
  'OPENAI_API_VERSION',
  'OPENAI_ORG_ID',
  'OPENAI_ORGANIZATION',
  'OPENAI_PROJECT_ID',
  'OPENAI_PROJECT',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_VERSION',
]);

export function buildChatGptManagedEnv(baseEnv = {}) {
  const env = { ...baseEnv };
  for (const key of CHATGPT_MANAGED_ENV_DENYLIST) delete env[key];
  return env;
}

export function stripChatGptManagedApiEnv(targetEnv = process.env) {
  const removed = [];
  for (const key of CHATGPT_MANAGED_ENV_DENYLIST) {
    if (Object.prototype.hasOwnProperty.call(targetEnv, key)) {
      delete targetEnv[key];
      removed.push(key);
    }
  }
  return removed;
}

export function classifyCodexError(text = '', event = null) {
  const blob = `${text}\n${JSON.stringify(event || {})}`.toLowerCase();
  if (/auth.*required|not logged in|login required|authentication required/.test(blob)) return 'auth_required';
  if (/auth.*expired|session expired|token expired/.test(blob)) return 'auth_expired';
  if (/quota|usage limit|insufficient.*credit/.test(blob)) return 'quota_exhausted';
  if (/rate limit|too many requests|429/.test(blob)) return 'rate_limited';
  if (/model.*unavailable|model not found|unknown model/.test(blob)) return 'model_unavailable';
  if (/sandbox.*denied|sandbox denied|permission denied.*sandbox/.test(blob)) return 'sandbox_denied';
  if (/approval required|needs approval|user approval/.test(blob)) return 'approval_required';
  if (/protocol|malformed|invalid json/.test(blob)) return 'executor_protocol_error';
  return 'executor_protocol_error';
}

function itemType(item) {
  if (!item || typeof item !== 'object') return '';
  return String(item.type || '');
}

function itemText(item) {
  if (!item || typeof item !== 'object') return '';
  if (typeof item.text === 'string') return item.text;
  if (typeof item.message === 'string') return item.message;
  if (item.command && typeof item.command === 'string') return item.command;
  if (item.path && typeof item.path === 'string') return item.path;
  return '';
}

function firstChangedFile(item) {
  if (!item || typeof item !== 'object') return '';
  if (typeof item.path === 'string') return item.path;
  if (typeof item.file === 'string') return item.file;
  if (Array.isArray(item.changes)) {
    const change = item.changes.find((row) => row && typeof row.path === 'string');
    if (change) return change.path;
  }
  return '';
}

export function createCodexEventContext() {
  return {
    threadId: null,
    turnStarted: false,
    turnCompleted: false,
    turnFailed: false,
    fatalError: null,
    errorClass: null,
    resolvedModel: null,
    usage: null,
    lastAgentMessage: '',
    protocolErrors: [],
    sawJsonLine: false,
  };
}

export function handleCodexJsonLine(line, ctx, { short = (v, m) => String(v).slice(0, m || 400) } = {}) {
  let obj = null;
  try {
    obj = JSON.parse(line);
    ctx.sawJsonLine = true;
  } catch {
    ctx.protocolErrors.push('malformed_jsonl');
    return {
      ctx,
      evt: { type: 'raw', phase: 'protocol_error', text: short(line, 200) },
      meaningful: '',
      action: 'protocol_error',
      tool: '',
      file: '',
      command: '',
    };
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !obj.type) {
    ctx.protocolErrors.push('missing_event_type');
    return {
      ctx,
      evt: { type: 'raw', phase: 'protocol_error', text: short(line, 200) },
      meaningful: '',
      action: 'protocol_error',
      tool: '',
      file: '',
      command: '',
    };
  }

  const type = String(obj.type || '');
  let action = type || 'running';
  let tool = '';
  let file = '';
  let command = '';
  let meaningful = '';

  if (type === 'thread.started' && obj.thread_id) {
    ctx.threadId = String(obj.thread_id);
    action = 'thread_started';
  } else if (type === 'turn.started') {
    ctx.turnStarted = true;
    action = 'turn_started';
    if (obj.model) ctx.resolvedModel = String(obj.model);
  } else if (type === 'turn.completed') {
    ctx.turnCompleted = true;
    action = 'turn_completed';
    if (obj.usage && typeof obj.usage === 'object') ctx.usage = obj.usage;
    if (obj.model) ctx.resolvedModel = String(obj.model);
  } else if (type === 'turn.failed') {
    ctx.turnFailed = true;
    ctx.fatalError = String(obj.error?.message || obj.message || 'turn_failed');
    ctx.errorClass = classifyCodexError(ctx.fatalError, obj);
    action = 'turn_failed';
    meaningful = short(ctx.fatalError, 800);
  } else if (type === 'error') {
    ctx.fatalError = String(obj.message || obj.error?.message || 'codex_error');
    ctx.errorClass = classifyCodexError(ctx.fatalError, obj);
    action = 'error';
    meaningful = short(ctx.fatalError, 800);
  } else if (type === 'item.started' || type === 'item.completed') {
    const item = obj.item || {};
    const it = itemType(item);
    action = type === 'item.completed' ? `${it}:done` : it || 'item';
    if (it === 'command_execution' || it === 'shell') {
      tool = 'shell';
      command = short(item.command || itemText(item), 240);
    } else if (it === 'file_change' || it === 'patch' || it === 'apply_patch') {
      tool = 'file';
      file = short(firstChangedFile(item) || itemText(item), 240);
    } else if (it === 'agent_message' || it === 'message') {
      tool = 'message';
      const text = itemText(item);
      if (text) {
        ctx.lastAgentMessage = text;
        if (type === 'item.completed') meaningful = short(text, 800);
      }
    } else if (it === 'plan') {
      tool = 'plan';
      meaningful = short(itemText(item), 800);
    }
  }

  const evt = {
    type,
    phase: action,
    threadId: ctx.threadId || null,
    tool: tool || undefined,
    file: file || undefined,
    command: command || undefined,
    text: meaningful || short(itemText(obj.item || obj), 400),
  };
  return { ctx, evt, meaningful, action, tool, file, command };
}

export function resolveCodexTerminal({ exitCode, ctx, stderr = '' }) {
  const code = Number(exitCode);
  if (ctx.turnFailed || ctx.fatalError) {
    return {
      runState: 'failed',
      error: ctx.fatalError || 'turn_failed',
      errorClass: ctx.errorClass || classifyCodexError(stderr, null),
      phase: 'failed',
    };
  }
  if (Array.isArray(ctx.protocolErrors) && ctx.protocolErrors.length) {
    return {
      runState: 'failed',
      error: `executor_protocol_error:${ctx.protocolErrors.join(',')}`,
      errorClass: 'executor_protocol_error',
      phase: 'failed',
    };
  }
  if (code === 0 && ctx.turnCompleted && ctx.turnStarted && ctx.sawJsonLine) {
    return { runState: 'completed', error: null, errorClass: null, phase: 'completed' };
  }
  if (code === 0 && ctx.turnCompleted && !ctx.turnStarted) {
    return {
      runState: 'failed',
      error: 'executor_protocol_mismatch:turn_completed_without_turn_started',
      errorClass: 'executor_protocol_mismatch',
      phase: 'failed',
    };
  }
  if (code === 0 && !ctx.turnCompleted) {
    return {
      runState: 'failed',
      error: 'executor_protocol_mismatch:exit_0_without_turn_completed',
      errorClass: 'executor_protocol_mismatch',
      phase: 'failed',
    };
  }
  if (code !== 0 && ctx.turnCompleted) {
    return {
      runState: 'failed',
      error: `executor_protocol_mismatch:exit_${code}_with_turn_completed`,
      errorClass: 'executor_protocol_mismatch',
      phase: 'failed',
    };
  }
  const errText = stderr.trim() || `codex_exit_${code}`;
  return {
    runState: 'failed',
    error: errText.slice(0, 2000),
    errorClass: classifyCodexError(errText, null),
    phase: 'failed',
  };
}

export function buildCodexSpawn(spec, promptFile, cliPrompt) {
  const authMode = String(spec.authMode || 'chatgpt-managed').trim().toLowerCase();
  if (authMode !== 'chatgpt-managed') {
    throw new Error(`codex_auth_mode_not_allowed:${authMode || 'missing'}`);
  }

  const strippedEnvKeys = stripChatGptManagedApiEnv(process.env);
  const bin = String(spec.executorBin || 'codex').trim();
  const sandbox = String(spec.sandboxMode || 'workspace-write');
  const args = [
    'exec', '--json', '--color', 'never', '--skip-git-repo-check',
    '--sandbox', sandbox,
  ];
  if (spec.model) args.push('--model', String(spec.model));
  args.push(cliPrompt);

  const ext = (bin.includes('.') ? bin.slice(bin.lastIndexOf('.')) : '').toLowerCase();
  if (ext === '.ps1') {
    return {
      command: 'powershell.exe',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', bin, ...args],
      strippedEnvKeys,
    };
  }
  if (ext === '.mjs' || ext === '.js' || ext === '.cjs') {
    return { command: process.execPath, args: [bin, ...args], strippedEnvKeys };
  }
  return { command: bin, args, shell: process.platform === 'win32', strippedEnvKeys };
}
