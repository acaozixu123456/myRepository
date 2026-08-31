import type {Weakness} from './PracticeLane';
import type {Story} from './content';

export type RecallResult = 'good' | 'close' | 'miss';

export type ExpressionHit = {strength: number; lastSeen: number; misses: number};
export type CallbackHit = {hits: number; lastSeen: number; weak: boolean};

export type MemoryRecord = {
  version?: 2;
  strength: number;
  nextReviewAt: number;
  lastSeen: number;
  weaknesses?: Partial<Record<Weakness, number>>;
  lastResult?: RecallResult;
  expressions?: Record<string, ExpressionHit>;
  callbacks?: Record<string, CallbackHit>;
};

export type MemoryMap = Record<string, MemoryRecord>;

const DAY = 24 * 60 * 60 * 1000;
const GOOD_DELAYS = [0, DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];

export const migrateMemory = (raw: MemoryMap): MemoryMap => {
  const out: MemoryMap = {};
  for (const [id, rec] of Object.entries(raw)) {
    out[id] = rec.version === 2 ? rec : {...rec, version: 2, expressions: rec.expressions || {}, callbacks: rec.callbacks || {}};
  }
  return out;
};

export const touchExpression = (rec: MemoryRecord, term: string, good: boolean): MemoryRecord => {
  const expressions = {...(rec.expressions || {})};
  const old = expressions[term] || {strength: 0, lastSeen: 0, misses: 0};
  const now = Date.now();
  expressions[term] = {
    strength: good ? Math.min(old.strength + 1, 5) : Math.max(old.strength - 1, 0),
    lastSeen: now,
    misses: good ? Math.max(0, old.misses - 1) : old.misses + 1,
  };
  return {...rec, version: 2, expressions};
};

export const touchCallback = (rec: MemoryRecord, targetId: string, weak: boolean): MemoryRecord => {
  const callbacks = {...(rec.callbacks || {})};
  const old = callbacks[targetId] || {hits: 0, lastSeen: 0, weak: false};
  callbacks[targetId] = {hits: old.hits + 1, lastSeen: Date.now(), weak: weak || old.weak};
  return {...rec, version: 2, callbacks};
};

export const applyFinish = (
  rec: MemoryRecord,
  result: RecallResult,
  story?: Story,
): MemoryRecord => {
  const now = Date.now();
  const weaknesses = {...(rec.weaknesses || {})};
  let strength = rec.strength;
  let delay = 10 * 60 * 1000;
  if (result === 'good') {
    strength = Math.min(rec.strength + 1, 5);
    delay = GOOD_DELAYS[strength];
    (Object.keys(weaknesses) as Weakness[]).forEach(k => {
      weaknesses[k] = Math.max(0, (weaknesses[k] || 0) - 1);
    });
  } else if (result === 'close') {
    strength = Math.max(rec.strength - 1, 0);
    delay = 6 * 60 * 60 * 1000;
    weaknesses.recall = (weaknesses.recall || 0) + 1;
  } else {
    strength = 0;
    delay = 10 * 60 * 1000;
    weaknesses.recall = (weaknesses.recall || 0) + 2;
  }
  let next: MemoryRecord = {
    ...rec,
    version: 2,
    strength,
    nextReviewAt: now + delay,
    lastSeen: now,
    weaknesses,
    lastResult: result,
    expressions: {...(rec.expressions || {})},
    callbacks: {...(rec.callbacks || {})},
  };
  if (story?.key?.term) next = touchExpression(next, story.key.term, result === 'good');
  const callbacks = (story as Story & {callbacks?: Array<{targetId: string}>}).callbacks || [];
  callbacks.slice(0, 2).forEach(cb => {
    next = touchCallback(next, cb.targetId, result !== 'good');
  });
  return next;
};

export const pickMemoryEcho = (
  story: Story,
  memories: MemoryMap,
): {label: string; term: string} | null => {
  const rec = memories[story.id];
  const callbacks = (story as Story & {callbacks?: Array<{targetId: string; sourceEpisodeId: string}>}).callbacks || [];
  const weakExpr = Object.entries(rec?.expressions || {})
    .filter(([, v]) => v.misses > 0)
    .sort((a, b) => b[1].misses - a[1].misses)[0];
  const callback = callbacks.find(cb => {
    const hit = rec?.callbacks?.[cb.targetId];
    return hit && hit.weak;
  }) || callbacks.find(cb => memories[cb.sourceEpisodeId]?.lastSeen);
  if (callback && memories[callback.sourceEpisodeId]?.lastSeen) {
    const prior = memories[callback.sourceEpisodeId];
    const term = prior.expressions ? Object.keys(prior.expressions)[0] : undefined;
    return {label: '以前见过', term: term || callback.targetId};
  }
  if (weakExpr) return {label: '以前见过', term: weakExpr[0]};
  return null;
};

export const reviewPriority = (rec: MemoryRecord): number => {
  const weaknessScore = Object.values(rec.weaknesses || {}).reduce((a, b) => a + (b || 0), 0);
  const callbackWeak = Object.values(rec.callbacks || {}).filter(v => v.weak).length;
  const exprWeak = Object.values(rec.expressions || {}).filter(v => v.misses > 0).length;
  return weaknessScore * 3 + callbackWeak * 2 + exprWeak + (rec.nextReviewAt <= Date.now() ? 5 : 0);
};
