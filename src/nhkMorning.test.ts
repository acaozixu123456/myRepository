import {describe, expect, it} from 'vitest';
import {
  completedNhkStreak,
  createNhkSession,
  findTodayNhkSession,
  isNhkSessionReadyToComplete,
  loadNhkSessions,
  pickRecallSession,
  suggestExpression,
  upsertNhkSession,
} from './nhkMorning';

describe('NHK morning learning loop', () => {
  it('suggests one sentence instead of collecting the whole article', () => {
    expect(suggestExpression('政府は対応を見直します。\n次の文です。')).toBe('政府は対応を見直します。');
  });

  it('upserts and finds the current local-day session', () => {
    const session = {...createNhkSession('2026-08-31'), title: '今日のニュース'};
    const sessions = upsertNhkSession([], session);
    expect(findTodayNhkSession(sessions, '2026-08-31')?.title).toBe('今日のニュース');
  });

  it('selects the latest completed session for delayed recall', () => {
    const older = {...createNhkSession('2026-08-29'), completedAt: 10};
    const latest = {...createNhkSession('2026-08-30'), completedAt: 20};
    expect(pickRecallSession([older, latest], '2026-08-31')?.dateKey).toBe('2026-08-30');
  });

  it('migrates old shadow text into the new sentence selection', () => {
    const payload = JSON.stringify([{...createNhkSession('2026-08-30'), selectedSentences: undefined, shadowText: '一文目です。\n二文目です。'}]);
    const storage = {getItem: () => payload, setItem: () => undefined};
    expect(loadNhkSessions(storage)[0].selectedSentences).toEqual(['一文目です。', '二文目です。']);
  });

  it('counts consecutive completed mornings and requires output before completion', () => {
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
