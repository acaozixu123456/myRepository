// 任务进度与军需领取：只处理玩家数据，不依赖 DOM。
import { QUESTS } from '../content/economy';
import type { QuestDef, RewardDef } from '../content/types';
import type { PlayerState, Resources } from './state';

export interface QuestState {
  progress: Record<string, number>;
  claimed: Record<string, boolean>;
  dailyKey: string;
  weeklyKey: string;
}

export type QuestClaimResult = { ok: true; reward: RewardDef } | { ok: false; reason: string };

const QUEST_BY_ID = new Map(QUESTS.map((quest) => [quest.id, quest]));
// 尚未接入的玩法不能通过手工进度领军需；装备/爬塔的开放范围待主导确认。
const AVAILABLE_GOALS = new Set([
  'login', 'claim_idle', 'clear_stage', 'reach_stage', 'level_up_hero',
  'hero_level', 'upgrade_skill', 'recruit', 'collect_hero', 'spend_fish',
]);
const MAX_GOALS = new Set(['reach_stage', 'hero_level', 'collect_hero']);
const RESOURCE_REWARDS = new Map<string, { key: keyof Resources; factor: number }>([
  ['fish', { key: 'fish', factor: 1 }], ['bells', { key: 'bells', factor: 1 }],
  ['catnip_small', { key: 'catnip', factor: 1 }],
  ['catnip_medium', { key: 'catnip', factor: 4 }],
  ['catnip_large', { key: 'catnip', factor: 16 }],
  ['recruit_ticket', { key: 'tickets', factor: 1 }],
]);
const object = (raw: unknown): Record<string, unknown> | null => raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });

function periodKeys(now: number): Pick<QuestState, 'dailyKey' | 'weeklyKey'> {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) date.setTime(0);
  // 按当地日历退一天，不能减固定 24 小时：夏令时转换日可能只有 23 小时。
  if (date.getHours() < 5) date.setDate(date.getDate() - 1);
  const key = () => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dailyKey = key();
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return { dailyKey, weeklyKey: key() };
}

export function createQuestState(now: number): QuestState {
  return { progress: {}, claimed: {}, ...periodKeys(now) };
}

export function isQuestAvailable(quest: QuestDef): boolean {
  return AVAILABLE_GOALS.has(quest.goal.type);
}

/** 坏任务字段只影响任务自己；无周期标记的每日/每周进度不能沿用。 */
export function normalizeQuestState(raw: unknown, now: number): QuestState {
  const out = createQuestState(now);
  const input = object(raw);
  if (!input) return out;
  const progress = object(input.progress);
  const claimed = object(input.claimed);
  for (const quest of QUESTS) {
    if (!isQuestAvailable(quest)) continue;
    if (quest.kind === 'daily' && input.dailyKey !== out.dailyKey) continue;
    if (quest.kind === 'weekly' && input.weeklyKey !== out.weeklyKey) continue;
    const amount = progress?.[quest.id];
    if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) out.progress[quest.id] = Math.min(quest.goal.target, amount);
    if (claimed?.[quest.id] === true) {
      out.claimed[quest.id] = true;
      // 已领取代表已经完成；补回缺失进度，也让每日登录去重继续有效。
      out.progress[quest.id] = quest.goal.target;
    }
  }
  return out;
}

export function questProgress(s: PlayerState, quest: QuestDef): number {
  if (!isQuestAvailable(quest)) return 0;
  const amount = s.quests.progress[quest.id];
  return Number.isFinite(amount) && amount > 0 ? Math.min(quest.goal.target, amount) : 0;
}

export function isClaimable(s: PlayerState, quest: QuestDef): boolean {
  return isQuestAvailable(quest) && s.quests.claimed[quest.id] !== true && questProgress(s, quest) >= quest.goal.target;
}

/** 事件计数累加；关卡、英雄等级、不同英雄数量保存最高值。 */
export function track(s: PlayerState, goalType: string, amount = 1): void {
  if (!AVAILABLE_GOALS.has(goalType) || !Number.isFinite(amount) || amount <= 0) return;
  for (const quest of QUESTS) {
    if (quest.goal.type !== goalType || s.quests.claimed[quest.id] === true) continue;
    const previous = questProgress(s, quest);
    if (previous >= quest.goal.target) continue;
    const next = MAX_GOALS.has(goalType) ? Math.max(previous, amount) : previous + amount;
    s.quests.progress[quest.id] = Math.min(quest.goal.target, next);
  }
}

function resetKind(state: QuestState, kind: QuestDef['kind']): void {
  for (const quest of QUESTS) if (quest.kind === kind) {
    delete state.progress[quest.id];
    delete state.claimed[quest.id];
  }
}

/** 本地每日 5 点 / 周一 5 点重置；成就、新手任务一直保留。 */
export function rollover(s: PlayerState, now: number): boolean {
  const keys = periodKeys(now);
  let reset = false;
  if (s.quests.dailyKey !== keys.dailyKey) {
    resetKind(s.quests, 'daily');
    s.quests.dailyKey = keys.dailyKey;
    reset = true;
  }
  if (s.quests.weeklyKey !== keys.weeklyKey) {
    resetKind(s.quests, 'weekly');
    s.quests.weeklyKey = keys.weeklyKey;
    reset = true;
  }
  return reset;
}

/** 验证整份奖励后再入账，失败时不发部分奖励，也不消耗领取机会。 */
export function claim(s: PlayerState, questId: string): QuestClaimResult {
  const quest = QUEST_BY_ID.get(questId);
  if (!quest) return fail('还没有这张任务条');
  if (!isQuestAvailable(quest)) return fail('这件事还未开放');
  if (s.quests.claimed[quest.id] === true) return fail('这份军需已经领过了');
  if (!isClaimable(s, quest)) return fail('先把任务做完，再来收军需');

  const reward = quest.reward;
  const additions: Partial<Resources> = {};
  for (const key of ['fish', 'exp', 'bells'] as const) {
    const amount = reward[key];
    if (amount === undefined) continue;
    if (!Number.isSafeInteger(amount) || amount < 0) return fail('这份军需暂时还不能入账');
    additions[key] = amount;
  }
  for (const item of reward.items ?? []) {
    if (!Number.isSafeInteger(item.count) || item.count <= 0) return fail('这份军需暂时还不能入账');
    const resource = RESOURCE_REWARDS.get(item.id);
    // 毛线球及其余道具入哪个账本仍在 Issue #27 等待确认，不能先发错地方。
    if (!resource) return fail('这份物品军需还在核对入库规则');
    additions[resource.key] = (additions[resource.key] ?? 0) + item.count * resource.factor;
  }
  if (reward.equips?.length || reward.heroShards?.length) return fail('这份军需暂时还不能入账');
  const next = { ...s.res };
  for (const key of Object.keys(additions) as (keyof Resources)[]) {
    const amount = next[key] + additions[key]!;
    if (!Number.isFinite(next[key]) || next[key] < 0 || !Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER) return fail('军需账本需要整理一下');
    next[key] = amount;
  }
  Object.assign(s.res, next);
  s.quests.claimed[quest.id] = true;
  return {
    ok: true,
    reward: {
      ...reward,
      ...(reward.items ? { items: reward.items.map((item) => ({ ...item })) } : {}),
      ...(reward.equips ? { equips: reward.equips.map((equip) => ({ ...equip })) } : {}),
      ...(reward.heroShards ? { heroShards: reward.heroShards.map((shards) => ({ ...shards })) } : {}),
    },
  };
}
