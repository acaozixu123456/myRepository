// 征战：章节页签 + 关卡地图 + 关卡详情。
import { CHAPTERS } from '../../content/campaign';
import type { RewardDef, StageDef } from '../../content/types';
import { FACTIONS } from '../../data/factions';
import { unitInfo } from '../../data/units';
import { applyGain, getStage, nextStage, recommendedPowerOf, stageOrdinal } from '../../game/stage';
import { teamPower } from '../../game/state';
import { TOWER_FLOORS, towerBest, towerClear, towerFaction, towerFloor, towerReward } from '../../game/tower';
import { DAILY_TRIES, DUNGEONS, DUNGEON_BY_ID, TIERS, dungeonLeft, dungeonReward, dungeonStage, dungeonStart, dungeonSweep, dungeonWin, ensureDungeon, tierUnlocked } from '../../game/dungeon';
import type { DungeonId } from '../../game/dungeon';
import { ATTEMPTS_PER_DAY, MILESTONES, attemptsLeft, bossBoard, bossLevel, bossOfWeek, bossStage, claimMilestone, claimable, ensureBoss, finishAttempt, startAttempt } from '../../game/worldboss';
import { artUrl } from '../../ui/art';
import { chip, esc, fmt } from '../../ui/components';
import { icon } from '../../ui/icons';
import type { AppCtx } from '../ctx';
import { topbar } from './lineup';

export const campaignState = { chapter: 0, sheet: '', mode: 'main' as 'main' | 'tower' | 'dungeon' | 'boss', dtier: { fish: 1, exp: 1, catnip: 1 } as Record<DungeonId, number> };

const best = (ctx: AppCtx) => ctx.s.best ?? ctx.s.stage;
const bestOrd = (ctx: AppCtx) => stageOrdinal(best(ctx).chapter, best(ctx).index);

type NodeState = 'done' | 'next' | 'locked';
function nodeState(ctx: AppCtx, c: number, i: number): NodeState {
  const o = stageOrdinal(c, i), b = bestOrd(ctx);
  return o <= b ? 'done' : o === b + 1 ? 'next' : 'locked';
}

const modeTabs = () => `<div class="seg" style="margin-bottom:2px"><button class="pill" data-act="cmode" data-m="main" aria-pressed="${campaignState.mode === 'main'}">主线</button><button class="pill" data-act="cmode" data-m="tower" aria-pressed="${campaignState.mode === 'tower'}">爬塔</button><button class="pill" data-act="cmode" data-m="dungeon" aria-pressed="${campaignState.mode === 'dungeon'}">秘境</button><button class="pill" data-act="cmode" data-m="boss" aria-pressed="${campaignState.mode === 'boss'}">Boss</button></div>`;

function towerHtml(ctx: AppCtx): string {
  const best = towerBest(ctx.s);
  const done = best >= TOWER_FLOORS;
  const n = Math.min(TOWER_FLOORS, best + 1);
  const st = towerFloor(n);
  const f = FACTIONS[towerFaction(n)];
  const kind = st.kind === 'boss' ? '守塔首领' : st.kind === 'elite' ? '精英' : '普通';
  const heads = st.waves[0].enemies.slice().sort((a, b) => a.pos - b.pos).map((e) => {
    const u = unitInfo(e.unit);
    return `<div class="eh ${u.isMob ? '' : 'hero'}"><img src="${artUrl(e.unit, 'head')}" alt="${esc(u.name)}" draggable="false"><em>Lv.${e.level}</em></div>`;
  }).join('');
  const rows: string[] = [];
  for (let i = Math.min(TOWER_FLOORS, n + 4); i >= Math.max(1, n - 3); i--) {
    const k = towerFloor(i).kind;
    const state = i <= best ? 'done' : i === n ? 'next' : 'locked';
    rows.push(`<div class="tfl ${state} ${k}"><b>${i}</b><span>${FACTIONS[towerFaction(i)].glyph}</span><em>${k === 'boss' ? '首领' : k === 'elite' ? '精英' : ''}</em><i>${state === 'done' ? icon('check', 18) : state === 'locked' ? icon('lock', 16) : icon('sword', 18)}</i></div>`);
  }
  return `
    ${modeTabs()}
    <div class="panel tnow">
      <div class="row"><span class="tag f" style="--c:${f.color}">${f.glyph}</span><b class="ttl">${done ? '登顶！' : `第 ${n} 层`}</b><span class="tag ${st.kind}">${kind}</span><div class="grow"></div><span class="muted prog">最高 ${best} / ${TOWER_FLOORS}</span></div>
      <div class="bar" style="margin:8px 0"><i style="width:${(best / TOWER_FLOORS) * 100}%"></i></div>
      ${done ? '<p class="intro">九命塔已经爬到了顶，猫猫们在塔尖晒起了太阳。</p>' : `<div class="heads" style="display:flex;gap:6px;margin:6px 0 8px">${heads}</div>
      <div class="rw"><b>首通</b>${rewardRow(towerReward(n))}</div>
      <p class="intro" style="margin-top:6px">每层只有首次通关有奖励；敌方阵营每 5 层轮换，别忘了阵营克制。</p>
      <div class="cfoot"><button class="btn green lg" data-act="tgo" data-n="${n}">挑战第 ${n} 层</button></div>`}
    </div>
    <div class="tcol">${rows.join('')}</div>`;
}

function dungeonHtml(ctx: AppCtx): string {
  const s = ctx.s;
  const st = ensureDungeon(s);
  const cards = DUNGEONS.map((d) => {
    const tier = campaignState.dtier[d.id];
    const left = dungeonLeft(s, d.id);
    const stage = dungeonStage(d.id, tier);
    const heads = stage.waves[0].enemies.map((e) => `<div class="eh"><img src="${artUrl(e.unit, 'head')}" alt="" draggable="false"><em>Lv.${e.level}</em></div>`).join('');
    const pills = Array.from({ length: TIERS }, (_, i) => i + 1).map((t) => `<button class="pill" data-act="dtier" data-d="${d.id}" data-t="${t}" aria-pressed="${t === tier}" ${tierUnlocked(s, t) ? '' : 'disabled'}>${tierUnlocked(s, t) ? '' : icon('lock', 13)}${t}${st.best[d.id] >= t ? icon('check', 13) : ''}</button>`).join('');
    const can = tierUnlocked(s, tier) && left > 0;
    const cleared = st.best[d.id] >= tier;
    return `<section class="panel dgn">
      <div class="row"><span class="dico">${icon(d.icon, 30)}</span><div class="grow"><b class="ttl">${d.name}</b><div class="muted" style="font-size:11.5px;font-weight:700">今日剩余 ${left} / ${DAILY_TRIES}</div></div></div>
      <p class="intro" style="margin:6px 0">${d.desc}</p>
      <div class="seg" style="margin:4px 0">${pills}</div>
      <div class="heads" style="display:flex;gap:6px;margin:6px 0">${heads}</div>
      <div class="rw"><b>通关</b>${rewardRow({ ...dungeonReward(d.id, tier), items: undefined })}</div>
      <div class="row" style="gap:8px;margin-top:8px"><button class="btn green" style="flex:1" data-act="dgo" data-d="${d.id}" ${can ? '' : 'disabled'}>${tierUnlocked(s, tier) ? '挑战' : '未解锁'}</button><button class="btn blue" style="flex:1" data-act="dsweep" data-d="${d.id}" ${can && cleared ? '' : 'disabled'}>扫荡</button></div>
    </section>`;
  }).join('');
  return `${modeTabs()}<p class="intro" style="margin:2px 4px 8px">秘境每天刷新次数；通关过的档位可以直接扫荡。档位随主线推进解锁。</p>${cards}`;
}

function bossHtml(ctx: AppCtx): string {
  const s = ctx.s, now = Date.now();
  const def = bossOfWeek(now), b = ensureBoss(s, now), left = attemptsLeft(s, now);
  const ready = claimable(s, now);
  const board = bossBoard(s, now);
  const myRank = board.findIndex((r) => r.me) + 1;
  const ms = MILESTONES.map((m, i) => {
    const done = b.claimed.includes(i);
    return `<div class="ms ${done ? 'done' : ready[i] ? 'ok' : ''}"><b>${m.bars} 条</b><small>${m.bells} 金铃铛 · ${m.paw} 猫爪印${m.tickets ? ` · ${m.tickets} 招福符` : ''}</small><button class="btn sm ${ready[i] ? 'green' : 'ghost'}" data-act="bclaim" data-i="${i}" ${ready[i] ? '' : 'disabled'}>${done ? '已领' : ready[i] ? '领取' : '未达'}</button></div>`;
  }).join('');
  return `${modeTabs()}<section class="panel wbs"><div class="row"><img class="bimg" src="${artUrl(def.hero, 'head')}" alt="" draggable="false"><div class="grow"><b class="ttl">${esc(def.title)}</b><div class="muted" style="font-size:11.5px;font-weight:700">本周 Boss · Lv.${bossLevel(s)} · 周一 05:00 换班</div></div></div>
    <p class="intro" style="margin:6px 0">${esc(def.desc)}</p>
    <p class="intro" style="margin:0 0 6px">每次挑战最多打 30 回合，按打掉的生命比例拿奖励；打满整条血也不会提前结束，快去试试。</p>
    <div class="row" style="gap:8px"><div class="grow">今日剩余 <b>${left}</b> / ${ATTEMPTS_PER_DAY}<br><small class="muted">本周累计 <b class="num">${b.bars.toFixed(2)}</b> 条 · 单次最高 ${Math.round(b.best * 100)}% · 排名第 ${myRank}</small></div>
    <button class="btn green" data-act="bgo" ${left > 0 ? '' : 'disabled'}>挑战</button></div></section>
    <section class="panel"><div class="note" style="font-weight:800;margin-bottom:4px">周累计里程碑</div>${ms}</section>
    <section class="panel"><div class="note" style="font-weight:800;margin-bottom:4px">本周伤害榜</div>${board.slice(0, 8).map((r, i) => `<div class="arow ${r.me ? 'me' : ''}"><i class="rk r${i + 1}">${i + 1}</i>${r.avatar ? `<img class="av" src="${artUrl(r.avatar, 'head')}" alt="" draggable="false">` : ''}<div class="who"><b>${esc(r.name)}</b></div><div class="rt"><em>累计</em><b class="num">${r.bars.toFixed(2)} 条</b></div></div>`).join('')}</section>`;
}

export function campaignHtml(ctx: AppCtx): string {
  if (campaignState.mode === 'boss') return `${topbar(ctx, '征战')}<div class="scroll">${bossHtml(ctx)}</div>`;
  if (campaignState.mode === 'dungeon') return `${topbar(ctx, '征战')}<div class="scroll">${dungeonHtml(ctx)}</div>`;
  if (campaignState.mode === 'tower') return `${topbar(ctx, '征战')}<div class="scroll">${towerHtml(ctx)}</div>`;
  const s = ctx.s;
  if (!campaignState.chapter) campaignState.chapter = best(ctx).chapter;
  const cn = campaignState.chapter;
  const ch = CHAPTERS[cn - 1];
  const b = best(ctx);
  const tabs = CHAPTERS.map((c) => {
    const locked = c.id > b.chapter + (b.index >= c.stages.length ? 1 : 0);
    return `<button class="pill" data-act="cchap" data-c="${c.id}" aria-pressed="${c.id === cn}" ${locked ? 'disabled' : ''}>${locked ? icon('lock', 14) : ''}第${c.id}章</button>`;
  }).join('');
  const done = ch.stages.filter((_, i) => nodeState(ctx, cn, i + 1) === 'done').length;
  const nodes = ch.stages.map((st, i) => {
    const idx = i + 1;
    const ns = nodeState(ctx, cn, idx);
    const farm = s.stage.chapter === cn && s.stage.index === idx;
    const glyph = ns === 'locked' ? icon('lock', 18) : ns === 'done' ? icon('check', 18) : `<b>${idx}</b>`;
    return `<button class="cnode ${st.kind} ${ns} ${farm ? 'farm' : ''}" data-act="cstage" data-id="${st.id}" aria-label="${st.id} ${esc(st.name)}">
      ${st.kind === 'boss' ? `<i class="crown">${icon('paw', 16)}</i>` : st.kind === 'elite' ? `<i class="crown">${icon('star', 14)}</i>` : ''}
      <span class="n">${ns === 'done' ? `<span class="idx">${idx}</span>` : ''}${glyph}</span>${farm ? '<em>挂机中</em>' : ''}</button>`;
  }).join('');
  const f = FACTIONS[ch.focusFactions[0]];
  return `
  ${topbar(ctx, '征战')}
  <div class="scroll">
    ${modeTabs()}
    <div class="seg">${tabs}</div>
    <div class="panel chintro">
      <div class="row"><span class="tag f" style="--c:${f.color}">${f.glyph}</span><b class="ttl">第${cn}章 · ${esc(ch.name)}</b><div class="grow"></div><span class="muted prog">${done} / ${ch.stages.length}</span></div>
      <div class="bar" style="margin:8px 0"><i style="width:${(done / ch.stages.length) * 100}%"></i></div>
      <p class="intro">${esc(ch.intro)}</p>
    </div>
    <div class="cmap">${nodes}</div>
  </div>`;
}

function rewardRow(r: RewardDef): string {
  const parts: string[] = [];
  if (r.fish) parts.push(`<span>${icon('fish', 18)}${fmt(r.fish)}</span>`);
  if (r.bells) parts.push(`<span>${icon('bells', 18)}${fmt(r.bells)}</span>`);
  if (r.exp) parts.push(`<span>${icon('spark', 18)}${fmt(r.exp)}</span>`);
  for (const it of r.items ?? []) parts.push(`<span>${icon(it.id.startsWith('catnip') ? 'catnip' : it.id.startsWith('recruit') ? 'ticket' : 'gift', 18)}×${it.count}</span>`);
  return parts.join('');
}

export function stageSheetHtml(ctx: AppCtx, id: string): string {
  const [c, i] = id.split('-').map(Number);
  const st = getStage(c, i) as StageDef;
  const ch = CHAPTERS[c - 1];
  const ns = nodeState(ctx, c, i);
  const rec = recommendedPowerOf(c, i);
  const power = teamPower(ctx.s);
  const farm = ctx.s.stage.chapter === c && ctx.s.stage.index === i;
  const kind = st.kind === 'boss' ? '首领' : st.kind === 'elite' ? '精英' : '普通';
  const waves = st.waves.map((w, wi) => `<div class="cwave"><span class="wl">第${wi + 1}波</span><div class="heads">${[...w.enemies].sort((a, b) => a.pos - b.pos).map((e) => {
    const u = unitInfo(e.unit);
    return `<div class="eh ${u.isMob ? '' : 'hero'}" title="${esc(u.name)}"><img src="${artUrl(e.unit, 'head')}" alt="${esc(u.name)}" draggable="false"><em>Lv.${e.level}</em></div>`;
  }).join('')}</div></div>`).join('');
  const action = ns === 'locked'
    ? `<button class="btn lg" disabled>先通关前面的关卡</button>`
    : ns === 'next'
      ? `<button class="btn green lg" data-act="cgo" data-id="${st.id}">挑战 ${st.id}</button>`
      : farm
        ? `<button class="btn lg" disabled>正在这里挂机</button>`
        : `<button class="btn blue lg" data-act="cfarm" data-id="${st.id}">在此挂机</button>`;
  return `<div class="mask" data-act="sheetmask"><div class="sheet cstagesheet" data-id="${st.id}">
    <div class="row"><b class="ttl">${st.id} ${esc(st.name)}</b><span class="tag ${st.kind}">${kind}</span><div class="grow"></div>${chip('sword', fmt(rec))}</div>
    <div class="muted" style="font-size:12px;margin:2px 0 8px;font-weight:700">${esc(ch.name)} · 我方战力 <b class="${power < rec * 0.9 ? 'bad' : ''}">${fmt(power)}</b></div>
    ${st.rule ? `<div class="crule">${icon('spark', 16)}${esc(st.rule)}</div>` : ''}
    <h3 class="sh">敌方阵容</h3>${waves}
    <h3 class="sh">${ns === 'done' ? '挂机奖励（单次）' : '奖励'}</h3>
    <div class="rw"><b>战斗</b>${rewardRow(st.rewards)}</div>
    ${ns !== 'done' ? `<div class="rw"><b>首通</b>${rewardRow(st.firstClear)}</div>` : ''}
    <div class="cfoot">${action}</div>
  </div></div>`;
}

export function handleCampaign(ctx: AppCtx, act: string, el: HTMLElement): boolean {
  switch (act) {
    case 'cmode': campaignState.mode = el.dataset.m as typeof campaignState.mode; ctx.refresh(); return true;
    case 'dtier': campaignState.dtier[el.dataset.d as DungeonId] = Number(el.dataset.t); ctx.refresh(); return true;
    case 'dsweep': {
      const id = el.dataset.d as DungeonId;
      const r = dungeonSweep(ctx.s, id, campaignState.dtier[id]);
      if (!r.ok) { ctx.toast(r.reason); return true; }
      ctx.save(); ctx.toast(`扫荡完成：${[r.gain.fish && `${fmt(r.gain.fish)} 小鱼干`, r.gain.exp && `${fmt(r.gain.exp)} 经验`, r.gain.catnip && `${r.gain.catnip} 猫薄荷`].filter(Boolean).join('、')}`);
      ctx.refresh();
      return true;
    }
    case 'dgo': {
      const id = el.dataset.d as DungeonId;
      const tier = campaignState.dtier[id];
      const r = dungeonStart(ctx.s, id, tier);
      if (!r.ok) { ctx.toast(r.reason ?? ''); return true; }
      ctx.save(); ctx.go('home'); ctx.toast(`进入${DUNGEON_BY_ID[id].name}`);
      void ctx.loop.runCustom(dungeonStage(id, tier), id === 'fish' ? 4 : id === 'exp' ? 6 : 5).then((win) => {
        if (win === null) return;
        if (win) {
          const g = dungeonWin(ctx.s, id, tier);
          ctx.save();
          ctx.result({ win: true, title: `${DUNGEON_BY_ID[id].name} · ${tier} 档`, gain: g, again: { act: 'nav', label: '回秘境', data: { to: 'campaign' } } });
        } else ctx.result({ win: false, title: `${DUNGEON_BY_ID[id].name} · ${tier} 档`, hint: '这一档的守卫更强。升级升星，或者先挑低一档，通关过的档位还能直接扫荡。' });
        campaignState.mode = 'dungeon';
        ctx.refresh();
      });
      return true;
    }
    case 'bgo': {
      const r = startAttempt(ctx.s);
      if (!r.ok) { ctx.toast(r.reason ?? ''); return true; }
      const def = bossOfWeek();
      ctx.save(); ctx.go('home'); ctx.toast(`挑战 ${def.title}`);
      void ctx.loop.runCustom(bossStage(ctx.s), def.theme).then((win) => {
        if (win === null) return;
        const res = finishAttempt(ctx.s, ctx.loop.customDamagePct);
        ctx.save();
        ctx.result({ win: true, banner: `打掉 ${Math.round(res.pct * 100)}%`, title: `${def.title}`, hint: `累计伤害已计入周榜：+${fmt(res.fish)} 小鱼干、${res.catnip} 猫薄荷、${res.paw} 猫爪印。累计达到里程碑记得回来领周奖。`, again: { act: 'nav', label: '回 Boss', data: { to: 'campaign' } } });
        campaignState.mode = 'boss';
        ctx.refresh();
      });
      return true;
    }
    case 'bclaim': {
      const r = claimMilestone(ctx.s, Number(el.dataset.i));
      if (!r.ok) { ctx.toast(r.reason); return true; }
      ctx.save(); ctx.toast(`领到 ${r.m.bells} 金铃铛、${r.m.paw} 猫爪印${r.m.tickets ? `、${r.m.tickets} 招福符` : ''}`); ctx.refresh();
      return true;
    }
    case 'tgo': {
      const n = Number(el.dataset.n);
      ctx.go('home');
      ctx.toast(`挑战第 ${n} 层`);
      void ctx.loop.runCustom(towerFloor(n), 1 + (Math.floor((n - 1) / 5) % 6)).then((win) => {
        if (win === null) return;
        if (win) {
          const r = towerClear(ctx.s, n);
          if (r) { applyGain(ctx.s, { fish: r.fish ?? 0, exp: r.exp ?? 0, bells: r.bells ?? 0, catnip: 0 }); for (const it of r.items ?? []) if (it.id.startsWith('catnip')) ctx.s.res.catnip += it.count * (it.id.endsWith('large') ? 16 : it.id.endsWith('medium') ? 4 : 1); }
          ctx.save();
          ctx.result({ win: true, title: `爬塔 第 ${n} 层`, gain: r ? { fish: r.fish, exp: r.exp, bells: r.bells, catnip: (r.items ?? []).reduce((a, it) => a + it.count * (it.id.endsWith('large') ? 16 : it.id.endsWith('medium') ? 4 : 1), 0) } : undefined, hint: r ? undefined : '这层已经通关过啦，没有额外奖励。', again: n < TOWER_FLOORS ? { act: 'tgo', label: '下一层', data: { n: String(n + 1) } } : undefined });
        } else ctx.result({ win: false, title: `爬塔 第 ${n} 层`, hint: `第 ${n} 层的${FACTIONS[towerFaction(n)].name}猫猫太强了。升级、换阵容，或者用克制阵营再来。` });
        ctx.refresh();
      });
      return true;
    }
    case 'cchap': campaignState.chapter = Number(el.dataset.c); ctx.refresh(); return true;
    case 'cstage': {
      closeStageSheet(ctx);
      ctx.root.insertAdjacentHTML('beforeend', stageSheetHtml(ctx, el.dataset.id!));
      return true;
    }
    case 'cgo': {
      closeStageSheet(ctx);
      ctx.go('home');
      ctx.loop.challenge();
      return true;
    }
    case 'cfarm': {
      const [c, i] = el.dataset.id!.split('-').map(Number);
      ctx.s.stage = { chapter: c, index: i, wins: 0 };
      ctx.save();
      closeStageSheet(ctx);
      ctx.go('home');
      ctx.loop.restart();
      ctx.toast(`已转到 ${c}-${i} 挂机`);
      return true;
    }
  }
  return false;
}
export function closeStageSheet(ctx: AppCtx) {
  ctx.root.querySelectorAll('.cstagesheet').forEach((e) => (e.closest('.mask') as HTMLElement | null)?.remove());
}
export { nextStage };

export const CAMPAIGN_CSS = `
.chintro .ttl{font-family:var(--f-d);font-weight:400;font-size:18px}
.chintro .prog{font-weight:800;font-size:13px}
.chintro .intro{margin:0;font-size:12.5px;line-height:1.65;color:var(--ink-2)}
.cmap{display:grid;grid-template-columns:repeat(4,1fr);gap:16px 10px;margin-top:14px;padding:14px 8px 18px;border-radius:20px;background:linear-gradient(rgba(255,248,226,.55),rgba(255,248,226,.3));box-shadow:inset 0 0 0 2px rgba(255,255,255,.6)}
.cnode{position:relative;justify-self:center;width:66px;height:66px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--f-d);font-size:22px;color:#fff;background:linear-gradient(#b6aa96,#9a8e7a);box-shadow:0 5px 0 #7d725f,inset 0 0 0 3px rgba(255,255,255,.35)}
.cnode .n{display:flex;align-items:center;justify-content:center;position:relative}
.cnode .n b{font-weight:400}
.cnode .n .idx{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);opacity:0}
.cnode.done{background:linear-gradient(#a7dc7a,#6fb24b);box-shadow:0 5px 0 #4f8a35,inset 0 0 0 3px rgba(255,255,255,.4)}
.cnode.next{background:linear-gradient(#ffd27a,#f0a22e);box-shadow:0 5px 0 var(--orange-d),inset 0 0 0 3px rgba(255,255,255,.55);animation:cpulse 1.4s infinite}
.cnode.elite{border-radius:18px;transform:rotate(0)}
.cnode.boss{width:76px;height:76px;border-radius:24px;grid-column:span 4;justify-self:center;margin-top:4px;background:linear-gradient(#c995e8,#8f5fc0);box-shadow:0 5px 0 #623c8a,inset 0 0 0 3px rgba(255,255,255,.4)}
.cnode.boss.locked{background:linear-gradient(#b6aa96,#9a8e7a);box-shadow:0 5px 0 #7d725f,inset 0 0 0 3px rgba(255,255,255,.35)}
.cnode.boss.done{background:linear-gradient(#a7dc7a,#6fb24b);box-shadow:0 5px 0 #4f8a35,inset 0 0 0 3px rgba(255,255,255,.4)}
.cnode .crown{position:absolute;top:-10px;left:50%;transform:translateX(-50%);width:26px;height:20px;border-radius:999px;background:#fff6dc;color:var(--orange-d);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 0 rgba(0,0,0,.25)}
.cnode em{position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);white-space:nowrap;font-style:normal;font-family:var(--f-b);font-weight:900;font-size:10.5px;padding:1px 8px;border-radius:999px;background:var(--wood-2);color:#fff6dc}
.cnode.farm{outline:3px solid #fff;outline-offset:2px}
@keyframes cpulse{50%{transform:scale(1.07)}}
.cstagesheet .ttl{font-family:var(--f-d);font-weight:400;font-size:20px}
.cstagesheet .tag.boss{background:#8f5fc0;color:#fff}.cstagesheet .tag.elite{background:#e09a3a;color:#fff}
.cstagesheet .bad{color:var(--red)}
.crule{display:flex;gap:6px;align-items:center;padding:6px 10px;border-radius:12px;background:#fff0c9;box-shadow:inset 0 0 0 2px #f0d58a;font-size:12.5px;font-weight:800;color:#8a5a12;margin-bottom:6px}
.cstagesheet .sh{margin:12px 0 6px;font-family:var(--f-d);font-weight:400;font-size:16px}
.cwave{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.cwave .wl{flex:none;width:44px;font-size:11.5px;font-weight:800;color:var(--ink-2)}
.cwave .heads{display:flex;gap:6px;flex-wrap:wrap}
.eh{position:relative;width:46px;height:46px;border-radius:13px;overflow:hidden;background:linear-gradient(#fff3d6,#f3dcae);box-shadow:0 0 0 2px #b99a6a}
.eh.hero{box-shadow:0 0 0 2.5px var(--r-ssr)}
.eh img{width:100%;height:100%;object-fit:cover;display:block}
.eh em{position:absolute;left:0;right:0;bottom:0;font-style:normal;font-size:9.5px;font-weight:900;text-align:center;color:#fff;background:rgba(43,28,16,.72);line-height:12px}
.cstagesheet .rw{display:flex;align-items:center;gap:12px;padding:6px 0;font-weight:800;font-size:14px;border-bottom:1px dashed var(--paper-line)}
.cstagesheet .rw b{width:40px;font-size:12px;color:var(--ink-2)}
.cstagesheet .rw span{display:inline-flex;align-items:center;gap:3px}
.tnow .ttl{font-family:var(--f-d);font-weight:400;font-size:20px}
.tnow .prog{font-weight:800;font-size:13px}
.tnow .intro{margin:0;font-size:12.5px;line-height:1.6;color:var(--ink-2)}
.tnow .rw{display:flex;align-items:center;gap:12px;font-weight:800;font-size:14px}.tnow .rw b{font-size:12px;color:var(--ink-2)}.tnow .rw span{display:inline-flex;align-items:center;gap:3px}
.tcol{margin-top:14px;display:grid;gap:8px}
.tfl{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:16px;background:rgba(255,248,226,.6);box-shadow:inset 0 0 0 2px rgba(255,255,255,.6),0 3px 0 rgba(95,143,67,.3);font-weight:800}
.tfl b{font-family:var(--f-d);font-weight:400;font-size:22px;width:48px}
.tfl span{width:30px;height:30px;border-radius:50%;background:var(--ink-2);color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--f-d)}
.tfl em{font-style:normal;font-size:12px;color:#8f5fc0;flex:1}
.tfl.done{opacity:.7}.tfl.done i{color:#4f8a35}
.tfl.next{background:linear-gradient(#ffe3a6,#ffd27a);box-shadow:0 4px 0 var(--orange-d),inset 0 0 0 2px rgba(255,255,255,.7)}
.tfl.locked{opacity:.55}.tfl.boss{box-shadow:inset 0 0 0 2.5px #b58bdf,0 3px 0 rgba(95,143,67,.3)}
.cfoot{margin-top:14px;display:flex}.cfoot .btn{flex:1}
`;
