// 活动中心：免费活动（七日喵程 / 嘉年华 / 猫抓机 / 问答）+ 氪金活动（首充 / 周累充 / 成长基金 / 通行证 / 礼包）。
import {
  CARNIVAL_TIERS, CUM_TIERS, FIRST_PAY_GIFT, GROWTH, GROWTH_TIERS, PACKS, PASS_BONUS_LEVELS, PASS_MAX, PASS_PRICE, PASS_XP, PRIZES, QUIZ_PER_DAY, SPIN_EXTRA_COST, SPIN_PITY, SPRINT, SPRINT_CHEST, SPRINT_DAYS,
  answerQuiz, buyGrowth, buyPack, buyPass, canClaimFirstPay, carnivalOf, claimCarnival, claimCum, claimFirstPay, claimGrowth, claimPass, claimSprint, claimSprintChest, ensureEvents, packAvailable,
  passFree, passLevel, passLux, passPrem, quizState, quizToday, rewardText, seasonDaysLeft, spin, spinsLeft, sprintActive, sprintDay, sprintDone, sprintUnlocked,
  carnivalReady as claimable, DAY_PTS_CAP,
  DEX_TIERS, FACTION_SET_REWARD, claimDex, claimFactionSet, dexCount, factionOwned, FESTIVAL_PACK, claimAllMail, claimMail, mailClaimed, mailbox, unclaimedMail, OPEN_DAYS, OPEN_REWARDS, claimOpen, openActive, openRankOf, PULL_TIERS, UP_TIERS, claimUp, upDaysLeft, upHeroOf, RANK_REWARDS, WISH_STREAK_BONUS, buyFestivalPack, canWish, claimFestival, claimPull, claimRank, ensureEvents as ensureEv, festivalGift, festivalView, rankNow, rankRewardOf, setWishHero, wish, wishShards, dayOf,
} from '../../game/events';
import type { Reward } from '../../game/events';
import { HERO_BY_ID } from '../../data/heroes';
import { FURNITURE, NEST_MAX_DAYS, buyFurniture, collectNest, comfortOf, ensureNest, nestDaysReady, nestPending } from '../../game/nest';
import { canClaimCard, vipLevel } from '../../game/premium';
import { artUrl } from '../../ui/art';
import { fmt } from '../../ui/components';
import { FACTIONS, FACTION_ORDER } from '../../data/factions';
import { esc } from '../../ui/components';
import type { AppCtx } from '../ctx';
import { sfx } from '../sfx';
import { topbar } from './lineup';

type Tab = 'dex' | 'nest' | 'mail' | 'sprint' | 'carnival' | 'spin' | 'quiz' | 'wish' | 'pulls' | 'rank' | 'open' | 'festival' | 'first' | 'cum' | 'growth' | 'pass' | 'packs';
export const eventsState = { tab: 'sprint' as Tab, spinning: false, hit: -1 };
const TABS: [Tab, string, boolean][] = [['dex', '图鉴奖励', false], ['nest', '猫窝', false], ['mail', '邮件', false], ['sprint', '七日喵程', false], ['carnival', '嘉年华', false], ['spin', '猫抓机', false], ['quiz', '问答', false], ['wish', '许愿池', false], ['pulls', '招募盛典', false], ['rank', '周冲榜', false], ['open', '开服冲榜', false], ['festival', '节日', false], ['first', '首充豪礼', true], ['cum', '周累充', true], ['growth', '成长基金', true], ['pass', '通行证', true], ['packs', '礼包', true]];

const ordinal = (ctx: AppCtx) => { const b = ctx.s.best ?? ctx.s.stage; return (b.chapter - 1) * 24 + b.index; };
function rbtn(act: string, data: Record<string, string | number>, state: 'ok' | 'done' | 'lock', label = '领取'): string {
  const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${v}"`).join(' ');
  return `<button class="btn sm ${state === 'ok' ? 'green' : 'ghost'}" data-act="${act}" ${attrs} ${state === 'ok' ? '' : 'disabled'}>${state === 'done' ? '已领' : state === 'lock' ? '未达' : label}</button>`;
}
const row = (title: string, r: Reward, btn: string, sub = '') => `<div class="evr"><div class="grow"><b>${title}</b><small>${rewardText(r)}</small>${sub ? `<em>${sub}</em>` : ''}</div>${btn}</div>`;

// ---------- 免费 ----------
function sprintHtml(ctx: AppCtx): string {
  const s = ctx.s, e = ensureEvents(s), day = sprintDay(s);
  const rows = SPRINT.map((g, i) => {
    const un = sprintUnlocked(s, i), done = sprintDone(s, i), got = e.sprint.includes(i);
    const val = Math.min(g.target, g.value(s));
    return row(`第 ${g.day} 天 · ${g.text}`, g.r, rbtn('ev-sprint', { i }, got ? 'done' : un && done ? 'ok' : 'lock', un ? '领取' : '未解锁'), `${val} / ${g.target}`);
  }).join('');
  const all = e.sprint.length >= SPRINT.length;
  return `<section class="panel"><h3>七日喵程 <small>第 ${Math.min(day, SPRINT_DAYS)} / ${SPRINT_DAYS} 天${sprintActive(s) ? '' : '（已结束）'}</small></h3>
    <p>新来的军师，跟着猫猫们走一遍喵洲：每天解锁两个目标，七天全部完成还有终极大箱。目标按进度实时计算，错过的天数随时可以补。</p>${rows}
    <div class="evr big"><div class="grow"><b>终极大箱</b><small>${rewardText(SPRINT_CHEST)}</small></div>${rbtn('ev-sprint-chest', {}, e.sprintChest ? 'done' : all ? 'ok' : 'lock', '开箱')}</div></section>`;
}
function carnivalHtml(ctx: AppCtx): string {
  const e = ensureEvents(ctx.s), c = carnivalOf(), ready = claimable(e.pts, e.carn);
  const rows = CARNIVAL_TIERS.map((t, i) => row(`${t.pts} 活动点`, t.r, rbtn('ev-carn', { i }, e.carn.includes(i) ? 'done' : ready[i] ? 'ok' : 'lock'))).join('');
  return `<section class="panel"><h3>${esc(c.name)} <small>每周轮换</small></h3><p>${esc(c.flavor)}<br>做日常就能攒活动点：主线、爬塔、秘境、竞技、拜访好友、公会互助、世界 Boss、招募……每天最多 ${DAY_PTS_CAP} 点，周一 05:00 清零。</p>
    <div class="evbar"><i style="width:${Math.min(100, (e.pts / CARNIVAL_TIERS[CARNIVAL_TIERS.length - 1].pts) * 100)}%"></i></div><p class="muted">本周 <b>${e.pts}</b> 点 · 今日 ${e.dayPts}/${DAY_PTS_CAP}</p>${rows}</section>`;
}
const SPIN_ORDER = [0, 1, 2, 5, 4, 3, 7, 6]; // 沿外圈顺时针（对应 PRIZES 下标）
function spinHtml(ctx: AppCtx): string {
  const s = ctx.s, e = ensureEvents(s), vip = vipLevel(s), card = canClaimCard(s) || !!s.pay?.card && s.pay.card.until > Date.now();
  const left = spinsLeft(s, vip, card);
  const cells = SPIN_ORDER.map((pi, pos) => `<div class="cell ${PRIZES[pi].big ? 'big' : ''} ${eventsState.hit === pos ? 'hit' : ''}"><b>${PRIZES[pi].label}</b><small>${rewardText(PRIZES[pi].r)}</small></div>`).join('');
  return `<section class="panel"><h3>幸运猫抓机 <small>每天免费</small></h3><p>每天 1 次免费，VIP 3 / VIP 8 / 月卡各 +1 次（现在每天 ${left.free + e.spinUsed} 次免费）；还可以花 ${SPIN_EXTRA_COST} 金铃铛加抓（今日还能买 ${left.paid} 次）。每抓满 ${SPIN_PITY} 次必出招福符，当前保底进度 ${e.spinPity}/${SPIN_PITY}。</p>
    <div class="spin">${cells}<button class="btn pink spin-go" data-act="ev-spin" ${eventsState.spinning || left.free + left.paid <= 0 ? 'disabled' : ''}>${left.free > 0 ? `免费抓<small>剩 ${left.free}</small>` : `${SPIN_EXTRA_COST} 铃铛<small>加抓</small>`}</button></div></section>`;
}
function quizHtml(ctx: AppCtx): string {
  const e = quizState(ctx.s), qs = quizToday(), n = e.quizAns.length;
  const done = qs.map((q, i) => i < n ? `<div class="evr"><div class="grow"><b>${esc(q.q)}</b><small>${e.quizAns[i] === q.a ? '答对了' : `正确答案：${esc(q.o[q.a])}`}</small></div></div>` : '').join('');
  const cur = n < qs.length ? `<div class="quiz"><b>第 ${n + 1} 题 / ${QUIZ_PER_DAY}</b><p>${esc(qs[n].q)}</p>${qs[n].o.map((o, i) => `<button class="btn ghost" data-act="ev-quiz" data-c="${i}">${esc(o)}</button>`).join('')}</div>` : '<p class="muted">今天的题都答完了，明天再来。</p>';
  return `<section class="panel"><h3>喵洲知识问答 <small>每天 ${QUIZ_PER_DAY} 题</small></h3><p>答对一题 1500 小鱼干 + 2 猫薄荷（答错也有 500 小鱼干安慰奖）；三题全对再送 60 金铃铛 + 1 招福符。</p>${done}${cur}</section>`;
}

const hasCard = (ctx: AppCtx) => !!ctx.s.pay?.card && ctx.s.pay.card.until > Date.now();
function wishHtml(ctx: AppCtx): string {
  const s = ctx.s, e = ensureEv(s), w = e.wish, vip = vipLevel(s), n = wishShards(vip, hasCard(ctx));
  const owned = Object.keys(s.heroes).sort((a, b) => (HERO_BY_ID[b]?.rarity === 'SP' ? 1 : 0) - (HERO_BY_ID[a]?.rarity === 'SP' ? 1 : 0)).filter((id) => HERO_BY_ID[id]);
  const picks = owned.map((id) => `<button class="pick ${w.hero === id ? 'on' : ''}" data-act="ev-wish-pick" data-id="${id}"><img src="${artUrl(id, 'head')}" alt="" draggable="false"><small>${esc(HERO_BY_ID[id].name)}</small></button>`).join('');
  const toNext = 7 - (w.streak % 7 || (canWish(s) && w.last === dayOf() - 1 ? 7 : 0));
  return `<section class="panel"><h3>猫猫许愿池 <small>每天免费</small></h3><p>选一只已拥有的猫猫许愿，每天可得 <b>${n}</b> 个升星碎片（VIP3 / VIP8 / 月卡各 +1）。连续许愿满 7 天，额外再得 <b>${WISH_STREAK_BONUS}</b> 个！中断了就从头再来。</p>
    <p class="muted">连续 ${w.streak} 天 · 累计许愿 ${w.total} 次${w.streak % 7 === 0 && w.streak > 0 ? '' : ` · 再连续 ${toNext > 7 ? 7 : toNext} 天有大奖`}</p>
    <div class="wishpick">${picks}</div>
    <button class="btn pink" style="width:100%;margin-top:8px" data-act="ev-wish" ${canWish(s) && w.hero ? '' : 'disabled'}>${!w.hero ? '先选一只猫猫' : canWish(s) ? `为 ${esc(HERO_BY_ID[w.hero]?.name ?? '')} 许愿` : '今天已许愿'}</button></section>`;
}
function pullsHtml(ctx: AppCtx): string {
  const e = ensureEv(ctx.s);
  const rows = PULL_TIERS.map((t, i) => row(`本周招募 ${t.n} 次`, t.r, rbtn('ev-pull', { i }, e.pullClaimed.includes(i) ? 'done' : e.pulls >= t.n ? 'ok' : 'lock'), `${Math.min(e.pulls, t.n)} / ${t.n}`)).join('');
  const up = e.up, upHero = HERO_BY_ID[upHeroOf(up.period)];
  const upRows = UP_TIERS.map((t, i) => `<div class="evr"><div class="grow"><b>UP 池累计 ${t.n} 抽</b><small>${t.label}</small><em>${Math.min(up.pulls, t.n)} / ${t.n}</em></div>${rbtn('ev-up', { i }, up.claimed.includes(i) ? 'done' : up.pulls >= t.n ? 'ok' : 'lock')}</div>`).join('');
  return `<section class="panel"><h3>限时 UP：${esc(upHero.name)} <small>本期剩 ${upDaysLeft()} 天</small></h3><p>每 14 天换一只 UP 的 UR。在「招募 → ${esc(upHero.name)}限定」池里累计抽数，到档领奖，100 抽直接送 UP 猫猫（已拥有则转碎片）。</p>${upRows}</section>
    <section class="panel"><h3>招募盛典 <small>每周重置</small></h3><p>在「招募」里每抽一次就累计一次（常驻池、UP 池、至尊池都算）。抽得越多，周奖越丰厚。</p><div class="evbar"><i style="width:${Math.min(100, (e.pulls / PULL_TIERS[PULL_TIERS.length - 1].n) * 100)}%"></i></div>${rows}</section>`;
}
function rankHtml(ctx: AppCtx): string {
  const s = ctx.s, e = ensureEv(s), r = rankNow(s), l = e.rank.last;
  const last = l ? `<div class="evr big"><div class="grow"><b>上周战力榜：第 ${l.rank} 名</b><small>${rankRewardOf(l.rank).label} · ${rewardText(rankRewardOf(l.rank).r)}</small></div>${rbtn('ev-rank', {}, l.claimed ? 'done' : 'ok', '领奖')}</div>` : '';
  const top = r.board.slice(0, 8).map((x, i) => `<div class="arow ${x.me ? 'me' : ''}"><i class="rk r${i + 1}">${i + 1}</i><div class="who"><b>${esc(x.name)}</b></div><div class="rt"><em>战力</em><b class="num">${fmt(x.power)}</b></div></div>`).join('');
  const me = r.board[r.rank - 1];
  return `<section class="panel"><h3>周战力冲榜 <small>周一 05:00 结算</small></h3><p>本周你的最高战力和 20 位模拟玩家比：下周一按名次发奖。养成、升星、换装备都能抬高战力。</p>${last}
    <p class="muted">你现在第 <b>${r.rank}</b> 名 · 本周最高战力 ${fmt(r.power)}</p>${RANK_REWARDS.map((x) => `<div class="evr"><div class="grow"><b>${x.label}</b><small>${rewardText(x.r)}</small></div></div>`).join('')}
    <div class="note" style="font-weight:800;margin:8px 0 4px">实时榜</div>${top}${r.rank > 8 ? `<div class="arow me"><i class="rk">${r.rank}</i><div class="who"><b>${esc(me.name)}</b></div><div class="rt"><em>战力</em><b class="num">${fmt(me.power)}</b></div></div>` : ''}</section>`;
}
function dexHtml(ctx: AppCtx): string {
  const s = ctx.s, e = ensureEv(s), n = dexCount(s);
  const rows = DEX_TIERS.map((t, i) => row(`收集 ${t.n} 只猫猫`, t.r, rbtn('ev-dex', { i }, (e.dexClaimed ?? []).includes(i) ? 'done' : n >= t.n ? 'ok' : 'lock'), `${Math.min(n, t.n)} / ${t.n}`)).join('');
  const fac = FACTION_ORDER.map((f) => { const o = factionOwned(s, f), got = (e.dexFaction ?? []).includes(f); return row(`${FACTIONS[f].full} 集齐`, FACTION_SET_REWARD, rbtn('ev-dexf', { f }, got ? 'done' : o.have >= o.total ? 'ok' : 'lock'), `${o.have} / ${o.total}`); }).join('');
  return `<section class="panel"><h3>图鉴收集奖励 <small>已收集 ${n} 只</small></h3><p>每收集到一个新阶段，或集齐一个阵营的全部猫猫，都有一次性奖励。抽到过就算收集到，不用一直留在队伍里。</p>${rows}</section><section class="panel"><h3>六族集齐奖</h3>${fac}</section>`;
}
function costText(c: { fish?: number; bells?: number; moon?: number }) { return [c.fish && `${c.fish.toLocaleString('en-US')} 小鱼干`, c.bells && `${c.bells} 金铃铛`, c.moon && `${c.moon} 月光珠`].filter(Boolean).join(' + '); }
function nestHtml(ctx: AppCtx): string {
  const s = ctx.s, n = ensureNest(s), comfort = comfortOf(s), days = nestDaysReady(s), pend = nestPending(s);
  const rows = FURNITURE.map((f) => {
    const own = n.owned.includes(f.id), prem = !!f.cost.moon;
    return `<div class="evr ${prem ? 'big' : ''}"><div class="grow"><b>${esc(f.name)} <em>舒适 +${f.comfort}${prem ? ' · 高级' : ''}</em></b><small>${esc(f.desc)}</small><em>${costText(f.cost)}</em></div><button class="btn sm ${own ? 'ghost' : prem ? 'pink' : 'green'}" data-act="ev-nest-buy" data-id="${f.id}" ${own ? 'disabled' : ''}>${own ? '已摆放' : '购买'}</button></div>`;
  }).join('');
  return `<section class="panel"><h3>猫窝 <small>舒适度 ${comfort}</small></h3><p>给猫猫们布置一个家：家具买一次永久生效，舒适度越高，每天攒的小鱼干越多（最多攒 ${NEST_MAX_DAYS} 天，每点舒适度每天 60 小鱼干）。免费家具用小鱼干和金铃铛，高级家具用月光珠，舒适度高得多。</p>
    <div class="evr big"><div class="grow"><b>可领取：${pend.toLocaleString('en-US')} 小鱼干</b><small>已攒 ${days} 天 · 每天 ${(comfort * 60).toLocaleString('en-US')}</small></div><button class="btn sm ${days > 0 && comfort > 0 ? 'green' : 'ghost'}" data-act="ev-nest-collect" ${days > 0 && comfort > 0 ? '' : 'disabled'}>领取</button></div>${rows}</section>`;
}
function mailHtml(ctx: AppCtx): string {
  const list = mailbox(ctx.s), un = unclaimedMail(ctx.s).length;
  const rows = list.map((m) => { const got = mailClaimed(ctx.s, m.id); return `<div class="evr big ${got ? '' : 'unread'}"><div class="grow"><b>${esc(m.title)}</b><small style="white-space:pre-line">${esc(m.body.replace(/\\n/g, '\n'))}</small><em>附件：${rewardText(m.r)}</em></div>${rbtn('ev-mail', { id: m.id }, got ? 'done' : 'ok')}</div>`; }).join('');
  return `<section class="panel"><h3>邮件 <small>${un ? `${un} 封有附件` : '都看过啦'}</small></h3><button class="btn sm ${un ? 'green' : 'ghost'}" data-act="ev-mail-all" ${un ? '' : 'disabled'}>一键领取全部</button>${rows}</section>`;
}
function openHtml(ctx: AppCtx): string {
  const s = ctx.s, e = ensureEv(s), o = openRankOf(s);
  if (!openActive(s)) return `<section class="panel"><h3>开服冲榜 <small>已结束</small></h3><p>开服冲榜只在新号的前 ${OPEN_DAYS} 天开放。之后可以去「周冲榜」继续比拼。</p></section>`;
  const tier = OPEN_REWARDS.find((x) => o.rank <= x.upTo), got = (e.openClaimed ?? []).includes(o.day);
  const top = o.board.slice(0, 8).map((x, i) => `<div class="arow ${x.me ? 'me' : ''}"><i class="rk r${i + 1}">${i + 1}</i><div class="who"><b>${esc(x.name)}</b></div><div class="rt"><em>${o.theme.unit}</em><b class="num">${fmt(x.v)}</b></div></div>`).join('');
  const me = o.board[o.rank - 1];
  return `<section class="panel"><h3>开服冲榜 · 第 ${o.day} / ${OPEN_DAYS} 天 <small>${o.theme.label}</small></h3><p>新来的军师和 20 位老玩家同台：每天换一个主题，当天只要排进前 15 名，就能领一次当日奖励；名次越高奖励越丰厚。榜单实时更新，老玩家也在涨，想领大奖要早点冲。</p>
    <p class="muted">你现在第 <b>${o.rank}</b> 名 · ${tier ? `可领「${tier.label}」奖励` : '暂未进前 15 名'}</p>
    <button class="btn ${got ? 'ghost' : tier ? 'green' : 'ghost'}" style="width:100%" data-act="ev-open" ${!got && tier ? '' : 'disabled'}>${got ? '今天已领取' : tier ? `领取 ${tier.label} 奖励` : '继续冲榜'}</button>
    ${OPEN_REWARDS.map((x) => `<div class="evr"><div class="grow"><b>${x.label}</b><small>${rewardText(x.r)}</small></div></div>`).join('')}
    <div class="note" style="font-weight:800;margin:8px 0 4px">实时榜</div>${top}${o.rank > 8 ? `<div class="arow me"><i class="rk">${o.rank}</i><div class="who"><b>${esc(me.name)}</b></div><div class="rt"><em>${o.theme.unit}</em><b class="num">${fmt(me.v)}</b></div></div>` : ''}</section>`;
}
function festivalHtml(ctx: AppCtx): string {
  const v = festivalView(ctx.s);
  if (!v.active) return `<section class="panel"><h3>节日活动 <small>敬请期待</small></h3><p>现在没有进行中的节日。下一个：<b>${esc(v.next.f.name)}</b>，还有 <b>${v.daysToNext}</b> 天开始（${v.next.f.from[0]}月${v.next.f.from[1]}日起，共 ${v.next.days} 天）。<br>每个节日都有限定的签到礼和节日礼盒，错过要等明年。</p>
    <div class="evr"><div class="grow"><b>${esc(v.next.f.name)}</b><small>${esc(v.next.f.flavor)}</small><em>节日礼盒 ¥${FESTIVAL_PACK.yuan}：${rewardText(FESTIVAL_PACK.r)}</em></div></div></section>`;
  const a = v.active, st = v.state!, d = dayOf();
  const rows = Array.from({ length: a.days }, (_, i) => {
    const got = st.claimed.includes(i), ok = a.start + i <= d;
    return row(`第 ${i + 1} 天`, festivalGift(i, a.days), rbtn('ev-fest', { i }, got ? 'done' : ok ? 'ok' : 'lock', ok ? '领取' : '未到'));
  }).join('');
  return `<section class="panel"><h3>${esc(a.f.name)} <small>剩 ${a.end - d + 1} 天</small></h3><p>${esc(a.f.flavor)}</p>${rows}
    <div class="evr big"><div class="grow"><b>${FESTIVAL_PACK.name} <em>¥${FESTIVAL_PACK.yuan}</em></b><small>${rewardText(FESTIVAL_PACK.r)}</small><em>本届节日限购 1 次</em></div><button class="btn sm ${st.pack ? 'ghost' : 'pink'}" data-act="ev-buy" data-kind="festival" ${st.pack ? 'disabled' : ''}>${st.pack ? '已购买' : `¥${FESTIVAL_PACK.yuan}`}</button></div></section>`;
}

// ---------- 氪金 ----------
function firstHtml(ctx: AppCtx): string {
  const e = ensureEvents(ctx.s), can = canClaimFirstPay(ctx.s);
  return `<section class="panel pay-vip"><h3>首充豪礼 <small>任意一笔充值即可领取 · 限 1 次</small></h3><p>完成任意金额的第一笔充值，立刻领取一份丰厚的开拓礼：</p>
    <div class="evr big"><div class="grow"><b>豪礼</b><small>${rewardText(FIRST_PAY_GIFT)}</small></div>${rbtn('ev-first', {}, e.firstPay ? 'done' : can ? 'ok' : 'lock', can ? '领取' : '去充值')}</div>
    <button class="btn sm blue" data-act="nav" data-to="pay">去充值中心</button></section>`;
}
function cumHtml(ctx: AppCtx): string {
  const e = ensureEvents(ctx.s);
  const rows = CUM_TIERS.map((t, i) => row(`本周累计充值 ¥${t.yuan}`, t.r, rbtn('ev-cum', { i }, e.cum.includes(i) ? 'done' : e.weekYuan >= t.yuan ? 'ok' : 'lock'))).join('');
  return `<section class="panel"><h3>周累计充值 <small>周一 05:00 重置</small></h3><p>本周已充值 <b>¥${e.weekYuan}</b>。档位越高奖励越丰厚，所有档位可叠加领取。<br><span class="muted">模拟支付：不会产生真实扣费。</span></p>${rows}<button class="btn sm blue" data-act="nav" data-to="pay">去充值中心</button></section>`;
}
function growthHtml(ctx: AppCtx): string {
  const e = ensureEvents(ctx.s), o = ordinal(ctx);
  const total = GROWTH_TIERS.reduce((a, t) => a + (t.r.moon ?? 0), 0);
  const rows = GROWTH_TIERS.map((t, i) => row(`主线通关 ${t.ord} 关`, t.r, rbtn('ev-growth', { i }, e.growth.claimed.includes(i) ? 'done' : e.growth.bought && o >= t.ord ? 'ok' : 'lock'), `当前 ${Math.min(o, t.ord)} / ${t.ord}`)).join('');
  return `<section class="panel pay-vip"><h3>${GROWTH.title} <small>¥${GROWTH.yuan} · 限购 1 次</small></h3><p>推进主线就能分批领回月光珠：全部领完共 <b>${total}</b> 月光珠（当量 ¥${total / 10}，超过买价），还有金铃铛。越早买、推得越快，回得越早。</p>
    <button class="btn sm ${e.growth.bought ? 'ghost' : 'pink'}" data-act="ev-buy" data-kind="growth" ${e.growth.bought ? 'disabled' : ''}>${e.growth.bought ? '已购买' : `购买 ¥${GROWTH.yuan}`}</button>${rows}</section>`;
}
function passHtml(ctx: AppCtx): string {
  const s = ctx.s, e = ensureEvents(s), lv = passLevel(s);
  const rows = Array.from({ length: PASS_MAX }, (_, i) => i + 1).map((l) => {
    const unl = l <= lv, lux = passLux(l);
    const b = (track: 'free' | 'prem' | 'lux', list: number[], need: boolean, r: Reward) => `<button class="pcell ${list.includes(l) ? 'done' : unl && need ? 'ok' : ''}" data-act="ev-pass" data-t="${track}" data-l="${l}" ${unl && need && !list.includes(l) ? '' : 'disabled'}><small>${rewardText(r)}</small>${list.includes(l) ? '<i>✓</i>' : !need ? '<i>🔒</i>' : ''}</button>`;
    return `<div class="prow2 ${unl ? 'on' : ''}"><i class="lv">${l}</i>${b('free', e.passFree, true, passFree(l))}${b('prem', e.passPrem, e.passTier >= 1, passPrem(l))}${lux ? b('lux', e.passLux, e.passTier >= 2, lux) : '<span class="pcell none"></span>'}</div>`;
  }).join('');
  const buy = (tier: 1 | 2) => {
    const price = PASS_PRICE[tier] - (e.passTier ? PASS_PRICE[e.passTier as 1 | 2] : 0);
    return `<button class="btn sm ${e.passTier >= tier ? 'ghost' : tier === 2 ? 'orange' : 'pink'}" data-act="ev-buy" data-kind="pass${tier}" ${e.passTier >= tier ? 'disabled' : ''}>${e.passTier >= tier ? (tier === 1 ? '已解锁通行证' : '已解锁豪华版') : `${tier === 1 ? '通行证' : '豪华版'} ¥${price}`}</button>`;
  };
  return `<section class="panel"><h3>喵喵通行证 <small>赛季剩 ${seasonDaysLeft()} 天</small></h3><p>活动点同时换算通行证经验（每 ${PASS_XP} 点 1 级）。免费轨人人可领；<b>通行证 ¥${PASS_PRICE[1]}</b> 额外解锁每级奖励和三档月光珠；<b>豪华版 ¥${PASS_PRICE[2]}</b> 再多一条每 5 级的豪华轨，并立得 ${PASS_BONUS_LEVELS} 级。赛季每 28 天重置。</p>
    <div class="evbar"><i style="width:${(lv / PASS_MAX) * 100}%"></i></div><p class="muted">当前 <b>Lv.${lv}</b> / ${PASS_MAX} · 本赛季 ${e.xp} 经验</p><div class="row" style="gap:8px;margin-bottom:8px">${buy(1)}${buy(2)}</div>
    <div class="prow2 head"><i class="lv">级</i><span>免费</span><span>通行证</span><span>豪华</span></div>${rows}</section>`;
}
function packsHtml(ctx: AppCtx): string {
  const rows = PACKS.map((p) => {
    const can = packAvailable(ctx.s, p);
    return `<div class="evr big"><div class="grow"><b>${p.name} <em>¥${p.yuan}</em></b><small>${rewardText(p.r)}</small><em>${p.desc}</em></div><button class="btn sm ${can ? 'pink' : 'ghost'}" data-act="ev-buy" data-kind="${p.id}" ${can ? '' : 'disabled'}>${can ? `¥${p.yuan}` : '本期已购'}</button></div>`;
  }).join('');
  return `<section class="panel"><h3>限时礼包 <small>按周期限购</small></h3><p>日 / 周 / 月三档，越大的箱子越划算（折算每元的招福符和鱼骨更多）。<span class="muted">模拟支付：不会产生真实扣费。</span></p>${rows}</section>`;
}

export function eventsHtml(ctx: AppCtx): string {
  const t = eventsState.tab;
  const body = { dex: dexHtml, nest: nestHtml, mail: mailHtml, sprint: sprintHtml, carnival: carnivalHtml, spin: spinHtml, quiz: quizHtml, wish: wishHtml, pulls: pullsHtml, rank: rankHtml, open: openHtml, festival: festivalHtml, first: firstHtml, cum: cumHtml, growth: growthHtml, pass: passHtml, packs: packsHtml }[t](ctx);
  return `${topbar(ctx, '活动', '<button class="btn sm ghost shop-back" data-act="nav" data-to="home">返回</button>')}
    <div class="shop-tabs ev-tabs"><div class="seg">${TABS.map(([id, name, paid]) => `<button class="pill ${paid ? 'paid' : ''}" data-act="ev-tab" data-tab="${id}" aria-pressed="${t === id}">${name}${paid ? '<i>氪</i>' : ''}</button>`).join('')}</div></div>
    <div class="scroll ev-scroll">${body}</div>`;
}

function confirm(ctx: AppCtx, title: string, desc: string, kind: string) {
  ctx.root.querySelectorAll('.mask.center').forEach((m) => m.remove());
  ctx.root.insertAdjacentHTML('beforeend', `<div class="mask center" data-act="closedialog"><div class="dialog" style="text-align:center">
    <h3 class="title" style="margin:0 0 6px">${title}</h3><p style="font-size:13.5px;line-height:1.7;font-weight:700;margin:0 0 4px">${desc}</p>
    <p class="muted" style="font-size:11.5px;margin:0 0 12px">模拟支付：确认后直接到账，不会产生真实扣费。</p>
    <div class="row" style="justify-content:center;gap:10px"><button class="btn ghost" data-act="closedialog">取消</button><button class="btn pink" data-act="ev-buy-ok" data-kind="${kind}">确认支付</button></div></div></div>`);
}
const say = (ctx: AppCtx, r: { ok: boolean; reason?: string; r?: Reward }, ok = '领到了') => { ctx.toast(r.ok ? `${ok}：${rewardText(r.r!)}` : r.reason ?? ''); if (r.ok) { sfx.ok(); ctx.save(); } ctx.refresh(); };

export function handleEvents(ctx: AppCtx, act: string, el: HTMLElement): boolean {
  const s = ctx.s;
  const i = Number(el.dataset.i);
  switch (act) {
    case 'ev-nest-buy': { const r = buyFurniture(s, el.dataset.id!); if (r.ok) { sfx.coin(); ctx.save(); ctx.toast(`摆好了「${r.f.name}」，舒适度 +${r.f.comfort}`); } else ctx.toast(r.reason); ctx.refresh(); return true; }
    case 'ev-nest-collect': { const r = collectNest(s); if (r.ok) { sfx.coin(); ctx.save(); ctx.toast(`领到 ${r.fish.toLocaleString('en-US')} 小鱼干（攒了 ${r.days} 天）`); } else ctx.toast(r.reason); ctx.refresh(); return true; }
    case 'ev-dex': say(ctx, claimDex(s, i)); return true;
    case 'ev-dexf': { const r = claimFactionSet(s, el.dataset.f!); say(ctx, r.ok ? { ok: true, r: r.r } : r, `${r.ok ? r.name : ''}集齐奖`); return true; }
    case 'ev-mail': say(ctx, claimMail(s, el.dataset.id!)); return true;
    case 'ev-mail-all': { const r = claimAllMail(s); ctx.toast(r.ok ? `领取了 ${r.n} 封邮件的附件` : r.reason); if (r.ok) { sfx.ok(); ctx.save(); } ctx.refresh(); return true; }
    case 'ev-tab': eventsState.tab = el.dataset.tab as Tab; ctx.refresh(); return true;
    case 'ev-sprint': say(ctx, claimSprint(s, i)); return true;
    case 'ev-sprint-chest': say(ctx, claimSprintChest(s)); return true;
    case 'ev-carn': say(ctx, claimCarnival(s, i)); return true;
    case 'ev-first': say(ctx, claimFirstPay(s)); return true;
    case 'ev-cum': say(ctx, claimCum(s, i)); return true;
    case 'ev-growth': say(ctx, claimGrowth(s, i)); return true;
    case 'ev-pass': say(ctx, claimPass(s, el.dataset.t as 'free' | 'prem' | 'lux', Number(el.dataset.l))); return true;
    case 'ev-wish-pick': { const r = setWishHero(s, el.dataset.id!); if (r.ok) ctx.save(); ctx.refresh(); return true; }
    case 'ev-wish': {
      const r = wish(s, vipLevel(s), hasCard(ctx));
      if (!r.ok) { ctx.toast(r.reason); return true; }
      ctx.save(); sfx.ok(); ctx.toast(`${HERO_BY_ID[r.hero].name} 收到 ${r.shards} 个碎片${r.bonus ? '（连续 7 天大奖！）' : ''}，连续第 ${r.streak} 天`); ctx.refresh(); return true;
    }
    case 'ev-pull': say(ctx, claimPull(s, i)); return true;
    case 'ev-up': { const r = claimUp(s, i); ctx.toast(r.ok ? `领到了：${r.text}` : r.reason); if (r.ok) { sfx.ok(); ctx.save(); } ctx.refresh(); return true; }
    case 'ev-rank': { const r = claimRank(s); say(ctx, r.ok ? { ok: true, r: r.r } : r, `上周第 ${r.ok ? r.rank : ''} 名奖励`); return true; }
    case 'ev-open': { const r = claimOpen(s); say(ctx, r.ok ? { ok: true, r: r.r } : r, `冲榜奖励（${r.ok ? r.label : ''}）`); return true; }
    case 'ev-fest': say(ctx, claimFestival(s, i)); return true;
    case 'ev-quiz': {
      const r = answerQuiz(s, Number(el.dataset.c));
      if (!r.ok) { ctx.toast(r.reason); return true; }
      ctx.toast(r.perfect ? '三题全对！额外奖励到账' : r.right ? '答对了！' : '差一点，下次加油'); r.right ? sfx.ok() : sfx.no();
      ctx.save(); ctx.refresh(); return true;
    }
    case 'ev-spin': {
      if (eventsState.spinning) return true;
      const vip = vipLevel(s), card = !!s.pay?.card && s.pay.card.until > Date.now();
      const r = spin(s, vip, card);
      if (!r.ok) { ctx.toast(r.reason); return true; }
      ctx.save();
      eventsState.spinning = true;
      const target = SPIN_ORDER.indexOf(r.index), steps = 24 + target;
      let n = 0;
      const tick = () => {
        eventsState.hit = n % SPIN_ORDER.length; sfx.tap(); n++;
        if (ctx.screen === 'events') ctx.refresh();
        if (n <= steps) setTimeout(tick, 45 + n * 5);
        else { eventsState.spinning = false; ctx.toast(`抓到了「${r.prize.label}」：${rewardText(r.prize.r)}`); r.prize.big ? sfx.win() : sfx.coin(); if (ctx.screen === 'events') ctx.refresh(); }
      };
      tick();
      return true;
    }
    case 'ev-buy': {
      const kind = el.dataset.kind!;
      if (kind === 'festival') confirm(ctx, `${FESTIVAL_PACK.name} ¥${FESTIVAL_PACK.yuan}`, rewardText(FESTIVAL_PACK.r), kind);
      else if (kind === 'growth') confirm(ctx, `${GROWTH.title} ¥${GROWTH.yuan}`, '购买后，主线每推进到指定关数即可领回月光珠与金铃铛。', kind);
      else if (kind.startsWith('pass')) confirm(ctx, kind === 'pass1' ? `喵喵通行证 ¥${PASS_PRICE[1]}` : `豪华通行证（含补差价）`, kind === 'pass1' ? '解锁本赛季的通行证奖励轨。' : `解锁豪华轨，并立得 ${PASS_BONUS_LEVELS} 级。`, kind);
      else { const p = PACKS.find((x) => x.id === kind)!; confirm(ctx, `${p.name} ¥${p.yuan}`, rewardText(p.r), kind); }
      return true;
    }
    case 'ev-buy-ok': {
      ctx.root.querySelectorAll('.mask.center').forEach((m) => m.remove());
      const kind = el.dataset.kind!;
      let msg: string, ok = true;
      if (kind === 'festival') { const r = buyFestivalPack(s); ok = r.ok; msg = r.ok ? `节日礼盒到账：${rewardText(r.r)}` : r.reason; }
      else if (kind === 'growth') { const r = buyGrowth(s); ok = r.ok; msg = r.ok ? '成长基金已购买，推进主线领回月光珠' : r.reason; }
      else if (kind.startsWith('pass')) { const r = buyPass(s, kind === 'pass1' ? 1 : 2); ok = r.ok; msg = r.ok ? '通行证已解锁' : r.reason; }
      else { const r = buyPack(s, kind); ok = r.ok; msg = r.ok ? `礼包到账：${rewardText(r.r)}` : r.reason; }
      if (ok) { sfx.coin(); ctx.save(); }
      ctx.refresh(); ctx.toast(msg);
      return true;
    }
  }
  return false;
}

export function eventsDot(ctx: AppCtx): boolean {
  const s = ctx.s, e = ensureEvents(s), vip = vipLevel(s), card = !!s.pay?.card && s.pay.card.until > Date.now();
  if (unclaimedMail(s).length) return true;
  if (DEX_TIERS.some((t, i) => dexCount(s) >= t.n && !(e.dexClaimed ?? []).includes(i))) return true;
  if (comfortOf(s) > 0 && nestDaysReady(s) > 0) return true;
  if (spinsLeft(s, vip, card).free > 0) return true;
  if (quizState(s).quizAns.length < QUIZ_PER_DAY) return true;
  if (claimable(e.pts, e.carn).some(Boolean)) return true;
  if (sprintActive(s) && SPRINT.some((_, i) => !e.sprint.includes(i) && sprintUnlocked(s, i) && sprintDone(s, i))) return true;
  if (canClaimFirstPay(s)) return true;
  if (e.wish.hero && canWish(s)) return true;
  if (UP_TIERS.some((t, i) => e.up.pulls >= t.n && !e.up.claimed.includes(i))) return true;
  if (e.pulls > 0 && PULL_TIERS.some((t, i) => e.pulls >= t.n && !e.pullClaimed.includes(i))) return true;
  if (e.rank.last && !e.rank.last.claimed) return true;
  if (openActive(s) && !(e.openClaimed ?? []).includes(openRankOf(s).day) && OPEN_REWARDS.some((x) => openRankOf(s).rank <= x.upTo)) return true;
  const f = festivalView(s);
  if (f.active && Array.from({ length: f.active.days }, (_, i) => i).some((i) => f.active!.start + i <= dayOf() && !f.state!.claimed.includes(i))) return true;
  return false;
}

export const EVENTS_CSS = `
.ev-tabs .seg{overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none}.ev-tabs .pill{white-space:nowrap;position:relative}
.ev-tabs .pill i{font-style:normal;margin-left:3px;padding:0 4px;border-radius:6px;background:#c0392b;color:#fff;font-size:10px;font-weight:800}
.ev-scroll{display:flex;flex-direction:column;gap:12px;padding:6px 10px 24px}
.ev-scroll .panel h3{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}.ev-scroll .panel h3 small{font-family:var(--f-b);font-size:12px;color:var(--ink-2);font-weight:700}
.ev-scroll p{margin:4px 0 8px;font-size:12.5px;line-height:1.65;font-weight:700;color:var(--ink-2)}
.evr{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px dashed var(--paper-line)}.evr:last-child{border:0}
.evr b{font-family:var(--f-d);font-weight:400;font-size:14.5px;display:block}.evr small{display:block;font-size:11.5px;font-weight:700;color:var(--ink-2)}.evr em{display:block;font-style:normal;font-size:11px;font-weight:800;color:var(--orange-d)}
.evr.big{padding:10px 0}
.evbar{height:10px;border-radius:999px;background:var(--paper-2);box-shadow:inset 0 0 0 2px var(--paper-line);overflow:hidden}.evbar i{display:block;height:100%;background:linear-gradient(#ffd45a,#f09a20)}
.spin{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:4px}
.spin .cell{aspect-ratio:1;border-radius:14px;background:var(--paper-2);box-shadow:inset 0 0 0 2px var(--paper-line);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2px;transition:transform .08s}
.spin .cell b{font-family:var(--f-d);font-weight:400;font-size:13px}.spin .cell small{font-size:10px;font-weight:700;color:var(--ink-2);line-height:1.2}
.spin .cell.big{background:linear-gradient(#fff3c4,#ffd98a)}.spin .cell.hit{transform:scale(1.08);background:linear-gradient(#ffe27a,#ff9f1c);box-shadow:0 0 0 3px #fff,0 0 14px rgba(255,159,28,.9)}
.spin-go{grid-column:1/-1;margin-top:6px;height:46px}.spin-go small{display:block;font-size:10px;opacity:.85}
.wishpick{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;max-height:210px;overflow-y:auto}
.wishpick .pick{display:flex;flex-direction:column;align-items:center;padding:4px 1px;border-radius:12px;background:var(--paper-2);box-shadow:inset 0 0 0 2px var(--paper-line)}.wishpick .pick img{width:44px;height:44px;border-radius:50%;object-fit:cover}.wishpick .pick small{font-size:9.5px;font-weight:800;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.wishpick .pick.on{background:linear-gradient(#fff3c4,#ffd0ee);box-shadow:inset 0 0 0 3px #ff6ad0}
.evr.unread b::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--red);margin-right:5px}
.quiz{display:flex;flex-direction:column;gap:8px}.quiz p{font-size:15px;color:var(--ink);margin:0}.quiz .btn{width:100%}
.prow2{display:grid;grid-template-columns:26px 1fr 1fr 1fr;gap:5px;align-items:stretch;padding:3px 0}.prow2.head{font-size:11px;font-weight:800;color:var(--ink-2);text-align:center;align-items:center}
.prow2 .lv{font-style:normal;display:grid;place-items:center;font-family:var(--f-d);font-size:13px;border-radius:50%;background:var(--paper-2);box-shadow:inset 0 0 0 2px var(--paper-line)}.prow2.on .lv{background:linear-gradient(#ffe27a,#f0a62e)}
.pcell{position:relative;min-height:38px;border-radius:10px;background:var(--paper-2);box-shadow:inset 0 0 0 2px var(--paper-line);padding:3px 13px 3px 4px;text-align:center;display:flex;align-items:center;justify-content:center}
.pcell small{font-size:9.5px;font-weight:700;line-height:1.25;color:var(--ink-2)}.pcell.ok{background:linear-gradient(#d6f5c4,#9fe07a);box-shadow:0 2px 0 var(--green-d)}.pcell.done{opacity:.55}.pcell i{position:absolute;right:2px;top:0;font-style:normal;font-size:10px}.pcell.none{background:none;box-shadow:none}
`;
