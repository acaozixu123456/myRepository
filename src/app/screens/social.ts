// 喵洲广场：世界聊天 / 玩家（20 位模拟玩家）/ 竞技场 / 好友。
import { FACTIONS } from '../../data/factions';
import { HERO_BY_ID } from '../../data/heroes';
import { NPCS, NPC_BY_ID, PROFILE_NAME, npcLastSeenMin, npcLineup, npcOnline, npcProgress } from '../../game/npc';
import type { ChatMsg, Npc } from '../../game/npc';
import { teamPower } from '../../game/state';
import {
  ARENA_EXTRA_COST, ARENA_EXTRA_MAX, ARENA_FREE, ARENA_REWARD, CHAT_MAX_LEN, addFriend, arenaBoard, arenaBuyExtra, arenaFinish, arenaLeft, arenaRefresh, arenaStage, arenaStart,
  canVisit, chatFeed, ensureSocial, isFriend, markRead, sendChat, visitFriend,
} from '../../game/social';
import { artUrl } from '../../ui/art';
import { esc, fmt } from '../../ui/components';
import { icon } from '../../ui/icons';
import type { AppCtx } from '../ctx';
import { sfx } from '../sfx';
import { floaty } from './home';
import { topbar } from './lineup';

export const socialState = { tab: 'world' as 'world' | 'players' | 'arena' | 'friends' };
const TABS: [typeof socialState.tab, string][] = [['world', '世界'], ['players', '玩家'], ['arena', '竞技'], ['friends', '好友']];

const clock = (t: number) => new Date(t).toTimeString().slice(0, 5);
function seen(npc: Npc, now: number): string {
  const m = npcLastSeenMin(npc, now);
  return m === 0 ? '在线' : m === null ? '很久没上线' : m < 60 ? `${m} 分钟前在线` : `${Math.round(m / 60)} 小时前在线`;
}
const vipTag = (n: Npc) => (n.vip > 0 ? `<i class="vtag">VIP${n.vip}</i>` : '');
const head = (heroId: string, cls = '') => `<img class="av ${cls}" src="${artUrl(heroId, 'head')}" alt="" draggable="false">`;

// ---------- 世界 ----------
function msgHtml(m: ChatMsg, ctx: AppCtx): string {
  if (m.kind === 'sys') return `<div class="cm sys"><span>${esc(m.text)}</span></div>`;
  if (m.kind === 'me') return `<div class="cm me"><div class="bub"><b>${esc(ctx.s.name)} <small>${clock(m.t)}</small></b><p>${esc(m.text)}</p></div>${head(ctx.s.lineup.find(Boolean) ?? 'wei_xiahoudun')}</div>`;
  const n = NPC_BY_ID[m.from];
  return `<div class="cm"><button class="avb" data-act="npc" data-id="${m.from}">${head(n?.avatar ?? 'wei_xiahoudun')}</button><div class="bub"><b>${esc(m.name)}${n ? vipTag(n) : ''} <small>${clock(m.t)}</small></b><p>${esc(m.text)}</p></div></div>`;
}
export function chatLogHtml(ctx: AppCtx): string {
  return chatFeed(ctx.s, Date.now()).map((m) => msgHtml(m, ctx)).join('') || '<div class="empty">广场上还没有声音…</div>';
}
/** 只刷新聊天记录（不动输入框），贴底时保持贴底 */
export function refreshChatLog(ctx: AppCtx) {
  const log = ctx.root.querySelector('.chat-log') as HTMLElement | null;
  if (!log || ctx.screen !== 'social' || socialState.tab !== 'world') return;
  const near = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  log.innerHTML = chatLogHtml(ctx);
  if (near) log.scrollTop = log.scrollHeight;
  markRead(ctx.s);
}
function worldHtml(ctx: AppCtx): string {
  const online = NPCS.filter((n) => npcOnline(n, Date.now())).length;
  return `<div class="chat-top"><b>世界频道</b><span>${online + 1} 位玩家在线</span></div>
    <div class="chat-log">${chatLogHtml(ctx)}</div>
    <div class="chat-bar"><input id="chatInput" maxlength="${CHAT_MAX_LEN}" placeholder="说点什么吧（最多 ${CHAT_MAX_LEN} 字）" autocomplete="off"><button class="btn sm" data-act="chat-send">发送</button></div>`;
}

// ---------- 玩家 / 好友 ----------
function npcRow(n: Npc, now: number, extra = ''): string {
  const p = npcProgress(n, now);
  const on = npcOnline(n, now);
  return `<button class="prow" data-act="npc" data-id="${n.id}">${head(n.avatar)}<i class="dot ${on ? 'on' : ''}"></i>
    <div class="who"><b>${esc(n.name)}${vipTag(n)}</b><small>Lv.${p.level} · ${PROFILE_NAME[n.profile]} · ${p.stageId} · ${seen(n, now)}</small></div>
    <div class="pw"><em>战力</em><b class="num">${fmt(p.power)}</b></div>${extra}</button>`;
}
function playersHtml(): string {
  const now = Date.now();
  const list = [...NPCS].sort((a, b) => Number(npcOnline(b, now)) - Number(npcOnline(a, now)) || npcProgress(b, now).power - npcProgress(a, now).power);
  return `<div class="scroll soc-scroll"><div class="note">共 ${NPCS.length} 位玩家，在线的排在前面。他们有自己的作息：会睡觉、会上班，也会在夜里偷偷刷塔。</div>${list.map((n) => npcRow(n, now)).join('')}</div>`;
}
function friendsHtml(ctx: AppCtx): string {
  const o = ensureSocial(ctx.s);
  const now = Date.now();
  if (!o.friends.length) return `<div class="scroll soc-scroll"><div class="empty">还没有好友。去「玩家」里点开一位，加个好友吧。<br>每位好友每天可以拜访一次，有小鱼干拿。</div></div>`;
  return `<div class="scroll soc-scroll"><div class="note">好友 ${o.friends.length} 位 · 每位每天拜访一次（得小鱼干）</div>${o.friends.map((id) => {
    const n = NPC_BY_ID[id];
    return npcRow(n, now, `<span class="vbtn ${canVisit(ctx.s, id, now) ? 'ok' : ''}" data-act="visit" data-id="${id}">${canVisit(ctx.s, id, now) ? '拜访' : '已访'}</span>`);
  }).join('')}</div>`;
}

// ---------- 竞技 ----------
function arenaHtml(ctx: AppCtx): string {
  const s = ctx.s;
  const now = Date.now();
  const o = ensureSocial(s);
  const a = arenaRefresh(s, now);
  const board = arenaBoard(s, teamPower(s), now);
  const myRank = board.findIndex((r) => r.me) + 1;
  const left = arenaLeft(s, now);
  const log = a.log.slice(0, 5).map((l) => `<div class="alog ${l.win ? 'w' : 'l'}"><span>${clock(l.t)}</span><b>${l.win ? '胜' : '负'}</b><span>${esc(NPC_BY_ID[l.npc]?.name ?? '')}</span><em>${l.delta >= 0 ? '+' : ''}${l.delta}</em></div>`).join('');
  return `<div class="scroll soc-scroll">
    <section class="panel arena-me">
      <div class="row"><div class="grow"><h3>${icon('trophy', 24)} 比爪场 <small>第 ${myRank} 名</small></h3><p>积分 <b class="num">${o.arena.rating}</b>（最高 ${o.arena.best}）· ${o.arena.wins} 胜 ${o.arena.losses} 负</p></div>
      <div class="col"><div class="left">今日剩余 <b>${left}</b> 次</div><button class="btn sm ${left >= ARENA_FREE + ARENA_EXTRA_MAX ? 'ghost' : 'blue'}" data-act="arena-buy" ${a.extra >= ARENA_EXTRA_MAX ? 'disabled' : ''}>加次数 ${icon('bells', 14)}${ARENA_EXTRA_COST}</button></div></div>
      <small class="muted">胜利 +${ARENA_REWARD.win} 猫爪印，失败 +${ARENA_REWARD.lose}；每天 ${ARENA_FREE} 次免费，积分按 Elo 结算。猫爪印可在商店「竞技」页兑换。</small>
      ${log ? `<div class="alogs">${log}</div>` : ''}
    </section>
    ${board.map((r, i) => `<div class="arow ${r.me ? 'me' : ''}"><i class="rk r${i + 1}">${i + 1}</i>${head(r.avatar)}<div class="who"><b>${esc(r.name)}</b><small>Lv.${r.level} · 战力 ${fmt(r.power)}</small></div><div class="rt"><em>积分</em><b class="num">${r.rating}</b></div>${r.me ? '<span class="vbtn me">你</span>' : `<button class="btn sm green" data-act="arena-go" data-id="${r.id}">切磋</button>`}</div>`).join('')}
  </div>`;
}

export function socialHtml(ctx: AppCtx): string {
  const tab = socialState.tab;
  const body = tab === 'world' ? worldHtml(ctx) : tab === 'players' ? playersHtml() : tab === 'arena' ? arenaHtml(ctx) : friendsHtml(ctx);
  return `${topbar(ctx, '喵洲广场', '<button class="btn sm ghost shop-back" data-act="nav" data-to="home">返回</button>')}
    <div class="shop-tabs"><div class="seg">${TABS.map(([id, name]) => `<button class="pill" data-act="stab" data-tab="${id}" aria-pressed="${tab === id}">${name}</button>`).join('')}</div></div>
    <div class="soc-body t-${tab}">${body}</div>`;
}

function profileDialog(ctx: AppCtx, id: string) {
  const n = NPC_BY_ID[id];
  const now = Date.now();
  const p = npcProgress(n, now);
  const f = FACTIONS[n.faction];
  const line = npcLineup(n, now, p.level);
  const fr = isFriend(ctx.s, id);
  ctx.root.querySelectorAll('.mask.center').forEach((m) => m.remove());
  ctx.root.insertAdjacentHTML('beforeend', `<div class="mask center" data-act="closedialog"><div class="dialog npcd" style="--c:${f.color}">
    <div class="row">${head(n.avatar, 'lg')}<div class="grow"><b class="ttl">${esc(n.name)}${vipTag(n)}</b><div class="muted" style="font-size:12px;font-weight:700">${f.glyph} ${f.full} · ${PROFILE_NAME[n.profile]} · ${seen(n, now)}</div></div></div>
    <p class="bio">“${esc(n.bio)}”</p>
    <div class="npcstat"><span>等级 <b>${p.level}</b></span><span>战力 <b>${fmt(p.power)}</b></span><span>关卡 <b>${p.stageId}</b></span></div>
    <div class="npcline">${line.map((u) => `<div class="m ${HERO_BY_ID[u.heroId].rarity.toLowerCase()}"><img src="${artUrl(u.heroId, 'head')}" alt="${esc(HERO_BY_ID[u.heroId].name)}" draggable="false"><em>Lv.${u.level}</em></div>`).join('')}</div>
    <div class="row" style="justify-content:center;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn sm ${fr ? 'ghost' : 'pink'}" data-act="friend" data-id="${id}" ${fr ? 'disabled' : ''}>${fr ? '已是好友' : '加好友'}</button>
      <button class="btn sm ${canVisit(ctx.s, id) ? 'green' : 'ghost'}" data-act="visit" data-id="${id}" ${canVisit(ctx.s, id) ? '' : 'disabled'}>${fr ? (canVisit(ctx.s, id) ? '拜访' : '今日已访') : '拜访（需好友）'}</button>
      <button class="btn sm blue" data-act="arena-go" data-id="${id}">切磋</button></div>
    <div style="text-align:center;margin-top:10px"><button class="btn ghost sm" data-act="closedialog">关闭</button></div></div></div>`);
}

function sendFromInput(ctx: AppCtx) {
  const el = ctx.root.querySelector('#chatInput') as HTMLInputElement | null;
  if (!el) return;
  const r = sendChat(ctx.s, el.value);
  if (!r.ok) return ctx.toast(r.reason);
  el.value = '';
  ctx.save();
  sfx.tap();
  const log = ctx.root.querySelector('.chat-log') as HTMLElement;
  log.innerHTML = chatLogHtml(ctx);
  log.scrollTop = log.scrollHeight;
  // NPC 的回应在 3~30 秒后陆续出现：到点自动刷新一次聊天记录
  for (const ms of [6000, 14000, 24000, 36000]) setTimeout(() => refreshChatLog(ctx), ms);
}

export function handleSocial(ctx: AppCtx, act: string, el: HTMLElement): boolean {
  const s = ctx.s;
  switch (act) {
    case 'stab': socialState.tab = el.dataset.tab as typeof socialState.tab; ctx.refresh(); return true;
    case 'npc': profileDialog(ctx, el.dataset.id!); return true;
    case 'chat-send': sendFromInput(ctx); return true;
    case 'friend': { const r = addFriend(s, el.dataset.id!); ctx.save(); ctx.toast(r.msg); if (r.ok) { profileDialog(ctx, el.dataset.id!); sfx.ok(); } return true; }
    case 'visit': {
      const id = el.dataset.id!;
      const r = visitFriend(s, id);
      if (!r.ok) { ctx.toast(r.reason); return true; }
      ctx.save(); sfx.coin(); floaty(ctx, `+${fmt(r.fish)}`, 'fish', 50, 30);
      ctx.toast(`拜访了 ${NPC_BY_ID[id].name}，带回 ${fmt(r.fish)} 小鱼干`);
      ctx.root.querySelectorAll('.mask.center').forEach((m) => m.remove());
      ctx.refresh();
      return true;
    }
    case 'arena-buy': { const r = arenaBuyExtra(s); ctx.toast(r.ok ? '加了一次切磋机会' : r.reason ?? ''); ctx.save(); ctx.refresh(); return true; }
    case 'arena-go': {
      const id = el.dataset.id!;
      const npc = NPC_BY_ID[id];
      const r = arenaStart(s);
      if (!r.ok) { ctx.toast(r.reason ?? ''); return true; }
      ctx.root.querySelectorAll('.mask.center').forEach((m) => m.remove());
      ctx.save();
      ctx.go('home');
      ctx.toast(`向 ${npc.name} 发起切磋！`);
      void ctx.loop.runCustom(arenaStage(npc), 6).then((win) => {
        if (win === null) return;
        const res = arenaFinish(s, id, win);
        ctx.save();
        ctx.result({ win, title: `切磋 · ${npc.name}`, hint: `积分 ${res.delta >= 0 ? '+' : ''}${res.delta}（现 ${res.rating}），猫爪印 +${res.paw}。${win ? '' : '对方战力更高，去阵容升级升星再来。'}`, again: { act: 'nav', label: '回比爪场', data: { to: 'social' } } });
        socialState.tab = 'arena';
        ctx.refresh();
      });
      return true;
    }
  }
  return false;
}

export const SOCIAL_CSS = `
.soc-body{position:relative;flex:1;display:flex;flex-direction:column;min-height:0}
.soc-scroll{position:relative;flex:1;overflow-y:auto;padding:6px 10px 20px;display:flex;flex-direction:column;gap:8px}
.soc-scroll .note{font-size:12px;font-weight:700;color:var(--ink-2);padding:2px 4px}
.chat-top{display:flex;justify-content:space-between;align-items:center;padding:4px 14px;font-size:12.5px;color:var(--ink-2);font-weight:700}
.chat-top b{font-family:var(--f-d);font-weight:400;font-size:15px;color:var(--ink)}
.chat-log{flex:1;overflow-y:auto;padding:4px 10px 8px;display:flex;flex-direction:column;gap:8px}
.cm{display:flex;gap:7px;align-items:flex-start}
.cm .av{width:38px;height:38px;border-radius:50%;object-fit:cover;background:var(--paper-2);box-shadow:0 0 0 2px #fff,0 2px 0 var(--paper-line);flex:none}
.cm .avb{padding:0;flex:none;border-radius:50%}
.cm .bub{max-width:76%;min-width:0}
.cm .bub b{display:block;font-size:11.5px;color:var(--ink-2);font-weight:700;margin:0 0 2px 4px}
.cm .bub b small{font-weight:600;color:var(--ink-3);margin-left:4px}
.cm .bub p{margin:0;padding:7px 11px;border-radius:4px 14px 14px 14px;background:var(--paper);box-shadow:0 2px 0 var(--paper-line);font-size:13.5px;line-height:1.5;font-weight:600;word-break:break-word}
.cm.me{flex-direction:row;justify-content:flex-end}.cm.me .bub{text-align:right}
.cm.me .bub p{border-radius:14px 4px 14px 14px;background:linear-gradient(#ffe3a0,#ffc860);text-align:left;display:inline-block}
.cm.sys{justify-content:center}.cm.sys span{padding:3px 12px;border-radius:999px;background:linear-gradient(90deg,transparent,rgba(255,200,70,.55),transparent);font-size:12px;font-weight:800;color:#8a5a10;text-align:center}
.vtag{font-style:normal;margin-left:4px;padding:0 5px;border-radius:999px;background:linear-gradient(#5b3d8a,#3a2560);color:#ffe27a;font-size:10px;font-weight:800}
.chat-bar{display:flex;gap:8px;padding:8px 10px calc(8px + env(safe-area-inset-bottom,0px));background:rgba(255,247,226,.9);box-shadow:0 -2px 8px rgba(60,36,12,.2)}
.chat-bar input{flex:1;min-width:0;height:40px;border-radius:14px;border:0;padding:0 12px;font:600 14px var(--f-b);background:#fff;box-shadow:inset 0 0 0 2px var(--paper-line);color:var(--ink)}
.prow{position:relative;display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:16px;background:var(--paper);box-shadow:0 3px 0 var(--paper-line);text-align:left;width:100%}
.prow .av,.arow .av{width:44px;height:44px;border-radius:50%;object-fit:cover;background:var(--paper-2);box-shadow:0 0 0 2px #fff;flex:none}
.prow .dot{position:absolute;left:44px;top:38px;width:12px;height:12px;border-radius:50%;background:#b8b0a0;box-shadow:0 0 0 2px #fff}.prow .dot.on{background:#3fcf5a}
.prow .who,.arow .who{flex:1;min-width:0}
.prow .who b,.arow .who b{color:var(--ink);display:block;font-family:var(--f-d);font-weight:400;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prow .who small,.arow .who small{color:var(--ink-2);display:block;font-size:11px;font-weight:700;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prow .pw,.arow .rt{text-align:right;font-size:11px;color:var(--ink-2);font-weight:700}.prow .pw b,.arow .rt b{display:block;font-family:var(--f-d);font-weight:400;font-size:16px;color:var(--ink)}
.vbtn{padding:4px 12px;border-radius:999px;background:var(--paper-2);box-shadow:inset 0 0 0 2px var(--paper-line);font-size:12px;font-weight:800;color:var(--ink-3);flex:none}.vbtn.ok{background:var(--green);color:#fff;box-shadow:0 2px 0 var(--green-d)}.vbtn.me{background:var(--orange);color:#fff}
.arena-me .col{display:flex;flex-direction:column;align-items:flex-end;gap:6px}.arena-me .left{font-size:12px;font-weight:800;color:var(--ink-2)}.arena-me .left b{font-family:var(--f-d);font-size:18px;color:var(--orange-d)}
.arena-me h3 small{font-family:var(--f-b);font-size:12px;color:var(--orange-d);font-weight:800;margin-left:6px}
.arena-me p{margin:2px 0 6px;font-size:12.5px;font-weight:700;color:var(--ink-2)}
.alogs{margin-top:6px;display:grid;gap:3px}.alog{display:grid;grid-template-columns:44px 20px 1fr 36px;gap:6px;font-size:11.5px;font-weight:700}.alog.w b{color:var(--green-d)}.alog.l b{color:var(--red)}.alog em{font-style:normal;text-align:right}
.arow{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:16px;background:var(--paper);box-shadow:0 3px 0 var(--paper-line)}
.arow.me{background:linear-gradient(#fff3c4,#ffe08a);box-shadow:0 3px 0 #d9a63a}
.arow .rk{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-family:var(--f-d);font-size:14px;background:var(--paper-2);box-shadow:inset 0 0 0 2px var(--paper-line);flex:none}
.arow .rk.r1{background:linear-gradient(#ffe27a,#f0a62e);color:#5a2a05}.arow .rk.r2{background:linear-gradient(#f0f0f6,#b8bcc8)}.arow .rk.r3{background:linear-gradient(#f0c8a0,#c88a58)}
.npcd .av.lg{width:58px;height:58px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 3px var(--c),0 2px 0 rgba(0,0,0,.2)}
.npcd .bio{margin:8px 0;font-size:13px;line-height:1.6;font-weight:700;color:var(--ink-2)}
.npcd .npcstat{display:flex;justify-content:space-between;gap:6px;font-size:12px;font-weight:700;color:var(--ink-2)}.npcd .npcstat b{font-family:var(--f-d);font-weight:400;font-size:16px;color:var(--ink);margin-left:3px}
.npcline{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:10px}
.npcline .m{position:relative;aspect-ratio:1;border-radius:12px;background:var(--paper-2);box-shadow:inset 0 0 0 2px var(--paper-line);overflow:hidden}
.npcline .m.ur{box-shadow:inset 0 0 0 2px var(--r-ur)}.npcline .m.ssr{box-shadow:inset 0 0 0 2px var(--r-ssr)}.npcline .m.sp{box-shadow:inset 0 0 0 2px #ff6ad0,0 0 8px rgba(255,106,208,.7)}
.npcline .m img{width:100%;height:100%;object-fit:cover}.npcline .m em{position:absolute;left:0;right:0;bottom:0;text-align:center;font-style:normal;font-size:9.5px;font-weight:800;background:rgba(43,28,16,.7);color:#fff6dc}
`;
