// 20 个模拟玩家（NPC）：自由发展、按作息上下线、世界频道里聊天。
// 关键设计：一切都是「墙上时钟」的纯函数（种子 + 时间 → 结果），不需要服务器，也不需要存档：
// 同一时刻任何设备看到的在线名单、聊天内容都一样；玩家离线很久回来，也能立刻补出这段时间里 NPC 说过的话。
import {
  ARENA_TALK, BOSS_TALK, CAT_TALK, EVENT_TALK, FESTIVAL_TALK, GUILD_TALK, CHAPTER_TALK, CONGRATS, COUNTER_TALK, EQUIPMENT_TALK, MYSTERY_TALK, NPC_LINES, REPLY_RULES, TOWER_TALK, WEATHER_TALK, FACTION_TALK, GACHA_BRAG, GACHA_SAD, GACHA_WANT, GREET_EVENING, GREET_MORNING, GREET_NIGHT, GREET_NOON, REPLY_ARENA, REPLY_GACHA,
  REPLY_GENERIC, REPLY_LAUGH, REPLY_WHALE, STAGE_CLEAR, STAGE_STUCK, TEAM_ASK, BUILD_TIP, WORK_NIGHT, WORK_OFFICE, WORK_STUDENT,
} from '../data/chatlines';
import { FACTIONS } from '../data/factions';
import type { FactionId } from '../data/factions';
import { HERO_BY_ID, PREMIUM_HEROES, STANDARD_HEROES } from '../data/heroes';
import type { HeroDef } from '../data/heroes';
import { festivalNow } from './events';
import { guildBossOf } from './guildboss';
import { bossOfWeek } from './worldboss';
import { heroPower } from './state';
import { paceLevel } from './stage';

export type Profile = 'early' | 'office' | 'night' | 'student' | 'grinder' | 'casual' | 'whale' | 'lurker';
export interface Npc {
  id: string; name: string; avatar: string; profile: Profile; faction: FactionId;
  joinDay: number; // 入服日（相对 EPOCH）：越早入服，进度越靠前
  chatty: number; // 话痨度 0~1
  grind: number; // 肝度：影响成长速度
  vip: number; // 氪金等级
  sp?: string; // 持有的至尊猫猫（展示用，进阵容）
  bio: string;
}
export interface ChatMsg { id: string; t: number; from: string; name: string; text: string; kind: 'chat' | 'sys' | 'reply' | 'me' }

/** 世界开服日：2026-10-01（本地时区零点） */
export const EPOCH = new Date(2026, 9, 1).getTime();
export const DAY = 86400000;
export const BLOCK = 20 * 60000; // 在线状态与聊天的时间粒度

export const NPCS: Npc[] = [
  { id: 'n01', name: '小鱼干收藏家', avatar: 'shu_liumiaobei', profile: 'office', faction: 'shu', joinDay: -20, chatty: 0.55, grind: 1.0, vip: 2, bio: '每天最大的快乐是领取挂机收益。' },
  { id: 'n02', name: '夜班橘', avatar: 'qun_lvbuding', profile: 'night', faction: 'qun', joinDay: -18, chatty: 0.7, grind: 0.95, vip: 0, bio: '白天睡觉，晚上推关。橘猫都这样。' },
  { id: 'n03', name: '咕噜噜噜', avatar: 'xian_shuijing', profile: 'casual', faction: 'xian', joinDay: -10, chatty: 0.35, grind: 0.7, vip: 0, bio: '佛系养猫，呼噜声是 BGM。' },
  { id: 'n04', name: '肉垫测评员', avatar: 'wei_xuhuchi', profile: 'student', faction: 'wei', joinDay: -14, chatty: 0.65, grind: 0.9, vip: 0, bio: '给每只猫的肉垫打分，三月无人反对。' },
  { id: 'n05', name: '毛线球终结者', avatar: 'wu_sunxiaoba', profile: 'grinder', faction: 'wu', joinDay: -25, chatty: 0.4, grind: 1.12, vip: 3, bio: '肝帝。毛线球见了他都绕道。' },
  { id: 'n06', name: '今天也想睡觉', avatar: 'man_wutugu', profile: 'lurker', faction: 'man', joinDay: -9, chatty: 0.12, grind: 0.6, vip: 0, bio: '潜水员，偶尔冒泡。' },
  { id: 'n07', name: '纸箱建筑师', avatar: 'wei_guojia', profile: 'office', faction: 'wei', joinDay: -16, chatty: 0.5, grind: 0.95, vip: 1, bio: '爱研究阵容和羁绊，常写攻略。' },
  { id: 'n08', name: '三花不是三分花', avatar: 'qun_diaochan', profile: 'student', faction: 'qun', joinDay: -12, chatty: 0.8, grind: 0.85, vip: 0, bio: '话痨，爱给别人起外号。' },
  { id: 'n09', name: '铃铛小队长', avatar: 'wu_huanggai', profile: 'early', faction: 'wu', joinDay: -22, chatty: 0.6, grind: 1.0, vip: 1, bio: '早起打卡第一名，每天催大家领福利。' },
  { id: 'n10', name: '暹罗奶茶', avatar: 'wu_zhoumiaoyu', profile: 'night', faction: 'wu', joinDay: -8, chatty: 0.6, grind: 0.8, vip: 2, bio: '周喵瑜的头号粉丝。' },
  { id: 'n11', name: '猫薄荷研究所', avatar: 'man_mulu', profile: 'grinder', faction: 'man', joinDay: -21, chatty: 0.45, grind: 1.08, vip: 0, bio: '数据党，爱算期望。' },
  { id: 'n12', name: '墩墩不减肥', avatar: 'wei_xiahoudun', profile: 'casual', faction: 'wei', joinDay: -6, chatty: 0.5, grind: 0.65, vip: 0, bio: '圆润，快乐，永远在吃宵夜。' },
  { id: 'n13', name: '阿喵不吃香菜', avatar: 'shu_zhugemiaoliang', profile: 'office', faction: 'shu', joinDay: -15, chatty: 0.55, grind: 0.9, vip: 1, bio: '嘴硬心软，口头禅是“再说吧”。' },
  { id: 'n14', name: '深夜蹲坑猫', avatar: 'xian_guanlu', profile: 'night', faction: 'xian', joinDay: -11, chatty: 0.7, grind: 0.88, vip: 0, bio: '专业蹲保底，凌晨出货率最高（自称）。' },
  { id: 'n15', name: '憨憨狸花', avatar: 'man_zhurong', profile: 'student', faction: 'man', joinDay: -7, chatty: 0.6, grind: 0.8, vip: 0, bio: '想法天马行空，操作很难评。' },
  { id: 'n16', name: '月下偷鱼人', avatar: 'qun_dongzhuo', profile: 'whale', faction: 'qun', joinDay: -19, chatty: 0.35, grind: 1.0, vip: 9, sp: 'wei_simamiyi', bio: '低调的大佬，据说有至尊猫猫。' },
  { id: 'n17', name: '玄甲预备役', avatar: 'wei_caomiaode', profile: 'grinder', faction: 'wei', joinDay: -24, chatty: 0.35, grind: 1.1, vip: 4, bio: '纪律委员，连挂机都按点。' },
  { id: 'n18', name: '蜀道难难难', avatar: 'shu_zhangmiaofei', profile: 'office', faction: 'shu', joinDay: -13, chatty: 0.65, grind: 0.92, vip: 0, bio: '嗓门大，心眼好。' },
  { id: 'n19', name: '江东小喵', avatar: 'wu_sunxiangxiang', profile: 'early', faction: 'wu', joinDay: -5, chatty: 0.55, grind: 0.78, vip: 0, bio: '新手村毕业不久，爱提问。' },
  { id: 'n20', name: '云端打工猫', avatar: 'xian_zuoci', profile: 'whale', faction: 'xian', joinDay: -17, chatty: 0.4, grind: 0.98, vip: 12, sp: 'xian_changmiao', bio: '“打工”赚的钱都变成了月光珠。' },
];
export const NPC_BY_ID: Record<string, Npc> = Object.fromEntries(NPCS.map((n) => [n.id, n]));

// ---------- 确定性随机 ----------
export function rnd(...parts: (string | number)[]): number {
  let x = 2166136261;
  for (const ch of parts.join('|')) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); }
  x ^= x >>> 13; x = Math.imul(x, 0x5bd1e995); x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}
const pick = <T>(arr: T[], ...seed: (string | number)[]): T => arr[Math.floor(rnd(...seed) * arr.length) % arr.length];

// ---------- 作息 ----------
const HOURLY: Record<Profile, number[]> = {
  early: [.02, .01, .01, .01, .03, .2, .6, .8, .6, .3, .2, .3, .6, .5, .2, .2, .2, .3, .4, .4, .3, .2, .1, .05],
  office: [.05, .02, .01, .01, .01, .01, .03, .1, .15, .1, .1, .2, .7, .5, .1, .1, .1, .15, .3, .6, .8, .8, .6, .25],
  night: [.5, .35, .2, .08, .02, .01, .01, .01, .02, .05, .08, .1, .2, .2, .2, .25, .3, .35, .4, .5, .7, .8, .85, .7],
  student: [.03, .01, .01, .01, .01, .01, .03, .06, .05, .05, .1, .2, .4, .4, .3, .3, .5, .7, .7, .8, .85, .8, .5, .15],
  grinder: [.2, .1, .05, .03, .05, .15, .4, .6, .6, .6, .6, .7, .7, .6, .6, .6, .6, .6, .7, .8, .9, .9, .8, .5],
  casual: [.01, 0, 0, 0, 0, .01, .03, .08, .08, .05, .05, .1, .2, .15, .05, .05, .08, .1, .2, .3, .35, .35, .2, .05],
  whale: [.1, .05, .02, .01, .01, .02, .05, .1, .2, .3, .4, .4, .4, .4, .4, .4, .4, .5, .6, .7, .8, .8, .7, .4],
  lurker: [.01, 0, 0, 0, 0, .01, .02, .06, .06, .04, .04, .08, .15, .12, .04, .04, .06, .08, .15, .22, .25, .25, .15, .04],
};
export const PROFILE_NAME: Record<Profile, string> = { early: '早起党', office: '上班族', night: '夜猫子', student: '学生党', grinder: '肝帝', casual: '佛系', whale: '氪佬', lurker: '潜水员' };

const blockOf = (t: number) => Math.floor(t / BLOCK);
const hourOf = (block: number) => new Date(block * BLOCK + BLOCK / 2).getHours();

/** 某个 20 分钟时段里，该 NPC 是否在线（带“粘性”：上一段在线，这一段更可能继续在线） */
export function npcOnline(npc: Npc, t: number): boolean {
  const b = blockOf(t);
  let on = false;
  for (let k = b - 5; k <= b; k++) {
    const p: number = HOURLY[npc.profile][hourOf(k)] * (on ? 1.9 : 0.6);
    on = rnd(npc.id, 'on', k) < Math.min(0.97, p);
  }
  return on;
}
/** 距离上次在线多少分钟（在线则 0；超过 48 小时返回 null） */
export function npcLastSeenMin(npc: Npc, now: number): number | null {
  if (npcOnline(npc, now)) return 0;
  const b = blockOf(now);
  for (let k = 1; k <= 144; k++) if (npcOnline(npc, (b - k) * BLOCK + 1)) return Math.max(1, Math.round((now - ((b - k + 1) * BLOCK - 1)) / 60000));
  return null;
}
export const onlineNpcs = (now: number) => NPCS.filter((n) => npcOnline(n, now));

// ---------- 自由发展：进度 / 阵容 ----------
export interface NpcProgress { level: number; star: number; ordinal: number; chapter: number; index: number; stageId: string; power: number }
const starFor = (lv: number) => (lv < 20 ? 1 : lv < 40 ? 2 : lv < 65 ? 3 : lv < 90 ? 4 : 5);
const ordinalFor = (level: number) => { let lo = 1, hi = 144; while (lo < hi) { const mid = (lo + hi) >> 1; if (paceLevel(mid) >= level) hi = mid; else lo = mid + 1; } return lo; };

export function npcProgress(npc: Npc, now: number): NpcProgress {
  const day = Math.floor((now - EPOCH) / DAY);
  const played = Math.max(0, day - npc.joinDay) + (now - EPOCH) / DAY % 1; // 连续成长（日内也在涨）
  const noise = (rnd(npc.id, 'lv', day) - 0.5) * 3;
  const level = Math.max(8, Math.min(100, Math.round(8 + 87 * (1 - Math.exp(-played / 22)) * npc.grind + noise)));
  const ordinal = ordinalFor(level);
  const chapter = Math.min(6, Math.floor((ordinal - 1) / 24) + 1);
  const index = ordinal - (chapter - 1) * 24;
  const star = starFor(level);
  const lineup = npcLineup(npc, now, level);
  const power = Math.round(lineup.reduce((a, u) => a + heroPower({ id: u.heroId, lv: level, star, shards: 0, skillLv: Math.min(10, 1 + Math.floor(level / 12)) }), 0) * (1 + Math.min(0.25, npc.vip * 0.02)));
  return { level, star, ordinal, chapter, index, stageId: `${chapter}-${index}`, power };
}

const FRONT = new Set(['守护', '先锋']);
const rarityScore = (h: HeroDef, vip: number) => (h.rarity === 'UR' ? 2 : h.rarity === 'SSR' ? 1 : 0) * (vip >= 3 ? 1 : vip >= 1 ? 0.5 : 0.2);
/** 该 NPC 的 5 人阵容（前 3 后 2），同族优先，氪佬更多 UR/SSR；持有 SP 的会放进阵容 */
export function npcLineup(npc: Npc, _now: number, level = 30): { heroId: string; level: number; pos: number }[] {
  const chosen: HeroDef[] = [];
  const usable = (h: HeroDef) => !chosen.includes(h);
  const rank = (h: HeroDef, slot: number) => (h.faction === npc.faction ? 3 : 0) + rarityScore(h, npc.vip) + rnd(npc.id, 'lineup', h.id, slot);
  const slots: ('front' | 'back')[] = ['front', 'front', 'front', 'back', 'back'];
  const sp = npc.sp ? HERO_BY_ID[npc.sp] : undefined;
  slots.forEach((kind, slot) => {
    if (sp && slot === (FRONT.has(sp.role) ? 0 : 3) && usable(sp)) { chosen.push(sp); return; }
    const cand = STANDARD_HEROES.filter((h) => usable(h) && (kind === 'front' ? FRONT.has(h.role) : !FRONT.has(h.role)));
    cand.sort((a, b) => rank(b, slot) - rank(a, slot));
    chosen.push(cand[0]);
  });
  return chosen.map((h, pos) => ({ heroId: h.id, level, pos }));
}
export const SP_COUNT = PREMIUM_HEROES.length;

// ---------- 聊天 ----------
const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const heroName = (...seed: (string | number)[]) => pick(STANDARD_HEROES, ...seed).name;
const WEEKDAY_NIGHT = (h: number) => h >= 23 || h < 5;

function compose(npc: Npc, block: number, at: number): string {
  const h = new Date(at).getHours();
  const prog = npcProgress(npc, at);
  const vars = { stage: prog.stageId, hero: heroName(npc.id, 'h1', block), hero2: heroName(npc.id, 'h2', block), faction: FACTIONS[npc.faction].name, me: '' };
  // 15%：只属于这位玩家的口头禅（独立随机域）
  const mine = NPC_LINES[npc.id];
  if (mine?.length && rnd(npc.id, 'personal', block) < 0.15) return fill(pick(mine, npc.id, 'pline', block), vars);
  const r = rnd(npc.id, 'cat', block);
  const greet = h >= 5 && h < 11 ? GREET_MORNING : h >= 11 && h < 14 ? GREET_NOON : h >= 19 && h < 23 ? GREET_EVENING : WEEKDAY_NIGHT(h) ? GREET_NIGHT : CAT_TALK; // 下午没有“问候”，说日常
  let pool: string[];
  if (festivalNow(at).active && rnd(npc.id, 'fest', block) < 0.3) pool = FESTIVAL_TALK;
  else if (r < 0.10) pool = greet;
  else if (r < 0.26) pool = rnd(npc.id, 'sc', block) < 0.5 ? STAGE_STUCK : STAGE_CLEAR;
  else if (r < 0.38) pool = rnd(npc.id, 'gc', block) < 0.4 ? GACHA_BRAG : rnd(npc.id, 'gd', block) < 0.5 ? GACHA_SAD : GACHA_WANT;
  else if (r < 0.43) pool = TEAM_ASK;
  else if (r < 0.52) pool = BUILD_TIP;
  else if (r < 0.66) pool = CAT_TALK;
  else if (r < 0.78) pool = npc.profile === 'office' ? WORK_OFFICE : npc.profile === 'student' ? WORK_STUDENT : npc.profile === 'night' && (h >= 22 || h < 5) ? WORK_NIGHT : CAT_TALK;
  else if (r < 0.84) pool = FACTION_TALK[npc.faction];
  else if (r < 0.90) pool = CHAPTER_TALK[Math.max(1, rnd(npc.id, 'chap', block) < 0.5 ? prog.chapter : Math.min(prog.chapter, 1 + Math.floor(rnd(npc.id, 'chap2', block) * prog.chapter)))] ?? CAT_TALK;
  else if (r < 0.99) pool = [EQUIPMENT_TALK, TOWER_TALK, MYSTERY_TALK, ARENA_TALK, COUNTER_TALK, BOSS_TALK, GUILD_TALK, EVENT_TALK][Math.floor(rnd(npc.id, 'topic', block) * 8)];
  else pool = WEATHER_TALK;
  return fill(pick(pool, npc.id, 'line', block), vars);
}

/** 世界频道里 NPC 自己说的话（含少量系统喜报），时间范围 [from, to]，按时间排序。纯函数。 */
export function worldFeed(from: number, to: number): ChatMsg[] {
  const out: ChatMsg[] = [];
  for (let b = blockOf(from); b <= blockOf(to); b++) {
    for (const npc of NPCS) {
      const t = b * BLOCK + Math.floor(rnd(npc.id, 'at', b) * BLOCK);
      if (t < from || t > to || !npcOnline(npc, t)) continue;
      const talk = rnd(npc.id, 'say', b) < npc.chatty * 0.7;
      if (talk) out.push({ id: `${npc.id}:${b}`, t, from: npc.id, name: npc.name, text: compose(npc, b, t), kind: 'chat' });
      // 氪佬偶尔抽到 SP，全服喜报；其他人会祝贺
      if (npc.sp && rnd(npc.id, 'brag', b) < 0.015) {
        const hero = HERO_BY_ID[npc.sp];
        out.push({ id: `sys:${npc.id}:${b}`, t: t + 1000, from: 'sys', name: '喜报', text: `【喜报】${npc.name} 在至尊招募中抽中了 ${hero.name}（${hero.title}）！`, kind: 'sys' });
        const fans = NPCS.filter((n) => n !== npc && npcOnline(n, t + 8000) && rnd(n.id, 'cg', b) < 0.45).slice(0, 2);
        fans.forEach((f, i) => out.push({ id: `cg:${f.id}:${b}`, t: t + 6000 + i * 7000 + Math.floor(rnd(f.id, 'cgd', b) * 4000), from: f.id, name: f.name, text: fill(pick(CONGRATS, f.id, 'cg', b), { who: npc.name }), kind: 'reply' }));
      }
    }
  }
  // 每日定点系统提醒
  for (let d = Math.floor((from - EPOCH) / DAY); d <= Math.floor((to - EPOCH) / DAY); d++) {
    const base = EPOCH + d * DAY;
    // 每周一 05:00 的 Boss 公告
    if (new Date(base + 12 * 3600000).getDay() === 1) {
      const t0 = base + 5 * 3600000;
      if (t0 >= from && t0 <= to) {
        out.push({ id: `sys:wb:${d}`, t: t0, from: 'sys', name: '公告', text: `【新一周】世界 Boss：${bossOfWeek(t0).title}已就位，每天 3 次挑战；公会 Boss：${guildBossOf(t0).title}，大家一起上。`, kind: 'sys' });
      }
    }
    for (const [hh, text] of [[12, '【提醒】午间福利时间到，别忘了领「每日福利」和挂机收益。'], [20, '【提醒】晚间爬塔时间，今日首通有额外猫薄荷。']] as [number, string][]) {
      const t = base + hh * 3600000;
      if (t >= from && t <= to) out.push({ id: `sys:daily:${d}:${hh}`, t, from: 'sys', name: '公告', text, kind: 'sys' });
    }
  }
  return out.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
}

/** 玩家发言后的 NPC 回应（确定性：由消息 id 决定谁回、何时回、回什么）。 */
export function repliesTo(msg: { id: string; t: number; text: string }, meName: string): ChatMsg[] {
  const online = NPCS.filter((n) => n.chatty > 0.25 && npcOnline(n, msg.t));
  if (!online.length) return [];
  const k = rnd(msg.id, 'n');
  const n = k < 0.15 ? 3 : k < 0.5 ? 2 : 1;
  const text = msg.text;
  const special = /氪|充|SP|至尊|月光珠|土豪/.test(text) ? REPLY_WHALE : /竞技|切磋|比爪|PK/i.test(text) ? REPLY_ARENA : /抽|卡|欧|歪|保底|出货/.test(text) ? REPLY_GACHA : undefined;
  const pool = special ?? REPLY_RULES.find((r) => r.test.test(text))?.pool ?? (/哈|笑|233|草/.test(text) ? REPLY_LAUGH : REPLY_GENERIC);
  const sorted = [...online].sort((a, b) => rnd(msg.id, 'w', a.id) - rnd(msg.id, 'w', b.id)).slice(0, n);
  let t = msg.t;
  return sorted.map((npc, i) => {
    t += 3500 + Math.floor(rnd(msg.id, 'd', i) * 24000);
    const line = i === 0 ? pick(pool, msg.id, 'l0') : pick(i === 1 ? REPLY_GENERIC : pool, msg.id, 'l', i);
    return { id: `re:${msg.id}:${npc.id}`, t, from: npc.id, name: npc.name, text: fill(line, { me: meName }), kind: 'reply' as const };
  });
}
