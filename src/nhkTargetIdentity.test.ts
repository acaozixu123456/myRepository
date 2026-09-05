import {it,expect} from 'vitest';
import {createNhkSession,upsertNhkSession} from './nhkMorning';
import {sessionForTarget} from './nhkPracticeHistory';

it('a changed target forks a typed answer instead of relabelling it',()=>{
  const original={...createNhkSession('2026-09-05','quiet'),sourceUrl:'https://www.mojidict.com/article/test',selectedSentences:['元の文です。'],shadowText:'元の文です。',recapText:'元の文についての回答です。'};
  const fresh=sessionForTarget(original,['別の文です。']);
  expect(fresh.id).not.toBe(original.id);expect(fresh.recapText).toBe('');
  expect(original.recapText).toBe('元の文についての回答です。');expect(original.shadowText).toBe('元の文です。');
  expect(sessionForTarget(original,['元の文です。'])).toBe(original);
  expect(upsertNhkSession([original],fresh)).toHaveLength(2);
});
it('a recorded answer is preserved when selecting another sentence',()=>{
  const original={...createNhkSession('2026-09-05','voice'),selectedSentences:['元の文です。'],shadowText:'元の文です。',recapRecordingSeconds:5};
  const fresh=sessionForTarget(original,['別の文です。']);
  expect(fresh.id).not.toBe(original.id);expect(fresh.recapRecordingSeconds).toBe(0);expect(original.recapRecordingSeconds).toBe(5);
});
