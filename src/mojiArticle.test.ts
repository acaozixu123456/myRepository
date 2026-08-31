import {describe, expect, it} from 'vitest';
import {
  extractJapaneseSentences,
  extractJapaneseSentencesFromText,
  extractMojiHeadlineHint,
  headlineSimilarity,
  matchNhkEasierFeed,
  normalizeMojiArticleUrl,
  parseMojiArticleHtml,
} from './mojiArticle';

describe('MOJi article parser', () => {
  it('accepts only public MOJi article URLs', () => {
    expect(normalizeMojiArticleUrl('https://www.mojidict.com/article/Izr0dhrpz3?from=share')).toBe('https://www.mojidict.com/article/Izr0dhrpz3');
    expect(normalizeMojiArticleUrl('https://example.com/article/Izr0dhrpz3')).toBeNull();
    expect(normalizeMojiArticleUrl('http://www.mojidict.com/article/Izr0dhrpz3')).toBeNull();
  });

  it('extracts the title and Japanese sentences from a public article', () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="物価高を受けて政府が新しい対策 - MOJi辞書">
      <script type="application/ld+json">${JSON.stringify({
        headline: '物価高を受けて政府が新しい対策',
        articleBody: '政府は物価高を受けて、新しい支援策を発表しました。対象となる世帯には来月から給付金が支給される予定です。',
      })}</script>
    </head><body><button>显示译文</button></body></html>`;
    const result = parseMojiArticleHtml(html, 'https://www.mojidict.com/article/demo123');
    expect(result.title).toBe('物価高を受けて政府が新しい対策');
    expect(result.access).toBe('full');
    expect(result.requiresClipboard).toBe(false);
    expect(result.sentences).toContain('政府は物価高を受けて、新しい支援策を発表しました。');
    expect(result.sentences).toContain('対象となる世帯には来月から給付金が支給される予定です。');
  });

  it('recognizes member-only delivery and extracts its Japanese headline hint', () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="亚撒西NHK：暑假变身小老师 - MOJi辞書">
      <meta property="og:description" content="島根県 中学生が保育園の先生の仕事を体験 👉点击单词查询释义 島根県大田市で昨日、夏休みの中学生">
    </head><body>本文为会员专享文章,请打开App阅读</body></html>`;
    const result = parseMojiArticleHtml(html, 'https://www.mojidict.com/article/Izr0dhrpz3');
    expect(result.title).toBe('亚撒西NHK：暑假变身小老师');
    expect(result.access).toBe('member-only');
    expect(result.requiresClipboard).toBe(true);
    expect(result.headlineHint).toBe('島根県中学生が保育園の先生の仕事を体験');
    expect(extractMojiHeadlineHint(html)).toBe(result.headlineHint);
    expect(result.sentences).toEqual(['島根県中学生が保育園の先生の仕事を体験']);
    expect(result.excerpt).toContain('島根県大田市');
  });

  it('matches a MOJi headline to recent public NHK Easy feed sentences', () => {
    const feed = `<?xml version="1.0"?><rss><channel>
      <item>
        <title>別のニュース</title>
        <link>https://nhkeasier.com/story/1/</link>
        <description>&lt;p&gt;別のニュースです。&lt;/p&gt;</description>
      </item>
      <item>
        <title>島根県　中学生が保育園の先生の仕事を体験</title>
        <link>https://nhkeasier.com/story/9883/</link>
        <description>
          &lt;p&gt;島根県大田市で17日、夏休みの中学生たちが保育園の先生の仕事を体験しました。&lt;/p&gt;
          &lt;p&gt;5人の中学生が保育園に集まりました。&lt;/p&gt;
          &lt;p&gt;中学生たちは、仕事の説明を聞いたあと、子どもたちと一緒に遊んだり本を読んだりしました。&lt;/p&gt;
          &lt;a href="https://www3.nhk.or.jp/news/easy/k10000000000000/k10000000000000.html"&gt;Original&lt;/a&gt;
        </description>
      </item>
    </channel></rss>`;
    const match = matchNhkEasierFeed(feed, '島根県 中学生が保育園の先生の仕事を体験');
    expect(match?.sourceUrl).toBe('https://nhkeasier.com/story/9883/');
    expect(match?.officialUrl).toContain('www3.nhk.or.jp/news/easy/');
    expect(match?.sentences).toHaveLength(3);
    expect(match?.sentences[0]).toContain('仕事を体験しました');
    expect(match?.score).toBe(1);
  });

  it('keeps fuzzy title matching strict enough for small punctuation differences', () => {
    expect(headlineSimilarity('島根県 中学生が保育園の先生の仕事を体験', '島根県　中学生が保育園の先生の仕事を体験')).toBe(1);
    expect(headlineSimilarity('東京都で大雨', '北海道で大雪')).toBeLessThan(0.78);
  });

  it('turns copied article text into selectable Japanese sentences', () => {
    const copied = `政府は新しい支援策を発表しました。\n点击显示译文\n対象となる世帯には来月から給付金が支給される予定です。`;
    expect(extractJapaneseSentencesFromText(copied)).toEqual([
      '政府は新しい支援策を発表しました。',
      '対象となる世帯には来月から給付金が支給される予定です。',
    ]);
  });

  it('removes ruby readings and filters Chinese interface noise', () => {
    const html = `<article><h1>今日のニュース</h1><p>会社は<ruby>計画<rt>けいかく</rt></ruby>を見直すことにしました。</p><p>点击显示译文</p><p>0评论 · 2赞</p></article>`;
    expect(extractJapaneseSentences(html)).toEqual(['会社は計画を見直すことにしました。']);
  });
});
