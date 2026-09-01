import type {NhkCausalWorldEvent} from './nhkCausalWorld';

export const NHK_WORLD_EPISODE_BRIDGE_VERSION = 'nhk-world-episode-bridge-v1';

export type NhkWorldEpisodeBridge = {
  version: 1;
  bridgeId: string;
  sourceEventId: string;
  sourceSessionId: string;
  sourceDateKey: string;
  targetStoryId: string;
  answerJa: string;
  reactionJa: string;
  reactionZh: string;
  targetExpression: string;
  isCallback: boolean;
  createdAt: number;
  consumedAt?: number;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const STORAGE_KEY = 'nihongo-world-episode-bridge-v1';

const clean = (value: unknown, max = 420): string => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : '';

const resolveStorage = (storage?: StorageLike): StorageLike | null => {
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? null : localStorage;
};

const isBridge = (value: unknown): value is NhkWorldEpisodeBridge => {
  if (!value || typeof value !== 'object') return false;
  const bridge = value as Partial<NhkWorldEpisodeBridge>;
  return bridge.version === 1
    && typeof bridge.bridgeId === 'string'
    && typeof bridge.sourceEventId === 'string'
    && typeof bridge.sourceSessionId === 'string'
    && typeof bridge.sourceDateKey === 'string'
    && typeof bridge.targetStoryId === 'string'
    && typeof bridge.answerJa === 'string'
    && typeof bridge.reactionJa === 'string'
    && typeof bridge.reactionZh === 'string'
    && typeof bridge.targetExpression === 'string'
    && typeof bridge.isCallback === 'boolean'
    && typeof bridge.createdAt === 'number';
};

export const createNhkWorldEpisodeBridge = (
  event: NhkCausalWorldEvent,
  targetStoryId: string,
  createdAt = Date.now(),
): NhkWorldEpisodeBridge => ({
  version: 1,
  bridgeId: `${NHK_WORLD_EPISODE_BRIDGE_VERSION}-${event.eventId}-${targetStoryId}`,
  sourceEventId: event.eventId,
  sourceSessionId: event.sourceSessionId,
  sourceDateKey: event.sourceDateKey,
  targetStoryId,
  answerJa: clean(event.answerJa),
  reactionJa: clean(event.reactionJa),
  reactionZh: clean(event.reactionZh),
  targetExpression: clean(event.targetExpression, 180),
  isCallback: event.isCallback,
  createdAt,
});

export const loadNhkWorldEpisodeBridge = (storage?: StorageLike): NhkWorldEpisodeBridge | null => {
  const target = resolveStorage(storage);
  if (!target) return null;
  try {
    const parsed = JSON.parse(target.getItem(STORAGE_KEY) || 'null') as unknown;
    return isBridge(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const saveNhkWorldEpisodeBridge = (
  bridge: NhkWorldEpisodeBridge | null,
  storage?: StorageLike,
): void => {
  const target = resolveStorage(storage);
  if (!target) return;
  if (!bridge) {
    target.removeItem(STORAGE_KEY);
    return;
  }
  target.setItem(STORAGE_KEY, JSON.stringify(bridge));
};

export const activeNhkWorldEpisodeBridge = (
  bridge: NhkWorldEpisodeBridge | null,
  storyId: string,
): NhkWorldEpisodeBridge | null => bridge && !bridge.consumedAt && bridge.targetStoryId === storyId ? bridge : null;

export const markNhkWorldEpisodeBridgeConsumed = (
  bridge: NhkWorldEpisodeBridge,
  consumedAt = Date.now(),
): NhkWorldEpisodeBridge => ({...bridge, consumedAt});

export const nhkWorldEpisodeContextLine = (bridge: NhkWorldEpisodeBridge): string => {
  const lead = bridge.isCallback ? '三天前的对话真的产生了后续。' : '刚才的新闻对话继续影响着这一集。';
  const answer = bridge.answerJa ? `あなたは「${bridge.answerJa}」と答えました。` : '';
  const reaction = bridge.reactionJa || bridge.reactionZh;
  return [lead, answer, reaction].filter(Boolean).join(' ');
};
