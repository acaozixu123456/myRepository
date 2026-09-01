from pathlib import Path


def replace_one(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


path = Path('api/moji-article.ts')
replace_one(
    path,
    "import type {VercelRequest, VercelResponse} from '@vercel/node';\nimport {inflateRawSync} from 'node:zlib';",
    "import type {VercelRequest, VercelResponse} from '@vercel/node';\nimport {inflateRawSync} from 'node:zlib';\nimport {\n  boundedCandidateSentences,\n  buildPersistentArticlePayload,\n  MOJI_PARSER_VERSION,\n  readPersistentArticleCache,\n  writePersistentArticleCache,\n} from '../src/nhkArticleCache';",
    'article cache imports',
)
replace_one(
    path,
    "type PublicMatch = {\n  title: string;\n  sourceUrl: string;\n  officialUrl?: string;\n  sentences: string[];\n  score: number;\n};\n\ntype ArchiveStory = {\n  title: string;\n  sourceUrl: string;\n  officialUrl?: string;\n  sentences: string[];\n};",
    "type PublicMatch = {\n  title: string;\n  sourceUrl: string;\n  officialUrl?: string;\n  publishedAt?: string;\n  sentences: string[];\n  score: number;\n};\n\ntype ArchiveStory = {\n  title: string;\n  sourceUrl: string;\n  officialUrl?: string;\n  publishedAt?: string;\n  sentences: string[];\n};\n\ntype RequestTiming = {\n  startedAt: number;\n  cacheLookupMs: number;\n  upstreamFetchMs: number;\n  publicLookupMs: number;\n  cacheWriteMs: number;\n};",
    'article match types',
)
replace_one(
    path,
    "const articleIdFromUrl = (url: string): string => url.split('/').filter(Boolean).pop() || '';\n",
    "const articleIdFromUrl = (url: string): string => url.split('/').filter(Boolean).pop() || '';\n\nconst toIsoDate = (value: string): string => {\n  const timestamp = Date.parse(value);\n  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';\n};\n\nconst timingPayload = (timing: RequestTiming) => ({\n  totalMs: Date.now() - timing.startedAt,\n  cacheLookupMs: timing.cacheLookupMs,\n  upstreamFetchMs: timing.upstreamFetchMs,\n  publicLookupMs: timing.publicLookupMs,\n  cacheWriteMs: timing.cacheWriteMs,\n});\n",
    'timing helpers',
)
replace_one(
    path,
    "    const sourceUrl = decodeHtml(xmlTag(item, 'link') || xmlTag(item, 'guid'));\n    const officialUrl = description.match(/https:\\/\\/www3\\.nhk\\.or\\.jp\\/news\\/easy\\/[A-Za-z0-9_-]+\\/[A-Za-z0-9_-]+\\.html/i)?.[0];\n    candidates.push({title, sourceUrl, officialUrl, sentences, score});",
    "    const sourceUrl = decodeHtml(xmlTag(item, 'link') || xmlTag(item, 'guid'));\n    const officialUrl = description.match(/https:\\/\\/www3\\.nhk\\.or\\.jp\\/news\\/easy\\/[A-Za-z0-9_-]+\\/[A-Za-z0-9_-]+\\.html/i)?.[0];\n    const publishedAt = toIsoDate(decodeHtml(xmlTag(item, 'pubDate')));\n    candidates.push({\n      title,\n      sourceUrl,\n      officialUrl,\n      sentences,\n      score,\n      ...(publishedAt ? {publishedAt} : {}),\n    });",
    'feed publication date',
)
replace_one(
    path,
    "  const section = /<section\\b[^>]*>([\\s\\S]*?)<\\/section>/i.exec(xhtml)?.[1] || xhtml;\n  const body = section\n    .replace(/<h3\\b[^>]*>[\\s\\S]*?<\\/h3>/i, ' ')\n    .replace(/<time\\b[^>]*>[\\s\\S]*?<\\/time>/i, ' ')",
    "  const section = /<section\\b[^>]*>([\\s\\S]*?)<\\/section>/i.exec(xhtml)?.[1] || xhtml;\n  const timeTag = /<time\\b[^>]*>[\\s\\S]*?<\\/time>/i.exec(section)?.[0] || '';\n  const publishedAt = toIsoDate(readAttribute(timeTag, 'datetime') || cleanSentence(timeTag));\n  const body = section\n    .replace(/<h3\\b[^>]*>[\\s\\S]*?<\\/h3>/i, ' ')\n    .replace(/<time\\b[^>]*>[\\s\\S]*?<\\/time>/i, ' ')",
    'archive publication date',
)
replace_one(
    path,
    "  return {title, sourceUrl, officialUrl, sentences};\n};",
    "  return {\n    title,\n    sourceUrl,\n    officialUrl,\n    sentences,\n    ...(publishedAt ? {publishedAt} : {}),\n  };\n};",
    'archive publication result',
)
old_matched = """const matchedResponse = (res: VercelResponse, article: ParsedArticle, headlineHint: string, match: PublicMatch, resolvedBy: string) => res.status(200).json({
  ok: true,
  ...article,
  headlineHint,
  sentences: match.sentences,
  access: 'matched-public',
  sentenceCount: match.sentences.length,
  resolvedBy,
  referenceUrl: match.sourceUrl,
  ...(match.officialUrl ? {officialUrl: match.officialUrl} : {}),
});
"""
new_matched = """const matchedResponse = async (
  res: VercelResponse,
  articleId: string,
  article: ParsedArticle,
  headlineHint: string,
  match: PublicMatch,
  resolvedBy: string,
  timing: RequestTiming,
) => {
  const cachePayload = buildPersistentArticlePayload(articleId, {
    ok: true,
    sourceUrl: article.sourceUrl,
    title: article.title,
    sentences: boundedCandidateSentences(match.sentences),
    access: 'matched-public',
    resolvedBy,
    headlineHint,
    referenceUrl: match.sourceUrl,
    ...(match.officialUrl ? {officialUrl: match.officialUrl} : {}),
    ...(match.publishedAt ? {publishedAt: match.publishedAt} : {}),
  });
  const cacheWriteStarted = Date.now();
  const cacheStored = cachePayload ? await writePersistentArticleCache(articleId, cachePayload) : false;
  timing.cacheWriteMs = Date.now() - cacheWriteStarted;
  const payload = cachePayload || {
    ok: true as const,
    sourceUrl: article.sourceUrl,
    title: article.title,
    sentences: boundedCandidateSentences(match.sentences),
    access: 'matched-public' as const,
    sentenceCount: Math.min(match.sentences.length, 16),
    resolvedBy,
    sourceVersion: MOJI_PARSER_VERSION,
    headlineHint,
    referenceUrl: match.sourceUrl,
    ...(match.officialUrl ? {officialUrl: match.officialUrl} : {}),
    ...(match.publishedAt ? {publishedAt: match.publishedAt} : {}),
  };
  return res.status(200).json({
    ...payload,
    cached: false,
    cacheStored,
    timingMs: timingPayload(timing),
  });
};
"""
replace_one(path, old_matched, new_matched, 'matched response')

text = path.read_text(encoding='utf-8')
start = text.index('export default async function handler')
new_handler = """export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const timing: RequestTiming = {
    startedAt: Date.now(),
    cacheLookupMs: 0,
    upstreamFetchMs: 0,
    publicLookupMs: 0,
    cacheWriteMs: 0,
  };
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ok: false, reason: 'method_not_allowed', timingMs: timingPayload(timing)});
  }

  const inputUrl = req.method === 'GET'
    ? String(req.query.url || '')
    : typeof req.body?.url === 'string' ? req.body.url : '';
  const canonicalUrl = normalizeMojiArticleUrl(inputUrl);
  if (!canonicalUrl) {
    return res.status(400).json({ok: false, reason: 'invalid_moji_article_url', timingMs: timingPayload(timing)});
  }

  const articleId = articleIdFromUrl(canonicalUrl);
  const cacheStarted = Date.now();
  const cached = await readPersistentArticleCache(articleId);
  timing.cacheLookupMs = Date.now() - cacheStarted;
  if (cached) {
    return res.status(200).json({
      ...cached,
      cached: true,
      timingMs: timingPayload(timing),
    });
  }

  try {
    const upstreamStarted = Date.now();
    const pages = await fetchArticlePages(canonicalUrl);
    timing.upstreamFetchMs = Date.now() - upstreamStarted;
    if (!pages.length) {
      return res.status(502).json({ok: false, reason: 'upstream_unavailable', timingMs: timingPayload(timing)});
    }
    const articles = pages.map(page => parseMojiArticle(page.html, page.finalUrl));
    const article = articles.sort((a, b) => Number(Boolean(b.headlineHint)) - Number(Boolean(a.headlineHint)))[0];
    const headlineHint = articles.find(candidate => candidate.headlineHint)?.headlineHint;
    const nhkArticle = Boolean(headlineHint) || /NHK/i.test(article.title);

    if (headlineHint) {
      const publicLookupStarted = Date.now();
      try {
        const recentMatch = matchNhkFeed(await fetchNhkFeed(), headlineHint);
        if (recentMatch) {
          timing.publicLookupMs = Date.now() - publicLookupStarted;
          return matchedResponse(res, articleId, article, headlineHint, recentMatch, 'public-nhk-feed', timing);
        }
      } catch {
        // Continue to the historical archive fallback.
      }

      const archiveMatch = await matchNhkArchive(headlineHint);
      timing.publicLookupMs = Date.now() - publicLookupStarted;
      if (archiveMatch) {
        return matchedResponse(res, articleId, article, headlineHint, archiveMatch, 'public-nhk-archive', timing);
      }
    }

    if (nhkArticle) {
      return res.status(422).json({
        ok: false,
        reason: 'nhk_transcript_not_matched',
        title: article.title,
        headlineDetected: Boolean(headlineHint),
        sourceVersion: MOJI_PARSER_VERSION,
        timingMs: timingPayload(timing),
        ...(headlineHint ? {headlineHint} : {}),
      });
    }

    const direct = articles.find(candidate => candidate.access !== 'member-only' && candidate.sentences.length >= 2);
    if (direct) {
      const sentences = boundedCandidateSentences(direct.sentences);
      return res.status(200).json({
        ok: true,
        ...direct,
        sentences,
        access: 'full',
        sentenceCount: sentences.length,
        resolvedBy: 'moji-page',
        sourceVersion: MOJI_PARSER_VERSION,
        cached: false,
        timingMs: timingPayload(timing),
      });
    }

    return res.status(422).json({
      ok: false,
      reason: 'no_japanese_sentences',
      title: article.title,
      sourceVersion: MOJI_PARSER_VERSION,
      timingMs: timingPayload(timing),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'parse_failed';
    console.error('moji-article handler failed', reason);
    return res.status(502).json({ok: false, reason, timingMs: timingPayload(timing)});
  }
}
"""
path.write_text(text[:start] + new_handler, encoding='utf-8')
