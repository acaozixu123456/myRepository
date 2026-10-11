import { QUEST_CATEGORIES, QUESTS } from '../../content/economy';
import { EQUIPS } from '../../content/equipment';
import { ITEMS } from '../../content/items';
import type { QuestDef, RewardDef } from '../../content/types';
import { HERO_BY_ID } from '../../data/heroes';
import { claim, isClaimable, isQuestAvailable, questProgress } from '../../game/quests';
import { esc, fmt } from '../../ui/components';
import { icon } from '../../ui/icons';
import type { AppCtx, ScreenId } from '../ctx';
import { floaty } from './home';
import { topbar } from './lineup';

type QuestTab = QuestDef['kind'];
export const questState: { tab: QuestTab } = { tab: 'daily' };

const TABS: { id: QuestTab; name: string; title: string; note: string }[] = [
  { id: 'daily', name: '每日', title: '今日军需簿', note: '每天凌晨 5 点换页，早起的猫负责压住纸角。' },
  { id: 'weekly', name: '每周', title: '一周爪印册', note: '每周一凌晨 5 点更新，七天的长进慢慢记。' },
  { id: 'achievement', name: '成就', title: '喵洲功劳簿', note: '每一份长进都留着，猫爪印比签名还认真。' },
  { id: 'newbie', name: '新手', title: '军师上任礼', note: '先认猫，再认路。这份见面礼不会催你。' },
];
const ITEMS_BY_ID = Object.fromEntries(ITEMS.map((item) => [item.id, item]));
const EQUIPS_BY_ID = Object.fromEntries(EQUIPS.map((equip) => [equip.id, equip]));
const DESTINATIONS: Record<string, ScreenId> = {
  login: 'home', claim_idle: 'home', clear_stage: 'campaign', reach_stage: 'campaign',
  level_up_hero: 'lineup', hero_level: 'lineup', upgrade_skill: 'lineup', spend_fish: 'lineup',
  recruit: 'gacha', collect_hero: 'gacha', equip_upgrade: 'bag', tower_clear: 'campaign',
};

function rewardIcon(id: string): string {
  if (id.startsWith('catnip')) return 'catnip';
  if (id.startsWith('yarn') || id === 'equip_thread') return 'yarn';
  if (id.includes('ticket')) return 'ticket';
  if (id.startsWith('fishbone') || id === 'fish') return 'fish';
  if (id === 'bells') return 'bells';
  if (id.includes('scroll')) return 'staff';
  if (id.endsWith('_token')) return 'campaign';
  if (id === 'paw_seal' || id.startsWith('shard_')) return 'paw';
  return 'gift';
}

type RewardPart = { image: string; name: string; count: number; resource: boolean };
function rewardParts(reward: RewardDef): RewardPart[] {
  const parts: RewardPart[] = [];
  const resources = [
    ['fish', '小鱼干', 'fish'], ['exp', '经验', 'spark'], ['bells', '金铃铛', 'bells'],
  ] as const;
  for (const [key, name, image] of resources) {
    const count = reward[key] ?? 0;
    if (count > 0) parts.push({ image, name, count, resource: true });
  }
  for (const item of reward.items ?? []) {
    parts.push({ image: rewardIcon(item.id), name: ITEMS_BY_ID[item.id]?.name ?? item.id, count: item.count, resource: false });
  }
  for (const equip of reward.equips ?? []) {
    parts.push({ image: 'armor', name: EQUIPS_BY_ID[equip.id]?.name ?? equip.id, count: equip.count, resource: false });
  }
  for (const shard of reward.heroShards ?? []) {
    parts.push({ image: 'paw', name: `${HERO_BY_ID[shard.heroId]?.name ?? shard.heroId}碎片`, count: shard.count, resource: false });
  }
  return parts;
}

function rewardsHtml(reward: RewardDef): string {
  return rewardParts(reward).map((part) => `<span class="qst-reward" title="${esc(part.name)} ×${part.count}">${icon(part.image, 18)}${!part.resource || part.name === '经验' ? `<span>${esc(part.name)}</span>` : ''}<b class="num">${part.resource ? '+' : '×'}${fmt(part.count)}</b></span>`).join('');
}

function taskHtml(ctx: AppCtx, quest: QuestDef): string {
  const available = isQuestAvailable(quest);
  const claimed = ctx.s.quests.claimed[quest.id] === true;
  const ready = isClaimable(ctx.s, quest);
  const progress = questProgress(ctx.s, quest);
  const category = QUEST_CATEGORIES[quest.id];
  const action = claimed || !available ? '' : ready ? 'qst-claim' : 'qst-go';
  const label = claimed ? '已领取' : !available ? '即将开放' : ready ? '领取' : '前往';
  return `<article class="panel qst-card${claimed ? ' qst-claimed' : !available ? ' qst-unavailable' : ready ? ' qst-ready' : ''}" data-quest-id="${esc(quest.id)}">
    <div class="qst-card-head"><div class="qst-card-title"><h3>${esc(quest.name)}</h3>${category ? `<span class="tag">${esc(category)}</span>` : ''}</div>
      <button class="btn sm ${ready ? 'green' : 'ghost'} qst-action" ${action ? `data-act="${action}" data-id="${esc(quest.id)}"` : 'disabled'}>${label}</button></div>
    <p class="qst-desc">${esc(quest.desc)}</p>
    <div class="qst-progress"><div class="bar${ready || claimed ? ' green' : ''}" role="progressbar" aria-label="${esc(quest.name)}进度" aria-valuemin="0" aria-valuemax="${quest.goal.target}" aria-valuenow="${progress}"><i style="width:${Math.min(100, progress / quest.goal.target * 100)}%"></i></div><span class="num">${fmt(progress)} / ${fmt(quest.goal.target)}</span></div>
    <div class="qst-rewards" aria-label="任务奖励">${rewardsHtml(quest.reward)}</div>
  </article>`;
}

function rank(ctx: AppCtx, quest: QuestDef): number {
  if (ctx.s.quests.claimed[quest.id]) return 3;
  if (isClaimable(ctx.s, quest)) return 0;
  return isQuestAvailable(quest) ? 1 : 2;
}

export function questsHtml(ctx: AppCtx): string {
  const tab = TABS.find((entry) => entry.id === questState.tab)!;
  const list = QUESTS.filter((quest) => quest.kind === tab.id).sort((a, b) => rank(ctx, a) - rank(ctx, b));
  const available = list.filter(isQuestAvailable);
  const claimed = available.filter((quest) => ctx.s.quests.claimed[quest.id]).length;
  const ready = list.filter((quest) => isClaimable(ctx.s, quest)).length;
  const complete = available.length > 0 && claimed === available.length;
  return `${topbar(ctx, '任务', '<button class="btn sm ghost qst-back" data-act="nav" data-to="home">返回</button>')}
    <div class="qst-tabs"><div class="seg" aria-label="任务页签">${TABS.map((entry) => `<button class="pill" data-act="qst-tab" data-tab="${entry.id}" aria-pressed="${entry.id === tab.id}">${entry.name}</button>`).join('')}</div></div>
    <div class="scroll qst-scroll"><section class="panel qst-summary"><div class="qst-summary-row"><div class="qst-summary-copy"><h3>${tab.title}</h3><div><b>${ready ? `${ready} 项可领取` : '暂无可领取'}</b><span>已领取 ${claimed} / ${available.length}</span></div></div><button class="btn sm qst-all" data-act="qst-all" ${ready ? '' : 'disabled'}>全部领取</button></div><p>${tab.note}</p></section>
    ${complete ? `<div class="panel qst-complete">${icon('team', 40)}<div><h3>军需已经收好</h3><p>本页已开放的任务都领完了。把笔放好，猫猫正惦记午睡。</p></div></div>` : ''}
    <div class="qst-list">${list.map((quest) => taskHtml(ctx, quest)).join('')}</div></div>`;
}

function sumRewards(rewards: RewardDef[]): RewardDef {
  const total: RewardDef = { fish: 0, exp: 0, bells: 0, items: [], equips: [], heroShards: [] };
  for (const reward of rewards) {
    for (const key of ['fish', 'exp', 'bells'] as const) total[key] = (total[key] ?? 0) + (reward[key] ?? 0);
    for (const key of ['items', 'equips'] as const) for (const part of reward[key] ?? []) {
      const old = total[key]!.find((entry) => entry.id === part.id);
      if (old) old.count += part.count;
      else total[key]!.push({ ...part });
    }
    for (const part of reward.heroShards ?? []) {
      const old = total.heroShards!.find((entry) => entry.heroId === part.heroId);
      if (old) old.count += part.count;
      else total.heroShards!.push({ ...part });
    }
  }
  return total;
}

function finishClaim(ctx: AppCtx, rewards: RewardDef[]): void {
  const scrollTop = ctx.root.querySelector('.qst-scroll')?.scrollTop ?? 0;
  ctx.save();
  ctx.refresh();
  const scroll = ctx.root.querySelector('.qst-scroll');
  if (scroll) scroll.scrollTop = scrollTop;
  ctx.toast(`领到 ${rewards.length} 份任务军需`);
  const parts = rewardParts(sumRewards(rewards));
  parts.filter((part) => part.resource).forEach((part, index) => floaty(ctx, `+${fmt(part.count)}`, part.image, 42, 27 + index * 6));
  const items = parts.filter((part) => !part.resource);
  if (items.length) floaty(ctx, items.length === 1 ? `${items[0].name} ×${fmt(items[0].count)}` : `军需物品 ×${fmt(items.reduce((count, item) => count + item.count, 0))}`, items.length === 1 ? items[0].image : 'gift', 24, 47);
}

export function handleQuests(ctx: AppCtx, el: HTMLElement): boolean {
  switch (el.dataset.act) {
    case 'qst-tab': {
      const tab = TABS.find((entry) => entry.id === el.dataset.tab);
      if (tab) { questState.tab = tab.id; ctx.refresh(); }
      return true;
    }
    case 'qst-go': {
      const quest = QUESTS.find((entry) => entry.id === el.dataset.id);
      if (quest && isQuestAvailable(quest) && !ctx.s.quests.claimed[quest.id]) ctx.go(DESTINATIONS[quest.goal.type] ?? 'home');
      return true;
    }
    case 'qst-claim': {
      const result = claim(ctx.s, el.dataset.id ?? '');
      if (result.ok) finishClaim(ctx, [result.reward]);
      else ctx.toast(result.reason);
      return true;
    }
    case 'qst-all': {
      const rewards: RewardDef[] = [];
      let failedReason: string | undefined;
      for (const quest of QUESTS.filter((entry) => entry.kind === questState.tab && isClaimable(ctx.s, entry))) {
        const result = claim(ctx.s, quest.id);
        if (result.ok) rewards.push(result.reward);
        else failedReason ??= result.reason;
      }
      if (rewards.length) {
        finishClaim(ctx, rewards);
        if (failedReason) ctx.toast(`已领 ${rewards.length} 份；${failedReason}`);
      } else ctx.toast(failedReason ?? '这页还没有可领取的军需');
      return true;
    }
    default: return false;
  }
}
