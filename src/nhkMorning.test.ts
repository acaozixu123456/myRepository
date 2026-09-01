import {describe, expect, it} from 'vitest';
import {buildFallbackCoach} from './nhkCoach';
import type {NhkSpeechReview} from './NhkSpeechCoach';
import {
  applyNhkDailyInput,
  applyNhkSpeechReview,
  applyNhkWorldCallbackReview,
  buildNhkDailyInput,
  completeNhkWorldCallback,
  completedNhkStreak,
  createNhkSession,
  findTodayNhkSession,
  isNhkSessionReadyToComplete,
  loadNhkSessions,
  markNhkDailyInputUsedInWorld,
  pickNhkWorldCallbackTarget,
  pickRecallTarget,
  recordNhkRecallAttempt,
  saveNhkSessions,
  suggestExpression,
  type NhkMorningSession,
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
    let session: NhkMorningSession = {
      ...createNhkSession('2026-09-01'),
      shadowText: sourceSentences[0],
      keyExpression: '〜てはいけない',
      completedAt: 1,
    };
    const day1 = pickRecallTarget([session], '2026-09-02');
    expect(day1?.intervalDay).toBe(1);
    session = recordNhkRecallAttempt(session, day1!, '2026-09-02', 'good', 12, 2);
    expect(pickRecallTarget([session], '2026-09-02')).toBeNull();

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
      recapRecordingSeconds: 18,
      worldRecordingSeconds: 12,
    };
    expect(isNhkSessionReadyToComplete(ready)).toBe(true);
  });

  it('persists speech reviews, fills transcripts and keeps manual fallback available', () => {
    const review: NhkSpeechReview = {
      id: 'review-1',
      mode: 'world',
      transcript: '仕様変更を受けて、確認方法を見直したほうがいいと思います。',
      summaryZh: '观点清楚，也使用了目标表达。',
      strengthsZh: ['回答了问题。'],
      omissions: [],
      substitutions: [],
      particles: [],
      pauseAdviceZh: [],
      minimalRevisionJa: '仕様変更を受けて、確認方法を見直したほうがいいと思います。',
      naturalVersionJa: '仕様変更を受けて、確認方法を見直したほうがいいと思います。',
      characterReactionJa: '確かに、その進め方がよさそうですね。',
      characterReactionZh: '田中赞同你的处理方式。',
      metrics: {
        textAccuracy: 0,
        contentScore: 88,
        omissionRate: 0,
        substitutionCount: 0,
        particleIssueCount: 0,
        targetExpressionUsed: true,
        charactersPerSecond: 3.2,
      },
      analyzedAt: 100,
      transcriptionModel: 'test-transcribe',
      feedbackModel: 'test-feedback',
    };
    const coach = buildFallbackCoach('仕様変更', sourceSentences);
    const base = applyNhkDailyInput(
      {...createNhkSession('2026-09-01'), sourceUrl: 'https://www.mojidict.com/article/speech', title: '仕様変更'},
      buildNhkDailyInput({
        session: {...createNhkSession('2026-09-01'), sourceUrl: 'https://www.mojidict.com/article/speech', title: '仕様変更'},
        coach,
        selectedSentences: [sourceSentences[0]],
        candidateSentences: sourceSentences,
      }),
    );
    const reviewed = applyNhkSpeechReview(base, {
      ...review,
      audioBase64: 'review-audio-must-not-survive',
    } as NhkSpeechReview);
    expect(reviewed.worldAnswer).toBe(review.transcript);
    expect(reviewed.speechReviews.world?.id).toBe('review-1');
    expect(reviewed.dailyInput?.world.characterReactionJa).toBe(review.characterReactionJa);

    let saved = '';
    saveNhkSessions([reviewed], {
      getItem: () => saved,
      setItem: (_key: string, value: string) => { saved = value; },
    });
    expect(saved).not.toContain('review-audio-must-not-survive');
    const restored = JSON.parse(saved)[0] as NhkMorningSession;
    expect(restored.speechReviews.world?.metrics.charactersPerSecond).toBe(0);

    const typedOnly = {...reviewed, recapText: '要約です。', recapRecordingSeconds: 0, worldRecordingSeconds: 0};
    expect(isNhkSessionReadyToComplete(typedOnly)).toBe(true);
    expect(isNhkSessionReadyToComplete({...typedOnly, speechFallback: true})).toBe(true);
  });

  it('loads a sparse legacy session without requiring the v2 fields', () => {
    const payload = JSON.stringify([{
      id: 'nhk-2026-08-30',
      dateKey: '2026-08-30',
      sourceUrl: '',
      title: '旧セッション',
      shadowText: '一文目です。\n二文目です。',
      recapText: '',
      keyExpression: '',
      dailyVersion: '',
      workVersion: '',
      opinion: '',
      worldAnswer: '',
      recapRecordingSeconds: 0,
      worldRecordingSeconds: 0,
    }]);
    const values = new Map<string, string>([['nihongo-nhk-morning-v1', payload]]);
    const storage = {
      getItem: (key: string) => values.get(key) || null,
      setItem: () => undefined,
    };
    const migrated = loadNhkSessions(storage)[0];
    expect(migrated.selectedSentences).toEqual(['一文目です。', '二文目です。']);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.shadowRecordingSeconds).toBe(0);
    expect(migrated.recallAttempts).toEqual([]);
  });

  it('persists only bounded text feedback and metrics, never audio-like fields', () => {
    let saved = '';
    const storage = {
      getItem: () => saved,
      setItem: (_key: string, value: string) => { saved = value; },
    };
    const coach = buildFallbackCoach('制度変更', sourceSentences);
    const base = {
      ...createNhkSession('2026-08-31'),
      sourceUrl: 'https://www.mojidict.com/article/speech-test',
      title: '制度変更',
    };
    const dailyInput = buildNhkDailyInput({
      session: base,
      coach,
      selectedSentences: [sourceSentences[0]],
      candidateSentences: sourceSentences,
    });
    const unsafe = {
      ...applyNhkDailyInput(base, dailyInput),
      recapText: '制度が変わるそうです。',
      recapRecordingSeconds: 24,
      recapFeedback: {
        version: 1,
        mode: 'recap',
        expectedText: '来年から制度が変わります。',
        transcript: '制度が変わるそうです。',
        durationSeconds: 24,
        usedFallback: false,
        minimalRevision: '制度が変わるそうです。',
        naturalJapanese: '来年から制度が変わるそうです。',
        missingFacts: ['来年から'],
        linkageFeedback: '时间信息放在句首更清楚。',
        naturalnessFeedback: '自然です。',
        rawAudio: 'nested-audio-must-not-survive',
      },
      dailyInput: {
        ...dailyInput,
        rawAudio: 'daily-input-audio-must-not-survive',
        coach: {...coach, audioBase64: 'coach-audio-must-not-survive'},
      },
      audioBase64: 'top-level-audio-must-not-survive',
      audioUrl: 'blob:must-not-survive',
      blob: {size: 1234},
    };

    saveNhkSessions([unsafe as ReturnType<typeof createNhkSession>], storage);
    expect(saved).not.toContain('audio-must-not-survive');
    expect(saved).not.toContain('blob:must-not-survive');
    const restored = loadNhkSessions(storage)[0];
    expect(restored.recapFeedback?.transcript).toBe('制度が変わるそうです。');
    expect(restored.recapRecordingSeconds).toBe(24);
    expect(restored.dailyInput?.selectedTrainingSentences[0].sourceSentence).toBe(sourceSentences[0]);
  });

  it('turns the daily input into a causal world event with a later callback', () => {
    const coach = buildFallbackCoach('フランスのSNS規制', sourceSentences);
    const base = {
      ...createNhkSession('2026-09-01'),
      sourceUrl: 'https://www.mojidict.com/article/causal123',
      title: 'フランスのSNS規制',
      worldAnswer: '年齢に応じたルールが必要だと思います。',
      completedAt: 1,
    };
    let session = applyNhkDailyInput(base, buildNhkDailyInput({
      session: base,
      coach,
      selectedSentences: [sourceSentences[0]],
      candidateSentences: sourceSentences,
    }));
    expect(session.dailyInput?.world.usedInWorld).toBe(false);
    expect(session.dailyInput?.world.callback.dueDateKey).toBe('2026-09-04');
    expect(pickNhkWorldCallbackTarget([session], '2026-09-04')).toBeNull();

    session = markNhkDailyInputUsedInWorld(session, 100);
    expect(session.dailyInput?.world.enteredAt).toBe(100);
    expect(pickNhkWorldCallbackTarget([session], '2026-09-03')).toBeNull();
    expect(pickNhkWorldCallbackTarget([session], '2026-09-04')?.session.id).toBe(session.id);

    const review: NhkSpeechReview = {
      id: 'callback-review',
      mode: 'world',
      transcript: '今も同じ考えです。子どもの安全を守るためです。',
      summaryZh: '立场和理由都很清楚。',
      strengthsZh: ['说明了理由。'],
      omissions: [],
      substitutions: [],
      particles: [],
      pauseAdviceZh: [],
      minimalRevisionJa: '今も同じ考えです。子どもの安全を守るためです。',
      naturalVersionJa: '今も同じ考えです。子どもの安全を守るためです。',
      characterReactionJa: '前より理由がはっきりしましたね。',
      characterReactionZh: '田中发现你的理由比上次更清楚。',
      metrics: {
        textAccuracy: 0,
        contentScore: 90,
        omissionRate: 0,
        substitutionCount: 0,
        particleIssueCount: 0,
        targetExpressionUsed: true,
        charactersPerSecond: 3,
      },
      analyzedAt: 200,
      transcriptionModel: 'test-transcribe',
      feedbackModel: 'test-feedback',
    };
    session = applyNhkWorldCallbackReview(session, review, 14);
    expect(session.dailyInput?.world.callback.answer).toBe(review.transcript);
    session = completeNhkWorldCallback(session, review.transcript, 14, review, 300);
    expect(session.dailyInput?.world.callback.completedAt).toBe(300);
    expect(session.dailyInput?.world.callback.characterReactionJa).toBe(review.characterReactionJa);
    expect(pickNhkWorldCallbackTarget([session], '2026-09-04')).toBeNull();
  });
});
