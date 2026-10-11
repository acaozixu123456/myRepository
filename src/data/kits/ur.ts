// 6 只 UR 的完整技能组：普攻 / 绝技(含 3 个升级词条) / 被动 / 觉醒（A / B 二选一）。
// 这是“研究型”技能设计的范本：联动、条件、计数器、分支觉醒。
import type { Kit } from '../../engine/types';
import { ally, dmg, energy, enemy, factionAllies, heal, self, shield, status, text } from './helpers';

export const KITS_UR: Record<string, Kit> = {
  // ================= 魏 · 曹喵德：令行禁止的统帅 =================
  wei_caomiaode: {
    heroId: 'wei_caomiaode',
    basic: {
      id: 'cmd_basic', name: '令爪', fx: 'ranged.seal', target: enemy('random', 1),
      effects: [dmg(1.1, { elem: 'magic' }), energy(8, ally('lowestEnergy', 1))],
      desc: '对随机 1 名敌人造成 110% 攻击的法术伤害，并使友方元气最低的猫猫回复 8 点元气。',
    },
    ultimate: {
      id: 'cmd_ult', name: '挟天子以令诸猫', fx: 'ult.imperialSeal', target: enemy('all'),
      effects: [
        dmg(1.8, { elem: 'magic' }),
        shield(0.6, 3, ally('all')),
        { t: 'when', cond: { c: 'allyFaction', faction: 'wei', atLeast: 3 }, then: [shield(0.6, 3, ally('all')), text('魏·铁壁')] },
      ],
      desc: '玉玺落下：对敌方全体造成 180% 攻击的法术伤害；友方全体获得「护体毛」（60% 攻击，3 回合）。场上魏势力≥3 时护盾翻倍。',
      levelMods: [
        { lv: 3, desc: '令行禁止：友方全体回复 10 点元气。', patch: { skill: 'ultimate', addEffects: [energy(10, ally('all'))] } },
        { lv: 6, desc: '军威：敌方全体「受惊」（攻击 -15%，2 回合）。', patch: { skill: 'ultimate', addEffects: [status('fright', 2, { power: 0.15, to: enemy('all') })] } },
        { lv: 9, desc: '天子在手：整体效果 +25%。', patch: { skill: 'ultimate', scaleMul: 1.25 } },
      ],
    },
    passive: {
      id: 'cmd_passive', name: '宁我负猫',
      desc: '友方猫猫阵亡时，曹喵德获得 30 点元气，并使全队「炸毛」（攻击 +15%，可叠 3 层）。',
      passive: [{ on: 'onAllyDeath', effects: [energy(30, self), status('fluff', 3, { power: 0.15, to: ally('all') })] }],
    },
    awaken: {
      A: { name: '魏武挥鞭', desc: '绝技额外使敌方全体「受惊」25%；「宁我负猫」额外返还 20 点元气。',
        patches: [{ skill: 'ultimate', addEffects: [status('fright', 2, { power: 0.25, to: enemy('all') })] }, { skill: 'passive', addPassive: { on: 'onAllyDeath', effects: [energy(20, self)] } }] },
      B: { name: '奉天子', desc: '战斗开始时全队「团团」（防御 +20%）2 回合，血量最低的友方获得「九命」。',
        patches: [{ skill: 'passive', addPassive: { on: 'battleStart', effects: [status('curl', 2, { power: 0.2, to: ally('all') }), status('nine', 3, { to: ally('lowestHpPct', 1) })] } }] },
    },
  },

  // ================= 蜀 · 刘喵备：仁德之主 =================
  shu_liumiaobei: {
    heroId: 'shu_liumiaobei',
    basic: {
      id: 'lb_basic', name: '仁爪', fx: 'heal.touch', target: enemy('front'),
      effects: [dmg(0.8), heal(1.0, ally('lowestHpPct', 1))],
      desc: '对敌方前排造成 80% 攻击的伤害，并治疗生命比例最低的友方（100% 攻击）。',
    },
    ultimate: {
      id: 'lb_ult', name: '桃园结义', fx: 'ult.peachOath', target: ally('all'),
      effects: [heal(1.8), status('fluff', 3, { power: 0.3 }), status('purr', 3, { power: 0.08, to: factionAllies('shu') })],
      desc: '桃花纷飞：友方全体回复 180% 攻击的生命并「炸毛」（攻击 +30%，3 回合）；蜀势力友方额外获得「呼噜」（每回合 8% 最大生命）。',
      levelMods: [
        { lv: 3, desc: '同饮一碗水：净化友方全体 1 个负面效果。', patch: { skill: 'ultimate', addEffects: [{ t: 'cleanse', n: 1, to: ally('all') }] } },
        { lv: 6, desc: '誓同生死：友方全体获得「护体毛」（40% 攻击，2 回合）。', patch: { skill: 'ultimate', addEffects: [shield(0.4, 2, ally('all'))] } },
        { lv: 9, desc: '仁德满溢：整体效果 +25%。', patch: { skill: 'ultimate', scaleMul: 1.25 } },
      ],
    },
    passive: {
      id: 'lb_passive', name: '仁德',
      desc: '每回合开始，若有友方生命低于 50%，自动治疗其 120% 攻击的生命（每回合 1 次）。',
      passive: [{
        on: 'roundStart', limit: { per: 'round', n: 1 }, target: ally('lowestHpPct', 1),
        effects: [{ t: 'when', cond: { c: 'hpBelow', pct: 0.5, who: 'target' }, then: [heal(1.2), text('仁德')] }],
      }],
    },
    awaken: {
      A: { name: '汉室永续', desc: '友方猫猫阵亡时，所有蜀势力友方「炸毛」30%（3 回合）。',
        patches: [{ skill: 'passive', addPassive: { on: 'onAllyDeath', target: factionAllies('shu'), effects: [status('fluff', 3, { power: 0.3 })] } }] },
      B: { name: '仁者无敌', desc: '绝技额外为友方全体提供护盾（50% 攻击）并回复 10 点元气。',
        patches: [{ skill: 'ultimate', addEffects: [shield(0.5, 2, ally('all')), energy(10, ally('all'))] }] },
    },
  },

  // ================= 吴 · 周喵瑜：赤壁火神 =================
  wu_zhoumiaoyu: {
    heroId: 'wu_zhoumiaoyu',
    basic: {
      id: 'zy_basic', name: '琴音', fx: 'ranged.qin', target: enemy('random', 2),
      effects: [dmg(0.75, { elem: 'fire' }), status('burn', 2, { snapAtk: 0.25 })],
      desc: '对随机 2 名敌人各造成 75% 攻击的火焰伤害，并施加「灼烧」（每回合 25% 攻击）。',
    },
    ultimate: {
      id: 'zy_ult', name: '赤壁火海', fx: 'ult.redCliff', target: enemy('all'),
      effects: [
        dmg(1.7, { elem: 'fire', bonus: [{ cond: { c: 'status', id: 'wet', who: 'target' }, mult: 1.6 }] }),
        status('burn', 3, { snapAtk: 0.3 }),
      ],
      desc: '火烧连营：对敌方全体造成 170% 攻击的火焰伤害并「灼烧」3 回合；对「淋湿」目标额外 +60% 伤害。',
      levelMods: [
        { lv: 3, desc: '燎原：灼烧再叠加 1 层。', patch: { skill: 'ultimate', addEffects: [status('burn', 3, { snapAtk: 0.3, stacks: 1 })] } },
        { lv: 6, desc: '东风：自身回复 25 点元气。', patch: { skill: 'ultimate', addEffects: [energy(25, self)] } },
        { lv: 9, desc: '烈火焚天：整体效果 +25%。', patch: { skill: 'ultimate', scaleMul: 1.25 } },
      ],
    },
    passive: {
      id: 'zy_passive', name: '曲有误',
      desc: '敌方每次释放绝技，周喵瑜立刻对其造成 80% 攻击的火焰伤害并叠加 1 层灼烧（每回合最多 2 次）。',
      passive: [{ on: 'onEnemyUlt', limit: { per: 'round', n: 2 }, target: { side: 'enemy', pick: 'source' }, effects: [dmg(0.8, { elem: 'fire' }), status('burn', 2, { snapAtk: 0.25 })] }],
    },
    awaken: {
      A: { name: '连环计·燎原', desc: '每回合开始，所有带灼烧的敌人再叠 1 层；灼烧目标被击杀时，把 2 层灼烧传给随机敌人。',
        patches: [
          { skill: 'passive', addPassive: { on: 'roundStart', target: enemy('all', undefined, { hasStatus: 'burn' }), effects: [status('burn', 3, { snapAtk: 0.3 })] } },
          { skill: 'passive', addPassive: { on: 'onKill', target: enemy('random', 1), effects: [status('burn', 3, { snapAtk: 0.3, stacks: 2 })] } },
        ] },
      B: { name: '东风起', desc: '绝技整体 +15%，并使吴势力友方「猫步」（速度 +15%）2 回合。',
        patches: [{ skill: 'ultimate', scaleMul: 1.15, addEffects: [status('step', 2, { power: 0.15, to: factionAllies('wu') })] }] },
    },
  },

  // ================= 群 · 吕布丁：飞将 =================
  qun_lvbuding: {
    heroId: 'qun_lvbuding',
    basic: {
      id: 'lv_basic', name: '画戟', fx: 'melee.halberd', melee: true, target: enemy('front'),
      effects: [dmg(1.2), { t: 'when', cond: { c: 'crit' }, then: [dmg(0.6), text('连击')] }],
      desc: '对敌方前排造成 120% 攻击的物理伤害；暴击时追加一次 60% 攻击的攻击。',
    },
    ultimate: {
      id: 'lv_ult', name: '天下无双', fx: 'ult.tianxia', melee: true, target: enemy('backRow'),
      effects: [dmg(2.2, { critBonus: 0.5 }), { t: 'when', cond: { c: 'killed' }, then: [energy(50, self), text('无双')] }],
      desc: '飞身突进：对敌方后排全体造成 220% 攻击的物理伤害，本次暴击率 +50%；击杀目标时返还 50 点元气。',
      levelMods: [
        { lv: 3, desc: '破阵：无视目标 20% 防御。', patch: { skill: 'ultimate', replaceEffects: [dmg(2.2, { critBonus: 0.5, ignoreDef: 0.2 }), { t: 'when', cond: { c: 'killed' }, then: [energy(50, self), text('无双')] }] } },
        { lv: 6, desc: '余威：自身「炸毛」20%（2 回合）。', patch: { skill: 'ultimate', addEffects: [status('fluff', 2, { power: 0.2, to: self })] } },
        { lv: 9, desc: '人中吕布：整体效果 +25%。', patch: { skill: 'ultimate', scaleMul: 1.25 } },
      ],
    },
    passive: {
      id: 'lv_passive', name: '飞将',
      desc: '战斗开始时攻击 +15%；每次击杀回复 20 点元气。',
      passive: [{ on: 'battleStart', effects: [status('fluff', 99, { power: 0.15 })] }, { on: 'onKill', effects: [energy(20, self)] }],
    },
    awaken: {
      A: { name: '赤兔（兔）', desc: '每回合行动后，50% 概率立刻额外行动一次（每回合 1 次）。',
        patches: [{ skill: 'passive', addPassive: { on: 'afterAct', cond: { c: 'chance', p: 0.5 }, limit: { per: 'round', n: 1 }, effects: [{ t: 'extraTurn' }] } }] },
      B: { name: '戟神', desc: '绝技整体 +20%，并使目标「铃铛标记」（受伤 +10%，2 回合）；暴击时回复 10% 最大生命。',
        patches: [{ skill: 'ultimate', scaleMul: 1.2, addEffects: [status('mark', 2)] }, { skill: 'passive', addPassive: { on: 'onCrit', limit: { per: 'round', n: 2 }, effects: [{ t: 'heal', scale: { maxHp: 0.1 } }] } }] },
    },
  },

  // ================= 蛮 · 孟喵获：七擒七纵 =================
  man_mengmiaohuo: {
    heroId: 'man_mengmiaohuo',
    basic: {
      id: 'mh_basic', name: '骨棒', fx: 'melee.mace', melee: true, target: enemy('front'),
      effects: [dmg(1.2), { t: 'counter', key: 'totem', add: 1, max: 6, to: self }],
      desc: '对敌方前排造成 120% 攻击的物理伤害，并为自身叠加 1 层「图腾」。',
    },
    ultimate: {
      id: 'mh_ult', name: '七擒七纵', fx: 'ult.sevenCapture', melee: true, target: enemy('front'),
      effects: [dmg(2.5), status('dizzy', 1, { p: 1 }), status('nine', 3, { to: self }), shield(0.5, 3, self)],
      desc: '被擒也不服：对敌方前排造成 250% 攻击的物理伤害并使其「晕乎乎」1 回合；自身获得「九命」与护盾（3 回合）。',
      levelMods: [
        { lv: 3, desc: '图腾共鸣：自身图腾 +2 层。', patch: { skill: 'ultimate', addEffects: [{ t: 'counter', key: 'totem', add: 2, max: 6, to: self }] } },
        { lv: 6, desc: '战吼：敌方全体「受惊」（攻击 -15%，2 回合）。', patch: { skill: 'ultimate', addEffects: [status('fright', 2, { power: 0.15, to: enemy('all') })] } },
        { lv: 9, desc: '盟主之怒：整体效果 +25%。', patch: { skill: 'ultimate', scaleMul: 1.25 } },
      ],
    },
    passive: {
      id: 'mh_passive', name: '不服',
      desc: '每次受到攻击，攻击 +4%（最多叠 3 层）并「团团」；图腾满 6 层时召唤猛兽扑向 3 名敌人。',
      passive: [
        { on: 'onHurt', effects: [status('fluff', 99, { power: 0.04 }), status('curl', 2, { power: 0.1 })] },
        { on: 'onBasic', cond: { c: 'counter', key: 'totem', atLeast: 5 }, effects: [{ t: 'summon', beast: 'tiger', count: 3, perCounter: 'totem', scale: { atk: 0.9 }, applyStatus: { id: 'scratch', turns: 2, snap: { atk: 0.25 } } }] },
      ],
    },
    awaken: {
      A: { name: '第七次', desc: '每受到 7 次攻击，立刻满元气并回复 30% 最大生命。',
        patches: [{ skill: 'passive', addPassive: { on: 'onHurt', effects: [{ t: 'counter', key: 'hurt', add: 1, to: self }, { t: 'when', cond: { c: 'counter', key: 'hurt', atLeast: 7 }, then: [energy(100, self), { t: 'heal', scale: { maxHp: 0.3 } }, { t: 'counter', key: 'hurt', add: -7 }, text('第七次！')] }] } }] },
      B: { name: '盟主之威', desc: '绝技后获得「挑衅」2 回合，并整体 +10%。',
        patches: [{ skill: 'ultimate', scaleMul: 1.1, addEffects: [status('taunt', 2, { to: self })] }] },
    },
  },

  // ================= 仙 · 左慈喵：幻术仙猫 =================
  xian_zuoci: {
    heroId: 'xian_zuoci',
    basic: {
      id: 'zc_basic', name: '幻爪', fx: 'ranged.teal', target: enemy('random', 1),
      effects: [dmg(1.2, { elem: 'magic' }), status('yarn', 1, { p: 0.3 })],
      desc: '对随机 1 名敌人造成 120% 攻击的法术伤害，30% 概率使其「毛线缠」1 回合。',
    },
    ultimate: {
      id: 'zc_ult', name: '千幻万象', fx: 'ult.mirror', target: enemy('all'),
      effects: [dmg(1.6, { elem: 'magic' }), status('illusion', 2, { to: ally('all') })],
      desc: '镜花水月：对敌方全体造成 160% 攻击的法术伤害；友方全体获得「幻象」（闪避下一次攻击）。',
      levelMods: [
        { lv: 3, desc: '幻象回流：友方全体回复 15 点元气。', patch: { skill: 'ultimate', addEffects: [energy(15, ally('all'))] } },
        { lv: 6, desc: '迷眼：敌方全体 40% 概率「毛线缠」1 回合。', patch: { skill: 'ultimate', addEffects: [status('yarn', 1, { p: 0.4, to: enemy('all') })] } },
        { lv: 9, desc: '万象归一：整体效果 +25%。', patch: { skill: 'ultimate', scaleMul: 1.25 } },
      ],
    },
    passive: {
      id: 'zc_passive', name: '天命',
      desc: '每回合开始 30% 概率触发天命，随机获得其一：额外行动 / 回复 50 点元气 / 九命。',
      passive: [{
        on: 'roundStart', cond: { c: 'chance', p: 0.3 },
        effects: [
          text('天命'),
          { t: 'when', cond: { c: 'chance', p: 0.34 }, then: [{ t: 'extraTurn' }], else: [{ t: 'when', cond: { c: 'chance', p: 0.5 }, then: [energy(50, self)], else: [status('nine', 2, { to: self })] }] },
        ],
      }],
    },
    awaken: {
      A: { name: '庄周梦猫', desc: '天命触发率提高到约 50%。',
        patches: [{ skill: 'passive', addPassive: { on: 'roundStart', cond: { c: 'chance', p: 0.3 }, effects: [{ t: 'when', cond: { c: 'chance', p: 0.5 }, then: [energy(50, self)], else: [status('nine', 2, { to: self })] }] } }] },
      B: { name: '梦蝶', desc: '绝技额外净化友方全体所有负面效果，并回复 20 点元气。',
        patches: [{ skill: 'ultimate', addEffects: [{ t: 'cleanse', to: ally('all') }, energy(20, ally('all'))] }] },
    },
  },
};
