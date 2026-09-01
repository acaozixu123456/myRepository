export type NhkFlowPerformance = {
  flowStartedAt?: number;
  parseCompletedAt?: number;
  parseMs?: number;
  parserServerMs?: number;
  parserCacheHit?: boolean;
  coachCompletedAt?: number;
  coachMs?: number;
  readyAt?: number;
  linkToReadyMs?: number;
  firstTrainingAt?: number;
  linkToFirstTrainingMs?: number;
  completedAt?: number;
  sessionDurationMs?: number;
};

const finite = (value: unknown): number | undefined => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : undefined;
};

export const normalizeNhkFlowPerformance = (value: unknown): NhkFlowPerformance => {
  if (!value || typeof value !== 'object') return {};
  const input = value as Partial<NhkFlowPerformance>;
  const output: NhkFlowPerformance = {};
  const keys: Array<Exclude<keyof NhkFlowPerformance, 'parserCacheHit'>> = [
    'flowStartedAt',
    'parseCompletedAt',
    'parseMs',
    'parserServerMs',
    'coachCompletedAt',
    'coachMs',
    'readyAt',
    'linkToReadyMs',
    'firstTrainingAt',
    'linkToFirstTrainingMs',
    'completedAt',
    'sessionDurationMs',
  ];
  for (const key of keys) {
    const number = finite(input[key]);
    if (number !== undefined) output[key] = number;
  }
  if (typeof input.parserCacheHit === 'boolean') output.parserCacheHit = input.parserCacheHit;
  return output;
};

export const startNhkFlowPerformance = (startedAt = Date.now()): NhkFlowPerformance => ({
  flowStartedAt: startedAt,
});

export const recordNhkParsePerformance = (
  performance: NhkFlowPerformance | undefined,
  values: {
    parseMs: number;
    parserServerMs?: number;
    parserCacheHit?: boolean;
    completedAt?: number;
  },
): NhkFlowPerformance => {
  const completedAt = values.completedAt ?? Date.now();
  return {
    ...normalizeNhkFlowPerformance(performance),
    parseCompletedAt: completedAt,
    parseMs: Math.max(0, Math.round(values.parseMs)),
    ...(finite(values.parserServerMs) !== undefined
      ? {parserServerMs: finite(values.parserServerMs)}
      : {}),
    ...(typeof values.parserCacheHit === 'boolean'
      ? {parserCacheHit: values.parserCacheHit}
      : {}),
  };
};

export const recordNhkCoachPerformance = (
  performance: NhkFlowPerformance | undefined,
  coachMs: number,
  completedAt = Date.now(),
): NhkFlowPerformance => {
  const current = normalizeNhkFlowPerformance(performance);
  const flowStartedAt = current.flowStartedAt;
  return {
    ...current,
    coachCompletedAt: completedAt,
    coachMs: Math.max(0, Math.round(coachMs)),
    readyAt: completedAt,
    ...(flowStartedAt !== undefined
      ? {linkToReadyMs: Math.max(0, completedAt - flowStartedAt)}
      : {}),
  };
};

export const recordNhkFirstTraining = (
  performance: NhkFlowPerformance | undefined,
  firstTrainingAt = Date.now(),
): NhkFlowPerformance => {
  const current = normalizeNhkFlowPerformance(performance);
  if (current.firstTrainingAt !== undefined) return current;
  return {
    ...current,
    firstTrainingAt,
    ...(current.flowStartedAt !== undefined
      ? {linkToFirstTrainingMs: Math.max(0, firstTrainingAt - current.flowStartedAt)}
      : {}),
  };
};

export const recordNhkSessionCompletion = (
  performance: NhkFlowPerformance | undefined,
  completedAt = Date.now(),
): NhkFlowPerformance => {
  const current = normalizeNhkFlowPerformance(performance);
  return {
    ...current,
    completedAt,
    ...(current.flowStartedAt !== undefined
      ? {sessionDurationMs: Math.max(0, completedAt - current.flowStartedAt)}
      : {}),
  };
};
