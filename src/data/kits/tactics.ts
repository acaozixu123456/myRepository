// 战技：每只英雄的「第四个技能」——普攻与绝技之间的小招，自己每 3 次行动放一次（第 2 次行动起）。
// 先用「职业 × 阵营」模板铺满全员（6 职业 × 6 阵营，各有名字与附带效果），个别英雄可在 BESPOKE 里换成专属战技。
import type { Effect, SkillDef, TargetSel } from '../../engine/types';
import type { FactionId } from '../factions';
import type { Role } from '../heroes';
import { unitInfo } from '../units';
import { ally, dmg, enemy, energy, self, status } from './helpers';

export const TACTIC_CD = 3;

const NAMES: Record<FactionId, Record<Role, string>> = {
  wei: { 守护: '铁壁军阵', 先锋: '玄甲突阵', 神射: '连弩齐发', 谋士: '军令如山', 医者: '军医疗伤', 刺客: '夜袭营帐' },
  shu: { 守护: '仁义之盾', 先锋: '五虎冲锋', 神射: '穿云箭', 谋士: '八阵连环', 医者: '桃园回春', 刺客: '七进七出' },
  wu: { 守护: '江东铁锁', 先锋: '锦帆突袭', 神射: '火矢连珠', 谋士: '赤壁引火', 医者: '江水润泽', 刺客: '锦帆夜渡' },
  qun: { 守护: '乱世硬骨', 先锋: '方天乱舞', 神射: '飞将连射', 谋士: '连环妙计', 医者: '悬壶妙手', 刺客: '暗影割喉' },
  man: { 守护: '藤甲盾阵', 先锋: '山林猛冲', 神射: '毒箭连发', 谋士: '图腾祝祷', 医者: '草药敷伤', 刺客: '丛林潜袭' },
  xian: { 守护: '结界护身', 先锋: '御剑突刺', 神射: '符箭连珠', 谋士: '天雷符咒', 医者: '仙露回春', 刺客: '遁甲暗袭' },
};
const ELEM: Record<FactionId, 'phys' | 'magic' | 'fire' | 'water' | 'thunder'> = { wei: 'phys', shu: 'phys', wu: 'fire', qun: 'phys', man: 'phys', xian: 'thunder' };
const FX: Record<Role, string> = { 守护: 'tac.guard', 先锋: 'tac.rush', 神射: 'tac.volley', 谋士: 'tac.spell', 医者: 'tac.bless', 刺客: 'tac.rush' };

/** 阵营附带效果（对敌人 / 对友方各一套）：让同职业的不同阵营玩起来不一样 */
function rider(f: FactionId, support: boolean): Effect[] {
  if (support) {
    switch (f) {
      case 'wei': case 'man': return [{ t: 'shield', scale: { maxHp: 0.1 }, turns: 2 }];
      case 'shu': return [status('purr', 2, { power: 0.06 })];
      default: return [energy(12)];
    }
  }
  switch (f) {
    case 'wei': return [{ t: 'shield', scale: { maxHp: 0.1 }, turns: 2, to: self }];
    case 'shu': return [{ t: 'heal', scale: { atk: 0.45 }, to: ally('lowestHpPct') }];
    case 'wu': return [status('burn', 2, { snapAtk: 0.3 })];
    case 'qun': return [energy(15, self)];
    case 'man': return [status('scratch', 2, { snapAtk: 0.25 })];
    case 'xian': return [status('charm', 2, { p: 0.6 })];
  }
}

function template(heroId: string): SkillDef {
  const u = unitInfo(heroId);
  const { faction: f, role } = u;
  const elem = role === '谋士' ? (f === 'wu' ? 'fire' : 'magic') : ELEM[f];
  let target: TargetSel = enemy('front');
  let effects: Effect[];
  let melee = false;
  let desc: string;
  switch (role) {
    case '守护': target = enemy('front'); effects = [dmg(0.9, { elem }), { t: 'shield', scale: { maxHp: 0.16 }, turns: 2, to: self }, ...rider(f, false)]; melee = true; desc = '重击前排敌人（90% 攻击），并为自己加上最大生命 16% 的护盾。'; break;
    case '先锋': target = enemy('front'); effects = [dmg(1.9, { elem }), ...rider(f, false)]; melee = true; desc = '冲入敌阵，对前排敌人造成 190% 攻击的伤害。'; break;
    case '神射': target = enemy('random', 3); effects = [dmg(0.95, { elem }), ...rider(f, false).filter((e) => e.t !== 'heal')]; desc = '一口气射向 3 名随机敌人，各造成 95% 攻击的伤害。'; break;
    case '谋士': target = enemy('all'); effects = [dmg(0.95, { elem }), ...rider(f, false).filter((e) => e.t !== 'heal')]; desc = '对敌方全体造成 95% 攻击的法术伤害。'; break;
    case '医者': target = ally('lowestHpPct', 2); effects = [{ t: 'heal', scale: { atk: 1.3 } }, { t: 'cleanse', n: 1, kind: 'debuff' }, ...rider(f, true)]; desc = '治疗生命比例最低的 2 名友方（130% 攻击），并净化 1 个负面状态。'; break;
    default: target = enemy('back'); effects = [dmg(2.1, { elem, critBonus: 0.15 }), ...rider(f, false)]; melee = true; desc = '绕到后排，对后排敌人造成 210% 攻击的伤害，暴击率 +15%。'; break;
  }
  return { id: `t_${heroId}`, name: NAMES[f][role], fx: FX[role], melee, target, effects, desc: `【战技 · 每 ${TACTIC_CD} 次行动】${desc}` };
}

/** 个别英雄的专属战技（有就覆盖模板）。后续可以逐只补。 */
const BESPOKE: Record<string, SkillDef> = {};

const cache = new Map<string, SkillDef>();
export function tacticFor(heroId: string): SkillDef {
  let t = cache.get(heroId);
  if (!t) { t = BESPOKE[heroId] ?? template(heroId); cache.set(heroId, t); }
  return t;
}
