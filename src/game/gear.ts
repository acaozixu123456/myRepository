// 装备对战斗的贡献：单件面板 + 二 / 四件套面板 + 四件套特效 id。纯函数，不依赖 DOM。
import { EQUIPS, EQUIP_SETS } from '../content/equipment';
import type { StatBlock, StatKey } from '../content/types';
import { equipmentStats } from './inventory';
import type { PlayerState } from './state';

const SET_BY_ID = new Map(EQUIP_SETS.map((x) => [x.id, x]));
const EQUIP_BY_ID = new Map(EQUIPS.map((x) => [x.id, x]));

export interface HeroGear {
  stats: StatBlock; // 已含套装面板
  set4: string[]; // 凑齐四件的套装（特殊效果由引擎实现）
  setCounts: Record<string, number>;
}

const EMPTY: HeroGear = { stats: {}, set4: [], setCounts: {} };

function add(into: StatBlock, from: StatBlock) {
  for (const k of Object.keys(from) as StatKey[]) into[k] = (into[k] ?? 0) + (from[k] ?? 0);
}

export function heroGear(s: PlayerState, heroId: string): HeroGear {
  const items = s.inventory?.equipment.filter((e) => e.heroId === heroId);
  if (!items?.length) return EMPTY;
  const stats: StatBlock = {};
  const setCounts: Record<string, number> = {};
  for (const it of items) {
    add(stats, equipmentStats(it));
    const sid = EQUIP_BY_ID.get(it.equipId)?.setId;
    if (sid) setCounts[sid] = (setCounts[sid] ?? 0) + 1;
  }
  const set4: string[] = [];
  for (const [sid, n] of Object.entries(setCounts)) {
    const set = SET_BY_ID.get(sid);
    if (!set) continue;
    if (n >= 2) add(stats, set.bonus2.stats);
    if (n >= 4) { add(stats, set.bonus4.stats); set4.push(sid); }
  }
  return { stats, set4, setCounts };
}
