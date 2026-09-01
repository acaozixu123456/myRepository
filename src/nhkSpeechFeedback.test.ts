import {describe, expect, it} from 'vitest';
import {
  buildDeterministicShadowDiff,
  estimateBase64Length,
  isNhkSpeechFeedbackResult,
  MAX_AUDIO_BASE64_LENGTH,
  MAX_AUDIO_BYTES,
  parseNhkSpeechFeedback,
} from './nhkSpeechFeedback';

describe('NHK speech feedback contract', () => {
  it('finds concrete omissions, substitutions, and particle issues deterministically', () => {
    const diff = buildDeterministicShadowDiff(
      '政府は対応を見直します。',
      '政府が対応見直します。',
    );

    expect(diff.omissions).toContain('を');
    expect(diff.substitutions).toContainEqual({expected: 'は', heard: 'が'});
    expect(diff.particleIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({expected: 'は', heard: 'が'}),
      expect.objectContaining({expected: 'を', heard: '（省略）'}),
    ]));
    expect(diff.accuracyPercent).toBeLessThan(100);
    expect(diff.retryTip).toContain('助词');
  });

  it('treats numeric accuracy as a bounded secondary text metric', () => {
    const exact = buildDeterministicShadowDiff('来年から始まります。', '来年から始まります。');
    expect(exact).toMatchObject({
      omissions: [],
      substitutions: [],
      particleIssues: [],
      accuracyPercent: 100,
    });
  });

  it('sanitizes a valid recap result and drops unknown audio-like fields', () => {
    const parsed = parseNhkSpeechFeedback({
      version: 99,
      mode: 'recap',
      expectedText: '来年から制度が変わります。',
      transcript: '来年から制度が変わると思います。',
      durationSeconds: 28.4,
      usedFallback: false,
      minimalRevision: '来年から制度が変わると思います。',
      naturalJapanese: '来年から制度が変わるそうです。',
      missingFacts: ['対象者'],
      linkageFeedback: '理由とのつながりを足しましょう。',
      naturalnessFeedback: '自然'.repeat(200),
      audioBase64: 'must-not-survive',
      objectUrl: 'blob:must-not-survive',
    }, 'recap');

    expect(isNhkSpeechFeedbackResult(parsed)).toBe(true);
    expect(parsed).toMatchObject({version: 1, mode: 'recap', durationSeconds: 28});
    expect(parsed?.mode === 'recap' ? parsed.naturalnessFeedback.length : 0).toBe(280);
    expect(parsed).not.toHaveProperty('audioBase64');
    expect(parsed).not.toHaveProperty('objectUrl');
  });

  it('rejects mismatched or incomplete result modes', () => {
    expect(parseNhkSpeechFeedback({mode: 'shadow'}, 'shadow')).toBeNull();
    expect(parseNhkSpeechFeedback({
      mode: 'recap',
      expectedText: '原句。',
      transcript: '実際。',
      durationSeconds: 20,
      minimalRevision: '実際。',
      naturalJapanese: '実際です。',
      missingFacts: [],
      linkageFeedback: 'OK',
      naturalnessFeedback: 'OK',
    }, 'shadow')).toBeNull();
  });

  it('keeps the encoded request around two megabytes or less', () => {
    expect(estimateBase64Length(MAX_AUDIO_BYTES)).toBe(MAX_AUDIO_BASE64_LENGTH);
    expect(estimateBase64Length(MAX_AUDIO_BYTES + 1)).toBeGreaterThan(MAX_AUDIO_BASE64_LENGTH);
  });
});
