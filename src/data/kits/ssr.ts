import type { Kit } from '../../engine/types';
import { ally, dmg, energy, enemy, factionAllies, heal, self, shield, status, text } from './helpers';

export const KITS_SSR: Record<string, Kit> = {
  // ----- 蜀 · 关云喵 -----
  shu_guanyunmiao: {
    heroId: 'shu_guanyunmiao',
    basic: { id: 'gy_basic', name: '偃月斩', fx: 'melee.glaive', melee: true, target: enemy('front'), effects: [dmg(1.4)], desc: '对敌方前排造成 140% 攻击的物理伤害。' },
    ultimate: {
      id: 'gy_ult', name: '温酒斩将', fx: 'ult.glaiveWave', melee: true, target: enemy('column'),
      effects: [dmg(2.6), { t: 'when', cond: { c: 'killed' }, then: [{ t: 'extraTurn' }, energy(20, self), text('斩！')] }],
      desc: '刀气纵贯一列，造成 260% 攻击的物理伤害；击杀目标时立刻再行动一次并回复 20 点元气。',
      levelMods: [{ lv: 5, desc: '青龙之势：整体 +15%。', patch: { skill: 'ultimate', scaleMul: 1.15 } }],
    },
    passive: { id: 'gy_passive', name: '义绝', desc: '每次暴击，攻击 +10%，最多叠加 3 层。', passive: [{ on: 'onCrit', effects: [status('fluff', 99, { power: 0.1, to: self })] }] },
    awaken: {
      A: { name: '过五关', desc: '击杀敌人后回复 30 点元气并「猫步」（速度 +15%）。', patches: [{ skill: 'passive', addPassive: { on: 'onKill', effects: [energy(30, self), status('step', 2, { power: 0.15, to: self })] } }] },
      B: { name: '青龙觉醒', desc: '绝技额外造成 80% 攻击的伤害，无视 50% 防御。', patches: [{ skill: 'ultimate', addEffects: [dmg(0.8, { ignoreDef: 0.5 })] }] },
    },
  },
  // ----- 蜀 · 张喵飞 -----
  shu_zhangmiaofei: {
    heroId: 'shu_zhangmiaofei',
    basic: { id: 'zf_basic', name: '蛇矛点', fx: 'melee.pierce', melee: true, target: enemy('front'), effects: [dmg(1.0), status('dizzy', 1, { p: 0.3 })], desc: '对敌方前排造成 100% 攻击的物理伤害，30% 概率「晕乎乎」1 回合。' },
    ultimate: {
      id: 'zf_ult', name: '当阳一吼', fx: 'ult.roar', target: enemy('all'),
      effects: [dmg(1.4), status('fright', 2, { power: 0.2 }), status('dizzy', 1, { to: enemy('random', 1) })],
      desc: '震耳欲聋：对敌方全体造成 140% 攻击的物理伤害并「受惊」（攻击 -20%，2 回合），随机 1 名敌人「晕乎乎」。',
    },
    passive: { id: 'zf_passive', name: '燕人风骨', desc: '受到攻击时「团团」（防御 +10%，2 回合）。', passive: [{ on: 'onHurt', effects: [status('curl', 2, { power: 0.1 })] }] },
    awaken: {
      A: { name: '喝断长坂桥', desc: '咆哮后获得「挑衅」2 回合与护盾。', patches: [{ skill: 'ultimate', addEffects: [status('taunt', 2, { to: self }), { t: 'shield', scale: { maxHp: 0.2 }, turns: 2, to: self }] }] },
      B: { name: '猛张飞', desc: '对「受惊」目标的伤害 +30%。', patches: [{ skill: 'basic', replaceEffects: [dmg(1.0, { bonus: [{ cond: { c: 'status', id: 'fright', who: 'target' }, mult: 1.3 }] }), status('dizzy', 1, { p: 0.3 })] }] },
    },
  },
  // ----- 蜀 · 诸葛喵亮 -----
  shu_zhugemiaoliang: {
    heroId: 'shu_zhugemiaoliang',
    basic: { id: 'zg_basic', name: '羽扇一挥', fx: 'ranged.fan', target: enemy('random', 1), effects: [dmg(1.2, { elem: 'magic' }), status('yarn', 1, { p: 0.2 })], desc: '对随机 1 名敌人造成 120% 攻击的法术伤害，20% 概率「毛线缠」。' },
    ultimate: {
      id: 'zg_ult', name: '八阵图', fx: 'ult.eightArray', target: enemy('all'),
      effects: [dmg(1.5, { elem: 'magic' }), status('step', 2, { power: -0.2 }), shield(0.5, 2, ally('all'))],
      desc: '八阵图起：对敌方全体造成 150% 攻击的法术伤害并使其减速 20%；友方全体获得「护体毛」。',
    },
    passive: { id: 'zg_passive', name: '卧龙', desc: '战斗开始时友方全体元气 +30；友方阵亡时回复 20 点元气。', passive: [{ on: 'battleStart', effects: [energy(30, ally('all'))] }, { on: 'onAllyDeath', effects: [energy(20, self)] }] },
    awaken: {
      A: { name: '借东风', desc: '绝技额外使吴势力友方「炸毛」40%；若周喵瑜在场，其灼烧伤害更高（联动）。', patches: [{ skill: 'ultimate', addEffects: [status('fluff', 2, { power: 0.4, to: factionAllies('wu') })] }] },
      B: { name: '空城计', desc: '绝技后自身获得「幻象」与「九命」。', patches: [{ skill: 'ultimate', addEffects: [status('illusion', 2, { to: self }), status('nine', 2, { to: self })] }] },
    },
  },
  // ----- 吴 · 孙香香 -----
  wu_sunxiangxiang: {
    heroId: 'wu_sunxiangxiang',
    basic: { id: 'xx_basic', name: '铃铛箭', fx: 'ranged.arrow', target: enemy('back', 1), effects: [dmg(1.4)], desc: '对敌方后排造成 140% 攻击的物理伤害。' },
    ultimate: {
      id: 'xx_ult', name: '连珠铃箭', fx: 'ult.arrowVolley', target: enemy('random', 1),
      effects: [{ t: 'repeat', n: 5, effects: [dmg(0.8, { to: enemy('random', 1), bonus: [{ cond: { c: 'or', conds: [{ c: 'status', id: 'burn', who: 'target' }, { c: 'status', id: 'wet', who: 'target' }] }, mult: 1.3 }] })] }],
      desc: '连射 5 箭，每箭对随机敌人造成 80% 攻击的伤害；对「灼烧」或「淋湿」目标额外 +30%。',
    },
    passive: { id: 'xx_passive', name: '回马弓', desc: '受到攻击时 20% 概率反射一箭（100% 攻击，每回合 1 次）。', passive: [{ on: 'onHurt', cond: { c: 'chance', p: 0.2 }, limit: { per: 'round', n: 1 }, target: { side: 'enemy', pick: 'attacker' }, effects: [dmg(1.0)] }] },
    awaken: {
      A: { name: '弓腰', desc: '暴击后追射一箭（60% 攻击）。', patches: [{ skill: 'passive', addPassive: { on: 'onCrit', limit: { per: 'round', n: 3 }, target: enemy('random', 1), effects: [dmg(0.6)] } }] },
      B: { name: '铃铛标记', desc: '普攻使目标「铃铛标记」（受伤 +10%，2 回合）。', patches: [{ skill: 'basic', addEffects: [status('mark', 2)] }] },
    },
  },
  // ----- 群 · 华佗喵 -----
  qun_huatuo: {
    heroId: 'qun_huatuo',
    basic: { id: 'ht_basic', name: '针灸', fx: 'heal.touch', target: ally('lowestHpPct', 1), effects: [heal(1.3)], desc: '治疗生命比例最低的友方（130% 攻击）。' },
    ultimate: {
      id: 'ht_ult', name: '麻沸散', fx: 'ult.herbMist', target: ally('all'),
      effects: [heal(1.5), { t: 'cleanse' }, { t: 'when', cond: { c: 'status', id: 'nip', who: 'target' }, then: [heal(0.5)] }],
      desc: '药雾弥漫：友方全体回复 150% 攻击的生命并净化所有负面效果。',
    },
    passive: { id: 'ht_passive', name: '五禽戏', desc: '每回合开始，为生命比例最低的 2 名友方施加「呼噜」。', passive: [{ on: 'roundStart', target: ally('lowestHpPct', 2), effects: [status('purr', 2, { power: 0.06 })] }] },
    awaken: {
      A: { name: '刮骨疗毒', desc: '友方阵亡时，复活该友方并回复 40% 生命（每场 1 次）。', patches: [{ skill: 'passive', addPassive: { on: 'onAllyDeath', limit: { per: 'battle', n: 1 }, target: { side: 'ally', pick: 'source' }, effects: [{ t: 'revive', hpPct: 0.4 }, text('刮骨疗毒')] } }] },
      B: { name: '悬壶济世', desc: '绝技额外为友方全体提供护盾（40% 攻击）。', patches: [{ skill: 'ultimate', addEffects: [shield(0.4, 2, ally('all'))] }] },
    },
  },
  // ----- 蛮 · 祝融喵 -----
  man_zhurong: {
    heroId: 'man_zhurong',
    basic: { id: 'zr_basic', name: '飞刀', fx: 'ranged.knife', target: enemy('back', 1), effects: [dmg(1.4), status('scratch', 2, { p: 0.3, snapAtk: 0.3 })], desc: '对敌方后排造成 140% 攻击的物理伤害，30% 概率施加「抓痕」。' },
    ultimate: {
      id: 'zr_ult', name: '烈火回旋', fx: 'ult.knifeStorm', target: enemy('backRow'),
      effects: [dmg(1.0, { elem: 'fire', hits: 3 }), status('burn', 2, { snapAtk: 0.25 }), { t: 'when', cond: { c: 'status', id: 'scratch', who: 'target' }, then: [dmg(0.6, { elem: 'fire' })] }],
      desc: '掷出 3 把飞刀，每把造成 100% 攻击的火焰伤害并「灼烧」；目标有「抓痕」时，飞刀返回再造成 60% 伤害。',
    },
    passive: { id: 'zr_passive', name: '火神后裔', desc: '暴击时回复 10 点元气。', passive: [{ on: 'onCrit', effects: [energy(10, self)] }] },
    awaken: {
      A: { name: '刀回三匝', desc: '飞刀增至 5 把。', patches: [{ skill: 'ultimate', replaceEffects: [dmg(1.0, { elem: 'fire', hits: 5 }), status('burn', 2, { snapAtk: 0.25 })] }] },
      B: { name: '烈焰之怒', desc: '暴击后追加一次 60% 攻击的火焰伤害。', patches: [{ skill: 'passive', addPassive: { on: 'onCrit', limit: { per: 'round', n: 2 }, target: enemy('random', 1), effects: [dmg(0.6, { elem: 'fire' })] } }] },
    },
  },
};
