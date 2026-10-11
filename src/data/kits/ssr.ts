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
      levelMods: [
        { lv: 3, desc: '刀过留铃：基础绝技效果结束后，为原来选中的一列存活敌人施加「铃铛标记」（受到直接伤害 +10%，被暴击率 +10 个百分点，持续 2 次目标行动结束）。',
          patch: { skill: 'ultimate', addEffects: [status('mark', 2)] } },
        { lv: 6, desc: '青龙之势：保留原来的伤害 +15%，基础刀气由 260% 攻击提高至 299%；基础绝技效果结束后，净化自身 1 个负面效果。',
          patch: { skill: 'ultimate', scaleMul: 1.15, addEffects: [{ t: 'cleanse', n: 1, to: self }] } },
        { lv: 9, desc: '义字暖杯：刘喵备存活时，每次自身直接伤害使目标睡着后，治疗生命比例最低的 1 名友方（60% 自身攻击），每回合最多 1 次。',
          patch: { skill: 'passive', addPassive: { on: 'onKill', cond: { c: 'heroAlive', hero: 'shu_liumiaobei' }, limit: { per: 'round', n: 1 }, target: ally('lowestHpPct', 1), effects: [heal(0.6)] } } },
      ],
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
      levelMods: [
        { lv: 3, desc: '桥头留垫：基础绝技效果结束后，为生命比例最低的 1 名友方提供「护体毛」（60% 自身攻击，持续 2 次持有者行动结束；施法者自身计入本次）。',
          patch: { skill: 'ultimate', addEffects: [shield(0.6, 2, ally('lowestHpPct', 1))] } },
        { lv: 6, desc: '护着大哥：刘喵备存活时，基础绝技效果结束后，自身获得「呼噜」（每次自身行动开始回复 4% 最大生命，同名更强呼噜保留更高比例；持续 3 次自身行动结束，计入本次施法）。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'heroAlive', hero: 'shu_liumiaobei' }, then: [status('purr', 3, { power: 0.04, to: self })] }] } },
        { lv: 9, desc: '嗓门不歇：受到带「受惊」的攻击者造成的非致命直接伤害后，自身额外回复 15 点元气，每回合最多 1 次。',
          patch: { skill: 'passive', addPassive: { on: 'onHurt', cond: { c: 'status', id: 'fright', who: 'target' }, limit: { per: 'round', n: 1 }, effects: [energy(15, self)] } } },
      ],
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
      levelMods: [
        { lv: 3, desc: '理顺阵脚：基础绝技效果结束后，净化友方全体各 1 个负面效果。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'cleanse', n: 1, to: ally('all') }] } },
        { lv: 6, desc: '借风带水：周喵瑜存活时，基础绝技效果结束后，使存活敌方全体「淋湿」（防御 -20%，同名状态保留更高比例；持续 2 次目标行动结束）。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'heroAlive', hero: 'wu_zhoumiaoyu' }, then: [status('wet', 2, { power: 0.2, to: enemy('all') })] }] } },
        { lv: 9, desc: '阵图回响：每次基础绝技效果结束后，自身累计 1 次阵图；累计至 2 次时，友方全体回复 10 点元气，并清空阵图计数。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'counter', key: 'eightArray', add: 1, max: 2, to: self }, { t: 'when', cond: { c: 'counter', key: 'eightArray', atLeast: 2 }, then: [energy(10, ally('all')), { t: 'counter', key: 'eightArray', add: -2, to: self }] }] } },
      ],
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
      levelMods: [
        { lv: 3, desc: '五箭过后：原来的 5 箭射完后，给敌方后排随机 1 名存活者挂「铃铛标记」；后排空则从前排随机选择。受到直接伤害 +10%，被暴击率 +10 个百分点，持续 2 次目标行动结束。',
          patch: { skill: 'ultimate', addEffects: [status('mark', 2, { to: enemy('back', 1) })] } },
        { lv: 6, desc: '兄长压阵：孙小霸存活时，绝技出手前、先于基础效果，自身获得「猫步」（速度 +15%，同名状态保留更高比例；持续 2 次自身行动结束，计入本次施法）。',
          patch: { skill: 'passive', addPassive: { on: 'onUlt', cond: { c: 'heroAlive', hero: 'wu_sunxiaoba' }, effects: [status('step', 2, { power: 0.15, to: self })] } } },
        { lv: 9, desc: '铃响再两声：每次原来的 5 箭射完后，自身累计 1 次铃箭；累计至 2 次时，追加 2 箭，每箭独立选择当前元气最高的存活敌人，造成 60% 攻击的物理伤害，随后清空铃箭计数。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'counter', key: 'bellVolley', add: 1, max: 2, to: self }, { t: 'when', cond: { c: 'counter', key: 'bellVolley', atLeast: 2 }, then: [{ t: 'repeat', n: 2, effects: [dmg(0.6, { to: enemy('highestEnergy', 1) })] }, { t: 'counter', key: 'bellVolley', add: -2, to: self }] }] } },
      ],
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
      levelMods: [
        { lv: 3, desc: '汤温正好：基础绝技治疗与净化结束后，友方元气最低的 1 名猫猫回复 15 点元气。',
          patch: { skill: 'ultimate', addEffects: [energy(15, ally('lowestEnergy', 1))] } },
        { lv: 6, desc: '药香留一刻：基础绝技治疗与净化结束后，为生命比例最低的 3 名友方施加「呼噜」（每次各自行动开始回复 6% 各自最大生命，同名更强呼噜保留更高比例；持续 3 次持有者行动结束，施法者自身计入本次）。',
          patch: { skill: 'ultimate', addEffects: [status('purr', 3, { power: 0.06, to: ally('lowestHpPct', 3) })] } },
        { lv: 9, desc: '再添半碗：基础绝技治疗与净化结束后，若生命比例最低的 1 名友方仍不足 50% 生命，再为其治疗一次（60% 自身攻击）。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'when', to: ally('lowestHpPct', 1), cond: { c: 'hpBelow', pct: 0.5, who: 'target' }, then: [heal(0.6)] }] } },
      ],
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
      // 觉醒 A 会替换绝技 effects；升级借 onUlt 触发，保留两条觉醒的原貌。
      levelMods: [
        { lv: 3, desc: '回旋先探路：绝技出手前、先于基础效果，为敌方后排全体叠加 1 层「抓痕」；后排空则作用于敌方全体。每层在目标行动开始时造成施加时 30% 自身攻击的基础持续伤害，最多 3 层，持续 2 次目标行动结束；已有更高攻击快照时沿用更高值。',
          patch: { skill: 'passive', addPassive: { on: 'onUlt', target: enemy('backRow'), effects: [status('scratch', 2, { snapAtk: 0.3 })] } } },
        { lv: 6, desc: '寨主接刀：孟喵获存活时，绝技出手前、先于基础效果，己方蛮势力中元气最低的 1 名猫猫回复 15 点元气。',
          patch: { skill: 'passive', addPassive: { on: 'onUlt', cond: { c: 'heroAlive', hero: 'man_mengmiaohuo' }, target: ally('lowestEnergy', 1, { faction: 'man' }), effects: [energy(15)] } } },
        { lv: 9, desc: '刀绕两棵树：每次绝技出手前、先于基础效果，自身累计 1 次回旋；累计至 2 次时，额外掷出 2 把飞刀，每把独立随机选择 1 名存活敌人，造成 30% 攻击的火焰伤害，随后清空回旋计数。',
          patch: { skill: 'passive', addPassive: { on: 'onUlt', effects: [{ t: 'counter', key: 'knifeRecall', add: 1, max: 2, to: self }, { t: 'when', cond: { c: 'counter', key: 'knifeRecall', atLeast: 2 }, then: [{ t: 'repeat', n: 2, effects: [dmg(0.3, { elem: 'fire', to: enemy('random', 1) })] }, { t: 'counter', key: 'knifeRecall', add: -2, to: self }] }] } } },
      ],
    },
    passive: { id: 'zr_passive', name: '火神后裔', desc: '暴击时回复 10 点元气。', passive: [{ on: 'onCrit', effects: [energy(10, self)] }] },
    awaken: {
      A: { name: '刀回三匝', desc: '飞刀增至 5 把。', patches: [{ skill: 'ultimate', replaceEffects: [dmg(1.0, { elem: 'fire', hits: 5 }), status('burn', 2, { snapAtk: 0.25 })] }] },
      B: { name: '烈焰之怒', desc: '暴击后追加一次 60% 攻击的火焰伤害。', patches: [{ skill: 'passive', addPassive: { on: 'onCrit', limit: { per: 'round', n: 2 }, target: enemy('random', 1), effects: [dmg(0.6, { elem: 'fire' })] } }] },
    },
  },
};
