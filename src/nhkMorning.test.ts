import {describe, expect, it} from 'vitest';
import {buildFallbackCoach} from './nhkCoach';
import {
  applyNhkDailyInput,
  buildNhkDailyInput,
  completedNhkStreak,
  createNhkSession,
  findTodayNhkSession,
  isNhkSessionReadyToComplete,
  loadNhkSessions,
  pickRecallTarget,
  recordNhkRecallAttempt,
  saveNhkSessions,
  suggestExpression,
  upsertNhkSession,
} from './nhkMorning';

describe('NHK morning learning loop', () => {
  const sourceSentences = [
    'フランスでは、15歳になる前の子どもはSNSを使ってはいけないという法律ができました。',
    '来年1月から使うことができなくなります。',
    '会社でも利用ルールを決める必要があります。',
  ];

  it('suggests one sentence instead of collecting the whole article', () => {
    expect(suggestExpression('政府は対応を見直します。\n次の文です。')).toBe('政府は対応を見直します。');
  });

  it('persists a complete DailyInputV2 with one explicit primary sentence', () => {
    const coach = buildFallbackCoach('フランスのSNS規制', sourceSentences);
    const base = {
      ...createNhkSession('2026-09-01'),
      sourceUrl: 'https://www.mojidict.com/article/example123',
      title: 'フランスのSNS規制',
    };
    const dailyInput = buildNhkDailyInput({
      session: base,
      coach,
      selectedSentences: [sourceSentences[2], sourceSentences[0]],
      candidateSentences: sourceSentences,
      coachModel: 'test-model',
      generatedAt: 100,
    });
    const session = applyNhkDailyInput(base, dailyInput);

    expect(session.dailyInput?.version).toBe(2);
    expect(session.dailyInput?.articleId).toBe('example123');
    expect(session.dailyInput?.candidateSentences).toEqual(sourceSentences);
    expect(session.dailyInput?.coach.summaryJa).toBe(coach.summaryJa);
    expect(session.dailyInput?.selectedTrainingSentences[0].sourceSentence).toBe(sourceSentences[2]);
    expect(session.dailyInput?.selectedTrainingSentences[0].isPrimary).toBe(true);
    expect(session.keyExpression).toContain('会社でも利用ルール');
    expect(session.dailyInput?.recallSchedule.map(item => item.intervalDay)).toEqual([1, 3, 7]);
  });

  it('migrates legacy storage and writes the new v2 key', () => {
    const legacy = JSON.stringify([{
      ...createNhkSession('2026-08-30'),
      schemaVersion: undefined,
      selectedSentences: undefined,
      recallAttempts: undefined,
      shadowText: '一文目です。\n二文目です。',
    }]);
    const values = new Map<string, string>([['nihongo-nhk-morning-v1', legacy]]);
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const loaded = loadNhkSessions(storage);
    expect(loaded[0].schemaVersion).toBe(2);
    expect(loaded[0].selectedSentences).toEqual(['一文目です。', '二文目です。']);
    saveNhkSessions(loaded, storage);
    expect(values.has('nihongo-nhk-morning-v2')).toBe(true);
  });

  it('schedules durable day 1, 3 and 7 recall attempts', () => {
    let session = {
      ...createNhkSession('2026-09-01'),
      shadowText: sourceSentences[0],
      keyExpression: '〜てはいけない',
      completedAt: 1,
    };
    const day1 = pickRecallTarget([session], '2026-09-02');
    expect(day1?.intervalDay).toBe(1);
    session = recordNhkRecallAttempt(session, day1!, '2026-09-02', 'good', 12, 2);

    const day3 = pickRecallTarget([session], '2026-09-04');
    expect(day3?.intervalDay).toBe(3);
    session = recordNhkRecallAttempt(session, day3!, '2026-09-04', 'close', 15, 3);

    const day7 = pickRecallTarget([session], '2026-09-08');
    expect(day7?.intervalDay).toBe(7);
    session = recordNhkRecallAttempt(session, day7!, '2026-09-08', 'good', 9, 4);
    expect(pickRecallTarget([session], '2026-09-09')).toBeNull();
    expect(session.recallAttempts).toHaveLength(3);
  });

  it('upserts, counts streaks and requires output before completion', () => {
    const session = {...createNhkSession('2026-08-31'), title: '今日のニュース'};
    const sessions = upsertNhkSession([], session);
    expect(findTodayNhkSession(sessions, '2026-08-31')?.title).toBe('今日のニュース');

    const first = {...createNhkSession('2026-08-29'), completedAt: 1};
    const second = {...createNhkSession('2026-08-30'), completedAt: 2};
    expect(completedNhkStreak([first, second], '2026-08-31')).toBe(2);

    const ready = {
      ...createNhkSession('2026-08-31'),
      shadowText: '原文。',
      recapText: '自分の要約。',
      keyExpression: '〜を受けて',
      worldAnswer: '仕様変更を受けて、確認します。',
    };
    expect(isNhkSessionReadyToComplete(ready)).toBe(true);
  });
});
