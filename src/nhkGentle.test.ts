import {describe, it, expect} from 'vitest';
import {loadGentle, saveGentle, focusGentle, checkGentleSentence, recordGentleReview, gentleReviewBatch, gentleContinueArticle, gentleWeek, GENTLE_KEY} from './nhkGentle';
import {createNhkArticleRecord, type NhkKnowledgeItem} from './nhkLibrary';
const storage = () => {const data = new Map<string, string>(); return {getItem: (k: string) => data.get(k) || null, setItem: (k: string, v: string) => {data.set(k, v);}};};
const now = new Date(2026, 8, 5, 12).getTime();
describe('gentle NHK progress', () => {
  it('starts safely with absent, malformed, future-version and unavailable storage', () => {
    const store = storage(); expect(loadGentle(store).activity).toEqual([]);
    for (const data of ['{', '{"version":99}', 'null']) {store.setItem(GENTLE_KEY, data); expect(loadGentle(store).articles).toEqual({});}
    expect(saveGentle(loadGentle(store), {getItem: () => null, setItem: () => {throw Error('quota');}})).toBe(false);
  });
  it('keeps cross-day focus and does not claim completion when merely opening', () => {
    const store = storage(); const progress = focusGentle(loadGentle(store), 'a', 'ここに住んでいます。', now);
    saveGentle(progress, store); expect(loadGentle(store).articles.a.focus).toBe('ここに住んでいます。');
    expect(progress.articles.a.read).toHaveLength(0); expect(progress.activity).toHaveLength(0);
  });
  it('deduplicates checks and distinguishes familiarity from recall', () => {
    const initial = loadGentle(storage());
    const good = checkGentleSentence(initial, 'a', 'sentence', 'good', now);
    const again = checkGentleSentence(good, 'a', 'sentence', 'again', now);
    expect(again.articles.a.read).toEqual(['sentence']); expect(again.articles.a.checked).toEqual([]);
    expect(again.activity).toHaveLength(1); expect(good.articles.a.checked).toEqual(['sentence']);
  });
  it('does not manufacture missed days or erase past participation', () => {
    let progress = checkGentleSentence(loadGentle(storage()), 'a', 'x', 'good', now - 2 * 86400000);
    progress = recordGentleReview(progress, 'v', 'again', now);
    expect(gentleWeek(progress, new Date(now)).filter(day => day.active)).toHaveLength(2);
    expect(gentleWeek(progress, new Date(now))[5].active).toBe(false);
  });
  it('caps the visible review session, leaving the original backlog intact', () => {
    const items = Array.from({length: 8}, (_, i) => ({id: `${i}`, savedAt: i, nextReviewAt: now - i}) as NhkKnowledgeItem);
    const batch = gentleReviewBatch(items, now); expect(batch).toHaveLength(3);
    expect(batch.map(item => item.id)).toEqual(['7', '6', '5']); expect(items).toHaveLength(8);
    expect(gentleReviewBatch(items, now, NaN)).toHaveLength(3);
  });
  it('resumes an older article rather than forcing a new article after midnight', () => {
    const records = ['new', 'old'].map(id => createNhkArticleRecord({sourceUrl: `https://www.mojidict.com/article/${id}`, title: id, sentences: ['sentence']}));
    const progress = focusGentle(loadGentle(storage()), records[1].id, 'sentence', now);
    expect(gentleContinueArticle(records, progress)?.title).toBe('old');
    expect(gentleContinueArticle([], progress)).toBeUndefined();
  });
  it('rejects unsafe storage entries and strips extra data', () => {
    const store = storage(); store.setItem(GENTLE_KEY, '{"version":1,"articles":{"__proto__":{"focus":"x"},"a":{"focus":45,"read":["x","x",3],"updatedAt":"bad"}},"activity":[null,{"day":"bad"}]}');
    const value = loadGentle(store); expect(Object.keys(value.articles)).toEqual(['a']);
    expect(value.articles.a).toEqual({focus:'', read:['x'], checked:[], updatedAt:0}); expect(value.activity).toEqual([]);
  });
});
