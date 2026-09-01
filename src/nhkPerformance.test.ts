import {describe, expect, it} from 'vitest';
import {
  normalizeNhkFlowPerformance,
  recordNhkCoachPerformance,
  recordNhkFirstTraining,
  recordNhkParsePerformance,
  recordNhkSessionCompletion,
  startNhkFlowPerformance,
} from './nhkPerformance';

describe('NHK flow performance tracking', () => {
  it('records parser, coach, first-training and total-session timing from one stable start', () => {
    let performance = startNhkFlowPerformance(1_000);
    performance = recordNhkParsePerformance(performance, {
      parseMs: 2_500,
      parserServerMs: 2_100,
      parserCacheHit: true,
      completedAt: 3_500,
    });
    performance = recordNhkCoachPerformance(performance, 1_200, 4_700);
    performance = recordNhkFirstTraining(performance, 5_200);
    performance = recordNhkSessionCompletion(performance, 10_000);

    expect(performance).toMatchObject({
      flowStartedAt: 1_000,
      parseCompletedAt: 3_500,
      parseMs: 2_500,
      parserServerMs: 2_100,
      parserCacheHit: true,
      coachCompletedAt: 4_700,
      coachMs: 1_200,
      readyAt: 4_700,
      linkToReadyMs: 3_700,
      firstTrainingAt: 5_200,
      linkToFirstTrainingMs: 4_200,
      completedAt: 10_000,
      sessionDurationMs: 9_000,
    });
  });

  it('does not overwrite the first training timestamp when the user navigates backward', () => {
    const initial = recordNhkFirstTraining(startNhkFlowPerformance(100), 500);
    const repeated = recordNhkFirstTraining(initial, 900);
    expect(repeated.firstTrainingAt).toBe(500);
    expect(repeated.linkToFirstTrainingMs).toBe(400);
  });

  it('normalizes legacy or malformed values without inventing measurements', () => {
    expect(normalizeNhkFlowPerformance({
      flowStartedAt: 100,
      parseMs: -2,
      parserServerMs: '320',
      parserCacheHit: false,
      sessionDurationMs: Number.NaN,
    })).toEqual({
      flowStartedAt: 100,
      parserServerMs: 320,
      parserCacheHit: false,
    });
  });
});
