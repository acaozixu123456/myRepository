export type NhkCachedArticle = {
  version: 1;
  articleId: string;
  sourceUrl: string;
  title: string;
  sentences: string[];
  sourceVersion: string;
  cachedAt: number;
  expiresAt: number;
};

export type NhkEntrySource = 'network' | 'local-cache';

export type NhkEntryMetric = {
  version: 1;
  id: string;
  dateKey: string;
  articleId: string;
  sourceUrl: string;
  startedAt: number;
  parseSource?: NhkEntrySource;
  parseMs?: number;
  coachMs?: number;
  readyMs?: number;
  completedMs?: number;
  completedAt?: number;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const ARTICLE_CACHE_KEY = 'nihongo-moji-article-cache-v1';
const ENTRY_METRICS_KEY = 'nihongo-nhk-entry-metrics-v1';
const ARTICLE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHED_ARTICLES = 12;
const MAX_ENTRY_METRICS = 60;
const MAX_SENTENCES = 16;
const SOURCE_VERSION = 'moji-article-v1';
const MOJI_ARTICLE_PATH = /^\/article\/([A-Za-z0-9_-]+)\/?$/;

const resolveStorage = (storage?: StorageLike): StorageLike | null => {
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? null : localStorage;
};

const clean = (value: unknown, max: number): string => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : '';

const uniqueSentences = (sentences: string[]): string[] =>
  Array.from(new Set(sentences.map(sentence => clean(sentence, 280)).filter(Boolean))).slice(0, MAX_SENTENCES);

export const normalizeMojiArticleUrl = (input: string): string | null => {
  try {
    const url = new URL(input.trim());
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || !['mojidict.com', 'www.mojidict.com', 'm.mojidict.com'].includes(hostname)) return null;
    const match = MOJI_ARTICLE_PATH.exec(url.pathname);
    return match ? `https://www.mojidict.com/article/${match[1]}` : null;
  } catch {
    return null;
  }
};

export const mojiArticleId = (input: string): string => {
  const normalized = normalizeMojiArticleUrl(input);
  return normalized ? normalized.split('/').pop() || '' : '';
};

const loadCachedArticles = (storage: StorageLike): NhkCachedArticle[] => {
  try {
    const parsed = JSON.parse(storage.getItem(ARTICLE_CACHE_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(value => {
      if (!value || typeof value !== 'object') return false;
      const item = value as Partial<NhkCachedArticle>;
      return item.version === 1
        && typeof item.articleId === 'string'
        && typeof item.sourceUrl === 'string'
        && typeof item.title === 'string'
        && Array.isArray(item.sentences)
        && typeof item.cachedAt === 'number'
        && typeof item.expiresAt === 'number';
    }) as NhkCachedArticle[];
  } catch {
    return [];
  }
};

export const readCachedMojiArticle = (
  sourceUrl: string,
  storage?: StorageLike,
  now = Date.now(),
): NhkCachedArticle | null => {
  const target = resolveStorage(storage);
  const articleId = mojiArticleId(sourceUrl);
  if (!target || !articleId) return null;
  const articles = loadCachedArticles(target);
  const valid = articles.filter(item => item.expiresAt > now && item.sourceVersion === SOURCE_VERSION);
  if (valid.length !== articles.length) target.setItem(ARTICLE_CACHE_KEY, JSON.stringify(valid));
  return valid.find(item => item.articleId === articleId) || null;
};

export const writeCachedMojiArticle = ({
  sourceUrl,
  title,
  sentences,
  storage,
  now = Date.now(),
}: {
  sourceUrl: string;
  title: string;
  sentences: string[];
  storage?: StorageLike;
  now?: number;
}): NhkCachedArticle | null => {
  const target = resolveStorage(storage);
  const normalizedUrl = normalizeMojiArticleUrl(sourceUrl);
  const articleId = mojiArticleId(sourceUrl);
  const cleanTitle = clean(title, 180);
  const cleanSentences = uniqueSentences(sentences);
  if (!target || !normalizedUrl || !articleId || !cleanTitle || !cleanSentences.length) return null;
  const next: NhkCachedArticle = {
    version: 1,
    articleId,
    sourceUrl: normalizedUrl,
    title: cleanTitle,
    sentences: cleanSentences,
    sourceVersion: SOURCE_VERSION,
    cachedAt: now,
    expiresAt: now + ARTICLE_CACHE_TTL_MS,
  };
  const existing = loadCachedArticles(target)
    .filter(item => item.articleId !== articleId && item.expiresAt > now && item.sourceVersion === SOURCE_VERSION)
    .sort((left, right) => right.cachedAt - left.cachedAt);
  target.setItem(ARTICLE_CACHE_KEY, JSON.stringify([next, ...existing].slice(0, MAX_CACHED_ARTICLES)));
  return next;
};

const loadMetrics = (storage: StorageLike): NhkEntryMetric[] => {
  try {
    const parsed = JSON.parse(storage.getItem(ENTRY_METRICS_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(value => {
      if (!value || typeof value !== 'object') return false;
      const metric = value as Partial<NhkEntryMetric>;
      return metric.version === 1
        && typeof metric.id === 'string'
        && typeof metric.dateKey === 'string'
        && typeof metric.startedAt === 'number';
    }) as NhkEntryMetric[];
  } catch {
    return [];
  }
};

const saveMetrics = (storage: StorageLike, metrics: NhkEntryMetric[]): void => {
  storage.setItem(ENTRY_METRICS_KEY, JSON.stringify(metrics.slice(0, MAX_ENTRY_METRICS)));
};

export const startNhkEntryMetric = (
  sourceUrl: string,
  dateKey: string,
  storage?: StorageLike,
  now = Date.now(),
): string => {
  const target = resolveStorage(storage);
  if (!target) return '';
  const articleId = mojiArticleId(sourceUrl);
  const id = `${dateKey}-${articleId || 'unknown'}-${now}`;
  const metric: NhkEntryMetric = {
    version: 1,
    id,
    dateKey,
    articleId,
    sourceUrl: normalizeMojiArticleUrl(sourceUrl) || clean(sourceUrl, 400),
    startedAt: now,
  };
  saveMetrics(target, [metric, ...loadMetrics(target).filter(item => item.id !== id)]);
  return id;
};

export const patchNhkEntryMetric = (
  id: string,
  values: Partial<Omit<NhkEntryMetric, 'version' | 'id' | 'dateKey' | 'articleId' | 'sourceUrl' | 'startedAt'>>,
  storage?: StorageLike,
): void => {
  const target = resolveStorage(storage);
  if (!target || !id) return;
  const metrics = loadMetrics(target);
  const index = metrics.findIndex(item => item.id === id);
  if (index < 0) return;
  metrics[index] = {...metrics[index], ...values};
  saveMetrics(target, metrics);
};

export const recentNhkEntryMetrics = (storage?: StorageLike, limit = 14): NhkEntryMetric[] => {
  const target = resolveStorage(storage);
  if (!target) return [];
  return loadMetrics(target).sort((left, right) => right.startedAt - left.startedAt).slice(0, Math.max(0, limit));
};

export const summarizeNhkEntryMetrics = (metrics: NhkEntryMetric[]) => {
  const withReady = metrics.filter(metric => typeof metric.readyMs === 'number');
  const average = (values: number[]): number | null => values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
  return {
    sampleCount: metrics.length,
    cachedCount: metrics.filter(metric => metric.parseSource === 'local-cache').length,
    averageParseMs: average(metrics.flatMap(metric => typeof metric.parseMs === 'number' ? [metric.parseMs] : [])),
    averageReadyMs: average(withReady.map(metric => metric.readyMs as number)),
    withinTenSecondsCount: withReady.filter(metric => (metric.readyMs as number) <= 10_000).length,
    completedCount: metrics.filter(metric => typeof metric.completedAt === 'number').length,
  };
};
