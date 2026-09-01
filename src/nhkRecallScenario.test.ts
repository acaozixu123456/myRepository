import {describe, expect, it} from 'vitest';
import {buildFallbackCoach} from './nhkCoach';
import {
  applyNhkDailyInput,
  buildNhkDailyInput,
  createNhkSession,
  type NhkMorningSession,
} from './nhkMorning';
import {buildNhkRecallScenario, NHK_UNSEEN_RECALL_VERSION} from './nhkRecallScenario';

const restrictionSession = (): NhkMorningSession => {
  const sentences = [
    '子どものSNSの使い方が、いろいろな国で問題になっています。',
    'フランスでは、15歳になる前の子どもはSNSを使ってはいけないという法律ができました。',
    '来年1月から使うことができなくなります。',
  ];
  const base = {
    ...createNhkSession('2026-09-01'),
    sourceUrl: 'https://www.mojidict.com/article/recall-test',
    title: 'フランスのSNS規制',
  };
  const coach = buildFallbackCoach(base.title, sentences);
  const restriction = coach.recommendations.find(item => item.expression.includes('てはいけない'))!;
  return applyNhkDailyInput(base, buildNhkDailyInput({
    session: base,
    coach,
    selectedSentences: [restriction.sentence],
    candidateSentences: sentences,
    coachModel: 'test-model',
    generatedAt: 1,
  }));
};

describe('NHK unseen recall scenarios', () => {
  it('creates distinct day 1, day 3 and day 7 tasks', () => {
    const session = restrictionSession();
    const day1 = buildNhkRecallScenario(session, 1);
    const day3 = buildNhkRecallScenario(session, 3);
    const day7 = buildNhkRecallScenario(session, 7);

    expect(day1.scenarioId).toContain(NHK_UNSEEN_RECALL_VERSION);
    expect(new Set([day1.scenarioId, day3.scenarioId, day7.scenarioId]).size).toBe(3);
    expect(day1.register).toBe('same-theme');
    expect(day3.register).toBe('daily');
    expect(day7.register).toBe('business');
    expect(day3.labelZh).toContain('陌生日常');
    expect(day7.labelZh).toContain('陌生工作');
  });

  it('uses genuinely new pattern-grounded examples for day 3 and day 7', () => {
    const session = restrictionSession();
    const day3 = buildNhkRecallScenario(session, 3);
    const day7 = buildNhkRecallScenario(session, 7);

    expect(day3.sampleAnswerJa).toContain('電話で話してはいけません');
    expect(day7.sampleAnswerJa).toContain('本番データ');
    expect(day3.sampleAnswerJa).not.toBe(session.dailyVersion);
    expect(day7.sampleAnswerJa).not.toBe(session.workVersion);
    expect(day3.promptJa).not.toContain(day3.sampleAnswerJa);
    expect(day7.promptJa).not.toContain(day7.sampleAnswerJa);
  });

  it('is deterministic so a delayed task does not change after reload', () => {
    const session = restrictionSession();
    expect(buildNhkRecallScenario(session, 7)).toEqual(buildNhkRecallScenario(session, 7));
  });

  it('keeps a usable fallback for expressions outside the pattern library', () => {
    const session = {
      ...createNhkSession('2026-09-01'),
      keyExpression: '念のため確認します',
      dailyVersion: '念のため、もう一度確認します。',
      workVersion: '念のため、影響範囲をもう一度確認します。',
      selectedSentences: ['念のため確認します。'],
      shadowText: '念のため確認します。',
    };
    const day3 = buildNhkRecallScenario(session, 3);
    const day7 = buildNhkRecallScenario(session, 7);
    expect(day3.source).toBe('stored-transfer');
    expect(day3.sampleAnswerJa).toBe('念のため、もう一度確認します。');
    expect(day7.sampleAnswerJa).toContain('影響範囲');
  });
});
