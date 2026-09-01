import {describe, expect, it} from 'vitest';
import {buildFallbackCoach} from './nhkCoach';
import {
  applyNhkDailyInput,
  buildNhkDailyInput,
  createNhkSession,
  type NhkMorningSession,
} from './nhkMorning';
import {
  buildNhkCausalWorldEvent,
  markNhkWorldCallbackRevealed,
  pickNhkWorldCallback,
} from './nhkCausalWorld';

const completedSession = (): NhkMorningSession => {
  const sentences = [
    '子どものSNSの使い方が、いろいろな国で問題になっています。',
    'フランスでは、15歳になる前の子どもはSNSを使ってはいけないという法律ができました。',
    '来年1月から使うことができなくなります。',
  ];
  const base = {
    ...createNhkSession('2026-09-01'),
    sourceUrl: 'https://www.mojidict.com/article/test-world',
    title: 'フランスのSNS規制',
    opinion: '年齢に合わせたルールが必要だと思います。',
    worldAnswer: '子どもを守るために、一定の制限が必要だと思います。',
  };
  const coach = buildFallbackCoach(base.title, sentences);
  const withInput = applyNhkDailyInput(base, buildNhkDailyInput({
    session: base,
    coach,
    selectedSentences: coach.recommendations.map(item => item.sentence),
    candidateSentences: sentences,
    coachModel: 'test-model',
    generatedAt: 1,
  }));
  return {
    ...withInput,
    completedAt: 2,
    dailyInput: {
      ...withInput.dailyInput!,
      world: {
        ...withInput.dailyInput!.world,
        answer: base.worldAnswer,
        usedInWorld: true,
        characterReactionJa: 'なるほど。年齢に合わせたルールなら納得できます。',
        characterReactionZh: '田中认同应根据年龄设置规则。',
      },
    },
  };
};

describe('NHK causal continuous world', () => {
  it('turns a completed daily input into an independent world event', () => {
    const event = buildNhkCausalWorldEvent(completedSession());
    expect(event?.sourceDateKey).toBe('2026-09-01');
    expect(event?.callbackDueDateKey).toBe('2026-09-04');
    expect(event?.answerJa).toContain('一定の制限');
    expect(event?.reactionJa).toContain('年齢に合わせたルール');
    expect(event?.isCallback).toBe(false);
  });

  it('does not surface a callback before day 3', () => {
    expect(pickNhkWorldCallback([completedSession()], '2026-09-03')).toBeNull();
  });

  it('surfaces the event on day 3 and never repeats it after reveal', () => {
    const session = completedSession();
    const target = pickNhkWorldCallback([session], '2026-09-04');
    expect(target?.event.isCallback).toBe(true);
    expect(target?.event.reactionZh).toContain('根据年龄');

    const revealed = markNhkWorldCallbackRevealed(session, 100);
    expect(pickNhkWorldCallback([revealed], '2026-09-05')).toBeNull();
  });

  it('refuses to create a causal event before the answer enters the world', () => {
    const session = completedSession();
    const incomplete = {
      ...session,
      dailyInput: {
        ...session.dailyInput!,
        world: {...session.dailyInput!.world, usedInWorld: false},
      },
    };
    expect(buildNhkCausalWorldEvent(incomplete)).toBeNull();
  });
});
