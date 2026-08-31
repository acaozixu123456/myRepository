import {describe, expect, it} from 'vitest';
import {buildFallbackCoach, isNhkCoachResult, pickCoachRecommendation} from './nhkCoach';

describe('NHK automatic coach', () => {
  const sentences = [
    '子どものSNSの使い方が、いろいろな国で問題になっています。',
    'フランスでは、15歳になる前の子どもはSNSを使ってはいけないという法律ができました。',
    '来年1月から使うことができなくなります。',
  ];

  it('builds three useful fallback recommendations', () => {
    const coach = buildFallbackCoach('フランスのSNS規制', sentences);
    expect(isNhkCoachResult(coach)).toBe(true);
    expect(coach.recommendations).toHaveLength(3);
    expect(coach.recommendations.some(item => item.expression.includes('てはいけない'))).toBe(true);
  });

  it('keeps a selected recommended sentence as the primary one', () => {
    const coach = buildFallbackCoach('フランスのSNS規制', sentences);
    const target = coach.recommendations[1];
    expect(pickCoachRecommendation(coach, [target.sentence])?.sentence).toBe(target.sentence);
  });
});
