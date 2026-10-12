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

/** 个别英雄的专属战技（有就覆盖模板）。先给 9 位 UR / SP 做，台词和性格对得上；其余按职业 × 阵营模板。 */
const tac = (heroId: string, name: string, fx: string, target: TargetSel, effects: Effect[], desc: string, melee = false): SkillDef =>
  ({ id: `t_${heroId}`, name, fx, melee, target, effects, desc: `【战技 · 每 ${TACTIC_CD} 次行动】${desc}` });
const BESPOKE: Record<string, SkillDef> = {
  wei_caomiaode: tac('wei_caomiaode', '爪印为法', 'tac.spell', enemy('all'), [dmg(0.85, { elem: 'magic' }), status('charm', 2, { p: 0.7 }), energy(10, self)], '盖下天下法度的爪印：对敌方全体造成 85% 攻击的法术伤害，70% 附「符咒」2 回合，自己元气 +10。'),
  shu_liumiaobei: tac('shu_liumiaobei', '分我半碗猫粮', 'tac.bless', ally('all'), [{ t: 'heal', scale: { atk: 0.8 } }, status('purr', 2, { power: 0.06 }), { t: 'cleanse', n: 1, kind: 'debuff' }], '一碗猫粮分着吃：友方全体回复 80% 攻击，附「呼噜」2 回合，并净化 1 个负面状态。'),
  wu_zhoumiaoyu: tac('wu_zhoumiaoyu', '火烧连营', 'tac.spell', enemy('all'), [dmg(0.8, { elem: 'fire' }), status('burn', 3, { snapAtk: 0.35 })], '一曲终了，火起：对敌方全体造成 80% 攻击的火焰伤害，并附「灼烧」3 回合。'),
  qun_lvbuding: tac('qun_lvbuding', '画戟连斩', 'tac.rush', enemy('front'), [dmg(1.4, { hits: 2 }), status('fluff', 2, { power: 0.2, to: self })], '人中吕布，两连斩：对前排敌人造成 2 段各 140% 攻击的伤害，自己「炸毛」2 回合（攻击 +20%）。', true),
  man_mengmiaohuo: tac('man_mengmiaohuo', '七擒七纵', 'tac.guard', enemy('front'), [dmg(1.0), { t: 'shield', scale: { maxHp: 0.26 }, turns: 2, to: self }, status('taunt', 2, { to: self })], '七次不算！重击前排（100% 攻击），自己获得最大生命 26% 的护盾，并「挑衅」2 回合。', true),
  xian_zuoci: tac('xian_zuoci', '幻术分身', 'tac.spell', enemy('all'), [dmg(0.75, { elem: 'thunder' }), status('illusion', 2, { to: self }), energy(15, self)], '你看见的是我，还是你想看见的我？对敌方全体造成 75% 攻击的雷法伤害，自己留下「幻象」2 回合，元气 +15。'),
  wei_simamiyi: tac('wei_simamiyi', '装睡一觉', 'tac.spell', enemy('front'), [dmg(1.1, { elem: 'magic' }), { t: 'shield', scale: { maxHp: 0.14 }, turns: 2, to: self }, energy(25, self)], '不急，我先睡一觉：对前排敌人造成 110% 攻击的法术伤害，自己获得最大生命 14% 的护盾，元气 +25。'),
  shu_pangmiaotong: tac('shu_pangmiaotong', '羽箭连喷嚏', 'tac.volley', enemy('random', 4), [dmg(0.8), status('fright', 2, { power: 0.15 })], '别怕，喷嚏打完就轮到羽毛：射向 4 名随机敌人，各造成 80% 攻击的伤害，并附「受惊」2 回合（攻击 -15%）。'),
  // ---- SSR ----
  wei_xiahoudun: tac('wei_xiahoudun', '独眼破阵', 'tac.rush', enemy('front'), [dmg(1.8), status('scratch', 2, { snapAtk: 0.25 })], '一只眼，足够看穿你：冲入敌阵对前排造成 180% 攻击的伤害，并附「抓痕」2 回合。', true),
  wei_xuhuchi: tac('wei_xuhuchi', '护主虎啸', 'tac.guard', enemy('front'), [dmg(0.8), { t: 'shield', scale: { maxHp: 0.14 }, turns: 2, to: ally('lowestHpPct') }, status('taunt', 2, { to: self })], '谁敢动主公的鱼干！重击前排（80% 攻击），为生命比例最低的友方加护盾，自己「挑衅」2 回合。', true),
  wei_zhangliao: tac('wei_zhangliao', '桥口突阵', 'tac.rush', enemy('front'), [dmg(1.7), status('step', 2, { power: 0.15, to: self })], '桥口虽窄，回家的路总要留着：突入前排造成 170% 攻击的伤害，自己「猫步」2 回合（速度提高）。', true),
  shu_guanyunmiao: tac('shu_guanyunmiao', '温酒斩排', 'tac.rush', enemy('front'), [dmg(1.15, { hits: 2 }), energy(10, self)], '温酒未凉：对前排连斩 2 刀，各造成 115% 攻击的伤害，自己元气 +10。', true),
  shu_zhangmiaofei: tac('shu_zhangmiaofei', '当阳一吼', 'tac.guard', enemy('front'), [dmg(0.9), status('fright', 2, { power: 0.15, to: enemy('all') }), { t: 'shield', scale: { maxHp: 0.12 }, turns: 2, to: self }], '燕人张喵飞在此！重击前排（90% 攻击），一声吼让敌方全体「受惊」2 回合（攻击 -15%），自己得护盾。', true),
  shu_zhugemiaoliang: tac('shu_zhugemiaoliang', '借东风', 'tac.spell', enemy('all'), [dmg(0.8, { elem: 'magic' }), status('fluff', 2, { power: 0.1, to: ally('all') })], '借你一阵东风：对敌方全体造成 80% 攻击的法术伤害，并让友方全体「炸毛」2 回合（攻击 +10%）。'),
  shu_zhaomiaoyun: tac('shu_zhaomiaoyun', '七进七出', 'tac.rush', enemy('back'), [dmg(2.0, { critBonus: 0.2 }), { t: 'heal', scale: { atk: 0.6 }, to: ally('lowestHpPct') }], '我绕后走：对后排造成 200% 攻击的伤害，暴击率 +20%，并治疗生命比例最低的友方（60% 攻击）。', true),
  wu_sunxiaoba: tac('wu_sunxiaoba', '先跳再说', 'tac.rush', enemy('front'), [dmg(1.8, { elem: 'water' }), status('wet', 2)], '前方是水还是火？先跳了再说：冲入前排造成 180% 攻击的水属性伤害，并附「淋湿」2 回合。', true),
  wu_sunxiangxiang: tac('wu_sunxiangxiang', '铃响低头', 'tac.volley', enemy('random', 3), [dmg(0.95), status('mark', 2)], '听到铃铛响，就该低头了：射向 3 名随机敌人，各造成 95% 攻击的伤害，并附「铃铛标记」2 回合。'),
  wu_luxun: tac('wu_luxun', '火候由我', 'tac.spell', enemy('all'), [dmg(0.85, { elem: 'fire' }), status('burn', 2, { snapAtk: 0.3 })], '火候由我算：对敌方全体造成 85% 攻击的火焰伤害，并附「灼烧」2 回合。'),
  qun_diaochan: tac('qun_diaochan', '借你一颗星', 'tac.spell', enemy('random', 2), [dmg(1.1, { elem: 'magic' }), status('charm', 2, { p: 0.8 })], '你的眼里有星星呢：对 2 名随机敌人造成 110% 攻击的法术伤害，80% 附「符咒」2 回合。'),
  qun_huatuo: tac('qun_huatuo', '舔一口不疼', 'tac.bless', ally('lowestHpPct', 2), [{ t: 'heal', scale: { atk: 1.4 } }, { t: 'cleanse', n: 2, kind: 'debuff' }], '不疼，就像被舔了一口：治疗生命比例最低的 2 名友方（140% 攻击），净化 2 个负面状态。'),
  qun_zhangjiao: tac('qun_zhangjiao', '黄巾符水', 'tac.spell', enemy('all'), [dmg(0.75, { elem: 'magic' }), status('nip', 1, { p: 0.5 })], '黄巾擦干再上阵：对敌方全体造成 75% 攻击的法术伤害，50% 使其「猫薄荷醉」1 回合。'),
  man_zhurong: tac('man_zhurong', '刀在背后', 'tac.rush', enemy('back'), [dmg(1.7, { elem: 'fire' }), status('burn', 2, { snapAtk: 0.3 })], '看刀！——哎？刀呢？对后排造成 170% 攻击的火焰伤害，并附「灼烧」2 回合。', true),
  man_mulu: tac('man_mulu', '山林号令', 'tac.spell', enemy('all'), [dmg(0.8, { elem: 'magic' }), status('yarn', 1, { p: 0.5 })], '嗡——山林听我号令：对敌方全体造成 80% 攻击的法术伤害，50% 使其被「毛线缠」1 回合。'),
  man_shamoke: tac('man_shamoke', '半步之后', 'tac.volley', enemy('random', 3), [dmg(1.0), status('scratch', 2, { snapAtk: 0.2 })], '风往左走，我等它半步：射向 3 名随机敌人，各造成 100% 攻击的伤害，并附「抓痕」2 回合。'),
  xian_zhangzhua: tac('xian_zhangzhua', '一起舔毛', 'tac.spell', ally('all'), [{ t: 'heal', scale: { atk: 0.6 } }, status('purr', 2, { power: 0.05 }), energy(10)], '诸位，伸出爪子，一起舔舔毛：友方全体回复 60% 攻击，附「呼噜」2 回合，元气 +10。'),
  xian_shuijing: tac('xian_shuijing', '很有前途', 'tac.bless', ally('lowestHpPct', 2), [{ t: 'heal', scale: { atk: 1.2 } }, { t: 'shield', scale: { maxHp: 0.1 }, turns: 2 }, energy(15)], '好，好，好……你这孩子很有前途：治疗生命比例最低的 2 名友方（120% 攻击），并加护盾、元气 +15。'),
  xian_yuji: tac('xian_yuji', '符水慢饮', 'tac.spell', enemy('all'), [dmg(0.75, { elem: 'thunder' }), status('wet', 2)], '符水慢慢喝，浮灰慢慢拂：对敌方全体造成 75% 攻击的雷法伤害，并附「淋湿」2 回合。'),
  xian_changmiao: tac('xian_changmiao', '月华流照', 'tac.bless', ally('all'), [{ t: 'heal', scale: { atk: 0.9 } }, { t: 'shield', scale: { maxHp: 0.08 }, turns: 2 }, energy(15)], '月亮很大，毛线球很小：友方全体回复 90% 攻击，获得最大生命 8% 的护盾，元气 +15。'),
};

const cache = new Map<string, SkillDef>();
export function tacticFor(heroId: string): SkillDef {
  let t = cache.get(heroId);
  if (!t) { t = BESPOKE[heroId] ?? template(heroId); cache.set(heroId, t); }
  return t;
}
