import {describe, expect, it} from 'vitest';
import {
  mojiArticleId,
  normalizeMojiArticleUrl,
  patchNhkEntryMetric,
  readCachedMojiArticle,
  recentNhkEntryMetrics,
  startNhkEntryMetric,
  summarizeNhkEntryMetrics,
  writeCachedMojiArticle,
} from './nhkEntryCost';

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
};

describe('NHK entry cost cache and metrics', () => {
  it('normalizes only supported MOJi article URLs', () => {
    expect(normalizeMojiArticleUrl('https://m.mojidict.com/article/lzXuLYNjQZ?from=share')).toBe('https://www.mojidict.com/article/lzXuLYNjQZ');
    expect(mojiArticleId('https://www.mojidict.com/article/lzXuLYNjQZ')).toBe('lzXuLYNjQZ');
    expect(normalizeMojiArticleUrl('https://example.com/article/lzXuLYNjQZ')).toBeNull();
  });

  it('stores a bounded local article result and respects expiry', () => {
    const target = storage();
    const written = writeCachedMojiArticle({
      sourceUrl: 'https://www.mojidict.com/article/lzXuLYNjQZ',
      title: 'ニュースの題名',
      sentences: ['一文目です。', '一文目です。', '二文目です。'],
      storage: target,
      now: 1_000,
    });
    expect(written?.sentences).toEqual(['一文目です。', '二文目です。']);
    expect(readCachedMojiArticle(written!.sourceUrl, target, 2_000)?.title).toBe('ニュースの題名');
    expect(readCachedMojiArticle(written!.sourceUrl, target, written!.expiresAt + 1)).toBeNull();
  });

  it('records measurable link-to-training entry cost locally', () => {
    const target = storage();
    const id = startNhkEntryMetric('https://www.mojidict.com/article/abc123', '2026-09-01', target, 10_000);
    patchNhkEntryMetric(id, {
      parseSource: 'local-cache',
      parseMs: 80,
      coachMs: 200,
      readyMs: 450,
      completedMs: 480_000,
      completedAt: 490_000,
    }, target);
    const metrics = recentNhkEntryMetrics(target);
    expect(metrics[0].parseSource).toBe('local-cache');
    expect(summarizeNhkEntryMetrics(metrics)).toEqual({
      sampleCount: 1,
      cachedCount: 1,
      averageParseMs: 80,
      averageReadyMs: 450,
      withinTenSecondsCount: 1,
      completedCount: 1,
    });
  });
});
