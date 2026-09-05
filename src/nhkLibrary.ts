import {isSentenceAnalysis} from './nhkSentenceAnalysis';
import {
  isNhkCoachResult,
  normalizeNhkCoachResult,
  type NhkCoachExample,
  type NhkCoachResult,
  type NhkGrammarPoint,
  type NhkVocabularyPoint,
} from './nhkCoach';
import type {NhkMorningSession} from './nhkMorning';

export type NhkArticleRecord = {
  version: 1;
  id: string;
  articleId: string;
  sourceUrl: string;
  title: string;
  sentences: string[];
  selectedSentences: string[];
  sentenceAnalyses?: import('./nhkSentenceAnalysis').SentenceAnalysis[];
  coach?: NhkCoachResult;
  coachModel?: string;
  importedAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  completedAt?: number;
  studyDateKeys: string[];
};

export type NhkKnowledgeKind = 'grammar' | 'vocabulary';
export type NhkKnowledgeRating = 'again' | 'good';

export type NhkKnowledgeSource = {
  articleId: string;
  articleTitle: string;
  sourceUrl: string;
  sentence: string;
  sentenceIndex: number;
};

export type NhkKnowledgeItem = {
  version: 1;
  id: string;
  kind: NhkKnowledgeKind;
  key: string;
  title: string;
  reading: string;
  meaningZh: string;
  explanationZh: string;
  formation: string;
  nuanceZh: string;
  examples: NhkCoachExample[];
  sources: NhkKnowledgeSource[];
  savedAt: number;
  updatedAt: number;
  reviewCount: number;
  mastery: number;
  nextReviewAt: number;
  lastReviewedAt?: number;
};

export type SaveableKnowledgePoint = {
  kind: NhkKnowledgeKind;
  key: string;
  title: string;
  reading?: string;
  meaningZh: string;
  explanationZh?: string;
  formation?: string;
  nuanceZh?: string;
  examples: NhkCoachExample[];
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const ARTICLE_STORAGE_KEY = 'nihongo-nhk-article-library-v1';
const KNOWLEDGE_STORAGE_KEY = 'nihongo-nhk-knowledge-library-v1';
const DAY_MS = 86_400_000;

const clean = (value: unknown, max = 1000): string => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : '';

const resolveStorage = (storage?: StorageLike): StorageLike | null => {
  if (storage) return storage;
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const sourceSentences = (values: unknown): string[] => Array.isArray(values)
  ? values.filter((v): v is string => typeof v === 'string' && !!v.trim()).map(v => v.trim()) : [];

const uniqueStrings = (values: unknown, limit = 64, max = 320): string[] => Array.isArray(values)
  ? Array.from(new Set(values.map(value => clean(value, max)).filter(Boolean))).slice(0, limit)
  : [];

const articleIdFromUrl = (sourceUrl: string): string => {
  try {
    const url = new URL(sourceUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[0] === 'article' ? parts[1] || '' : parts[parts.length - 1] || '';
  } catch {
    return '';
  }
};

export const nhkArticleRecordId = (sourceUrl: string, title = ''): string => {
  const articleId = articleIdFromUrl(sourceUrl);
  return articleId ? `moji-${articleId}` : `article-${stableHash(`${sourceUrl}|${title}`)}`;
};

export const createNhkArticleRecord = ({
  sourceUrl,
  title,
  sentences,
  selectedSentences = [],
  coach,
  coachModel,
  dateKey,
  importedAt = Date.now(),
  completedAt,
}: {
  sourceUrl: string;
  title: string;
  sentences: string[];
  selectedSentences?: string[];
  coach?: NhkCoachResult;
  coachModel?: string;
  dateKey?: string;
  importedAt?: number;
  completedAt?: number;
}): NhkArticleRecord => {
  const normalizedSentences = sourceSentences(sentences);
  const normalizedCoach = coach && isNhkCoachResult(coach)
    ? normalizeNhkCoachResult(coach, title, normalizedSentences)
    : undefined;
  return {
    version: 1,
    id: nhkArticleRecordId(sourceUrl, title),
    articleId: articleIdFromUrl(sourceUrl),
    sourceUrl: clean(sourceUrl, 1000),
    title: clean(title, 200) || 'NHK日语听力',
    sentences: normalizedSentences,
    selectedSentences: uniqueStrings(selectedSentences, 3, 8000),
    ...(normalizedCoach ? {coach: normalizedCoach} : {}),
    ...(clean(coachModel, 100) ? {coachModel: clean(coachModel, 100)} : {}),
    importedAt,
    updatedAt: importedAt,
    lastOpenedAt: importedAt,
    ...(completedAt ? {completedAt} : {}),
    studyDateKeys: dateKey ? [dateKey] : [],
  };
};

const normalizeArticleRecord = (value: unknown): NhkArticleRecord | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<NhkArticleRecord>;
  const sourceUrl = clean(raw.sourceUrl, 1000);
  const title = clean(raw.title, 200) || 'NHK日语听力';
  if (!sourceUrl) return null;
  const sentences = sourceSentences(raw.sentences);
  const importedAt = typeof raw.importedAt === 'number' ? raw.importedAt : Date.now();
  const coach = raw.coach && isNhkCoachResult(raw.coach)
    ? normalizeNhkCoachResult(raw.coach, title, sentences)
    : undefined;
  return {
    version: 1,
    id: clean(raw.id, 180) || nhkArticleRecordId(sourceUrl, title),
    articleId: clean(raw.articleId, 180) || articleIdFromUrl(sourceUrl),
    sourceUrl,
    title,
    sentences,
    sentenceAnalyses: Array.isArray(raw.sentenceAnalyses) ? raw.sentenceAnalyses.filter(item => isSentenceAnalysis(item) && sentences[item.recommendation.sentenceIndex] === item.recommendation.sentence) : [],
    selectedSentences: uniqueStrings(raw.selectedSentences, 3, 8000),
    ...(coach ? {coach} : {}),
    ...(clean(raw.coachModel, 100) ? {coachModel: clean(raw.coachModel, 100)} : {}),
    importedAt,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : importedAt,
    lastOpenedAt: typeof raw.lastOpenedAt === 'number' ? raw.lastOpenedAt : importedAt,
    ...(typeof raw.completedAt === 'number' ? {completedAt: raw.completedAt} : {}),
    studyDateKeys: uniqueStrings(raw.studyDateKeys, 100, 10),
  };
};

export const upsertNhkArticleRecord = (
  records: NhkArticleRecord[],
  incoming: NhkArticleRecord,
): NhkArticleRecord[] => {
  const normalized = normalizeArticleRecord(incoming) || incoming;
  const previous = records.find(record => record.id === normalized.id);
  const merged: NhkArticleRecord = previous ? {
    ...previous,
    ...normalized,
    importedAt: Math.min(previous.importedAt, normalized.importedAt),
    updatedAt: Math.max(previous.updatedAt, normalized.updatedAt),
    lastOpenedAt: Math.max(previous.lastOpenedAt, normalized.lastOpenedAt),
    sentences: normalized.sentences.length ? normalized.sentences : previous.sentences,
    selectedSentences: normalized.selectedSentences.length ? normalized.selectedSentences : previous.selectedSentences,
    sentenceAnalyses: [...(previous.sentenceAnalyses || []).filter(item => !(normalized.sentenceAnalyses || []).some(next => next.recommendation.sentenceIndex === item.recommendation.sentenceIndex)), ...(normalized.sentenceAnalyses || [])],
    coach: normalized.coach || previous.coach,
    coachModel: normalized.coachModel || previous.coachModel,
    completedAt: Math.max(previous.completedAt || 0, normalized.completedAt || 0) || undefined,
    studyDateKeys: Array.from(new Set([...previous.studyDateKeys, ...normalized.studyDateKeys])).sort().reverse(),
  } : normalized;
  return [...records.filter(record => record.id !== merged.id), merged]
    .sort((left, right) => right.importedAt - left.importedAt || right.updatedAt - left.updatedAt);
};

export const loadNhkArticleRecords = (storage?: StorageLike): NhkArticleRecord[] => {
  const target = resolveStorage(storage);
  if (!target) return [];
  try {
    const parsed = JSON.parse(target.getItem(ARTICLE_STORAGE_KEY) || '[]') as unknown;
    return Array.isArray(parsed)
      ? parsed.map(normalizeArticleRecord).filter((record): record is NhkArticleRecord => Boolean(record))
        .sort((left, right) => right.importedAt - left.importedAt)
      : [];
  } catch {
    return [];
  }
};

export const saveNhkArticleRecords = (records: NhkArticleRecord[], storage?: StorageLike): boolean => {
  try {
    const target = resolveStorage(storage);
    if (!target) return false;
    target.setItem(ARTICLE_STORAGE_KEY, JSON.stringify(records.map(normalizeArticleRecord).filter(Boolean)));
    return true;
  } catch { return false; }
};

const dateKeyTimestamp = (dateKey: string): number => {
  const timestamp = Date.parse(`${dateKey}T12:00:00+09:00`);
  return Number.isFinite(timestamp) ? timestamp : Date.now();
};

const recordFromSession = (session: NhkMorningSession): NhkArticleRecord | null => {
  if (!session.sourceUrl || !session.title) return null;
  const sentences = session.dailyInput?.candidateSentences?.length
    ? session.dailyInput.candidateSentences
    : session.selectedSentences?.length
      ? session.selectedSentences
      : session.shadowText.split(/\n+/).map(value => value.trim()).filter(Boolean);
  return createNhkArticleRecord({
    sourceUrl: session.sourceUrl,
    title: session.title,
    sentences,
    selectedSentences: session.selectedSentences,
    coach: session.dailyInput?.coach,
    coachModel: session.dailyInput?.coachModel,
    dateKey: session.dateKey,
    importedAt: session.dailyInput?.generatedAt || session.completedAt || dateKeyTimestamp(session.dateKey),
    completedAt: session.completedAt,
  });
};

export const mergeNhkArticlesWithSessions = (
  records: NhkArticleRecord[],
  sessions: NhkMorningSession[],
): NhkArticleRecord[] => sessions.reduce((current, session) => {
  const record = recordFromSession(session);
  if (!record) return current;
  const existing = current.find(item => item.id === record.id);
  if (!existing) return upsertNhkArticleRecord(current, record);
  // Sessions are practice snapshots, never authoritative replacements for archived source.
  return current.map(item => item.id === existing.id ? {...item,
    completedAt: Math.max(item.completedAt || 0, record.completedAt || 0) || undefined,
    studyDateKeys: [...new Set([...item.studyDateKeys, ...record.studyDateKeys])].sort().reverse(),
  } : item);
}, records);

export const updateNhkArticleCoach = (
  records: NhkArticleRecord[],
  sourceUrl: string,
  title: string,
  sentences: string[],
  selectedSentences: string[],
  coach: NhkCoachResult,
  coachModel: string,
  dateKey: string,
  now = Date.now(),
): NhkArticleRecord[] => {
  const next = createNhkArticleRecord({
    sourceUrl,
    title,
    sentences,
    selectedSentences,
    coach,
    coachModel,
    dateKey,
    importedAt: now,
  });
  next.updatedAt = now;
  next.lastOpenedAt = now;
  return upsertNhkArticleRecord(records, next);
};

export const markNhkArticleCompleted = (
  records: NhkArticleRecord[],
  sourceUrl: string,
  completedAt = Date.now(),
): NhkArticleRecord[] => records.map(record => record.id === nhkArticleRecordId(sourceUrl, record.title)
  ? {...record, completedAt, updatedAt: completedAt, lastOpenedAt: completedAt}
  : record);

export const touchNhkArticle = (
  records: NhkArticleRecord[],
  id: string,
  now = Date.now(),
): NhkArticleRecord[] => records.map(record => record.id === id ? {...record, lastOpenedAt: now} : record);

export const knowledgePointFromGrammar = (point: NhkGrammarPoint): SaveableKnowledgePoint => ({
  kind: 'grammar',
  key: point.pattern,
  title: point.pattern,
  meaningZh: point.meaningZh,
  explanationZh: point.explanationZh,
  formation: point.formation,
  nuanceZh: point.nuanceZh,
  examples: point.examples,
});

export const knowledgePointFromVocabulary = (point: NhkVocabularyPoint): SaveableKnowledgePoint => ({
  kind: 'vocabulary',
  key: point.word,
  title: point.word,
  reading: point.reading,
  meaningZh: point.meaningZh,
  explanationZh: point.partOfSpeech,
  nuanceZh: point.nuanceZh,
  examples: point.examples,
});

export const nhkKnowledgeId = (kind: NhkKnowledgeKind, key: string): string =>
  `${kind}-${stableHash(clean(key, 180).toLowerCase())}`;

const normalizeSource = (value: unknown): NhkKnowledgeSource | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<NhkKnowledgeSource>;
  const articleId = clean(source.articleId, 180);
  const sentence = clean(source.sentence, 360);
  if (!articleId || !sentence) return null;
  return {
    articleId,
    articleTitle: clean(source.articleTitle, 200) || 'NHK日语听力',
    sourceUrl: clean(source.sourceUrl, 1000),
    sentence,
    sentenceIndex: Number.isInteger(source.sentenceIndex) ? Number(source.sentenceIndex) : 0,
  };
};

const normalizeKnowledgeItem = (value: unknown): NhkKnowledgeItem | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<NhkKnowledgeItem>;
  if (raw.kind !== 'grammar' && raw.kind !== 'vocabulary') return null;
  const title = clean(raw.title || raw.key, 180);
  const meaningZh = clean(raw.meaningZh, 400);
  if (!title || !meaningZh) return null;
  const savedAt = typeof raw.savedAt === 'number' ? raw.savedAt : Date.now();
  const examples = Array.isArray(raw.examples)
    ? raw.examples
      .filter(item => item && typeof item === 'object')
      .map(item => item as Partial<NhkCoachExample>)
      .map(item => ({ja: clean(item.ja, 320), zh: clean(item.zh, 320)}))
      .filter(item => item.ja && item.zh)
      .slice(0, 4)
    : [];
  const sources = Array.isArray(raw.sources)
    ? raw.sources.map(normalizeSource).filter((source): source is NhkKnowledgeSource => Boolean(source)).slice(0, 20)
    : [];
  return {
    version: 1,
    id: clean(raw.id, 180) || nhkKnowledgeId(raw.kind, title),
    kind: raw.kind,
    key: clean(raw.key, 180) || title,
    title,
    reading: clean(raw.reading, 180),
    meaningZh,
    explanationZh: clean(raw.explanationZh, 800),
    formation: clean(raw.formation, 500),
    nuanceZh: clean(raw.nuanceZh, 800),
    examples,
    sources,
    savedAt,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : savedAt,
    reviewCount: Math.max(0, Number(raw.reviewCount) || 0),
    mastery: Math.max(0, Math.min(5, Number(raw.mastery) || 0)),
    nextReviewAt: typeof raw.nextReviewAt === 'number' ? raw.nextReviewAt : savedAt,
    ...(typeof raw.lastReviewedAt === 'number' ? {lastReviewedAt: raw.lastReviewedAt} : {}),
  };
};

export const loadNhkKnowledge = (storage?: StorageLike): NhkKnowledgeItem[] => {
  const target = resolveStorage(storage);
  if (!target) return [];
  try {
    const parsed = JSON.parse(target.getItem(KNOWLEDGE_STORAGE_KEY) || '[]') as unknown;
    return Array.isArray(parsed)
      ? parsed.map(normalizeKnowledgeItem).filter((item): item is NhkKnowledgeItem => Boolean(item))
        .sort((left, right) => left.nextReviewAt - right.nextReviewAt || right.savedAt - left.savedAt)
      : [];
  } catch {
    return [];
  }
};

export const saveNhkKnowledge = (items: NhkKnowledgeItem[], storage?: StorageLike): boolean => {
  try {
    const target = resolveStorage(storage);
    if (!target) return false;
    target.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(items.map(normalizeKnowledgeItem).filter(Boolean)));
    return true;
  } catch { return false; }
};

export const isNhkKnowledgeSaved = (
  items: NhkKnowledgeItem[],
  kind: NhkKnowledgeKind,
  key: string,
): boolean => items.some(item => item.id === nhkKnowledgeId(kind, key));

export const toggleNhkKnowledge = (
  items: NhkKnowledgeItem[],
  point: SaveableKnowledgePoint,
  source: NhkKnowledgeSource,
  now = Date.now(),
): NhkKnowledgeItem[] => {
  const id = nhkKnowledgeId(point.kind, point.key);
  const existing = items.find(item => item.id === id);
  if (existing) return items.filter(item => item.id !== id);

  const normalizedSource = normalizeSource(source);
  const next: NhkKnowledgeItem = {
    version: 1,
    id,
    kind: point.kind,
    key: clean(point.key, 180),
    title: clean(point.title, 180),
    reading: clean(point.reading, 180),
    meaningZh: clean(point.meaningZh, 400),
    explanationZh: clean(point.explanationZh, 800),
    formation: clean(point.formation, 500),
    nuanceZh: clean(point.nuanceZh, 800),
    examples: point.examples.slice(0, 4),
    sources: normalizedSource ? [normalizedSource] : [],
    savedAt: now,
    updatedAt: now,
    reviewCount: 0,
    mastery: 0,
    nextReviewAt: now,
  };
  return [...items, next].sort((left, right) => left.nextReviewAt - right.nextReviewAt || right.savedAt - left.savedAt);
};

export const addNhkKnowledgeSource = (
  items: NhkKnowledgeItem[],
  point: SaveableKnowledgePoint,
  source: NhkKnowledgeSource,
  now = Date.now(),
): NhkKnowledgeItem[] => {
  const id = nhkKnowledgeId(point.kind, point.key);
  const normalizedSource = normalizeSource(source);
  const existing = items.find(item => item.id === id);
  if (!existing) return toggleNhkKnowledge(items, point, source, now);
  if (!normalizedSource) return items;
  const sourceKey = `${normalizedSource.articleId}|${normalizedSource.sentenceIndex}|${normalizedSource.sentence}`;
  const sources = existing.sources.some(item => `${item.articleId}|${item.sentenceIndex}|${item.sentence}` === sourceKey)
    ? existing.sources
    : [...existing.sources, normalizedSource].slice(-20);
  return items.map(item => item.id === id ? {
    ...item,
    title: clean(point.title, 180) || item.title,
    reading: clean(point.reading, 180) || item.reading,
    meaningZh: clean(point.meaningZh, 400) || item.meaningZh,
    explanationZh: clean(point.explanationZh, 800) || item.explanationZh,
    formation: clean(point.formation, 500) || item.formation,
    nuanceZh: clean(point.nuanceZh, 800) || item.nuanceZh,
    examples: point.examples.length ? point.examples.slice(0, 4) : item.examples,
    sources,
    updatedAt: now,
  } : item);
};

export const removeNhkKnowledge = (items: NhkKnowledgeItem[], id: string): NhkKnowledgeItem[] =>
  items.filter(item => item.id !== id);

const reviewIntervalDays = (mastery: number): number => [1, 1, 3, 7, 14, 30][Math.max(0, Math.min(5, mastery))] || 30;

export const rateNhkKnowledge = (
  items: NhkKnowledgeItem[],
  id: string,
  rating: NhkKnowledgeRating,
  now = Date.now(),
): NhkKnowledgeItem[] => items.map(item => {
  if (item.id !== id) return item;
  const mastery = rating === 'again' ? Math.max(0, item.mastery - 1) : Math.min(5, item.mastery + 1);
  const days = rating === 'again' ? 1 : reviewIntervalDays(mastery);
  return {
    ...item,
    mastery,
    reviewCount: item.reviewCount + 1,
    lastReviewedAt: now,
    nextReviewAt: now + days * DAY_MS,
    updatedAt: now,
  };
}).sort((left, right) => left.nextReviewAt - right.nextReviewAt || right.savedAt - left.savedAt);

export const dueNhkKnowledge = (items: NhkKnowledgeItem[], now = Date.now()): NhkKnowledgeItem[] =>
  items.filter(item => item.nextReviewAt <= now)
    .sort((left, right) => left.nextReviewAt - right.nextReviewAt || left.mastery - right.mastery);

export const exportNhkStudyData = (
  articles: NhkArticleRecord[],
  knowledge: NhkKnowledgeItem[],
  sessions: NhkMorningSession[],
): string => JSON.stringify({
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  articles,
  knowledge,
  sessions,
}, null, 2);
