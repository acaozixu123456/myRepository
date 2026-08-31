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

const resolveEpisodeTerm = (
  episodeId: string,
  memories: MemoryMap,
  catalog?: Story[],
): string | undefined => {
  const prior = memories[episodeId];
  const fromExpr = Object.entries(prior?.expressions || {})
    .sort((a, b) => b[1].misses - a[1].misses || b[1].strength - a[1].strength)[0]?.[0];
  if (fromExpr) return fromExpr;
  return catalog?.find(s => s.id === episodeId)?.key?.term;
};

type EchoCandidate = {term: string; score: number};

const seasonEpisodeIds = (story: Story, catalog?: Story[]): string[] => {
  const seasonId = story.series?.seasonId;
  if (!seasonId || !catalog?.length) return [];
  return catalog
    .filter(s => s.series?.seasonId === seasonId && (s.series?.episodeNo || 0) < (story.series?.episodeNo || 99))
    .map(s => s.id);
};

const scoreExpression = (hit: ExpressionHit, weight: number, now: number): number => {
  const recencyDays = Math.max(0, (now - hit.lastSeen) / (24 * 60 * 60 * 1000));
  const recencyBoost = recencyDays <= 3 ? 3 : recencyDays <= 7 ? 1 : 0;
  const weakness = hit.misses > 0 ? hit.misses * 4 + Math.max(0, 3 - hit.strength) : 0;
  return weight * (weakness + recencyBoost);
};

export const pickMemoryEcho = (
  story: Story,
  memories: MemoryMap,
  catalog?: Story[],
): {label: string; term: string} | null => {
  const rec = memories[story.id];
  const callbacks = (story as Story & {callbacks?: Array<{targetId: string; sourceEpisodeId: string}>}).callbacks || [];
  const now = Date.now();
  const candidates: EchoCandidate[] = [];

  for (const [term, hit] of Object.entries(rec?.expressions || {})) {
    const score = scoreExpression(hit, 1.2, now);
    if (score > 0) candidates.push({term, score});
  }

  for (const episodeId of seasonEpisodeIds(story, catalog)) {
    const prior = memories[episodeId];
    for (const [term, hit] of Object.entries(prior?.expressions || {})) {
      const score = scoreExpression(hit, 1, now);
      if (score > 0) candidates.push({term, score});
    }
  }

  for (const cb of callbacks) {
    const prior = memories[cb.sourceEpisodeId];
    if (!prior?.lastSeen) continue;
    const hit = rec?.callbacks?.[cb.targetId];
    const term = resolveEpisodeTerm(cb.sourceEpisodeId, memories, catalog);
    if (!term) continue;
    let score = 2;
    if (hit?.weak) score += 6;
    const expr = prior.expressions?.[term];
    if (expr) score += scoreExpression(expr, 0.5, now);
    candidates.push({term, score});
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return {label: '以前见过', term: candidates[0].term};
};

export const reviewPriority = (rec: MemoryRecord): number => {
  const weaknessScore = Object.values(rec.weaknesses || {}).reduce((a, b) => a + (b || 0), 0);
  const callbackWeak = Object.values(rec.callbacks || {}).filter(v => v.weak).length;
  const exprWeak = Object.values(rec.expressions || {}).filter(v => v.misses > 0).length;
  return weaknessScore * 3 + callbackWeak * 2 + exprWeak + (rec.nextReviewAt <= Date.now() ? 5 : 0);
};
