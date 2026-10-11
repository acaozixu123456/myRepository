// 图鉴：全部猫猫一览，未获得的置灰；点开看设定（获得后才解锁背景故事与台词）。
import { FACTIONS, FACTION_ORDER } from '../../data/factions';
import type { FactionId } from '../../data/factions';
import { HEROES, HERO_BY_ID } from '../../data/heroes';
import { artImg } from '../../ui/art';
import { esc, heroCard } from '../../ui/components';
import { ROLE_ICON, icon } from '../../ui/icons';
import type { AppCtx } from '../ctx';

export const dexState = { faction: 'all' as 'all' | FactionId };

export function dexHtml(ctx: AppCtx): string {
  const s = ctx.s;
  const list = HEROES.filter((h) => dexState.faction === 'all' || h.faction === dexState.faction);
  const owned = HEROES.filter((h) => s.heroes[h.id]).length;
  const tabs = ['all' as const, ...FACTION_ORDER].map((f) => `<button class="pill ${f === 'all' ? '' : 'glyph'}" ${f === 'all' ? '' : `style="--c:${FACTIONS[f].color}"`} data-act="dexf" data-f="${f}" aria-pressed="${dexState.faction === f}">${f === 'all' ? '全部' : FACTIONS[f].glyph}</button>`).join('');
  return `<div class="mask" data-act="sheetmask"><div class="sheet dex">
    <div class="row"><b class="ttl">猫猫图鉴</b><span class="muted" style="font-weight:800;font-size:13px">${owned} / ${HEROES.length}</span><div class="grow"></div><button class="btn sm ghost" data-act="closesheetx">${icon('close', 16)}</button></div>
    <div class="seg" style="margin:8px 0 4px">${tabs}</div>
    <div class="roster">${list.map((h) => heroCard(h.id, { owned: !!s.heroes[h.id], state: s.heroes[h.id] ?? null, act: 'dexhero', lvText: h.title })).join('')}</div>
  </div></div>`;
}

export function dexHeroHtml(ctx: AppCtx, id: string): string {
  const h = HERO_BY_ID[id];
  const f = FACTIONS[h.faction];
  const own = !!ctx.s.heroes[id];
  return `<div class="mask center" data-act="closedialog"><div class="dialog dexhero" style="--c:${f.color}">
    <div class="pt ${own ? '' : 'off'}">${artImg(id, 'full')}</div>
    <div class="row" style="justify-content:center;gap:8px;margin-top:6px"><span class="tag f" style="--c:${f.color}">${f.glyph}</span><b class="ttl">${esc(h.name)}</b><span class="tag">${h.rarity}</span></div>
    <div class="muted" style="text-align:center;font-weight:800;font-size:12.5px;margin:3px 0 8px">${esc(h.title)} · ${icon(ROLE_ICON[h.role], 14)} ${h.role} · ${esc(h.breed)}</div>
    ${own ? `<p class="lore">${esc(h.lore)}</p><p class="quote">“${esc(h.quote)}”</p><p class="likes">喜欢：${esc(h.likes)}</p>` : `<p class="lore" style="text-align:center">还没有遇见这只猫。招募后会解锁它的故事和台词。</p>`}
    <div style="text-align:center;margin-top:10px"><button class="btn" data-act="closedialog">好的</button></div>
  </div></div>`;
}

export function handleDex(ctx: AppCtx, act: string, el: HTMLElement): boolean {
  switch (act) {
    case 'dex': ctx.root.insertAdjacentHTML('beforeend', dexHtml(ctx)); return true;
    case 'dexf': {
      dexState.faction = el.dataset.f as never;
      const sc = (ctx.root.querySelector('.sheet.dex') as HTMLElement | null)?.scrollTop ?? 0;
      ctx.root.querySelectorAll('.sheet.dex').forEach((e) => e.closest('.mask')?.remove());
      ctx.root.insertAdjacentHTML('beforeend', dexHtml(ctx));
      (ctx.root.querySelector('.sheet.dex') as HTMLElement).scrollTop = sc;
      return true;
    }
    case 'dexhero': ctx.root.insertAdjacentHTML('beforeend', dexHeroHtml(ctx, el.dataset.id!)); return true;
    case 'closesheetx': ctx.root.querySelectorAll('.sheet.dex').forEach((e) => e.closest('.mask')?.remove()); return true;
  }
  return false;
}

export const DEX_CSS = `
.sheet.dex{min-height:70%}
.sheet.dex .ttl{font-family:var(--f-d);font-weight:400;font-size:20px}
.dialog.dexhero{max-height:90%;overflow:auto;text-align:left}
.dialog.dexhero .pt{height:210px;border-radius:16px;background:radial-gradient(circle at 50% 70%,color-mix(in srgb,var(--c) 40%,#fff7e2),#efe2bf 78%);position:relative;overflow:hidden}
.dialog.dexhero .pt img{position:absolute;left:0;bottom:0;width:100%;height:100%;object-fit:contain;object-position:50% 100%}
.dialog.dexhero .pt.off img{filter:brightness(0) opacity(.45)}
.dialog.dexhero .ttl{font-family:var(--f-d);font-weight:400;font-size:22px}
.dialog.dexhero .lore{margin:0 0 8px;font-size:13px;line-height:1.7;font-weight:600}
.dialog.dexhero .quote{margin:0 0 6px;font-size:13.5px;font-weight:900;border-left:4px solid var(--c);padding-left:8px}
.dialog.dexhero .likes{margin:0;font-size:12px;color:var(--ink-2);font-weight:700}
`;
