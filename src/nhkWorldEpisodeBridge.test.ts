import {describe, expect, it} from 'vitest';
import type {NhkCausalWorldEvent} from './nhkCausalWorld';
import {
  activeNhkWorldEpisodeBridge,
  createNhkWorldEpisodeBridge,
  loadNhkWorldEpisodeBridge,
  markNhkWorldEpisodeBridgeConsumed,
  nhkWorldEpisodeContextLine,
  saveNhkWorldEpisodeBridge,
} from './nhkWorldEpisodeBridge';

const event: NhkCausalWorldEvent = {
  version: 1,
  eventId: 'nhk-world-nhk-2026-09-01',
  sourceSessionId: 'nhk-2026-09-01',
  sourceDateKey: '2026-09-01',
  callbackDueDateKey: '2026-09-04',
  title: 'SNSの利用ルール',
  setupZh: '田中想听听你的意见。',
  promptJa: '子どものSNS利用について、どう思いますか。',
  answerJa: '年齢に合ったルールが必要だと思います。',
  targetExpression: '〜が必要だと思います',
  reactionJa: 'なるほど。家族とも話してみます。',
  reactionZh: '田中决定和家人继续讨论。',
  isCallback: false,
};

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

describe('NHK causal episode bridge', () => {
  it('carries the learner answer and character reaction into one target episode', () => {
    const bridge = createNhkWorldEpisodeBridge(event, 'episode-08', 100);
    expect(activeNhkWorldEpisodeBridge(bridge, 'episode-08')).toBe(bridge);
    expect(activeNhkWorldEpisodeBridge(bridge, 'episode-09')).toBeNull();
    expect(nhkWorldEpisodeContextLine(bridge)).toContain(event.answerJa);
    expect(nhkWorldEpisodeContextLine(bridge)).toContain(event.reactionJa);
  });

  it('persists across a refresh and can be removed', () => {
    const storage = memoryStorage();
    const bridge = createNhkWorldEpisodeBridge(event, 'episode-08', 100);
    saveNhkWorldEpisodeBridge(bridge, storage);
    expect(loadNhkWorldEpisodeBridge(storage)).toEqual(bridge);
    saveNhkWorldEpisodeBridge(null, storage);
    expect(loadNhkWorldEpisodeBridge(storage)).toBeNull();
  });

  it('is consumed once after the target episode finishes', () => {
    const bridge = createNhkWorldEpisodeBridge(event, 'episode-08', 100);
    const consumed = markNhkWorldEpisodeBridgeConsumed(bridge, 200);
    expect(consumed.consumedAt).toBe(200);
    expect(activeNhkWorldEpisodeBridge(consumed, 'episode-08')).toBeNull();
  });

  it('uses a different opening line for a delayed callback', () => {
    const callback = createNhkWorldEpisodeBridge({...event, isCallback: true}, 'episode-08', 100);
    expect(nhkWorldEpisodeContextLine(callback)).toContain('三天前');
  });
});
