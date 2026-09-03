import {describe, expect, it} from 'vitest';
import {
  alignCoachRecommendations,
  buildFallbackCoach,
  isNhkCoachResult,
  normalizeNhkCoachResult,
  pickCoachRecommendation,
} from './nhkCoach';

describe('NHK automatic deep-reading coach', () => {
  const sentences = [
    '子どものSNSの使い方が、いろいろな国で問題になっています。',
    'フランスでは、15歳になる前の子どもはSNSを使ってはいけないという法律ができました。',
    '来年1月から使うことができなくなります。',
    '会社でも利用ルールを決める必要があります。',
  ];

  it('builds three useful fallback recommendations with grammar, vocabulary and examples', () => {
    const coach = buildFallbackCoach('フランスのSNS規制', sentences.slice(0, 3));
    expect(isNhkCoachResult(coach)).toBe(true);
    expect(coach.recommendations).toHaveLength(3);
    expect(coach.recommendations.some(item => item.expression.includes('てはいけない'))).toBe(true);
    expect(coach.recommendations.every(item => item.translationZh.length > 0)).toBe(true);
    expect(coach.recommendations.every(item => item.structureZh.length > 0)).toBe(true);
    expect(coach.recommendations.every(item => item.grammarPoints.length > 0)).toBe(true);
    expect(coach.recommendations.every(item => item.vocabularyPoints.length > 0)).toBe(true);
    expect(coach.recommendations.flatMap(item => item.grammarPoints).some(point => point.examples.length >= 2)).toBe(true);
  });

  it('normalizes old cached coach output into the new rich format', () => {
    const legacy = {
      summaryJa: 'SNSの利用についてのニュースです。',
      summaryZh: '这是关于SNS使用的新闻。',
      recommendations: [{
        sentenceIndex: 1,
        sentence: sentences[1],
        label: '核心',
        reasonZh: '核心规则',
        chunks: [sentences[1]],
        expression: '〜てはいけない',
        meaningZh: '不可以',
        dailyVersion: '子どもは使ってはいけません。',
        workVersion: '本番データを使ってはいけません。',
      }],
      opinionQuestion: 'どう思いますか。',
      worldSetupZh: '旧字段',
      worldPromptJa: 'どう思いますか。',
    };
    const normalized = normalizeNhkCoachResult(legacy, 'SNS', sentences);
    expect(normalized.recommendations[0].sentence).toBe(sentences[1]);
    expect(normalized.recommendations[0].grammarPoints[0].pattern).toContain('てはいけない');
    expect(normalized.recommendations[0].vocabularyPoints.length).toBeGreaterThan(0);
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
