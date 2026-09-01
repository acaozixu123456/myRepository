import {describe, expect, it} from 'vitest';
import {buildFallbackCoach} from './nhkCoach';
import type {NhkSpeechReview} from './NhkSpeechCoach';
import {
  buildNhkBossCandidate,
  createNhkBossSession,
  finalizeNhkBossSession,
  findNhkBossSession,
  loadNhkBossSessions,
  nextNhkBossTurnIndex,
  recordNhkBossTurn,
  saveNhkBossSessions,
  upsertNhkBossSession,
} from './nhkBoss';
import {applyNhkDailyInput, buildNhkDailyInput, createNhkSession} from './nhkMorning';

const makeSession = (dateKey: string, suffix: string, sentences: string[]) => {
  const base = {
    ...createNhkSession(dateKey),
    sourceUrl: `https://www.mojidict.com/article/${suffix}`,
    title: `ニュース${suffix}`,
    completedAt: 1,
  };
  const coach = buildFallbackCoach(base.title, sentences);
  return applyNhkDailyInput(base, buildNhkDailyInput({
    session: base,
    coach,
    selectedSentences: sentences,
    candidateSentences: sentences,
  }));
};

const review = (
  id: string,
  transcript: string,
  reactionJa: string,
  targetExpressionUsed = true,
): NhkSpeechReview => ({
  id,
  mode: 'world',
  transcript,
  summaryZh: '回答了问题，并完成了表达。',
  strengthsZh: ['表达完整。'],
  omissions: [],
  substitutions: [],
  particles: [],
  pauseAdviceZh: [],
  minimalRevisionJa: transcript,
  naturalVersionJa: transcript,
  characterReactionJa: reactionJa,
  characterReactionZh: '田中理解了你的回答，并继续追问。',
  metrics: {
    textAccuracy: 0,
    contentScore: 80,
    omissionRate: 0,
    substitutionCount: 0,
    particleIssueCount: 0,
    targetExpressionUsed,
    charactersPerSecond: 3,
  },
  analyzedAt: Number(id.replace(/\D/g, '')) || 1,
  transcriptionModel: 'test-transcribe',
  feedbackModel: 'test-feedback',
});

const weeklySessions = [
  makeSession('2026-08-31', 'a', [
    'フランスでは子どものSNS利用に新しいルールができました。',
    '安全を守るために年齢を確認することになっています。',
    'この変更を受けて多くの家庭が利用方法を見直しています。',
  ]),
  makeSession('2026-09-01', 'b', [
    '会社では新しいシステムを来月から使うことになりました。',
    '古い端末ではサービスを利用することができなくなります。',
    '担当者は影響を確認してから手順を更新すると話しています。',
  ]),
];

describe('weekly spoken NHK Boss', () => {
  it('unlocks only after collecting five distinct real expressions in the calendar week', () => {
    const candidate = buildNhkBossCandidate(weeklySessions, '2026-09-01');
    expect(candidate.weekStartKey).toBe('2026-08-31');
    expect(candidate.weekEndKey).toBe('2026-09-06');
    expect(candidate.expressions.length).toBeGreaterThanOrEqual(5);
    expect(candidate.eligible).toBe(true);

    const notReady = buildNhkBossCandidate([weeklySessions[0]], '2026-09-01');
    expect(notReady.expressions).toHaveLength(3);
    expect(notReady.eligible).toBe(false);
  });

  it('creates five open spoken turns across daily polite and work registers', () => {
    const candidate = buildNhkBossCandidate(weeklySessions, '2026-09-01');
    const session = createNhkBossSession(candidate, weeklySessions, 10);
    expect(session.turns).toHaveLength(5);
    expect(session.turns.map(turn => turn.register)).toEqual(['daily', 'daily', 'polite', 'work', 'work']);
    expect(new Set(session.turns.map(turn => turn.targetExpression)).size).toBe(5);
    expect(session.turns.every(turn => !turn.promptJa.includes(turn.targetExpression))).toBe(true);
    expect(nextNhkBossTurnIndex(session)).toBe(0);
  });

  it('uses the learner-specific reaction to lead into the next question', () => {
    const candidate = buildNhkBossCandidate(weeklySessions, '2026-09-01');
    const session = createNhkBossSession(candidate, weeklySessions, 10);
    const firstReview = review('review-1', '子どもの安全のためにルールが必要だと思います。', '安全を重視しているんですね。');
    const next = recordNhkBossTurn(session, 0, firstReview, 28, 20);
    expect(next.turns[0]).toMatchObject({answer: firstReview.transcript, recordingSeconds: 28, completedAt: 20});
    expect(next.turns[1].promptJa).toContain('安全を重視しているんですね。');
    expect(next.turns[1].promptJa).toContain(next.turns[1].basePromptJa);
    expect(nextNhkBossTurnIndex(next)).toBe(1);
  });

  it('shows the fifth-turn feedback before calculating the weekly outcome', () => {
    const candidate = buildNhkBossCandidate(weeklySessions, '2026-09-01');
    let session = createNhkBossSession(candidate, weeklySessions, 10);
    for (let index = 0; index < 5; index += 1) {
      session = recordNhkBossTurn(
        session,
        index,
        review(`review-${index + 1}`, `第${index + 1}回の回答です。具体的に確認します。`, `では、第${index + 2}の点も考えてみましょう。`, index !== 2),
        30,
        100 + index,
      );
    }
    expect(nextNhkBossTurnIndex(session)).toBe(-1);
    expect(session.outcome).toBeUndefined();
    const completed = finalizeNhkBossSession(session, 200);
    expect(completed.outcome).toMatchObject({
      usedExpressionCount: 4,
      averageContentScore: 80,
      completedAt: 200,
    });
    expect(completed.outcome?.nextWeekHookZh).toContain('下周');
  });

  it('does not finalize an incomplete Boss', () => {
    const candidate = buildNhkBossCandidate(weeklySessions, '2026-09-01');
    const session = createNhkBossSession(candidate, weeklySessions, 10);
    expect(finalizeNhkBossSession(session, 20)).toBe(session);
  });

  it('persists and resumes the current weekly Boss locally', () => {
    const candidate = buildNhkBossCandidate(weeklySessions, '2026-09-01');
    const started = createNhkBossSession(candidate, weeklySessions, 10);
    const progressed = recordNhkBossTurn(
      started,
      0,
      review('review-1', '最初の回答です。', 'なるほど。'),
      24,
      20,
    );
    let value = '';
    const storage = {
      getItem: () => value,
      setItem: (_key: string, next: string) => { value = next; },
    };
    saveNhkBossSessions(upsertNhkBossSession([], progressed), storage);
    const loaded = loadNhkBossSessions(storage);
    expect(findNhkBossSession(loaded, candidate.weekKey)?.turns[0].answer).toBe('最初の回答です。');
    expect(nextNhkBossTurnIndex(loaded[0])).toBe(1);
  });
});
