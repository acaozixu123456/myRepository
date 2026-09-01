import {describe, expect, it} from 'vitest';
import {validateSpeechRequest} from '../api/nhk-speech-feedback';

const validRequest = {
  mode: 'shadow',
  mimeType: 'audio/webm;codecs=opus',
  durationSeconds: 12.4,
  expectedText: '来年から制度が変わります。',
  contextText: '制度変更についてのニュースです。',
  audioBase64: 'AQIDBA==',
};

describe('NHK speech Vercel proxy validation', () => {
  it('normalizes a valid bounded request', () => {
    expect(validateSpeechRequest(validRequest)).toMatchObject({
      mode: 'shadow',
      mimeType: 'audio/webm',
      durationSeconds: 12,
      expectedText: validRequest.expectedText,
    });
  });

  it.each([
    ['mode', {...validRequest, mode: 'other'}],
    ['mime', {...validRequest, mimeType: 'application/octet-stream'}],
    ['duration', {...validRequest, durationSeconds: 61}],
    ['expected text', {...validRequest, expectedText: ''}],
    ['context text', {...validRequest, contextText: ''}],
    ['base64 shape', {...validRequest, audioBase64: 'data:audio/webm;base64,AQIDBA=='}],
  ])('rejects invalid %s input', (_label, input) => {
    expect(validateSpeechRequest(input)).toBeNull();
  });

  it('rejects encoded audio above the two-megabyte request boundary', () => {
    expect(validateSpeechRequest({...validRequest, audioBase64: 'A'.repeat(2_000_004)})).toBeNull();
  });
});
