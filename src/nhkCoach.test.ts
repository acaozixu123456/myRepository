import {describe, expect, it} from 'vitest';
import {
  alignCoachRecommendations,
  buildFallbackCoach,
  isNhkCoachResult,
  pickCoachRecommendation,
} from './nhkCoach';

describe('NHK automatic coach', () => {
  const sentences = [
    '子どものSNSの使い方が、いろいろな国で問題になっています。',
    'フランスでは、15歳になる前の子どもはSNSを使ってはいけないという法律ができました。',
    '来年1月から使うことができなくなります。',
    '会社でも利用ルールを決める必要があります。',
  ];

  it('builds three useful fallback recommendations', () => {
    const coach = buildFallbackCoach('フランスのSNS規制', sentences.slice(0, 3));
    expect(isNhkCoachResult(coach)).toBe(true);
    expect(coach.recommendations).toHaveLength(3);
    expect(coach.recommendations.some(item => item.expression.includes('てはいけない'))).toBe(true);
  });

  it('always makes the first selected sentence the primary sentence', () => {
    const coach = buildFallbackCoach('フランスのSNS規制', sentences.slice(0, 3));
    const firstSelected = coach.recommendations[1].sentence;
    const secondSelected = coach.recommendations[0].sentence;
    const primary = pickCoachRecommendation(coach, [firstSelected, secondSelected], sentences);
    expect(primary?.sentence).toBe(firstSelected);
    expect(primary?.label).toBe('核心');
  });

  it('never falls back to an unrelated recommendation', () => {
    const coach = buildFallbackCoach('フランスのSNS規制', sentences.slice(0, 3));
    const manuallySelected = sentences[3];
    const aligned = alignCoachRecommendations(coach, [manuallySelected], sentences);
    expect(aligned[0].sentence).toBe(manuallySelected);
    expect(aligned[0].sentenceIndex).toBe(3);
    expect(aligned[0].label).toBe('核心');
    expect(aligned[0].expression).toContain('会社でも利用ルール');
  });
});
