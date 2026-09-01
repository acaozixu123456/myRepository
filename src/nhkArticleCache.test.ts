import {describe, expect, it} from 'vitest';
import {
  boundedCandidateSentences,
  buildPersistentArticlePayload,
  canonicalMojiArticleUrl,
  isPersistentArticlePayload,
  MAX_TRAINING_CANDIDATES,
  MOJI_PARSER_VERSION,
} from './nhkArticleCache';

describe('persistent NHK article cache', () => {
  it('keeps a stable bounded set of unique training candidates', () => {
    const sentences = Array.from({length: 20}, (_, index) => `これは第${index + 1}の練習文です。`);
    const bounded = boundedCandidateSentences([...sentences, sentences[0]]);
    expect(bounded).toHaveLength(MAX_TRAINING_CANDIDATES);
    expect(new Set(bounded).size).toBe(MAX_TRAINING_CANDIDATES);
  });

  it('builds only canonical matched-public cache payloads', () => {
    const articleId = 'abc_DEF-123';
    const payload = buildPersistentArticlePayload(articleId, {
      ok: true,
      sourceUrl: canonicalMojiArticleUrl(articleId),
      title: '島根県 中学生が保育園の仕事を体験',
      sentences: ['中学生が保育園の仕事を体験しました。', '子どもたちと一緒に遊びました。'],
      access: 'matched-public',
      resolvedBy: 'public-nhk-feed',
      headlineHint: '島根県中学生が保育園の先生の仕事を体験',
      referenceUrl: 'https://example.test/story',
      publishedAt: '2026-08-31T00:00:00.000Z',
    });
    expect(payload).toMatchObject({
      ok: true,
      sourceUrl: canonicalMojiArticleUrl(articleId),
      access: 'matched-public',
      sentenceCount: 2,
      sourceVersion: MOJI_PARSER_VERSION,
    });
    expect(isPersistentArticlePayload(payload, articleId)).toBe(true);
  });

  it('rejects direct MOJi text and cross-article payloads', () => {
    const articleId = 'safe-id';
    expect(buildPersistentArticlePayload(articleId, {
      ok: true,
      sourceUrl: canonicalMojiArticleUrl(articleId),
      title: '直接ページ',
      sentences: ['一つ目の日本語文です。', '二つ目の日本語文です。'],
      access: 'full' as 'matched-public',
      resolvedBy: 'moji-page',
    })).toBeNull();

    const payload = buildPersistentArticlePayload(articleId, {
      ok: true,
      sourceUrl: canonicalMojiArticleUrl(articleId),
      title: '公開本文',
      sentences: ['一つ目の日本語文です。', '二つ目の日本語文です。'],
      access: 'matched-public',
      resolvedBy: 'public-nhk-archive',
    });
    expect(isPersistentArticlePayload(payload, 'another-id')).toBe(false);
  });
});
