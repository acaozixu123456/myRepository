import { HERO_BY_ID } from '../heroes';
import type { Kit } from '../../engine/types';
import { dmg, enemy, heal, ally } from './helpers';
import { KITS_UR } from './ur';
import { KITS_SSR } from './ssr';

export const KITS: Record<string, Kit> = { ...KITS_UR, ...KITS_SSR };

/** 没有手工设计技能组的猫猫（以及杂兵）使用的通用技能组，保证战斗引擎可以跑任何阵容 */
export function genericKit(heroId: string): Kit {
  const h = HERO_BY_ID[heroId];
  const role = h?.role ?? '先锋';
  const melee = role === '守护' || role === '先锋' || role === '刺客';
  const healer = role === '医者';
  return {
    heroId,
    basic: healer
      ? { id: 'g_basic', name: '抚爪', fx: 'heal.touch', target: ally('lowestHpPct'), effects: [heal(1.1)], desc: '治疗生命最低的友方。' }
      : { id: 'g_basic', name: '挥爪', fx: melee ? 'melee.slash' : 'ranged.bolt', melee, target: enemy('front'), effects: [dmg(1.15, { elem: role === '谋士' ? 'magic' : 'phys' })], desc: '普通攻击。' },
    ultimate: healer
      ? { id: 'g_ult', name: '呼噜大法', fx: 'ult.generic', target: ally('all'), effects: [heal(1.4)], desc: '治疗全体友方。' }
      : { id: 'g_ult', name: '绝招', fx: 'ult.generic', melee, target: role === '守护' ? enemy('front') : enemy('all'), effects: [dmg(role === '守护' ? 2.4 : 1.7, { elem: role === '谋士' ? 'magic' : 'phys' })], desc: '对敌方造成大量伤害。' },
    passive: { id: 'g_passive', name: '本能', desc: '无。', passive: [] },
    awaken: { A: { name: '觉醒', desc: '无', patches: [] }, B: { name: '觉醒', desc: '无', patches: [] } },
  };
}
