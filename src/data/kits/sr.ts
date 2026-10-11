// 首批剩余十二只的手工技能组，按同伴小组拆分；其中也包含 SSR。
import type { Kit } from '../../engine/types';
import { KITS_WEI_WU } from './remaining-wei-wu';
import { KITS_WU_QUN_MAN } from './remaining-wu-qun-man';
import { KITS_MAN_XIAN } from './remaining-man-xian';

export const KITS_SR: Record<string, Kit> = {
  ...KITS_WEI_WU,
  ...KITS_WU_QUN_MAN,
  ...KITS_MAN_XIAN,
};
