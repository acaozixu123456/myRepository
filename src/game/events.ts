// 活动中心：免费活动（七日喵程 / 嘉年华 / 幸运猫抓机 / 每日问答）与氪金活动（首充豪礼 / 周累充 / 成长基金 / 喵喵通行证 / 限时礼包）。
// 纯逻辑：时间与随机数可注入；「充值」同 premium.ts 一样是模拟下单，由 premium.record 回调 onPay 记账。
import { addItem } from './inventory';
import { rnd } from './npc';
import { recordOrder } from './premium';
import { teamPower } from './state';
import type { PlayerState } from './state';

export const dayOf = (now = Date.now()) => Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / 86400000);
const weekStart = (d: number) => d - ((d + 3) % 7); // 周一的日序号
const ordinalOf = (s: PlayerState) => { const b = s.best ?? s.stage; return (b.chapter - 1) * 24 + b.index; };

// ---------- 奖励 ----------
export interface Reward {
  fish?: number; bells?: number; tickets?: number; catnip?: number; yarn?: number; moon?: number;
  items?: Record<string, number>; // 背包道具 id → 数量
}
export function grant(s: PlayerState, r: Reward): void {
  s.res.fish += r.fish ?? 0; s.res.bells += r.bells ?? 0; s.res.tickets += r.tickets ?? 0;
  s.res.catnip += r.catnip ?? 0; s.res.yarn += r.yarn ?? 0; s.res.moon = (s.res.moon ?? 0) + (r.moon ?? 0);
  for (const [id, n] of Object.entries(r.items ?? {})) addItem(s, id, n);
}
const ITEM_NAME: Record<string, string> = { paw_seal: '猫爪印', guild_token: '同袍鱼牌', tower_token: '登楼铃签', faction_token: '六族盟笺', fishbone_small: '细纹鱼骨', fishbone_medium: '青纹鱼骨', fishbone_large: '金纹鱼骨', catnip_medium: '中阶猫薄荷', catnip_large: '高阶猫薄荷' };
export function rewardText(r: Reward): string {
  const out: string[] = [];
  if (r.fish) out.push(`${r.fish.toLocaleString('en-US')} 小鱼干`);
  if (r.bells) out.push(`${r.bells} 金铃铛`);
  if (r.tickets) out.push(`${r.tickets} 招福符`);
  if (r.catnip) out.push(`${r.catnip} 猫薄荷`);
  if (r.yarn) out.push(`${r.yarn} 毛线球`);
  if (r.moon) out.push(`${r.moon} 月光珠`);
  for (const [id, n] of Object.entries(r.items ?? {})) out.push(`${n} ${ITEM_NAME[id] ?? id}`);
  return out.join(' · ');
}

// ---------- 状态 ----------
export interface EventState {
  day: number; // 日重置
  spinUsed: number; spinBought: number; spinPity: number; spinTotal: number;
  quizDay: number; quizAns: number[]; // 当天已答的选项（下标对应第几题）
  week: number; pts: number; carn: number[]; // 嘉年华：本周活动点 / 已领档
  dayPts: number; // 今日已得活动点（有上限）
  start: number; sprint: number[]; sprintChest: boolean; // 七日喵程：开始日 / 已领目标 / 终极宝箱
  season: number; xp: number; passTier: 0 | 1 | 2; passFree: number[]; passPrem: number[]; passLux: number[]; // 通行证
  weekYuan: number; cum: number[]; // 本周累充
  firstPay: boolean; // 首充豪礼已领
  growth: { bought: boolean; claimed: number[] };
  packs: Record<string, number>; // 礼包 id → 上次购买的周期序号
}
export function ensureEvents(s: PlayerState, now = Date.now()): EventState {
  const d = dayOf(now);
  s.events ??= {
    day: -1, spinUsed: 0, spinBought: 0, spinPity: 0, spinTotal: 0, quizDay: -1, quizAns: [], week: 0, pts: 0, carn: [], dayPts: 0,
    start: d, sprint: [], sprintChest: false, season: -1, xp: 0, passTier: 0, passFree: [], passPrem: [], passLux: [], weekYuan: 0, cum: [], firstPay: false,
    growth: { bought: false, claimed: [] }, packs: {},
  };
  const e = s.events;
  e.carn ??= []; e.sprint ??= []; e.quizAns ??= []; e.passFree ??= []; e.passPrem ??= []; e.passLux ??= []; e.cum ??= []; e.packs ??= {}; e.growth ??= { bought: false, claimed: [] };
  e.start ??= d;
  if (e.day !== d) { e.day = d; e.spinUsed = 0; e.spinBought = 0; e.dayPts = 0; }
  const wk = weekStart(d);
  if (e.week !== wk) { e.week = wk; e.pts = 0; e.carn = []; e.weekYuan = 0; e.cum = []; }
  const season = Math.floor(d / SEASON_DAYS);
  if (e.season !== season) { e.season = season; e.xp = 0; e.passTier = 0; e.passFree = []; e.passPrem = []; e.passLux = []; }
  return e;
}

// ---------- 活动点（嘉年华与通行证共用） ----------
export const DAY_PTS_CAP = 400;
const POINTS: Record<string, number> = { login: 10, clear_stage: 1, tower_clear: 6, arena_battle: 4, visit_friend: 2, guild_help: 3, recruit: 8, level_up_hero: 1, upgrade_skill: 2, equip_upgrade: 2, claim_idle: 5, dungeon: 8, boss: 15 };
export function addPoints(s: PlayerState, kind: string, amount = 1, now = Date.now()): number {
  const per = POINTS[kind]; if (!per) return 0;
  const e = ensureEvents(s, now);
  const gain = Math.max(0, Math.min(per * amount, DAY_PTS_CAP - e.dayPts));
  e.dayPts += gain; e.pts += gain; e.xp += gain;
  return gain;
}
/** quests.track 的回调 */
export const onTrack = (s: PlayerState, goal: string, amount: number) => { addPoints(s, goal, amount); };

// ---------- 嘉年华（每周轮换主题，免费） ----------
export const CARNIVALS = [
  { name: '猫薄荷嘉年华', flavor: '广场上空飘着薄荷味的气球，所有猫都有点晕乎乎。' },
  { name: '纸箱节', flavor: '全城的纸箱都被擦亮了，谁钻进最大的那只，谁就是今天的节日之王。' },
  { name: '毛线球大赛', flavor: '一团毛线，一场混战；最后总有一只猫把自己缠成了粽子。' },
  { name: '晒太阳大会', flavor: '规则只有一条：谁都别挡着谁的太阳。' },
];
export const carnivalOf = (now = Date.now()) => CARNIVALS[(weekStart(dayOf(now)) / 7) % CARNIVALS.length | 0];
export const CARNIVAL_TIERS: { pts: number; r: Reward }[] = [
  { pts: 100, r: { fish: 5000, catnip: 5 } },
  { pts: 300, r: { bells: 60, items: { paw_seal: 60 } } },
  { pts: 600, r: { tickets: 1, fish: 8000 } },
  { pts: 1000, r: { bells: 100, catnip: 15, items: { fishbone_small: 3 } } },
  { pts: 1500, r: { tickets: 2, items: { guild_token: 60 } } },
  { pts: 2000, r: { bells: 150, items: { fishbone_medium: 2 } } },
  { pts: 2600, r: { tickets: 3, bells: 200, items: { tower_token: 80 } } },
];
export const carnivalReady = (pts: number, claimed: number[]) => CARNIVAL_TIERS.map((t, i) => pts >= t.pts && !claimed.includes(i));
export type Res<T = object> = ({ ok: true } & T) | { ok: false; reason: string };
export function claimCarnival(s: PlayerState, i: number, now = Date.now()): Res<{ r: Reward }> {
  const e = ensureEvents(s, now), t = CARNIVAL_TIERS[i];
  if (!t) return { ok: false, reason: '没有这一档' };
  if (e.carn.includes(i)) return { ok: false, reason: '已经领过了' };
  if (e.pts < t.pts) return { ok: false, reason: '活动点还不够' };
  e.carn.push(i); grant(s, t.r);
  return { ok: true, r: t.r };
}

// ---------- 七日喵程（新手冲刺，免费） ----------
export const SPRINT_DAYS = 7;
const maxHeroLv = (s: PlayerState) => Math.max(0, ...Object.values(s.heroes).map((h) => h.lv));
const arenaGames = (s: PlayerState) => (s.social?.arena.wins ?? 0) + (s.social?.arena.losses ?? 0);
export interface SprintGoal { day: number; text: string; target: number; value: (s: PlayerState) => number; r: Reward }
export const SPRINT: SprintGoal[] = [
  { day: 1, text: '通关主线 1-6', target: 6, value: ordinalOf, r: { fish: 4000, catnip: 5 } },
  { day: 1, text: '收集 6 只猫猫', target: 6, value: (s) => Object.keys(s.heroes).length, r: { tickets: 1 } },
  { day: 2, text: '任意猫猫升到 Lv.12', target: 12, value: maxHeroLv, r: { fish: 5000, bells: 40 } },
  { day: 2, text: '队伍战力达到 700', target: 700, value: teamPower, r: { catnip: 10 } },
  { day: 3, text: '通关主线 1-12', target: 12, value: ordinalOf, r: { fish: 6000, tickets: 1 } },
  { day: 3, text: '爬塔到第 3 层', target: 3, value: (s) => s.tower?.floor ?? 0, r: { bells: 50, items: { tower_token: 30 } } },
  { day: 4, text: '收集 8 只猫猫', target: 8, value: (s) => Object.keys(s.heroes).length, r: { tickets: 1, fish: 6000 } },
  { day: 4, text: '在竞技场切磋 3 次', target: 3, value: arenaGames, r: { bells: 50, items: { paw_seal: 60 } } },
  { day: 5, text: '通关主线 1-18', target: 18, value: ordinalOf, r: { fish: 8000, catnip: 10 } },
  { day: 5, text: '任意猫猫升到 Lv.20', target: 20, value: maxHeroLv, r: { tickets: 2 } },
  { day: 6, text: '爬塔到第 8 层', target: 8, value: (s) => s.tower?.floor ?? 0, r: { bells: 80, items: { tower_token: 60 } } },
  { day: 6, text: '加入一个公会', target: 1, value: (s) => (s.guild?.id ? 1 : 0), r: { fish: 8000, items: { guild_token: 50 } } },
  { day: 7, text: '通关主线 1-24（第一章 Boss）', target: 24, value: ordinalOf, r: { tickets: 2, bells: 100 } },
  { day: 7, text: '挑战一次世界 Boss', target: 1, value: (s) => ((s.wboss?.bars ?? 0) > 0 ? 1 : 0), r: { tickets: 2, fish: 10000 } },
];
export const SPRINT_CHEST: Reward = { tickets: 6, bells: 400, items: { fishbone_medium: 3 }, catnip: 30 };
export const sprintDay = (s: PlayerState, now = Date.now()) => Math.max(1, dayOf(now) - ensureEvents(s, now).start + 1);
export const sprintActive = (s: PlayerState, now = Date.now()) => sprintDay(s, now) <= SPRINT_DAYS + 2 && !ensureEvents(s, now).sprintChest; // 宽限两天补领
export const sprintUnlocked = (s: PlayerState, i: number, now = Date.now()) => SPRINT[i].day <= sprintDay(s, now);
export const sprintDone = (s: PlayerState, i: number) => SPRINT[i].value(s) >= SPRINT[i].target;
export function claimSprint(s: PlayerState, i: number, now = Date.now()): Res<{ r: Reward }> {
  const e = ensureEvents(s, now), g = SPRINT[i];
  if (!g) return { ok: false, reason: '没有这个目标' };
  if (e.sprint.includes(i)) return { ok: false, reason: '已经领过了' };
  if (!sprintUnlocked(s, i, now)) return { ok: false, reason: `第 ${g.day} 天才解锁` };
  if (!sprintDone(s, i)) return { ok: false, reason: '目标还没达成' };
  e.sprint.push(i); grant(s, g.r);
  return { ok: true, r: g.r };
}
export function claimSprintChest(s: PlayerState, now = Date.now()): Res<{ r: Reward }> {
  const e = ensureEvents(s, now);
  if (e.sprintChest) return { ok: false, reason: '已经领过了' };
  if (e.sprint.length < SPRINT.length) return { ok: false, reason: '先完成全部目标' };
  e.sprintChest = true; grant(s, SPRINT_CHEST);
  return { ok: true, r: SPRINT_CHEST };
}

// ---------- 幸运猫抓机（免费 + VIP 加次数） ----------
export interface Prize { id: string; label: string; w: number; r: Reward; big?: boolean }
export const PRIZES: Prize[] = [
  { id: 'fish', label: '小鱼干', w: 30, r: { fish: 8000 } },
  { id: 'catnip', label: '猫薄荷', w: 22, r: { catnip: 15 } },
  { id: 'bells', label: '金铃铛', w: 16, r: { bells: 50 } },
  { id: 'paw', label: '猫爪印', w: 12, r: { items: { paw_seal: 60 } } },
  { id: 'token', label: '同袍鱼牌', w: 10, r: { items: { guild_token: 40 } } },
  { id: 'ticket', label: '招福符', w: 6, r: { tickets: 2 }, big: true },
  { id: 'bells2', label: '大金铃铛', w: 3, r: { bells: 300 }, big: true },
  { id: 'jackpot', label: '大奖·十连符', w: 1, r: { tickets: 10 }, big: true },
];
export const SPIN_EXTRA_COST = 30, SPIN_EXTRA_MAX = 5, SPIN_PITY = 10;
export const freeSpins = (vip: number, cardActive: boolean) => 1 + (vip >= 3 ? 1 : 0) + (vip >= 8 ? 1 : 0) + (cardActive ? 1 : 0);
export function spinsLeft(s: PlayerState, vip: number, cardActive: boolean, now = Date.now()): { free: number; paid: number } {
  const e = ensureEvents(s, now);
  return { free: Math.max(0, freeSpins(vip, cardActive) - e.spinUsed), paid: SPIN_EXTRA_MAX - e.spinBought };
}
export function spin(s: PlayerState, vip: number, cardActive: boolean, rng: () => number = Math.random, now = Date.now()): Res<{ prize: Prize; index: number; paid: boolean }> {
  const e = ensureEvents(s, now), left = spinsLeft(s, vip, cardActive, now);
  let paid = false;
  if (left.free > 0) e.spinUsed++;
  else if (left.paid > 0 && s.res.bells >= SPIN_EXTRA_COST) { s.res.bells -= SPIN_EXTRA_COST; e.spinBought++; paid = true; }
  else return { ok: false, reason: left.paid > 0 ? '金铃铛不够' : '今天的次数用完了' };
  e.spinTotal++; e.spinPity++;
  let index: number;
  if (e.spinPity >= SPIN_PITY) index = PRIZES.findIndex((p) => p.id === 'ticket');
  else { let x = rng() * PRIZES.reduce((a, p) => a + p.w, 0); index = 0; for (let i = 0; i < PRIZES.length; i++) { x -= PRIZES[i].w; if (x < 0) { index = i; break; } } }
  const prize = PRIZES[index];
  if (prize.id === 'ticket' || prize.id === 'jackpot') e.spinPity = 0;
  grant(s, prize.r);
  return { ok: true, prize, index, paid };
}

// ---------- 每日问答（免费） ----------
export interface Quiz { q: string; o: [string, string, string]; a: number }
export const QUIZ: Quiz[] = [
  { q: '“桃园三结义”的三兄弟是谁？', o: ['刘备、关羽、张飞', '曹操、孙权、刘备', '赵云、马超、黄忠'], a: 0 },
  { q: '“草船借箭”的主角是谁？', o: ['周瑜', '诸葛亮', '鲁肃'], a: 1 },
  { q: '关羽的招牌兵器是？', o: ['丈八蛇矛', '方天画戟', '青龙偃月刀'], a: 2 },
  { q: '张飞的招牌兵器是？', o: ['丈八蛇矛', '青龙偃月刀', '双股剑'], a: 0 },
  { q: '吕布的坐骑叫什么？', o: ['的卢', '赤兔', '绝影'], a: 1 },
  { q: '“三顾茅庐”里，刘备三次去请的是谁？', o: ['庞统', '司马懿', '诸葛亮'], a: 2 },
  { q: '曹操的字是？', o: ['孟德', '玄德', '仲谋'], a: 0 },
  { q: '刘备的字是？', o: ['孟德', '玄德', '公瑾'], a: 1 },
  { q: '赵云在哪场战役里七进七出救阿斗？', o: ['官渡', '赤壁', '长坂坡'], a: 2 },
  { q: '“七擒七纵”的对象是谁？', o: ['孟获', '马超', '董卓'], a: 0 },
  { q: '官渡之战，曹操的对手是？', o: ['袁绍', '孙策', '吕布'], a: 0 },
  { q: '“空城计”的主角是谁？', o: ['司马懿', '诸葛亮', '周瑜'], a: 1 },
  { q: '貂蝉的“连环计”主要是用来对付谁？', o: ['曹操', '董卓', '袁术'], a: 1 },
  { q: '“既生瑜，何生亮”是谁的感叹？', o: ['周瑜', '曹操', '孙权'], a: 0 },
  { q: '司马懿的后代最终建立了哪个王朝？', o: ['隋', '晋', '唐'], a: 1 },
  { q: '黄忠在定军山斩了谁？', o: ['夏侯渊', '张辽', '许褚'], a: 0 },
  { q: '猫咪一天大约要睡多久？', o: ['4~6 小时', '12~16 小时', '20 小时以上'], a: 1 },
  { q: '猫咪的胡须主要用来做什么？', o: ['感知周围空间', '保暖', '吓唬老鼠'], a: 0 },
  { q: '下面哪种食物不能给猫咪吃？', o: ['煮熟的鸡胸肉', '巧克力', '水煮鱼肉'], a: 1 },
  { q: '猫咪“踩奶”的习惯来自哪里？', o: ['幼崽时吃奶的动作', '想磨爪子', '想把你推走'], a: 0 },
  { q: '强光下，猫咪的瞳孔会变成什么样？', o: ['圆圆的', '一条细线', '没有变化'], a: 1 },
  { q: '成年猫一共有多少颗恒牙？', o: ['20 颗', '30 颗', '42 颗'], a: 1 },
  { q: '猫咪尾巴竖得直直的，通常表示？', o: ['友好、开心', '生气了', '想睡觉'], a: 0 },
  { q: '猫咪舌头上的倒刺主要用来？', o: ['梳理毛发', '尝味道', '喝奶'], a: 0 },
  { q: '《猫国志》里六大阵营不包括下面哪个？', o: ['蛮', '晋', '仙'], a: 1 },
  { q: '《猫国志》里的金币叫什么？', o: ['小鱼干', '金铃铛', '猫爪印'], a: 0 },
  { q: '《猫国志》里“元气”相当于传统游戏里的什么？', o: ['金币', '怒气', '经验'], a: 1 },
  { q: '喵洲大陆的九命天子，现在还剩几命？', o: ['三命', '九命', '最后一命'], a: 2 },
  { q: '玩家在故事里是什么身份？', o: ['被召唤来的铲屎官军师', '九命天子', '六族族长'], a: 0 },
  { q: '《猫国志》里的竞技货币叫什么？', o: ['猫爪印', '登楼铃签', '六族盟笺'], a: 0 },
];
export const QUIZ_PER_DAY = 3;
export function quizToday(now = Date.now()): Quiz[] {
  const d = dayOf(now), picked: number[] = [];
  for (let k = 0; picked.length < QUIZ_PER_DAY && k < 50; k++) { const i = Math.floor(rnd('quiz', d, k) * QUIZ.length); if (!picked.includes(i)) picked.push(i); }
  return picked.map((i) => QUIZ[i]);
}
export const quizRight: Reward = { fish: 1500, catnip: 2 };
export const quizWrong: Reward = { fish: 500 };
export const quizPerfect: Reward = { bells: 60, tickets: 1 };
export function quizState(s: PlayerState, now = Date.now()) {
  const e = ensureEvents(s, now); if (e.quizDay !== dayOf(now)) { e.quizDay = dayOf(now); e.quizAns = []; }
  return e;
}
export function answerQuiz(s: PlayerState, choice: number, now = Date.now()): Res<{ right: boolean; correct: number; perfect: boolean }> {
  const e = quizState(s, now), qs = quizToday(now), n = e.quizAns.length;
  if (n >= qs.length) return { ok: false, reason: '今天的题都答完了' };
  const right = qs[n].a === choice;
  e.quizAns.push(choice);
  grant(s, right ? quizRight : quizWrong);
  const perfect = e.quizAns.length === qs.length && e.quizAns.every((c, i) => qs[i].a === c);
  if (perfect) grant(s, quizPerfect);
  return { ok: true, right, correct: qs[n].a, perfect };
}

// ---------- 氪金：首充豪礼 ----------
export const FIRST_PAY_GIFT: Reward = { tickets: 10, bells: 1000, moon: 200, catnip: 60, items: { fishbone_large: 1 } };
export const canClaimFirstPay = (s: PlayerState, now = Date.now()) => (s.pay?.total ?? 0) > 0 && !ensureEvents(s, now).firstPay;
export function claimFirstPay(s: PlayerState, now = Date.now()): Res<{ r: Reward }> {
  const e = ensureEvents(s, now);
  if ((s.pay?.total ?? 0) <= 0) return { ok: false, reason: '完成任意一笔充值后可领' };
  if (e.firstPay) return { ok: false, reason: '已经领过了' };
  e.firstPay = true; grant(s, FIRST_PAY_GIFT);
  return { ok: true, r: FIRST_PAY_GIFT };
}

// ---------- 氪金：周累计充值 ----------
export const CUM_TIERS: { yuan: number; r: Reward }[] = [
  { yuan: 6, r: { tickets: 2, bells: 100 } },
  { yuan: 30, r: { tickets: 6, bells: 400, items: { fishbone_medium: 2 } } },
  { yuan: 98, r: { tickets: 15, bells: 1000, items: { fishbone_large: 2 } } },
  { yuan: 198, r: { tickets: 30, bells: 2000, moon: 300, items: { fishbone_large: 3 } } },
  { yuan: 328, r: { tickets: 50, bells: 3500, moon: 500, items: { fishbone_large: 4 } } },
  { yuan: 648, r: { tickets: 100, bells: 7000, moon: 1200, items: { fishbone_large: 8 } } },
];
/** premium.record 回调：累计到本周 */
export function onPay(s: PlayerState, yuan: number, now = Date.now()) { ensureEvents(s, now).weekYuan += yuan; }
export function claimCum(s: PlayerState, i: number, now = Date.now()): Res<{ r: Reward }> {
  const e = ensureEvents(s, now), t = CUM_TIERS[i];
  if (!t) return { ok: false, reason: '没有这一档' };
  if (e.cum.includes(i)) return { ok: false, reason: '已经领过了' };
  if (e.weekYuan < t.yuan) return { ok: false, reason: '本周累计充值还不够' };
  e.cum.push(i); grant(s, t.r);
  return { ok: true, r: t.r };
}

// ---------- 氪金：成长基金 ----------
export const GROWTH = { yuan: 98, title: '喵喵成长基金' };
export const GROWTH_TIERS: { ord: number; r: Reward }[] = [
  { ord: 6, r: { moon: 100, bells: 100 } }, { ord: 12, r: { moon: 100, bells: 100 } }, { ord: 24, r: { moon: 150, bells: 150 } },
  { ord: 36, r: { moon: 150, bells: 150 } }, { ord: 48, r: { moon: 200, bells: 200 } }, { ord: 72, r: { moon: 200, bells: 200 } },
  { ord: 96, r: { moon: 200, bells: 200 } }, { ord: 120, r: { moon: 250, bells: 250 } }, { ord: 144, r: { moon: 300, bells: 300 } },
];
const payRecord = recordOrder;
export function buyGrowth(s: PlayerState, now = Date.now()): Res {
  const e = ensureEvents(s, now);
  if (e.growth.bought) return { ok: false, reason: '已经购买过了' };
  e.growth.bought = true; payRecord(s, 'growth', GROWTH.yuan, 0, now);
  return { ok: true };
}
export function claimGrowth(s: PlayerState, i: number, now = Date.now()): Res<{ r: Reward }> {
  const e = ensureEvents(s, now), t = GROWTH_TIERS[i];
  if (!t) return { ok: false, reason: '没有这一档' };
  if (!e.growth.bought) return { ok: false, reason: '先购买成长基金' };
  if (e.growth.claimed.includes(i)) return { ok: false, reason: '已经领过了' };
  if (ordinalOf(s) < t.ord) return { ok: false, reason: `主线通关到 ${t.ord} 关才能领` };
  e.growth.claimed.push(i); grant(s, t.r);
  return { ok: true, r: t.r };
}

// ---------- 氪金：喵喵通行证 ----------
export const SEASON_DAYS = 28, PASS_XP = 150, PASS_MAX = 30;
export const PASS_PRICE = { 1: 68, 2: 128 } as const;
export const PASS_BONUS_LEVELS = 10; // 豪华版立得的额外等级
export const passLevel = (s: PlayerState, now = Date.now()) => { const e = ensureEvents(s, now); return Math.min(PASS_MAX, Math.floor(e.xp / PASS_XP) + (e.passTier === 2 ? PASS_BONUS_LEVELS : 0)); };
export const seasonDaysLeft = (now = Date.now()) => SEASON_DAYS - (dayOf(now) % SEASON_DAYS);
export function passFree(lv: number): Reward { return lv % 5 === 0 ? { bells: 40, catnip: 10 } : { fish: 1500 + 150 * lv }; }
export function passPrem(lv: number): Reward {
  if (lv === 30) return { moon: 500, tickets: 5, items: { fishbone_large: 2 } };
  if (lv === 20) return { moon: 300, tickets: 3 };
  if (lv === 10) return { moon: 200, tickets: 2 };
  if (lv % 5 === 0) return { tickets: 2, bells: 100 };
  return lv % 2 ? { bells: 30, catnip: 5 } : { items: { paw_seal: 40, guild_token: 20 } };
}
export function passLux(lv: number): Reward | null {
  if (lv % 5 !== 0) return null;
  return lv === 30 ? { moon: 800, tickets: 10, items: { fishbone_large: 4 } } : { moon: 100 * (lv / 5), tickets: 1 + lv / 10 | 0, bells: 200 };
}
export function buyPass(s: PlayerState, tier: 1 | 2, now = Date.now()): Res {
  const e = ensureEvents(s, now);
  if (e.passTier >= tier) return { ok: false, reason: '已经拥有这个版本' };
  const yuan = PASS_PRICE[tier] - (e.passTier ? PASS_PRICE[e.passTier] : 0); // 升级补差价
  e.passTier = tier; payRecord(s, `pass${tier}`, yuan, 0, now);
  return { ok: true };
}
export function claimPass(s: PlayerState, track: 'free' | 'prem' | 'lux', lv: number, now = Date.now()): Res<{ r: Reward }> {
  const e = ensureEvents(s, now);
  if (lv < 1 || lv > PASS_MAX) return { ok: false, reason: '没有这一级' };
  if (lv > passLevel(s, now)) return { ok: false, reason: '等级还不够' };
  if (track === 'prem' && e.passTier < 1) return { ok: false, reason: '需要通行证' };
  if (track === 'lux' && e.passTier < 2) return { ok: false, reason: '需要豪华通行证' };
  const list = track === 'free' ? e.passFree : track === 'prem' ? e.passPrem : e.passLux;
  if (list.includes(lv)) return { ok: false, reason: '已经领过了' };
  const r = track === 'free' ? passFree(lv) : track === 'prem' ? passPrem(lv) : passLux(lv);
  if (!r) return { ok: false, reason: '这一级没有豪华奖励' };
  list.push(lv); grant(s, r);
  return { ok: true, r };
}

// ---------- 氪金：限时礼包 ----------
export interface PackDef { id: string; name: string; yuan: number; period: 'day' | 'week' | 'month'; desc: string; r: Reward }
export const PACKS: PackDef[] = [
  { id: 'pk_day', name: '每日喵礼', yuan: 6, period: 'day', desc: '每天限购 1 次', r: { tickets: 2, bells: 120, catnip: 20, fish: 20000 } },
  { id: 'pk_week', name: '每周大箱', yuan: 30, period: 'week', desc: '每周限购 1 次', r: { tickets: 11, bells: 600, items: { fishbone_medium: 2, paw_seal: 400 } } },
  { id: 'pk_month', name: '月度至尊箱', yuan: 98, period: 'month', desc: '每月限购 1 次', r: { tickets: 38, bells: 1800, moon: 200, items: { fishbone_large: 2, tower_token: 300 } } },
];
export const packPeriod = (p: PackDef, now = Date.now()) => { const d = dayOf(now); return p.period === 'day' ? d : p.period === 'week' ? weekStart(d) : Math.floor(d / 30); };
export const packAvailable = (s: PlayerState, p: PackDef, now = Date.now()) => ensureEvents(s, now).packs[p.id] !== packPeriod(p, now);
export function buyPack(s: PlayerState, id: string, now = Date.now()): Res<{ r: Reward }> {
  const p = PACKS.find((x) => x.id === id), e = ensureEvents(s, now);
  if (!p) return { ok: false, reason: '没有这个礼包' };
  if (!packAvailable(s, p, now)) return { ok: false, reason: '本期已购买' };
  e.packs[id] = packPeriod(p, now); grant(s, p.r); payRecord(s, id, p.yuan, p.r.moon ?? 0, now);
  return { ok: true, r: p.r };
}
