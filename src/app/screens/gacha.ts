import { FACTIONS } from '../../data/factions';
import { HEROES, HERO_BY_ID } from '../../data/heroes';
import type { Rarity } from '../../data/heroes';
import { COST, DUP_SHARDS, POOLS, pull, urRate } from '../../game/gacha';
import type { PoolDef, PullResult } from '../../game/gacha';
import { TOTAL_HEROES } from '../../game/state';
import { artUrl } from '../../ui/art';
import { chip, heroCard } from '../../ui/components';
import { icon } from '../../ui/icons';
import type { AppCtx } from '../ctx';
import { sfx } from '../sfx';
import { topbar } from './lineup';

export const gachaState = { pool: POOLS[0].id };
const pool = (): PoolDef => POOLS.find((p) => p.id === gachaState.pool) ?? POOLS[0];
const GLOW: Record<Rarity, string> = { UR: '#ffd24a', SSR: '#c08aff', SR: '#9bc4ff' };

export function gachaHtml(ctx: AppCtx): string {
  const s = ctx.s;
  const p = pool();
  const up = p.upHero ? HERO_BY_ID[p.upHero] : null;
  const showcase = up ? [up.id] : ['wei_caomiaode', 'shu_liumiaobei', 'qun_lvbuding'];
  const imgs = up
    ? `<img src="${artImgUrl(up.id)}" alt="${up.name}">`
    : showcase.map((id, i) => `<img style="height:${i === 1 ? 92 : 78}%;left:${[22, 50, 78][i]}%;z-index:${i === 1 ? 2 : 1}" src="${artImgUrl(id)}" alt="">`).join('');
  const need = (n: 1 | 10) => (s.res.tickets >= COST[n === 1 ? 'single' : 'ten'].tickets ? { ic: 'ticket', v: COST[n === 1 ? 'single' : 'ten'].tickets } : { ic: 'bells', v: COST[n === 1 ? 'single' : 'ten'].bells });
  const c1 = need(1), c10 = need(10);
  const ssrLeft = p.ssrPity - s.pity.ssr;
  const urLeft = p.urPity - s.pity.ur;
  return `
  ${topbar(ctx, '招募', chip('ticket', s.res.tickets))}
  <div class="scroll" style="padding:0 0 18px">
    <div class="banner"><div class="rays"></div>${imgs}${up ? `<span class="up">UR 概率 UP</span>` : `<span class="up" style="background:var(--r-ssr);color:#fff">全员可出</span>`}<div class="nm"><span>${up ? `${up.name} · ${up.title}` : '常驻招募'}</span></div></div>
    <div class="tabs">${POOLS.map((x) => `<button data-act="pool" data-id="${x.id}" aria-pressed="${x.id === p.id}">${x.name}</button>`).join('')}</div>
    <div class="pity">
      <div class="r"><span>SSR 保底</span><div class="bar"><i style="width:${(s.pity.ssr / p.ssrPity) * 100}%"></i></div><em class="num">${ssrLeft} 抽内</em></div>
      <div class="r"><span>UR 保底</span><div class="bar"><i style="width:${(s.pity.ur / p.urPity) * 100}%;background:linear-gradient(#ffe08a,#f0a62e)"></i></div><em class="num">${urLeft} 抽内</em></div>
      <div class="muted" style="font-size:11.5px;text-align:center;font-weight:700">本次 UR 概率 ${(urRate(p, s.pity.ur) * 100).toFixed(1)}%${s.pity.upLost ? ' · 下一只 UR 必为 UP' : ''} · <a data-act="dex" style="color:var(--blue-d);text-decoration:underline;cursor:pointer">图鉴 ${Object.keys(s.heroes).length}/${TOTAL_HEROES}</a></div>
    </div>
    <div class="pullbar">
      <button class="btn blue" data-act="pull1">招募 ×1<span class="cost">${icon(c1.ic, 16)}${c1.v}</span></button>
      <button class="btn lg" data-act="pull10">招募 ×10<span class="cost">${icon(c10.ic, 16)}${c10.v} · 必出 SSR</span></button>
    </div>
    <div class="note">${p.desc}<br>UR 1.5% · SSR 12% · SR 86.5% · <a data-act="rates">查看概率与保底说明</a></div>
  </div>`;
}

const artImgUrl = (id: string) => artUrl(id, 'full');

export function ratesDialog(ctx: AppCtx) {
  const p = pool();
  const list = (r: Rarity) => HEROES.filter((h) => h.rarity === r).map((h) => `<span class="tag f" style="--c:${FACTIONS[h.faction].color}">${h.name}</span>`).join(' ');
  ctx.root.insertAdjacentHTML('beforeend', `<div class="mask center" data-act="closedialog"><div class="dialog" style="max-height:86%;overflow:auto"><h3 class="title" style="margin:0 0 8px">概率说明</h3>
    <p style="font-size:13px;line-height:1.7;margin:0 0 6px"><b>UR 1.5%</b>：${p.urPity} 抽内必出，第 ${p.urSoftFrom} 抽起概率逐抽提高。${p.upHero ? `出 UR 时 50% 为 UP 猫猫，没出则下次必出。` : ''}</p>
    <p style="font-size:13px;line-height:1.7;margin:0 0 6px"><b>SSR 12%</b>：${p.ssrPity} 抽内必出 SSR 及以上；十连至少 1 个 SSR。</p>
    <p style="font-size:13px;line-height:1.7;margin:0 0 6px"><b>重复获得</b>：转化为碎片（SR ${DUP_SHARDS.SR} / SSR ${DUP_SHARDS.SSR} / UR ${DUP_SHARDS.UR}），用于升星。</p>
    <div style="line-height:2"><b>UR</b> ${list('UR')}</div><div style="line-height:2"><b>SSR</b> ${list('SSR')}</div><div style="line-height:2"><b>SR</b> ${list('SR')}</div>
    <div style="text-align:center;margin-top:12px"><button class="btn" data-act="closedialog">知道了</button></div></div></div>`);
}

// ---------------- 抽卡动画 ----------------
const BOX = `<svg viewBox="0 0 230 230" xmlns="http://www.w3.org/2000/svg"><defs>
  <linearGradient id="bx1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8c48a"/><stop offset="1" stop-color="#b8844a"/></linearGradient>
  <linearGradient id="bx2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0d4a0"/><stop offset="1" stop-color="#d3a468"/></linearGradient></defs>
  <ellipse cx="115" cy="212" rx="86" ry="12" fill="rgba(0,0,0,.35)"/>
  <rect x="34" y="92" width="162" height="116" rx="10" fill="url(#bx1)" stroke="#6a4420" stroke-width="5"/>
  <rect x="100" y="92" width="30" height="116" fill="#f3e2b4" opacity=".75"/>
  <path d="M34 112 L196 112" stroke="#9a6a34" stroke-width="3" opacity=".6"/>
  <path d="M34 60 L100 60 L100 92 L34 92 Z" class="flapL" fill="url(#bx2)" stroke="#6a4420" stroke-width="5" stroke-linejoin="round"/>
  <path d="M130 60 L196 60 L196 92 L130 92 Z" class="flapR" fill="url(#bx2)" stroke="#6a4420" stroke-width="5" stroke-linejoin="round"/>
  <ellipse cx="88" cy="148" rx="8" ry="11" fill="#2b1d22"/><ellipse cx="142" cy="148" rx="8" ry="11" fill="#2b1d22"/>
  <circle cx="85" cy="144" r="3" fill="#fff"/><circle cx="139" cy="144" r="3" fill="#fff"/>
  <path d="M109 162 L121 162 L115 170 Z" fill="#e0707a"/><path d="M115 170 Q106 180 98 174 M115 170 Q124 180 132 174" fill="none" stroke="#2b1d22" stroke-width="3" stroke-linecap="round"/>
  <path d="M60 164 L34 158 M60 170 L32 174 M170 164 L196 158 M170 170 L198 174" stroke="#6a4420" stroke-width="3" stroke-linecap="round"/>
  <text x="115" y="198" text-anchor="middle" font-size="14" font-weight="700" fill="#6a4420" font-family="ZCOOL KuaiLe, sans-serif">招福纸箱</text></svg>`;

function resultCard(ctx: AppCtx, r: PullResult, size = 'big') {
  const st = ctx.s.heroes[r.hero.id];
  void size;
  return heroCard(r.hero.id, { state: st, lvText: r.isNew ? '新获得' : `碎片 +${r.shards}` });
}

export async function doPull(ctx: AppCtx, n: 1 | 10) {
  const res = pull(ctx.s, pool(), n);
  if (!res.ok) return ctx.toast(res.reason);
  ctx.save();
  ctx.refresh();
  await playReveal(ctx, res.results, n);
}

function playReveal(ctx: AppCtx, results: PullResult[], n: 1 | 10): Promise<void> {
  return new Promise((done) => {
    const best: Rarity = results.some((r) => r.rarity === 'UR') ? 'UR' : results.some((r) => r.rarity === 'SSR') ? 'SSR' : 'SR';
    const el = document.createElement('div');
    el.className = 'reveal';
    el.style.setProperty('--glow', GLOW[best]);
    el.innerHTML = `<div class="rays"></div><div class="glowbox"></div><div class="boxwrap shake">${BOX}</div><div class="hint">点击纸箱，或稍等一下</div><div class="flash"></div><button class="btn sm ghost skip" data-r="skip">跳过</button>`;
    ctx.root.appendChild(el);
    sfx.rumble();
    let stage = 0;
    const timers: number[] = [];
    const later = (f: () => void, ms: number) => timers.push(window.setTimeout(f, ms));
    const showResults = async () => {
      if (stage >= 2) return;
      stage = 2;
      timers.forEach(clearTimeout);
      el.querySelector('.hint')?.remove();
      // UR 先来一段插入图
      for (const r of results.filter((x) => x.rarity === 'UR')) await urCut(ctx, el, r);
      el.querySelector('.boxwrap')?.remove();
      el.querySelector('.glowbox')?.remove();
      const body = document.createElement('div');
      if (n === 1) {
        const r = results[0];
        body.className = 'one';
        body.innerHTML = `<div class="big" style="--c:${FACTIONS[r.hero.faction].color}">${resultCard(ctx, r)}</div>${r.isNew ? '<span class="new">NEW!</span>' : ''}<div class="meta"><b>${r.hero.name}</b><span>${r.hero.title} · ${r.rarity}${r.isNew ? '' : ` · 重复，转化为碎片 +${r.shards}`}</span></div>`;
      } else {
        body.className = 'ten';
        body.innerHTML = `<div class="title" style="color:#fff6dc;font-size:24px">招募结果</div><div class="grid">${results.map((r, i) => `<div class="cell" data-r="${r.rarity}" style="animation-delay:${i * 0.11}s">${r.isNew ? '<span class="tagn">NEW</span>' : ''}${heroCard(r.hero.id, { state: ctx.s.heroes[r.hero.id] })}<span class="tagd">${r.isNew ? '' : `碎片+${r.shards}`}</span></div>`).join('')}</div>`;
      }
      el.appendChild(body);
      const bar = document.createElement('div');
      bar.className = 'okbar';
      bar.innerHTML = `<button class="btn blue" data-r="again">再抽${n === 10 ? '十次' : '一次'}</button><button class="btn lg" data-r="ok">确定</button>`;
      el.appendChild(bar);
    };
    const openBox = () => {
      if (stage >= 1) return;
      stage = 1;
      timers.forEach(clearTimeout);
      el.querySelector('.boxwrap')?.classList.remove('shake');
      el.classList.add('open', 'burst');
      sfx.burst();
      later(() => sfx.reveal(best), 260);
      el.querySelector('.glowbox')?.classList.add('on');
      const fl = el.querySelector('.flash') as HTMLElement;
      fl.classList.add('go');
      later(() => void showResults(), 620);
    };
    later(openBox, 1400);
    el.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-r]') as HTMLElement | null;
      const k = t?.dataset.r;
      if (k === 'skip') return void showResults();
      if (k === 'ok') { el.remove(); ctx.refresh(); done(); return; }
      if (k === 'again') { el.remove(); ctx.refresh(); done(); void doPull(ctx, n); return; }
      if (stage === 0) openBox();
    });
  });
}

function urCut(ctx: AppCtx, host: HTMLElement, r: PullResult): Promise<void> {
  return new Promise((res) => {
    const f = FACTIONS[r.hero.faction];
    const el = document.createElement('div');
    el.className = 'urcut';
    el.style.setProperty('--c', f.color);
    el.innerHTML = `<div class="band"><img src="${artImgUrl(r.hero.id)}" alt=""><div class="txt"><small>${r.hero.title}</small><b>${r.hero.name}</b><small>${f.full} · UR${r.isUp ? ' · UP' : ''}</small></div></div>`;
    host.appendChild(el);
    ctx.root.querySelector('.flash')?.classList.remove('go');
    const end = () => { el.remove(); res(); };
    el.addEventListener('click', end);
    setTimeout(end, 2200);
  });
}
