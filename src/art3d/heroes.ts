// 英雄专属 3D 部件：只有需要「独一份」造型的猫才在这里加（通用的放 parts/）。
// 键是英雄 id，值按部件组覆盖：同一个 PartBuilder 契约（见 parts/types.ts）。
// 例：关云喵的青龙偃月刀、曹喵德的冕旒、诸葛喵亮的羽扇与纶巾。
import type { PartGroup } from './parts';
import type { PartBuilder } from './parts/types';
import { caomaoCrown, zhouyuCrown } from './parts/hero-ur-regalia';
import { liubeiDualSwords } from './parts/hero-ur-liu-swords';
import { lvbuHalberd, menghuoMace, zuociStaff } from './parts/hero-ur-weapons';

export const HERO_PARTS: Record<string, Partial<Record<PartGroup, PartBuilder>>> = {
  wei_caomiaode: { headgear: caomaoCrown },
  shu_liumiaobei: { weapon: liubeiDualSwords },
  wu_zhoumiaoyu: { headgear: zhouyuCrown },
  qun_lvbuding: { weapon: lvbuHalberd },
  man_mengmiaohuo: { weapon: menghuoMace },
  xian_zuoci: { weapon: zuociStaff },
};
