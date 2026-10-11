import type { Effect, Kit } from '../../engine/types';
import { ally, dmg, energy, enemy, factionAllies, heal, self, shield, status } from './helpers';

// 倍率连乘后依次为 1 / 2 / 3 / 4 / 5；damage 的 bonus 会逐目标检查层数。
// 不用多目标 when，否则引擎会把首名目标的符咒层数套给整队。
const charmBurst = (): Effect => dmg(0.5, {
  elem: 'magic',
  to: enemy('all', undefined, { hasStatus: 'charm' }),
  bonus: [2, 3, 4, 5].map((stacks) => ({
    cond: { c: 'status' as const, id: 'charm', who: 'target' as const, atLeast: stacks },
    mult: stacks / (stacks - 1),
  })),
});

const COIN_HEADS = 'guanlu_heads';
const coinRoll = (): Effect => ({
  t: 'when', cond: { c: 'chance', p: 0.5 },
  then: [
    dmg(0.8, { elem: 'magic', to: enemy('all') }),
    { t: 'counter', key: COIN_HEADS, add: 1, max: 5, to: self },
  ],
  else: [shield(0.4, 2, ally('all'))],
});

// counter 没有赋值操作；最多 5 次有条件减一，保证重置后恰为 0。
const resetCoins = (): Effect => ({
  t: 'repeat', n: 5,
  effects: [{
    t: 'when', cond: { c: 'counter', key: COIN_HEADS, atLeast: 1 },
    then: [{ t: 'counter', key: COIN_HEADS, add: -1, to: self }],
  }],
});

export const KITS_MAN_XIAN: Record<string, Kit> = {
  // 藤甲没有按元素减伤的 DSL；用增防、灼烧条件与自疗表现猫窝的取舍。
  man_wutugu: {
    heroId: 'man_wutugu',
    basic: {
      id: 'wtg_basic', name: '藤拳', fx: 'melee.mace', melee: true, target: enemy('front'),
      effects: [
        dmg(1.0),
        {
          t: 'when', cond: { c: 'counter', key: 'wutugu_nest', atLeast: 3 },
          then: [
            { t: 'damage', scale: { def: 1.0 }, elem: 'phys' },
            { t: 'counter', key: 'wutugu_nest', add: -3, to: self },
          ],
        },
      ],
      desc: '对前排随机 1 名敌人造成 100% 攻击的物理伤害，前排无人时选择后排；自身窝沿印记达到 3 道时，追加 100% 自身防御的物理伤害，并消耗 3 道印记。拳头伸出窝，眼睛还没睁开。',
    },
    ultimate: {
      id: 'wtg_ult', name: '缩甲', fx: 'ult.rattanNest', target: self,
      effects: [
        { t: 'heal', scale: { maxHp: 0.12 }, to: self },
        { t: 'shield', scale: { maxHp: 0.3 }, turns: 3, to: self },
        status('curl', 3, { power: 0.5, to: self }),
      ],
      desc: '缩进藤窝，回复自身 12% 最大生命，获得自身最大生命 30% 的「护体毛」和「团团」（防御 +50%），均持续 3 次自身行动结束，计入本次施放。请继续，午睡照常。',
      levelMods: [
        {
          lv: 3, desc: '窝门朝外：缩甲后获得「挑衅」，持续 2 次自身行动结束，计入本次施放。',
          patch: { skill: 'ultimate', addEffects: [status('taunt', 2, { to: self })] },
        },
        {
          lv: 6, desc: '藤条借座：蛮势力友方全体获得兀突骨最大生命 10% 的「护体毛」，持续 2 次持有者行动结束，兀突骨计入本次施放。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'shield', scale: { maxHp: 0.1 }, turns: 2, to: factionAllies('man') }] },
        },
        {
          lv: 9, desc: '凉茶备好：缩甲后，若自身仍有「灼烧」，净化自身所有负面效果，并获得「呼噜」（每次行动前回复自身 6% 最大生命，持续 2 次自身行动结束，计入本次施放）。',
          patch: {
            skill: 'ultimate', addEffects: [{
              t: 'when', cond: { c: 'status', id: 'burn' },
              then: [{ t: 'cleanse', to: self }, status('purr', 2, { power: 0.06, to: self })],
            }],
          },
        },
      ],
    },
    passive: {
      id: 'wtg_passive', name: '藤甲',
      desc: '每次受击后仍醒着时，积累 1 道窝沿印记（最多 3 道）。未处于「灼烧」时获得或续上「团团」（防御 +20%，持续 2 次自身行动结束；已有团团保留较高的增防值）；有「灼烧」时改为回复自身 5 点元气，不补充团团。藤窝结实，火堆请挪远些。',
      passive: [{
        on: 'onHurt', effects: [
          { t: 'counter', key: 'wutugu_nest', add: 1, max: 3, to: self },
          {
            t: 'when', cond: { c: 'not', cond: { c: 'status', id: 'burn' } },
            then: [status('curl', 2, { power: 0.2, to: self })],
            else: [energy(5, self)],
          },
        ],
      }],
    },
    awaken: {
      A: {
        name: '钻进猫窝',
        desc: '每整轮开始，若自身生命低于 50% 且有「团团」，回复自身 10% 最大生命；缩甲后额外净化自身 1 个负面效果。窝里留了凉垫，今天可以多睡一会儿。',
        patches: [
          {
            skill: 'passive', addPassive: {
              on: 'roundStart', cond: { c: 'and', conds: [{ c: 'hpBelow', pct: 0.5 }, { c: 'status', id: 'curl' }] },
              effects: [{ t: 'heal', scale: { maxHp: 0.1 }, to: self }],
            },
          },
          { skill: 'ultimate', addEffects: [{ t: 'cleanse', n: 1, to: self }] },
        ],
      },
      B: {
        name: '藤窝迎客',
        desc: '有「团团」时受击后仍醒着，对攻击者反击 50% 自身防御的物理伤害（每整轮最多 2 次）；缩甲后使蛮势力友方全体获得「团团」（防御 +20%，持续 2 次持有者行动结束，兀突骨计入本次施放）。来敲窝门的，都算客人。',
        patches: [
          {
            skill: 'passive', addPassive: {
              on: 'onHurt', cond: { c: 'status', id: 'curl' }, limit: { per: 'round', n: 2 },
              target: enemy('attacker'), effects: [{ t: 'damage', scale: { def: 0.5 }, elem: 'phys' }],
            },
          },
          { skill: 'ultimate', addEffects: [status('curl', 2, { power: 0.2, to: factionAllies('man') })] },
        ],
      },
    },
  },
  xian_zhangzhua: {
    heroId: 'xian_zhangzhua',
    basic: {
      id: 'zz_basic', name: '符水', fx: 'ranged.seal', target: enemy('random', 1),
      effects: [dmg(1.1, { elem: 'magic' }), status('charm', 3, { power: 0.1 })],
      desc: '对随机 1 名敌人造成 110% 攻击的法术伤害，再贴 1 层「符咒」（每层受到伤害 +10%，持续 3 次持有者行动结束，最多 5 层）。符纸贴得端正，鱼汤也没洒。',
    },
    ultimate: {
      id: 'zz_ult', name: '黄天当立', fx: 'ult.yellowHeaven', target: enemy('all'),
      effects: [dmg(1.4, { elem: 'magic' }), charmBurst(), status('yarn', 1)],
      desc: '对敌方全体造成 140% 攻击的法术伤害；随后对仍醒着且带「符咒」的敌人，各按其符咒层数追加每层 50% 攻击的法术伤害（最多 5 层），再施加「毛线缠」，持续 1 次持有者行动结束。黄巾一举，散开的猫都记得回来。',
      levelMods: [
        {
          lv: 3, desc: '符纸续页：绝技后为敌方全体再贴 1 层「符咒」（每层受到伤害 +10%，持续 3 次持有者行动结束，最多 5 层）。',
          patch: { skill: 'ultimate', addEffects: [status('charm', 3, { power: 0.1, to: enemy('all') })] },
        },
        {
          lv: 6, desc: '仙友同席：左慈喵在友方且醒着时，绝技后治疗友方全体，回复 50% 张爪攻击的生命。',
          patch: {
            skill: 'ultimate', addEffects: [{
              t: 'when', cond: { c: 'heroAlive', hero: 'xian_zuoci' }, then: [heal(0.5, ally('all'))],
            }],
          },
        },
        {
          lv: 9, desc: '黄巾劝歇：每整轮开始，使所有带「符咒」的敌人获得「受惊」（攻击 -15%，持续 2 次其行动结束）。',
          patch: {
            skill: 'passive', addPassive: {
              on: 'roundStart', target: enemy('all', undefined, { hasStatus: 'charm' }),
              effects: [status('fright', 2, { power: 0.15 })],
            },
          },
        },
      ],
    },
    passive: {
      id: 'zz_passive', name: '太平要术',
      desc: '每有 1 名友方睡着，张爪获得 1 层「炸毛」（每层攻击 +15%，持续 3 次自身行动结束，最多 3 层）。大家先歇着，下一壶符水由本喵来煮。',
      passive: [{ on: 'onAllyDeath', effects: [status('fluff', 3, { power: 0.15, to: self })] }],
    },
    awaken: {
      A: {
        name: '苍天已死',
        desc: '绝技后，所有已经带「符咒」的敌人再叠 1 层符咒（每层受到伤害 +10%，持续 3 次持有者行动结束，最多 5 层）；张爪使敌人睡着时，给随机 1 名仍醒着的敌人贴 2 层同样的符咒。黄巾传到下一位，太平道还没散席。',
        patches: [
          { skill: 'ultimate', addEffects: [status('charm', 3, { power: 0.1, to: enemy('all', undefined, { hasStatus: 'charm' }) })] },
          {
            skill: 'passive', addPassive: {
              on: 'onKill', target: enemy('random', 1), effects: [status('charm', 3, { power: 0.1, stacks: 2 })],
            },
          },
        ],
      },
      B: {
        name: '太平同饮',
        desc: '绝技后为友方全体施加「呼噜」（每次行动前回复该猫 5% 最大生命，持续 2 次其行动结束），并使仙势力友方获得「团团」（防御 +20%，持续 2 次其行动结束）；张爪计入本次施放。符水不问来处，热乎就好。',
        patches: [{
          skill: 'ultimate', addEffects: [status('purr', 2, { power: 0.05, to: ally('all') }), status('curl', 2, { power: 0.2, to: factionAllies('xian') })],
        }],
      },
    },
  },
  xian_shuijing: {
    heroId: 'xian_shuijing',
    basic: {
      id: 'sj_basic', name: '镜花', fx: 'heal.touch', target: ally('lowestHpPct', 1),
      effects: [heal(1.0), shield(0.3, 2)],
      desc: '治疗生命比例最低的 1 名友方，回复 100% 水镜攻击的生命，并给予 30% 水镜攻击的「护体毛」，持续 2 次持有者行动结束；若选中水镜，计入本次普攻。水里那朵花，今天替你开。',
    },
    ultimate: {
      id: 'sj_ult', name: '水镜观势', fx: 'ult.waterMirror', target: ally('all'),
      effects: [heal(1.0), shield(0.45, 2), energy(15)],
      desc: '友方全体回复 100% 水镜攻击的生命，获得 45% 水镜攻击的「护体毛」（持续 2 次持有者行动结束，水镜计入本次施放），并回复 15 点元气。先生看过水面，才想起来还有茶没分。',
      levelMods: [
        {
          lv: 3, desc: '拂去水纹：观势后净化每名友方 1 个负面效果。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'cleanse', n: 1, to: ally('all') }] },
        },
        {
          lv: 6, desc: '蜀仙共读：观势后，蜀与仙势力友方获得「呼噜」（每次行动前回复该猫 5% 最大生命，持续 2 次其行动结束，水镜计入本次施放）。',
          patch: {
            skill: 'ultimate', addEffects: [status('purr', 2, { power: 0.05, to: factionAllies('shu') }), status('purr', 2, { power: 0.05, to: factionAllies('xian') })],
          },
        },
        {
          lv: 9, desc: '先看一步：敌方释放绝技前，为生命比例最低的 1 名友方给予 80% 水镜攻击的「护体毛」（持续 2 次其行动结束）与「幻象」（闪避下一次直接攻击，持续 1 次其行动结束），每整轮最多 1 次。',
          patch: {
            skill: 'passive', addPassive: {
              on: 'onEnemyUlt', limit: { per: 'round', n: 1 }, target: ally('lowestHpPct', 1),
              effects: [shield(0.8, 2), status('illusion', 1)],
            },
          },
        },
      ],
    },
    passive: {
      id: 'sj_passive', name: '好，好，好',
      desc: '每整轮开始，为元气最低的 1 名友方回复 10 点元气，并记下 1 次授课；累计 3 次后，给基础攻击最高的 1 名友方（不计临时增减）施加 1 层「炸毛」（每层攻击 +20%，持续 2 次其行动结束，最多 3 层），再清空授课次数。第三声好，总算记得夸谁了。',
      passive: [{
        on: 'roundStart', effects: [
          energy(10, ally('lowestEnergy', 1)),
          { t: 'counter', key: 'shuijing_lessons', add: 1, max: 3, to: self },
          {
            t: 'when', cond: { c: 'counter', key: 'shuijing_lessons', atLeast: 3 },
            then: [status('fluff', 2, { power: 0.2, to: ally('highestAtk', 1) }), { t: 'counter', key: 'shuijing_lessons', add: -3, to: self }],
          },
        ],
      }],
    },
    awaken: {
      A: {
        name: '伏龙凤雏',
        desc: '诸葛喵亮在友方且醒着时，每当蜀势力队友行动结束，水镜为该猫回复 8 点元气，并给予 30% 水镜攻击的「护体毛」，持续 2 次持有者行动结束，计入该同伴本次行动。学生交完小报告，先生才把批注递过去。',
        patches: [{
          skill: 'passive', addPassive: {
            on: 'onAllyAct', effects: [{
              t: 'when', to: ally('source'),
              cond: { c: 'and', conds: [{ c: 'heroAlive', hero: 'shu_zhugemiaoliang' }, { c: 'targetFaction', faction: 'shu' }] },
              then: [energy(8), shield(0.3, 2)],
            }],
          },
        }],
      },
      B: {
        name: '镜底留灯',
        desc: '观势后为友方全体施加「幻象」，闪避下一次直接攻击，持续 2 次持有者行动结束，水镜计入本次施放；敌方首次释放绝技前，为生命比例最低的 1 名友方给予「九命」，抵挡一次直接致命伤害并保留 15% 最大生命，持续 3 次持有者行动结束，每场施加 1 次。水镜留着一点亮，晚归的猫也找得到路。',
        patches: [
          { skill: 'ultimate', addEffects: [status('illusion', 2, { to: ally('all') })] },
          {
            skill: 'passive', addPassive: {
              on: 'onEnemyUlt', limit: { per: 'battle', n: 1 }, target: ally('lowestHpPct', 1), effects: [status('nine', 3)],
            },
          },
        ],
      },
    },
  },
  xian_guanlu: {
    heroId: 'xian_guanlu',
    basic: {
      id: 'gl_basic', name: '抛铜钱', fx: 'ranged.seal', target: enemy('random', 1),
      effects: [dmg(1.0, { elem: 'magic' }), { t: 'when', cond: { c: 'chance', p: 0.5 }, then: [dmg(0.5, { elem: 'magic' })], else: [energy(10, self)] }],
      desc: '对随机 1 名敌人造成 100% 攻击的法术伤害，再抛 1 枚铜钱：50% 概率正面，追加 50% 攻击的法术伤害；反面则回复自身 10 点元气。铜钱落定，摊主的笑容没变。',
    },
    ultimate: {
      id: 'gl_ult', name: '卜卦', fx: 'ult.coinDivination', target: enemy('all'),
      effects: [resetCoins(), dmg(0.4, { elem: 'magic' }), { t: 'repeat', n: 3, effects: [coinRoll()] }],
      desc: '先用卦风对敌方全体造成 40% 攻击的法术伤害，再独立抛 3 枚铜钱；每枚有 50% 概率正面，对敌方全体造成 80% 攻击的法术伤害；反面则给友方全体添加 40% 管辂攻击的「护体毛」（持续 2 次持有者行动结束，管辂计入本次施放，可同时保有多份）。本次正面枚数重新计算，鱼干账另算。',
      levelMods: [
        {
          lv: 3, desc: '铜钱余音：前 3 枚铜钱落定后，为元气最低的 1 名友方回复 12 点元气。',
          patch: { skill: 'ultimate', addEffects: [energy(12, ally('lowestEnergy', 1))] },
        },
        {
          lv: 6, desc: '摊边热汤：完成回能后，治疗此时元气最低的 1 名友方，回复 80% 管辂攻击的生命。',
          patch: { skill: 'ultimate', addEffects: [heal(0.8, ally('lowestEnergy', 1))] },
        },
        {
          lv: 9, desc: '卦象落笔：前 3 枚至少 2 枚正面时，敌方全体叠 1 层「符咒」（每层受到伤害 +10%，持续 2 次持有者行动结束，最多 5 层）；否则友方全体获得「团团」（防御 +20%，持续 2 次持有者行动结束，管辂计入本次施放）。',
          patch: {
            skill: 'ultimate', addEffects: [{
              t: 'when', cond: { c: 'counter', key: COIN_HEADS, atLeast: 2 },
              then: [status('charm', 2, { power: 0.1, to: enemy('all') })],
              else: [status('curl', 2, { power: 0.2, to: ally('all') })],
            }],
          },
        },
      ],
    },
    passive: {
      id: 'gl_passive', name: '天机',
      desc: '战斗开始时，窥探敌方元气最高的 1 名猫猫，使其元气降低 30 点。摊位还没铺好，算盘先拨了一下。',
      passive: [{ on: 'battleStart', effects: [energy(-30, enemy('highestEnergy', 1))] }],
    },
    awaken: {
      A: {
        name: '铜钱剑',
        desc: '前三枚铜钱和升级效果结算后，再独立抛 2 枚相同铜钱（每枚 50% 正面：全体敌人受到 80% 攻击的法术伤害；反面：全体友方获得 40% 管辂攻击的护盾，持续 2 次持有者行动结束，管辂计入本次施放）。本次全部 5 枚都是正面时，额外对敌方全体造成 200% 攻击的法术伤害。五枚串起一柄小剑，天机总算排整齐了。',
        patches: [{
          skill: 'ultimate', addEffects: [
            { t: 'repeat', n: 2, effects: [coinRoll()] },
            { t: 'when', cond: { c: 'counter', key: COIN_HEADS, atLeast: 5 }, then: [dmg(2.0, { elem: 'magic', to: enemy('all') })] },
          ],
        }],
      },
      B: {
        name: '反面添碗',
        desc: '绝技前三枚铜钱至少 2 枚反面时，为友方全体回复 100% 管辂攻击的生命，并各净化 1 个负面效果；否则自身回复 20 点元气。卦不好看，汤还能添一碗。',
        patches: [{
          skill: 'ultimate', addEffects: [{
            t: 'when', cond: { c: 'not', cond: { c: 'counter', key: COIN_HEADS, atLeast: 2 } },
            then: [heal(1.0, ally('all')), { t: 'cleanse', n: 1, to: ally('all') }],
            else: [energy(20, self)],
          }],
        }],
      },
    },
  },
};
