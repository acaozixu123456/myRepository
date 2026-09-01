import {describe, expect, it} from 'vitest';
import {buildFallbackCoach} from './nhkCoach';
import type {NhkSpeechReview} from './NhkSpeechCoach';
import {
  applyNhkDailyInput,
  applyNhkSpeechReview,
  applyNhkWorldCallbackReview,
  buildNhkDailyInput,
  buildNhkRecallSchedule,
  completeNhkWorldCallback,
  completedNhkStreak,
  createNhkSession,
  findTodayNhkSession,
  isNhkSessionReadyToComplete,
  loadNhkSessions,
  markNhkDailyInputUsedInWorld,
  pickNhkWorldCallbackTarget,
  pickRecallTarget,
  recordNhkQuietReview,
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
    expect(session.dailyInput?.recallSchedule.map(item => item.scenarioKind)).toEqual([
      'reconstruct',
      'daily-transfer',
      'work-transfer',
    ]);
    expect(session.dailyInput?.recallSchedule[0].referenceJa).toBe(sourceSentences[2]);
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
    expect(day1).toMatchObject({
      intervalDay: 1,
      scenarioKind: 'reconstruct',
      register: 'core',
      titleZh: '重建核心',
      referenceJa: sourceSentences[0],
    });
    session = recordNhkRecallAttempt(session, day1!, '2026-09-02', 'good', 12, 2);
    expect(pickRecallTarget([session], '2026-09-02')).toBeNull();

    const day3 = pickRecallTarget([session], '2026-09-04');
    expect(day3).toMatchObject({
      intervalDay: 3,
      scenarioKind: 'daily-transfer',
      register: 'daily',
    });
    session = recordNhkRecallAttempt(session, day3!, '2026-09-04', 'close', 15, 3);

    const day7 = pickRecallTarget([session], '2026-09-08');
    expect(day7).toMatchObject({
      intervalDay: 7,
      scenarioKind: 'work-transfer',
      register: 'work',
    });
    session = recordNhkRecallAttempt(session, day7!, '2026-09-08', 'good', 9, 4);
    expect(pickRecallTarget([session], '2026-09-09')).toBeNull();
    expect(session.recallAttempts).toHaveLength(3);
    expect(session.recallAttempts.every(attempt => attempt.responseMode === 'voice')).toBe(true);
    expect((session.recallAttempts[0] as NhkMorningSession['recallAttempts'][number] & {session?: unknown}).session).toBeUndefined();
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

  it('persists speech reviews, fills transcripts and keeps speaking as the primary path', () => {
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
    const reviewed = applyNhkSpeechReview(base, review);
    expect(reviewed.worldAnswer).toBe(review.transcript);
    expect(reviewed.speechReviews.world?.id).toBe('review-1');
    expect(reviewed.dailyInput?.world.characterReactionJa).toBe(review.characterReactionJa);
    expect(reviewed.dailyInput?.world.targetExpressionUsed).toBe(true);
    expect(reviewed.dailyInput?.world.contentScore).toBe(88);
    expect(reviewed.dailyInput?.world.answeredAt).toBe(100);

    const typedOnly = {...reviewed, recapText: '要約です。', recapRecordingSeconds: 0, worldRecordingSeconds: 0};
    expect(isNhkSessionReadyToComplete(typedOnly)).toBe(false);
    expect(isNhkSessionReadyToComplete({...typedOnly, speechFallback: true})).toBe(true);
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
    expect(session.dailyInput?.world.eventId).toBe('causal123-2026-09-01-world-event');
    expect(session.dailyInput?.world.callback.dueDateKey).toBe('2026-09-04');
    expect(pickNhkWorldCallbackTarget([session], '2026-09-04')).toBeNull();

    const blankAnswer = markNhkDailyInputUsedInWorld({
      ...session,
      worldAnswer: '',
      dailyInput: session.dailyInput ? {
        ...session.dailyInput,
        world: {...session.dailyInput.world, answer: ''},
      } : undefined,
    }, 99);
    expect(pickNhkWorldCallbackTarget([blankAnswer], '2026-09-04')).toBeNull();

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
    expect(session.dailyInput?.world.callback.targetExpressionUsed).toBe(true);
    expect(session.dailyInput?.world.callback.contentScore).toBe(90);
    expect(session.dailyInput?.world.callback.answeredAt).toBe(200);
    session = completeNhkWorldCallback(session, review.transcript, 14, review, 300);
    expect(session.dailyInput?.world.callback.completedAt).toBe(300);
    expect(session.dailyInput?.world.callback.characterReactionJa).toBe(review.characterReactionJa);
    expect(pickNhkWorldCallbackTarget([session], '2026-09-04')).toBeNull();
  });


  it('builds different unseen tasks for day 1, 3 and 7', () => {
    const schedule = buildNhkRecallSchedule('2026-09-01', {
      sourceSentence: sourceSentences[0],
      expression: '〜てはいけない',
      dailyVersion: '子どものSNSには、ある程度ルールが必要だと思います。',
      workVersion: 'この変更を受けて、プロジェクトへの影響を確認します。',
    });
    expect(schedule[0]).toMatchObject({
      scenarioKind: 'reconstruct',
      referenceJa: sourceSentences[0],
      revealLabelZh: '核心原句',
    });
    expect(schedule[1]).toMatchObject({
      scenarioKind: 'daily-transfer',
      referenceJa: '子どものSNSには、ある程度ルールが必要だと思います。',
      revealLabelZh: '日常参考',
    });
    expect(schedule[2]).toMatchObject({
      scenarioKind: 'work-transfer',
      referenceJa: 'この変更を受けて、プロジェクトへの影響を確認します。',
      revealLabelZh: '工作参考',
    });
    expect(new Set(schedule.map(item => item.promptJa)).size).toBe(3);
  });

  it('enriches old minimal v2 recall schedules during storage migration', () => {
    const coach = buildFallbackCoach('フランスのSNS規制', sourceSentences);
    const base = {
      ...createNhkSession('2026-09-01'),
      sourceUrl: 'https://www.mojidict.com/article/migrate-recall',
      title: 'フランスのSNS規制',
    };
    const complete = applyNhkDailyInput(base, buildNhkDailyInput({
      session: base,
      coach,
      selectedSentences: [sourceSentences[0]],
      candidateSentences: sourceSentences,
    }));
    const payload = JSON.stringify([{
      ...complete,
      dailyInput: {
        ...complete.dailyInput,
        recallSchedule: [
          {intervalDay: 1, dueDateKey: '2026-09-02'},
          {intervalDay: 3, dueDateKey: '2026-09-04'},
          {intervalDay: 7, dueDateKey: '2026-09-08'},
        ],
      },
    }]);
    const storage = {getItem: () => payload, setItem: () => undefined};
    const migrated = loadNhkSessions(storage)[0];
    expect(migrated.dailyInput?.recallSchedule[1]).toMatchObject({
      dueDateKey: '2026-09-04',
      scenarioKind: 'daily-transfer',
      register: 'daily',
    });
    expect(migrated.dailyInput?.recallSchedule[2].referenceJa).toBe(complete.workVersion);
  });


  it('supports a deliberate quiet study completion without pretending it was spoken', () => {
    const quiet = {
      ...createNhkSession('2026-09-02', 'quiet'),
      shadowText: '原文です。',
      recapText: 'ニュースの要点です。',
      keyExpression: '〜を受けて',
      worldAnswer: '変更を受けて、確認します。',
      recapRecordingSeconds: 0,
      worldRecordingSeconds: 0,
    };
    expect(isNhkSessionReadyToComplete(quiet)).toBe(true);
    expect(isNhkSessionReadyToComplete({...quiet, recapText: ''})).toBe(false);

    const voice = {...quiet, practiceMode: 'voice' as const};
    expect(isNhkSessionReadyToComplete(voice)).toBe(false);
    expect(isNhkSessionReadyToComplete({
      ...voice,
      recapRecordingSeconds: 12,
      worldRecordingSeconds: 9,
    })).toBe(true);
  });

  it('stores quiet delayed recall separately from speech evidence', () => {
    const session = {
      ...createNhkSession('2026-09-01', 'quiet'),
      shadowText: sourceSentences[0],
      keyExpression: '〜てはいけない',
      completedAt: 1,
      completedMode: 'quiet' as const,
    };
    const target = pickRecallTarget([session], '2026-09-02')!;
    const reviewed = recordNhkRecallAttempt(
      session,
      target,
      '2026-09-02',
      'close',
      0,
      20,
      undefined,
      'quiet',
      'SNSのルール',
    );
    expect(reviewed.recallAttempts[0]).toMatchObject({
      responseMode: 'quiet',
      quietNote: 'SNSのルール',
      recordingSeconds: 0,
      rating: 'close',
    });
    expect(reviewed.recallAttempts[0].review).toBeUndefined();
  });

  it('keeps a bounded local history of anytime quiet reviews', () => {
    let session = createNhkSession('2026-09-01', 'quiet');
    for (let index = 0; index < 35; index += 1) {
      session = recordNhkQuietReview(session, index % 2 ? 'good' : 'close', `note-${index}`, index + 1);
    }
    expect(session.quietReviews).toHaveLength(30);
    expect(session.quietReviews[0].completedAt).toBe(6);
    expect(session.quietReviews[29]).toMatchObject({completedAt: 35, note: 'note-34'});

    const payload = JSON.stringify([session]);
    const storage = {getItem: () => payload, setItem: () => undefined};
    const restored = loadNhkSessions(storage)[0];
    expect(restored.practiceMode).toBe('quiet');
    expect(restored.quietReviews).toHaveLength(30);
  });

  it('records quiet callback completion without a speech review', () => {
    const coach = buildFallbackCoach('静音回访', sourceSentences);
    const base = {
      ...createNhkSession('2026-09-01', 'quiet'),
      sourceUrl: 'https://www.mojidict.com/article/quiet-callback',
      title: '静音回访',
      worldAnswer: '最初の回答です。',
      completedAt: 1,
      completedMode: 'quiet' as const,
    };
    const session = applyNhkDailyInput(base, buildNhkDailyInput({
      session: base,
      coach,
      selectedSentences: [sourceSentences[0]],
      candidateSentences: sourceSentences,
    }));
    const completed = completeNhkWorldCallback(
      session,
      '今も同じ考えです。',
      0,
      undefined,
      200,
      'quiet',
    );
    expect(completed.dailyInput?.world.callback).toMatchObject({
      responseMode: 'quiet',
      recordingSeconds: 0,
      completedAt: 200,
    });
    expect(completed.dailyInput?.world.callback.review).toBeUndefined();
  });

});
