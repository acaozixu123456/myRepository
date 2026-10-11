import { FACTIONS } from '../data/factions';
import { HERO_BY_ID } from '../data/heroes';
import type { HeroState } from '../game/state';
import { artImg } from './art';
import { ROLE_ICON, icon } from './icons';

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export const fmt = (n: number) => (n >= 100000 ? `${(n / 1000).toFixed(n >= 1e6 ? 0 : 1)}k` : Math.floor(n).toLocaleString('en-US'));

export function stars(n: number, max = 5, size = 12) {
  return Array.from({ length: max }, (_, i) => icon(i < n ? 'star' : 'starOff', size)).join('');
}

export interface CardOpts {
  state?: HeroState | null; // null = 未拥有
  owned?: boolean;
  badge?: string;
  act?: string; // data-act
  id?: string;
  lvText?: string;
}
/** 英雄卡牌（立绘 + 稀有度边框 + 阵营徽章 + 职业） */
export function heroCard(heroId: string, o: CardOpts = {}): string {
  const h = HERO_BY_ID[heroId];
  const f = FACTIONS[h.faction];
  const st = o.state;
  const off = o.owned === false || st === null;
  return `<button class="hcard${off ? ' off' : ''}" data-r="${h.rarity}" style="--c:${f.color}" ${o.act ? `data-act="${o.act}" data-id="${heroId}"` : ''} aria-label="${h.name}">
    <div class="art"><span class="rar">${h.rarity}</span><span class="fg">${f.glyph}</span>${artImg(heroId, 'card')}<span class="role">${icon(ROLE_ICON[h.role], 16)}</span></div>
    ${st && !off ? `<div class="stars">${stars(st.star, 5, 11)}</div>` : ''}
    ${o.badge ? `<span class="badge">${o.badge}</span>` : ''}
    <div class="info"><b>${h.name}</b><span class="lv">${off ? '未获得' : o.lvText ?? (st ? `Lv.${st.lv}` : '')}</span></div>
  </button>`;
}

export const chip = (iconName: string, value: string | number, extra = '') => `<span class="chip">${icon(iconName, 22)}<span class="num">${typeof value === 'number' ? fmt(value) : value}</span>${extra}</span>`;
