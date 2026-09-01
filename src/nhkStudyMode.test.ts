import {describe, expect, it} from 'vitest';
import {
  buildNhkRecallSchedule,
  completeNhkWorldCallback,
  createNhkSession,
  isNhkSessionReadyToComplete,
  recordNhkQuietWorldAnswer,
  recordNhkRecallAttempt,
} from './nhkMorning';
import {loadNhkStudyMode, saveNhkStudyMode} from './nhkStudyMode';

describe('NHK quiet study mode', () => {
  it('persists the learner preference and falls back to voice for invalid values', () => {
    let value: string | null = null;
    const storage = {
      getItem: () => value,
      setItem: (_key: string, next: string) => { value = next; },
    };
    expect(loadNhkStudyMode(storage)).toBe('voice');
    saveNhkStudyMode('quiet', storage);
    expect(loadNhkStudyMode(storage)).toBe('quiet');
    value = 'unknown';
    expect(loadNhkStudyMode(storage)).toBe('voice');
  });

  it('allows a complete written learning loop without pretending that speech happened', () => {
    const session = {
      ...createNhkSession('2026-09-02'),
      shadowText: '仕様変更を受けて、確認方法を見直します。',
      recapText: '仕様変更について説明しました。',
      keyExpression: '〜を受けて',
      worldAnswer: '変更を受けて、影響を確認したほうがいいと思います。',
    };
    expect(isNhkSessionReadyToComplete(session, 'voice')).toBe(false);
    expect(isNhkSessionReadyToComplete(session, 'quiet')).toBe(true);
  });

  it('stores quiet world answers separately from analyzed speech', () => {
    const base = {
      ...createNhkSession('2026-09-02'),
      worldAnswer: '変更を受けて、先に影響を確認します。',
      dailyInput: {
        version: 2 as const,
        articleId: 'quiet-world',
        sourceUrl: 'https://www.mojidict.com/article/quiet-world',
        title: '仕様変更',
        candidateSentences: ['仕様変更を受けて、確認方法を見直します。'],
        coach: {
          version: 1 as const,
          summaryJa: '仕様変更についてのニュースです。',
          summaryZh: '关于规格变更的新闻。',
          recommendations: [],
          opinionQuestion: 'どう思いますか。',
          worldSetupZh: '田中が質問しました。',
          worldPromptJa: 'この変更について、どう思いますか。',
        },
        generatedAt: 1,
        selectedTrainingSentences: [],
        primaryTrainingSentenceId: '',
        userOpinion: '',
        world: {
          eventId: 'quiet-event',
          characterId: 'tanaka' as const,
          characterName: '田中',
          locationNameZh: '公司午休区',
          setupZh: '田中が質問しました。',
          promptJa: 'この変更について、どう思いますか。',
          answer: '',
          usedInWorld: false,
          callback: {
            dueDateKey: '2026-09-05',
            setupZh: '田中がもう一度聞きました。',
            promptJa: '今も同じ考えですか。',
            answer: '',
            recordingSeconds: 0,
          },
        },
        recallSchedule: buildNhkRecallSchedule('2026-09-02'),
      },
    };
    const next = recordNhkQuietWorldAnswer(base, base.worldAnswer, 100);
    expect(next.completionMode).toBe('quiet');
    expect(next.dailyInput?.world).toMatchObject({
      answer: base.worldAnswer,
      usedInWorld: true,
      enteredAt: 100,
      answeredAt: 100,
      responseMode: 'quiet',
    });
    expect(next.speechReviews.world).toBeUndefined();
  });

  it('records quiet recall and callback completion without recording seconds', () => {
    const plan = buildNhkRecallSchedule('2026-09-02', {
      sourceSentence: '新しいルールができました。',
      expression: '〜ことになりました',
      dailyVersion: '来週からルールが変わることになりました。',
      workVersion: '来月から新しい手順を使うことになりました。',
    })[1];
    const base = createNhkSession('2026-09-02');
    const recalled = recordNhkRecallAttempt(base, plan, '2026-09-05', 'good', 0, 20, undefined, 'quiet');
    expect(recalled.recallAttempts[0]).toMatchObject({completionMode: 'quiet', recordingSeconds: 0});

    const withInput = recordNhkQuietWorldAnswer({
      ...base,
      dailyInput: {
        version: 2 as const,
        articleId: 'quiet-callback',
        sourceUrl: 'https://www.mojidict.com/article/quiet-callback',
        title: '新しいルール',
        candidateSentences: ['新しいルールができました。'],
        coach: {
          version: 1 as const,
          summaryJa: '新しいルールの話です。',
          summaryZh: '关于新规则。',
          recommendations: [],
          opinionQuestion: 'どう思いますか。',
          worldSetupZh: '田中が質問しました。',
          worldPromptJa: 'どう思いますか。',
        },
        generatedAt: 1,
        selectedTrainingSentences: [],
        primaryTrainingSentenceId: '',
        userOpinion: '',
        world: {
          eventId: 'quiet-callback-event',
          characterId: 'tanaka' as const,
          characterName: '田中',
          locationNameZh: '公司午休区',
          setupZh: '田中が質問しました。',
          promptJa: 'どう思いますか。',
          answer: '',
          usedInWorld: false,
          callback: {
            dueDateKey: '2026-09-05',
            setupZh: '田中がもう一度聞きました。',
            promptJa: '今も同じ考えですか。',
            answer: '',
            recordingSeconds: 0,
          },
        },
        recallSchedule: buildNhkRecallSchedule('2026-09-02'),
      },
    }, '賛成です。', 10);
    const callback = completeNhkWorldCallback(withInput, '今も賛成です。', 0, undefined, 30, 'quiet');
    expect(callback.dailyInput?.world.callback).toMatchObject({
      answer: '今も賛成です。',
      recordingSeconds: 0,
      completedAt: 30,
      responseMode: 'quiet',
    });
  });
});
