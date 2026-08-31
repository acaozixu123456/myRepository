import {describe, expect, it} from 'vitest';
import {extractSharedMojiUrl, stripShareParameters} from './shareTarget';

describe('MOJi share target', () => {
  it('extracts an encoded URL share', () => {
    expect(extractSharedMojiUrl('https://app.example/?share_target=1&url=https%3A%2F%2Fm.mojidict.com%2Farticle%2FlzXuLYNjQZ'))
      .toBe('https://www.mojidict.com/article/lzXuLYNjQZ');
  });

  it('extracts a link embedded in shared text', () => {
    const href = 'https://app.example/?text=' + encodeURIComponent('亚撒西NHK\nhttps://www.mojidict.com/article/Izr0dhrpz3');
    expect(extractSharedMojiUrl(href)).toBe('https://www.mojidict.com/article/Izr0dhrpz3');
  });

  it('does not accept unrelated links and removes share parameters', () => {
    expect(extractSharedMojiUrl('https://app.example/?url=https%3A%2F%2Fexample.com')).toBeNull();
    expect(stripShareParameters('https://app.example/?share_target=1&url=x&keep=1#top')).toBe('/?keep=1#top');
  });
});
