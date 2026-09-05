import {describe,it,expect} from 'vitest';
import {mojiArticleFetchUrls,normalizeMojiArticleUrl} from '../api/moji-article';

describe('MOJi share URLs',()=>{
  const id='GKfNZSHmCI';
  const canonical=`https://www.mojidict.com/article/${id}`;
  it('accepts the current mobile mojiread share format',()=>{
    expect(normalizeMojiArticleUrl(`https://m.mojidict.com/mojiread/article/${id}`)).toBe(canonical);
    expect(normalizeMojiArticleUrl(`https://m.mojidict.com/mojiread/article/${id}/?from=share#x`)).toBe(canonical);
  });
  it('keeps legacy article links compatible',()=>{
    expect(normalizeMojiArticleUrl(`https://m.mojidict.com/article/${id}`)).toBe(canonical);
    expect(normalizeMojiArticleUrl(canonical)).toBe(canonical);
  });
  it('rejects lookalike hosts, http and unrelated paths',()=>{
    expect(normalizeMojiArticleUrl(`https://evil.example/mojiread/article/${id}`)).toBeNull();
    expect(normalizeMojiArticleUrl(`https://m.mojidict.com.evil.example/mojiread/article/${id}`)).toBeNull();
    expect(normalizeMojiArticleUrl(`http://m.mojidict.com/mojiread/article/${id}`)).toBeNull();
    expect(normalizeMojiArticleUrl(`https://m.mojidict.com/mojiread/user/${id}`)).toBeNull();
  });
  it('tries the actual shared mobile route first while retaining fallbacks',()=>{
    expect(mojiArticleFetchUrls(canonical)).toEqual([
      `https://m.mojidict.com/mojiread/article/${id}`,
      canonical,
      `https://m.mojidict.com/article/${id}`,
      `https://www.mojidict.com/mojiread/article/${id}`,
    ]);
  });
});
