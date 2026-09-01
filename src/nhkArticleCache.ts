export const MOJI_PARSER_VERSION = 'moji-parser-v4';
export const MAX_TRAINING_CANDIDATES = 16;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kivebsjsdfdobxzaokbj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZGZkb2J4emFva2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzA2NDIsImV4cCI6MjEwMzcwNjY0Mn0.rzB2Yhn0vn1WqLJ2cq62WcSTsauNAm9vmn8MfNzgiYM';
const RPC_TIMEOUT_MS = 1_800;

export type PersistentArticlePayload = {
  ok: true;
  sourceUrl: string;
  title: string;
  sentences: string[];
  access: 'matched-public';
  sentenceCount: number;
  resolvedBy: string;
  sourceVersion: string;
  headlineHint?: string;
  referenceUrl?: string;
  officialUrl?: string;
  publishedAt?: string;
  cached?: boolean;
  cacheMeta?: {
    parserVersion?: string;
    fetchedAt?: string;
    expiresAt?: string;
    ageSeconds?: number;
  };
};

type CacheableArticleInput = Omit<PersistentArticlePayload, 'sentences' | 'sentenceCount' | 'sourceVersion' | 'cached' | 'cacheMeta'> & {
  sentences: string[];
};

const clean = (value: unknown, max: number): string => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : '';

export const canonicalMojiArticleUrl = (articleId: string): string =>
  `https://www.mojidict.com/article/${articleId}`;

export const boundedCandidateSentences = (sentences: string[]): string[] => {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of sentences) {
    const sentence = clean(value, 280);
    const key = sentence.replace(/[\s「」『』]/g, '');
    if (!sentence || seen.has(key)) continue;
    seen.add(key);
    result.push(sentence);
    if (result.length >= MAX_TRAINING_CANDIDATES) break;
  }
  return result;
};

export const buildPersistentArticlePayload = (
  articleId: string,
  input: CacheableArticleInput,
): PersistentArticlePayload | null => {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(articleId)) return null;
  const sourceUrl = canonicalMojiArticleUrl(articleId);
  const sentences = boundedCandidateSentences(input.sentences);
  const title = clean(input.title, 180);
  const resolvedBy = clean(input.resolvedBy, 80);
  if (input.access !== 'matched-public'
    || input.sourceUrl !== sourceUrl
    || !title
    || !resolvedBy
    || sentences.length < 2) return null;
  return {
    ok: true,
    sourceUrl,
    title,
    sentences,
    access: 'matched-public',
    sentenceCount: sentences.length,
    resolvedBy,
    sourceVersion: MOJI_PARSER_VERSION,
    ...(clean(input.headlineHint, 280) ? {headlineHint: clean(input.headlineHint, 280)} : {}),
    ...(clean(input.referenceUrl, 500) ? {referenceUrl: clean(input.referenceUrl, 500)} : {}),
    ...(clean(input.officialUrl, 500) ? {officialUrl: clean(input.officialUrl, 500)} : {}),
    ...(clean(input.publishedAt, 80) ? {publishedAt: clean(input.publishedAt, 80)} : {}),
  };
};

export const isPersistentArticlePayload = (
  value: unknown,
  articleId: string,
): value is PersistentArticlePayload => {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<PersistentArticlePayload>;
  return payload.ok === true
    && payload.access === 'matched-public'
    && payload.sourceVersion === MOJI_PARSER_VERSION
    && payload.sourceUrl === canonicalMojiArticleUrl(articleId)
    && typeof payload.title === 'string'
    && payload.title.trim().length > 0
    && Array.isArray(payload.sentences)
    && payload.sentences.length >= 2
    && payload.sentences.length <= MAX_TRAINING_CANDIDATES
    && payload.sentences.every(sentence => typeof sentence === 'string' && sentence.trim().length > 0);
};

const rpc = async (name: string, body: unknown): Promise<unknown> => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`cache_rpc_${name}_${response.status}`);
  return response.json().catch(() => null);
};

export const readPersistentArticleCache = async (
  articleId: string,
): Promise<PersistentArticlePayload | null> => {
  try {
    const value = await rpc('get_nihongo_article_cache', {
      p_article_id: articleId,
      p_parser_version: MOJI_PARSER_VERSION,
    });
    return isPersistentArticlePayload(value, articleId) ? value : null;
  } catch {
    return null;
  }
};

export const writePersistentArticleCache = async (
  articleId: string,
  payload: PersistentArticlePayload,
): Promise<boolean> => {
  try {
    const value = await rpc('put_nihongo_article_cache', {
      p_article_id: articleId,
      p_source_url: canonicalMojiArticleUrl(articleId),
      p_parser_version: MOJI_PARSER_VERSION,
      p_payload: payload,
      p_ttl_hours: 720,
    });
    return value === true;
  } catch {
    return false;
  }
};
