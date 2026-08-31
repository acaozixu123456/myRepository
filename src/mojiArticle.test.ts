import {describe, expect, it} from 'vitest';
import {extractJapaneseSentences, normalizeMojiArticleUrl, parseMojiArticleHtml} from './mojiArticle';

describe('MOJi article parser', () => {
  it('accepts only public MOJi article URLs', () => {
    expect(normalizeMojiArticleUrl('https://www.mojidict.com/article/Izr0dhrpz3?from=share')).toBe('https://www.mojidict.com/article/Izr0dhrpz3');
    expect(normalizeMojiArticleUrl('https://example.com/article/Izr0dhrpz3')).toBeNull();
    expect(normalizeMojiArticleUrl('http://www.mojidict.com/article/Izr0dhrpz3')).toBeNull();
  });

  it('extracts the title and Japanese sentences from structured data', () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="物価高を受けて政府が新しい対策 - MOJi辞書">
      <script type="application/ld+json">${JSON.stringify({
        headline: '物価高を受けて政府が新しい対策',
        articleBody: '政府は物価高を受けて、新しい支援策を発表しました。対象となる世帯には来月から給付金が支給される予定です。',
      })}</script>
    </head><body><button>显示译文</button></body></html>`;
    const result = parseMojiArticleHtml(html, 'https://www.mojidict.com/article/demo123');
    expect(result.title).toBe('物価高を受けて政府が新しい対策');
    expect(result.sentences).toContain('政府は物価高を受けて、新しい支援策を発表しました。');
    expect(result.sentences).toContain('対象となる世帯には来月から給付金が支給される予定です。');
  });

  it('removes ruby readings and filters Chinese interface noise', () => {
    const html = `<article><h1>今日のニュース</h1><p>会社は<ruby>計画<rt>けいかく</rt></ruby>を見直すことにしました。</p><p>点击显示译文</p><p>0评论 · 2赞</p></article>`;
    expect(extractJapaneseSentences(html)).toEqual(['会社は計画を見直すことにしました。']);
  });
});
