import {describe, expect, it} from 'vitest';
import {buildFallbackCoach} from './nhkCoach';
import {applyNhkDailyInput, buildNhkDailyInput, createNhkSession} from './nhkMorning';
import {
  createNhkArticleRecord,
  dueNhkKnowledge,
  knowledgePointFromGrammar,
  loadNhkArticleRecords,
  loadNhkKnowledge,
  mergeNhkArticlesWithSessions,
  nhkArticleRecordId,
  rateNhkKnowledge,
  saveNhkArticleRecords,
  saveNhkKnowledge,
  toggleNhkKnowledge,
  updateNhkArticleCoach,
  upsertNhkArticleRecord,
} from './nhkLibrary';

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
};

describe('NHK article library', () => {
  const sourceUrl = 'https://www.mojidict.com/article/deep-read-001';
  const title = '子どものSNS利用について';
  const sentences = [
    '子どものSNSの使い方が、いろいろな国で問題になっています。',
    '15歳になる前の子どもはSNSを使ってはいけないという法律ができました。',
    '来年1月から使うことができなくなります。',
  ];

  it('archives the complete parsed article before study completion', () => {
    const record = createNhkArticleRecord({sourceUrl, title, sentences, dateKey: '2026-09-03', importedAt: 100});
    expect(record.id).toBe(nhkArticleRecordId(sourceUrl, title));
    expect(record.sentences).toEqual(sentences);
    expect(record.completedAt).toBeUndefined();

    const storage = memoryStorage();
    saveNhkArticleRecords([record], storage);
    const loaded = loadNhkArticleRecords(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe(title);
    expect(loaded[0].sentences).toEqual(sentences);
  });

  it('keeps different same-day articles instead of replacing the archive', () => {
    const first = createNhkArticleRecord({sourceUrl, title, sentences, dateKey: '2026-09-03', importedAt: 100});
    const second = createNhkArticleRecord({
      sourceUrl: 'https://www.mojidict.com/article/deep-read-002',
      title: '別のニュース',
      sentences: ['別のニュースについて説明します。'],
      dateKey: '2026-09-03',
      importedAt: 200,
    });
    const records = upsertNhkArticleRecord(upsertNhkArticleRecord([], first), second);
    expect(records).toHaveLength(2);
    expect(records.map(record => record.title)).toEqual(['別のニュース', title]);
  });

  it('attaches rich coach output without losing the first imported timestamp', () => {
    const first = createNhkArticleRecord({sourceUrl, title, sentences, dateKey: '2026-09-03', importedAt: 100});
    const coach = buildFallbackCoach(title, sentences);
    const updated = updateNhkArticleCoach([first], sourceUrl, title, sentences, [sentences[1]], coach, 'test-model', '2026-09-03', 300);
    expect(updated[0].importedAt).toBe(100);
    expect(updated[0].updatedAt).toBe(300);
    expect(updated[0].coach?.recommendations[0].grammarPoints.length).toBeGreaterThan(0);
    expect(updated[0].coachModel).toBe('test-model');
  });

  it('migrates previously saved daily sessions into the new article library', () => {
    const coach = buildFallbackCoach(title, sentences);
    const base = {...createNhkSession('2026-09-01'), sourceUrl, title};
    const session = applyNhkDailyInput(base, buildNhkDailyInput({
      session: base,
      coach,
      selectedSentences: [sentences[1]],
      candidateSentences: sentences,
      generatedAt: 100,
    }));
    const records = mergeNhkArticlesWithSessions([], [{...session, completedAt: 200}]);
    expect(records).toHaveLength(1);
    expect(records[0].sentences).toEqual(sentences);
    expect(records[0].completedAt).toBe(200);
  });
});

describe('NHK saved grammar and vocabulary review', () => {
  const title = 'SNSのニュース';
  const sourceUrl = 'https://www.mojidict.com/article/knowledge-001';
  const sentence = '子どもはSNSを使ってはいけません。';
  const coach = buildFallbackCoach(title, [sentence]);
  const recommendation = coach.recommendations[0];
  const grammar = recommendation.grammarPoints[0];
  const source = {
    articleId: nhkArticleRecordId(sourceUrl, title),
    articleTitle: title,
    sourceUrl,
    sentence,
    sentenceIndex: 0,
  };

  it('adds and removes only the point manually chosen by the learner', () => {
    const point = knowledgePointFromGrammar(grammar);
    const added = toggleNhkKnowledge([], point, source, 100);
    expect(added).toHaveLength(1);
    expect(added[0].kind).toBe('grammar');
    expect(added[0].title).toBe(grammar.pattern);
    expect(added[0].nextReviewAt).toBe(100);
    expect(toggleNhkKnowledge(added, point, source, 200)).toEqual([]);
  });

  it('persists favorites and schedules repeated review', () => {
    const point = knowledgePointFromGrammar(grammar);
    const saved = toggleNhkKnowledge([], point, source, 100);
    const storage = memoryStorage();
    saveNhkKnowledge(saved, storage);
    const loaded = loadNhkKnowledge(storage);
    expect(dueNhkKnowledge(loaded, 100)).toHaveLength(1);

    const remembered = rateNhkKnowledge(loaded, loaded[0].id, 'good', 100);
    expect(remembered[0].mastery).toBe(1);
    expect(remembered[0].reviewCount).toBe(1);
    expect(remembered[0].nextReviewAt).toBeGreaterThan(100);
    expect(dueNhkKnowledge(remembered, 101)).toHaveLength(0);

    const again = rateNhkKnowledge(remembered, remembered[0].id, 'again', 200);
    expect(again[0].mastery).toBe(0);
    expect(again[0].reviewCount).toBe(2);
  });
});
