// 第二批猫猫：技能说明与 DSL 一并维护，未获确认的能力不以近似规则代填。
import type { DamageBonus, Effect, Kit } from '../../engine/types';
import { ally, dmg, energy, enemy, heal, self, shield, status } from './helpers';

const count = (key: string, add: number, max: number): Effect => ({ t: 'counter', key, add, max, to: self });

const firstCup = (atk: number): Effect => ({
  t: 'when', cond: { c: 'not', cond: { c: 'counter', key: 'hx_first', atLeast: 1 } },
  then: [dmg(atk, { critBonus: 1 }), count('hx_first', 1, 1)],
  else: [dmg(atk)],
});

// 各档互斥，只取当前拍数对应的加伤，不把逐档乘区叠成复利。
const bellBonus: DamageBonus[] = Array.from({ length: 5 }, (_, i) => {
  const n = i + 1;
  return {
    cond: { c: 'and', conds: [
      { c: 'counter', key: 'gn_bells', atLeast: n },
      { c: 'not', cond: { c: 'counter', key: 'gn_bells', atLeast: n + 1 } },
    ] },
    mult: 1 + n * 0.08,
  };
});

// 北伐从整轮开始或升级/觉醒推进；满层即结算，计数不会停在三层等下一轮。
const northMarch = (): Effect[] => [
  count('jw_north', 1, 3),
  { t: 'when', cond: { c: 'counter', key: 'jw_north', atLeast: 3 }, then: [
    status('curl', 2, { power: 0.15, to: ally('all') }),
    energy(10, ally('all')),
    count('jw_north', -3, 3),
    { t: 'when', cond: { c: 'counter', key: 'jw_quiet', atLeast: 1 }, then: [status('yarn', 1, { to: enemy('highestEnergy', 1) })] },
  ] },
];

// 每组攻击开始时数醒着的同伴；各档互斥，睡着的同伴不占名额。
const narrowBridge = (atk: number, hits = 1): Effect => ({
  t: 'when', cond: { c: 'allyCount', atMost: 1 }, then: [dmg(atk, { hits, critBonus: 0.4 })],
  else: [{ t: 'when', cond: { c: 'allyCount', atMost: 2 }, then: [dmg(atk, { hits, critBonus: 0.25 })],
    else: [{ t: 'when', cond: { c: 'allyCount', atMost: 3 }, then: [dmg(atk, { hits, critBonus: 0.1 })], else: [dmg(atk, { hits })] }],
  }],
});

const steadyRanks = (): Effect[] => [
  count('xh_steady', 1, 4),
  ...Array.from({ length: 4 }, (_, i): Effect => ({
    t: 'when', cond: { c: 'and', conds: [
      { c: 'counter', key: 'xh_steady', atLeast: i + 1 },
      { c: 'not', cond: { c: 'counter', key: 'xh_steady', atLeast: i + 2 } },
    ] },
    then: [status('curl', 2, { power: (i + 1) * 5 / 100, to: self })],
  })),
];

export const KITS_B2: Record<string, Kit> = {
  // 甘宁宁：行动攒铃声，夜袭再动与护送同伴分走两条路线。
  wu_ganning: {
    heroId: 'wu_ganning',
    basic: {
      id: 'gn_basic', name: '铃钩', fx: 'melee.slash', melee: true, target: enemy('back', 1),
      effects: [dmg(1.05, { bonus: bellBonus })],
      desc: '对后排随机 1 名敌人造成 105% 攻击的物理伤害；后排空则选择前排。每拍自身铃声使本次伤害提高 8%，最多 5 拍、提高 40%。钩尖收着，铃铛倒是藏不住。',
    },
    ultimate: {
      id: 'gn_ult', name: '锦帆夜袭', fx: 'ult.silkSail', melee: true, target: enemy('back', 1),
      effects: [dmg(0.75, { hits: 3, bonus: bellBonus })],
      desc: '对后排随机 1 名敌人连续出钩 3 次，每次造成 75% 攻击的物理伤害；后排空则选择前排。每拍自身铃声使这 3 次伤害各提高 8%，最多提高 40%。船帆可以卷好，铃声先到岸上。',
      levelMods: [
        { lv: 3, desc: '留铃认路：3 钩结束后，为原目标施加「铃铛标记」（受到直接伤害 +10%，被暴击概率 +10 个百分点，持续 2 次其行动结束）。',
          patch: { skill: 'ultimate', addEffects: [status('mark', 2)] } },
        { lv: 6, desc: '借走半拍：3 钩结束后，使原目标减少 15 点元气。',
          patch: { skill: 'ultimate', addEffects: [energy(-15)] } },
        { lv: 9, desc: '铃声满舱：绝技结束时，自身已有 5 拍铃声则向元气最高的 1 名存活敌人追加 55% 攻击的物理伤害；这次追钩不额外计算铃声加伤。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'counter', key: 'gn_bells', atLeast: 5 }, then: [dmg(0.55, { to: enemy('highestEnergy', 1) })] }] } },
      ],
    },
    passive: {
      id: 'gn_passive', name: '锦帆铃声',
      desc: '每次能行动时，出手前为自身累计 1 拍铃声，最多 5 拍，普攻与绝技都计入；「晕乎乎」跳过行动不计。自身每次直接伤害暴击后回复 6 点元气，每整轮最多 2 次。人先上船，铃声也跟着排队。',
      passive: [
        { on: 'beforeAct', effects: [count('gn_bells', 1, 5)] },
        { on: 'onCrit', limit: { per: 'round', n: 2 }, effects: [energy(6, self)] },
      ],
    },
    awaken: {
      A: {
        name: '百骑夜行',
        desc: '自身直接伤害暴击后立刻获得一次再动，每整轮最多触发 1 次。再动也会累计铃声；船靠岸了，宁宁再走一趟。',
        patches: [{ skill: 'passive', addPassive: { on: 'onCrit', limit: { per: 'round', n: 1 }, effects: [{ t: 'extraTurn' }] } }],
      },
      B: {
        name: '铃响护归帆',
        desc: '自身行动结束、至少已有 3 拍铃声时，为生命比例最低的 1 名友方提供 40% 自身攻击的护盾，持续 2 次持有者行动结束；若选中自身，计入本次行动。每整轮最多触发 1 次。铃声指路，同伴先上船。',
        patches: [{ skill: 'passive', addPassive: { on: 'afterAct', cond: { c: 'counter', key: 'gn_bells', atLeast: 3 }, limit: { per: 'round', n: 1 }, target: ally('lowestHpPct', 1), effects: [shield(0.4, 2)] } }],
      },
    },
  },

  // 华雄雄：首击先声夺猫，薄荷奶会打乱叫阵的拍子。
  qun_huaxiong: {
    heroId: 'qun_huaxiong',
    basic: {
      id: 'hx_basic', name: '关前大刀', fx: 'melee.glaive', melee: true, target: enemy('front', 1),
      effects: [firstCup(1.2)],
      desc: '对前排随机 1 名敌人造成 120% 攻击的物理伤害；前排无人时选择后排。本场首次未「猫薄荷醉」的普攻或绝技攻击，命中时必定暴击。杯子还温着，先把嗓子清好。',
    },
    ultimate: {
      id: 'hx_ult', name: '温盏叫阵', fx: 'ult.teaChallenge', melee: true, target: enemy('front', 1),
      effects: [firstCup(2.6)],
      desc: '对前排随机 1 名敌人造成 260% 攻击的物理伤害；前排无人时选择后排。若是本场首次未「猫薄荷醉」的普攻或绝技攻击，命中时必定暴击。这声叫阵，比热奶的白气更长。',
      levelMods: [
        { lv: 3, desc: '话音先落：绝技攻击结束后，使原目标减少 20 点元气。',
          patch: { skill: 'ultimate', addEffects: [energy(-20)] } },
        { lv: 6, desc: '刀风止喧：绝技攻击结束后，使原目标「受惊」（攻击降低 12%，持续 2 次其行动结束）。',
          patch: { skill: 'ultimate', addEffects: [status('fright', 2, { power: 0.12 })] } },
        { lv: 9, desc: '添杯缓口气：绝技基础效果结束时，若自身生命低于 50%，回复 75% 自身攻击的生命。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'hpBelow', pct: 0.5 }, then: [heal(0.75, self)] }] } },
      ],
    },
    passive: {
      id: 'hx_passive', name: '杯还温着',
      desc: '本场首次未「猫薄荷醉」的普攻或绝技攻击，命中时必定暴击，此次攻击后便用掉机会。「猫薄荷醉」期间，每次能行动时出手前额外减少自身 20 点元气，混乱攻击不消耗这次首击机会。自身直接伤害暴击后回复 5 点元气，每整轮最多 1 次；奶香也会让叫阵走神。',
      passive: [
        { on: 'beforeAct', cond: { c: 'status', id: 'nip' }, effects: [energy(-20, self)] },
        { on: 'onCrit', limit: { per: 'round', n: 1 }, effects: [energy(5, self)] },
      ],
    },
    awaken: {
      A: {
        name: '温盏抢先',
        desc: '自身直接伤害使目标睡着后，回复 20 点元气，并获得「猫步」（速度提高 15%，持续 2 次自身行动结束；在自身行动中触发计入本次）。每整轮最多触发 1 次。下一杯先放好，叫阵还没散场。',
        patches: [{ skill: 'passive', addPassive: { on: 'onKill', limit: { per: 'round', n: 1 }, effects: [energy(20, self), status('step', 2, { power: 0.15, to: self })] } }],
      },
      B: {
        name: '关前守杯',
        desc: '受到非致命直接伤害后，净化自身 1 个负面效果，并获得 100% 自身防御的护盾，持续 2 次自身行动结束；若在自身行动中触发计入本次。每整轮最多触发 1 次。杯托摆稳，热奶先别洒。',
        patches: [{ skill: 'passive', addPassive: { on: 'onHurt', limit: { per: 'round', n: 1 }, effects: [{ t: 'cleanse', n: 1, to: self }, { t: 'shield', scale: { def: 1 }, turns: 2, to: self }] } }],
      },
    },
  },

  // 于吉吉：符水持续照护；两觉醒分别让药水带护盾、以回能和受惊反制敌方绝技。
  xian_yuji: {
    heroId: 'xian_yuji',
    basic: {
      id: 'yj_basic', name: '拂尘点水', fx: 'ranged.teal', target: enemy('random', 1),
      effects: [dmg(0.9, { elem: 'magic' }), heal(0.6, ally('lowestHpPct', 1))],
      desc: '对随机 1 名敌人造成 90% 攻击的法术伤害，并为生命比例最低的 1 名友方回复 60% 自身攻击的生命。拂尘轻点，水碗先摆稳。',
    },
    ultimate: {
      id: 'yj_ult', name: '符水济众', fx: 'ult.talismanWater', target: ally('all'),
      effects: [heal(1.0), { t: 'cleanse', n: 1 }, status('purr', 3, { power: 0.05 })],
      desc: '友方全体各回复于吉吉 100% 攻击的生命，净化各 1 个负面效果，并获得「呼噜」（每次持有者行动开始回复其最大生命的 5%，持续 3 次其行动结束；于吉吉计入本次施法）。同名呼噜保留较高回复比例。符水趁温喝，小鱼干汤的配方先保密。',
      levelMods: [
        { lv: 3, desc: '杯沿添暖：符水基础效果结束后，生命比例最低的 1 名友方获得 45% 于吉吉攻击的护盾，持续 2 次持有者行动结束；选中自身计入本次施法。',
          patch: { skill: 'ultimate', addEffects: [shield(0.45, 2, ally('lowestHpPct', 1))] } },
        { lv: 6, desc: '云间续水：左慈喵仍在友方场上时，符水基础效果结束后，使仙势力中元气最低的 1 名猫猫回复 15 点元气。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'heroAlive', hero: 'xian_zuoci' }, then: [energy(15, ally('lowestEnergy', 1, { faction: 'xian' }))] }] } },
        { lv: 9, desc: '两碗一壶：每次符水基础效果结束后，自身累计 1 次添水；累计至 2 次时，净化友方全体各 1 个额外负面效果，并清空添水计数。',
          patch: { skill: 'ultimate', addEffects: [count('yj_refill', 1, 2), { t: 'when', cond: { c: 'counter', key: 'yj_refill', atLeast: 2 }, then: [{ t: 'cleanse', n: 1, to: ally('all') }, count('yj_refill', -2, 2)] }] } },
      ],
    },
    passive: {
      id: 'yj_passive', name: '温水常备',
      desc: '每整轮开始，为生命比例最低的 1 名友方净化 1 个负面效果，并回复其最大生命 3% 的生命；每整轮 1 次。汤壶放在身旁，谁凉了先添谁的。',
      passive: [{ on: 'roundStart', limit: { per: 'round', n: 1 }, target: ally('lowestHpPct', 1), effects: [{ t: 'cleanse', n: 1 }, { t: 'heal', scale: { targetMaxHp: 0.03 } }] }],
    },
    awaken: {
      A: {
        name: '太平暖盏',
        desc: '于吉吉实际受到治疗后，为生命比例最低的 1 名友方提供 40% 自身攻击的护盾，持续 2 次持有者行动结束；若在自身行动中选中自己，计入当前行动。每整轮最多触发 1 次。自己捧热碗，也给同伴垫好杯底。',
        patches: [{ skill: 'passive', addPassive: { on: 'onHealed', limit: { per: 'round', n: 1 }, target: ally('lowestHpPct', 1), effects: [shield(0.4, 2)] } }],
      },
      B: {
        name: '清谈止喧',
        desc: '敌方施放绝技前，于吉吉回复 8 点元气，并使该施法者「受惊」（攻击降低 10%，持续 2 次其行动结束，计入本次绝技）；每整轮最多触发 1 次。绝技已选定，先请对方放轻嗓门。',
        patches: [{ skill: 'passive', addPassive: { on: 'onEnemyUlt', limit: { per: 'round', n: 1 }, target: enemy('source'), effects: [energy(8, self), status('fright', 2, { power: 0.1 })] } }],
      },
    },
  },

  // 黄忠忠：生命门槛决定箭数，选择追箭或在低生命时护送同伴。
  shu_huangzhong: {
    heroId: 'shu_huangzhong',
    basic: {
      id: 'hz_basic', name: '老弓试弦', fx: 'ranged.arrow', target: enemy('back', 1),
      effects: [
        dmg(1.1),
        { t: 'when', cond: { c: 'hpBelow', pct: 0.5 }, then: [dmg(0.3)] },
        { t: 'when', cond: { c: 'hpBelow', pct: 0.25 }, then: [dmg(0.3)] },
      ],
      desc: '对后排随机 1 名敌人射出一箭，造成 110% 攻击的物理伤害；后排空则选择前排。第一箭后，若自身当前生命低于 50%，再射一箭（30% 攻击）；随后若仍低于 25%，再射一箭（30% 攻击），均追原目标。眼睛眯着，弓弦倒很清醒。',
    },
    ultimate: {
      id: 'hz_ult', name: '百步铃箭', fx: 'ult.bellArrow', target: enemy('back', 1),
      effects: [{ t: 'when', cond: { c: 'hpBelow', pct: 0.25 }, then: [dmg(0.6, { hits: 6 })], else: [
        { t: 'when', cond: { c: 'hpBelow', pct: 0.5 }, then: [dmg(0.6, { hits: 4 })], else: [dmg(0.6, { hits: 2 })] },
      ] }],
      desc: '向后排随机 1 名敌人连射，每箭造成 60% 攻击的物理伤害；后排空则选择前排。开始连射时自身生命不低于 50% 射 2 箭，低于 50% 但不低于 25% 射 4 箭，低于 25% 射 6 箭；原目标睡着后，余箭不转攻其他猫。老将先数箭，白胡子不用跟着数。',
      levelMods: [
        { lv: 3, desc: '铃声别跑远：连射后为原目标施加「铃铛标记」（受到直接伤害 +10%，被暴击概率 +10 个百分点，持续 2 次其行动结束）。',
          patch: { skill: 'ultimate', addEffects: [status('mark', 2)] } },
        { lv: 6, desc: '慢半盏茶：连射后使原目标减少 15 点元气。',
          patch: { skill: 'ultimate', addEffects: [energy(-15)] } },
        { lv: 9, desc: '须弓相映：关云喵仍在友方场上时，连射后另向后排随机 1 名存活敌人追加一箭，造成 35% 攻击的物理伤害；后排空则选择前排。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'heroAlive', hero: 'shu_guanyunmiao' }, then: [dmg(0.35, { to: enemy('back', 1) })] }] } },
      ],
    },
    passive: {
      id: 'hz_passive', name: '老当益壮',
      desc: '受到非致命直接伤害后，若自身生命低于 50%，额外回复 10 点元气，每整轮最多 1 次。受直接伤害后生命首次低于 25% 时，另获「幻象」，可闪避下一次直接攻击，持续 2 次自身行动结束；在自身行动中触发计入本次，每场仅 1 次。箭袋放近些，老将还没打算歇。',
      passive: [
        { on: 'onHurt', cond: { c: 'hpBelow', pct: 0.5 }, limit: { per: 'round', n: 1 }, effects: [energy(10, self)] },
        { on: 'lowHp', hpPct: 0.25, effects: [status('illusion', 2, { to: self })] },
      ],
    },
    awaken: {
      A: {
        name: '弦上追铃',
        desc: '自身直接伤害暴击后，向元气最高的 1 名存活敌人追射一箭，造成 45% 攻击的物理伤害，每整轮最多触发 1 次。连射越密，弦上的铃也越热闹。',
        patches: [{ skill: 'passive', addPassive: { on: 'onCrit', limit: { per: 'round', n: 1 }, target: enemy('highestEnergy', 1), effects: [dmg(0.45)] } }],
      },
      B: {
        name: '老弓护粮',
        desc: '自身行动收招时，若生命低于 50%，净化自身 1 个负面效果，并为生命比例最低的 1 名其他友方提供 40% 黄忠忠攻击的护盾，持续 2 次其行动结束；每整轮最多触发 1 次。白胡子留在后头，同伴先把粮袋抱稳。',
        patches: [{ skill: 'passive', addPassive: { on: 'afterAct', cond: { c: 'hpBelow', pct: 0.5 }, limit: { per: 'round', n: 1 }, effects: [{ t: 'cleanse', n: 1, to: self }, shield(0.4, 2, ally('lowestHpPct', 1, { exclSelf: true }))] } }],
      },
    },
  },

  // 马超超：开战冲锋不消耗正常行动；击睡后再动按引擎只追加一次。
  shu_machao: {
    heroId: 'shu_machao',
    basic: {
      id: 'mc_basic', name: '锦枪点阵', fx: 'melee.pierce', melee: true, target: enemy('front', 1),
      effects: [dmg(1.25)],
      desc: '对前排随机 1 名敌人造成 125% 攻击的物理伤害；前排无人时选择后排。披风先收半寸，别挂上自己的枪尾。',
    },
    ultimate: {
      id: 'mc_ult', name: '锦马破阵', fx: 'ult.brocadeCharge', melee: true, target: enemy('front', 1),
      effects: [dmg(2.25, { ignoreDef: 0.15 })],
      desc: '对前排随机 1 名敌人造成 225% 攻击的物理伤害，无视其 15% 防御；前排无人时选择后排。白马踏过，锦袍仍要叠齐。',
      levelMods: [
        { lv: 3, desc: '枪缨认阵：破阵后为原目标施加「铃铛标记」（受到直接伤害 +10%，被暴击概率 +10 个百分点，持续 2 次其行动结束）。',
          patch: { skill: 'ultimate', addEffects: [status('mark', 2)] } },
        { lv: 6, desc: '锦袍挡风：破阵后自身获得最大生命 10% 的护盾，持续 2 次自身行动结束，计入本次施法。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'shield', scale: { maxHp: 0.1 }, turns: 2, to: self }] } },
        { lv: 9, desc: '两程再跃：每次破阵后自身累计 1 次行程；累计至 2 次时，另向前排随机 1 名存活敌人造成 70% 攻击的物理伤害，然后清空行程计数；前排无人时选择后排。',
          patch: { skill: 'ultimate', addEffects: [count('mc_journey', 1, 2), { t: 'when', cond: { c: 'counter', key: 'mc_journey', atLeast: 2 }, then: [dmg(0.7, { to: enemy('front', 1) }), count('mc_journey', -2, 2)] }] } },
      ],
    },
    passive: {
      id: 'mc_passive', name: '白马先登',
      desc: '开战时先对前排随机 1 名敌人冲锋，造成 80% 攻击的物理伤害，前排无人时选择后排；这次开场打击不消耗正常行动或元气。自身另获「猫步」（速度提高 15%，持续 2 次自身行动结束）。自身直接伤害使目标睡着后，获得一次再动，每整轮最多触发 1 次；开场冲锋获再动时，在首次正常行动后执行。一次正常行动之后最多追加一次行动，再动内的击睡不会继续串联。',
      passive: [
        { on: 'battleStart', target: enemy('front', 1), effects: [dmg(0.8), status('step', 2, { power: 0.15, to: self })] },
        { on: 'onKill', limit: { per: 'round', n: 1 }, effects: [{ t: 'extraTurn' }] },
      ],
    },
    awaken: {
      A: {
        name: '西凉追风',
        desc: '绝技改为对后排随机 1 名敌人出手，后排空则选择前排；绝技原有效果结束后，自身回复 15 点元气。Lv9 的另一次行程打击仍优先前排，披风替后来的同伴指路。',
        patches: [{ skill: 'ultimate', retarget: enemy('back', 1), addEffects: [energy(15, self)] }],
      },
      B: {
        name: '锦袍留暖',
        desc: '绝技原有效果结束后，为生命比例最低的 1 名友方提供 60% 马超超攻击的护盾，并净化其 1 个负面效果。护盾持续 2 次其行动结束；选中自身时计入本次施法。锦袍分出一角，赶路也能避风。',
        patches: [{ skill: 'ultimate', addEffects: [shield(0.6, 2, ally('lowestHpPct', 1)), { t: 'cleanse', n: 1, to: ally('lowestHpPct', 1) }] }],
      },
    },
  },

  // 姜喵维：按整轮积攒北伐；觉醒选择加快推进或在满层时压制绝技。
  shu_jiangwei: {
    heroId: 'shu_jiangwei',
    basic: {
      id: 'jw_basic', name: '问阵长枪', fx: 'melee.pierce', melee: true, target: enemy('front', 1),
      effects: [dmg(0.95, { elem: 'magic' })],
      desc: '对前排随机 1 名敌人造成 95% 攻击的法术伤害；前排无人时选择后排。枪尖点阵，书页记下哪块砖适合下一回停爪。',
    },
    ultimate: {
      id: 'jw_ult', name: '再赴祁山', fx: 'ult.qishan', target: enemy('frontRow'),
      effects: [dmg(1.35, { elem: 'magic' }), energy(8, ally('lowestEnergy', 1))],
      desc: '对敌方前排全体造成 135% 攻击的法术伤害，前排无人时作用于敌方全体；友方元气最低的 1 名猫猫回复 8 点元气。地图卷好了，末尾还夹着一张下回的路条。',
      levelMods: [
        { lv: 3, desc: '阵前缓步：绝技基础效果结束后，使原来选中的存活敌人「受惊」（攻击降低 10%，持续 2 次其行动结束）。',
          patch: { skill: 'ultimate', addEffects: [status('fright', 2, { power: 0.1 })] } },
        { lv: 6, desc: '再记一程：绝技基础效果结束后，自身额外累计 1 层北伐；若达到 3 层，立即按「北伐不止」结算团队增益并清零，姜喵维的团团持续次数计入本次施法。',
          patch: { skill: 'ultimate', addEffects: northMarch() } },
        { lv: 9, desc: '卧龙留卷：诸葛喵亮仍在友方场上时，绝技出手前、先于基础效果，为元气最低的 1 名其他蜀势力友方回复 12 点元气。',
          patch: { skill: 'passive', addPassive: { on: 'onUlt', cond: { c: 'heroAlive', hero: 'shu_zhugemiaoliang' }, target: ally('lowestEnergy', 1, { faction: 'shu', exclSelf: true }), effects: [energy(12)] } } },
      ],
    },
    passive: {
      id: 'jw_passive', name: '北伐不止',
      desc: '每整轮开始，自身累计 1 层北伐，最多 3 层；满 3 层时，友方全体获得「团团」（防御提高 15%，同名更强增防沿用较高值，持续 2 次持有者行动结束）并各回复 10 点元气，随后清空北伐计数。地图可以补边，前进的路不用从头算。',
      passive: [{ on: 'roundStart', effects: northMarch() }],
    },
    awaken: {
      A: {
        name: '九伐不歇',
        desc: '普攻原有效果结束后，自身额外累计 1 层北伐；达到 3 层时立即结算「北伐不止」的团队增益并清零。若在自身行动中结算，团团持续 2 次自身行动结束、计入当前行动。每次收枪，都顺手把下一程标好。',
        patches: [{ skill: 'basic', addEffects: northMarch() }],
      },
      B: {
        name: '祁山止喧',
        desc: '每次北伐满 3 层结算团队增益时，额外使敌方元气最高的 1 名猫猫「毛线缠」，无法施放绝技，持续 1 次其行动结束，仍受控制免疫影响。先把对面的嗓门压低，粮车才能听见路。',
        patches: [{ skill: 'passive', addPassive: { on: 'battleStart', effects: [count('jw_quiet', 1, 1)] } }],
      },
    },
  },

  // 张喵辽：桥口越窄，出手越准；再动突阵与护送余伴分开研究。
  wei_zhangliao: {
    heroId: 'wei_zhangliao',
    basic: {
      id: 'zl_basic', name: '双刃过桥', fx: 'melee.slash', melee: true, target: enemy('front', 1),
      effects: [narrowBridge(1.2)],
      desc: '对前排随机 1 名敌人造成 120% 攻击的物理伤害；前排空则选择后排。友方醒着的猫猫（含自身）有 3 名时，本次暴击率额外提高 10 个百分点；2 名提高 25 个百分点，仅自身提高 40 个百分点，取对应一档。桥口留半步，双刃恰好并肩。',
    },
    ultimate: {
      id: 'zl_ult', name: '八百踏津', fx: 'ult.ford', melee: true, target: enemy('back', 1),
      effects: [narrowBridge(0.85, 3)],
      desc: '对后排随机 1 名敌人连续出刃 3 次，每次造成 85% 攻击的物理伤害；后排空则选择前排。开始这组连击时，友方醒猫（含自身）有 3 名，3 击暴击率各额外提高 10 个百分点；2 名提高 25 个百分点，仅自身提高 40 个百分点，取对应一档。人不必挤满桥，脚步先排好。',
      levelMods: [
        { lv: 3, desc: '桥头留铃：3 击结束后，为原目标施加「铃铛标记」（受到直接伤害 +10%，被暴击概率 +10 个百分点，持续 2 次其行动结束）。',
          patch: { skill: 'ultimate', addEffects: [status('mark', 2)] } },
        { lv: 6, desc: '归路清障：绝技基础效果结束后，净化自身 1 个负面效果。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'cleanse', n: 1, to: self }] } },
        { lv: 9, desc: '三渡逍遥津：每次绝技基础效果结束后，自身累计 1 次渡桥；满 3 次时，向攻击最高的 1 名存活敌人追加 65% 攻击的物理伤害，并清空渡桥计数。这一击不附带醒猫数量的暴击加成。',
          patch: { skill: 'ultimate', addEffects: [count('zl_crossings', 1, 3), { t: 'when', cond: { c: 'counter', key: 'zl_crossings', atLeast: 3 }, then: [dmg(0.65, { to: enemy('highestAtk', 1) }), count('zl_crossings', -3, 3)] }] } },
      ],
    },
    passive: {
      id: 'zl_passive', name: '津口点兵',
      desc: '开战时获得「猫步」（速度提高 10%，持续 2 次自身行动结束）。普攻与绝技按出招时的友方醒猫数提高暴击率，含自身；同伴睡着后不再计入。自身直接伤害暴击后回复 8 点元气，每整轮最多 2 次。点兵不吵船夫，铃声也要压轻些。',
      passive: [
        { on: 'battleStart', effects: [status('step', 2, { power: 0.1, to: self })] },
        { on: 'onCrit', limit: { per: 'round', n: 2 }, effects: [energy(8, self)] },
      ],
    },
    awaken: {
      A: {
        name: '窄桥再渡',
        desc: '自身直接伤害使目标睡着后，若友方醒猫（含自身）不超过 2 名，获得一次再动，每整轮最多触发 1 次。一次正常行动后最多追加一次行动，再动中的击睡不继续串联。窄桥走过，还能折返一趟。',
        patches: [{ skill: 'passive', addPassive: { on: 'onKill', cond: { c: 'allyCount', atMost: 2 }, limit: { per: 'round', n: 1 }, effects: [{ t: 'extraTurn' }] } }],
      },
      B: {
        name: '余伴归帆',
        desc: '其他友方睡着后，自身获得最大生命 12% 的护盾，持续 2 次自身行动结束；在自身行动中触发计入本次。并治疗生命比例最低的 1 名其他存活友方（65% 张喵辽攻击），每整轮最多 1 次。桥上少一声脚步，归帆多留一角。',
        patches: [{ skill: 'passive', addPassive: { on: 'onAllyDeath', limit: { per: 'round', n: 1 }, effects: [{ t: 'shield', scale: { maxHp: 0.12 }, turns: 2, to: self }, heal(0.65, ally('lowestHpPct', 1, { exclSelf: true }))] } }],
      },
    },
  },

  // 徐晃晃：护佑是真减伤；每次接住打击后，军列逐档站稳。
  wei_xuhuang: {
    heroId: 'wei_xuhuang',
    basic: {
      id: 'xh_basic', name: '斧柄定阵', fx: 'melee.mace', melee: true, target: enemy('front', 1),
      effects: [{ t: 'damage', scale: { atk: 0.75, def: 0.65 } }],
      desc: '对前排随机 1 名敌人造成 75% 攻击加 65% 防御的物理伤害；前排空则选择后排。斧柄先压住营图，阵脚也跟着稳下来。',
    },
    ultimate: {
      id: 'xh_ult', name: '亚夫整营', fx: 'ult.campDrill', melee: true, target: enemy('frontRow'),
      effects: [dmg(1.05), status('ward', 2, { power: 0.15, to: ally('all') }), heal(0.5, self)],
      desc: '对敌方前排全体造成 105% 攻击的物理伤害，前排空则作用于敌方全体；友方全体获得「护佑」，受到直接伤害降低 15%，持续 2 次各自行动结束，徐晃晃计入本次施法。自身另回复 50% 攻击的生命。同名护佑保留较高减伤比例；不降低持续伤害。整营一声令，打盹也给过路猫留空。',
      levelMods: [
        { lv: 3, desc: '先理尾巴：绝技基础效果结束后，净化生命比例最低的 1 名友方 1 个负面效果。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'cleanse', n: 1, to: ally('lowestHpPct', 1) }] } },
        { lv: 6, desc: '主公放心：曹喵德仍在友方场上时，绝技基础效果结束后，自身获得「呼噜」（行动开始回复自身最大生命 4%，持续 3 次自身行动结束，计入本次；同名更强呼噜保留较高比例）。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'heroAlive', hero: 'wei_caomiaode' }, then: [status('purr', 3, { power: 0.04, to: self })] }] } },
        { lv: 9, desc: '稳阵传令：绝技基础效果结束后，若已累计至少 3 次军纪，为元气最低的 1 名友方回复 15 点元气。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'counter', key: 'xh_steady', atLeast: 3 }, then: [energy(15, ally('lowestEnergy', 1))] }] } },
      ],
    },
    passive: {
      id: 'xh_passive', name: '军纪不晃',
      desc: '每次受到非致命直接伤害后，自身累计 1 次军纪，最多 4 次，随后获得「团团」：防御提高当前军纪次数乘 5%，最多 20%，持续 2 次自身行动结束；在自身行动中触发计入本次。与同名团团相遇保留较高增防，军纪计数不因状态到期清空。名字可以晃，队列不能晃。',
      passive: [{ on: 'onHurt', effects: steadyRanks() }],
    },
    awaken: {
      A: {
        name: '斧立营门',
        desc: '绝技出手前、先于基础效果，自身获得「挑衅」，吸引敌方前排单体或随机单体普攻，持续 3 次自身行动结束，计入本次施法。斧柄立在门口，新兵安心歇爪。',
        patches: [{ skill: 'passive', addPassive: { on: 'onUlt', effects: [status('taunt', 3, { to: self })] } }],
      },
      B: {
        name: '接稳同袍',
        desc: '受到非致命直接伤害、按「军纪不晃」累计后已有至少 3 次军纪时，为生命比例最低的 1 名其他友方提供 80% 徐晃晃当前防御的护盾，持续 2 次其行动结束；每整轮最多触发 1 次。晃动接住了，给身旁也垫稳些。',
        patches: [{ skill: 'passive', addPassive: { on: 'onHurt', cond: { c: 'counter', key: 'xh_steady', atLeast: 3 }, limit: { per: 'round', n: 1 }, target: ally('lowestHpPct', 1, { exclSelf: true }), effects: [{ t: 'shield', scale: { def: 0.8 }, turns: 2 }] } }],
      },
    },
  },

  // 陆喵逊：引爆逐目标消费灼烧，不把首目标的层数套给整队。
  wu_luxun: {
    heroId: 'wu_luxun',
    basic: {
      id: 'lx_basic', name: '连营试风', fx: 'ranged.fan', target: enemy('random', 2),
      effects: [dmg(0.65, { elem: 'fire' }), status('burn', 3, { snapAtk: 0.18 })],
      desc: '随机选至多 2 名敌人，各造成 65% 攻击的火焰伤害并叠加 1 层「灼烧」：每层在持有者行动开始造成施加时 18% 自身攻击的持续伤害，最多 5 层，持续 3 次其行动结束；同名刷新保留较高攻击快照。先看风，琴搬远些再点火。',
    },
    ultimate: {
      id: 'lx_ult', name: '夷陵收火', fx: 'ult.gatherFire', target: enemy('all'),
      effects: [dmg(1.2, { elem: 'fire' }), { t: 'detonate', id: 'burn', per: 0.4, elem: 'fire' }],
      desc: '对敌方全体造成 120% 攻击的火焰伤害，再分别引爆每个存活目标身上的全部「灼烧」并移除：每层另造成 40% 当前自身攻击的火焰伤害，引爆不暴击，仍计算防御、阵营及受伤倍率。没有灼烧的目标不受引爆伤害。火候记在小字里，退路画得很宽。',
      levelMods: [
        { lv: 3, desc: '营声渐静：引爆结束后，使原来选中的存活敌人各减少 10 点元气。',
          patch: { skill: 'ultimate', addEffects: [energy(-10)] } },
        { lv: 6, desc: '都督留谱：周喵瑜仍在友方场上时，引爆结束后，自身回复 15 点元气。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'heroAlive', hero: 'wu_zhoumiaoyu' }, then: [energy(15, self)] }] } },
        { lv: 9, desc: '两图留星：每次引爆结束后，自身累计 1 次收火；满 2 次时，敌方存活全体各重新叠 1 层「灼烧」（施加时 18% 自身攻击的每层持续伤害，最多 5 层，持续 3 次目标行动结束，快照取较高值），并清空收火计数。',
          patch: { skill: 'ultimate', addEffects: [count('lx_fires', 1, 2), { t: 'when', cond: { c: 'counter', key: 'lx_fires', atLeast: 2 }, then: [status('burn', 3, { snapAtk: 0.18, to: enemy('all') }), count('lx_fires', -2, 2)] }] } },
      ],
    },
    passive: {
      id: 'lx_passive', name: '风向批注',
      desc: '每整轮开始，随机选 1 名已有「灼烧」的存活敌人，再叠 1 层灼烧（施加时 18% 自身攻击的每层持续伤害，最多 5 层，持续 3 次目标行动结束，快照取较高值）。场上没有灼烧目标则不施加。营图能添小字，水桶不能省位置。',
      passive: [{ on: 'roundStart', target: enemy('random', 1, { hasStatus: 'burn' }), effects: [status('burn', 3, { snapAtk: 0.18 })] }],
    },
    awaken: {
      A: {
        name: '先藏一星火',
        desc: '绝技出手前、先于基础效果，为敌方全体各叠 1 层「灼烧」（施加时 18% 自身攻击的每层持续伤害，最多 5 层，持续 3 次目标行动结束，快照取较高值），随后照常造成基础火伤并引爆。这一星，专留给收火时数。',
        patches: [{ skill: 'passive', addPassive: { on: 'onUlt', target: enemy('all'), effects: [status('burn', 3, { snapAtk: 0.18 })] } }],
      },
      B: {
        name: '退路铺暖',
        desc: '绝技原有效果结束后，生命比例最低的至多 2 名友方各获得 45% 陆喵逊攻击的护盾，并各净化 1 个负面效果；护盾持续 2 次各自行动结束，选中自身计入本次。火收好了，退路也要留暖。',
        patches: [{ skill: 'ultimate', addEffects: [shield(0.45, 2, ally('lowestHpPct', 2)), { t: 'cleanse', n: 1, to: ally('lowestHpPct', 2) }] }],
      },
    },
  },

  // 张角角：小喵当次协战，不创建留场单位；群族同伴行动攒点名。
  qun_zhangjiao: {
    heroId: 'qun_zhangjiao',
    basic: {
      id: 'zj_basic', name: '符水点名', fx: 'ranged.seal', target: enemy('random', 1),
      effects: [dmg(0.95, { elem: 'magic' }), heal(0.35, ally('lowestHpPct', 1)), count('zj_helpers', 1, 4)],
      desc: '随机对 1 名敌人造成 95% 攻击的法术伤害，治疗生命比例最低的 1 名友方（35% 自身攻击），并为自身累计 1 次黄巾点名，最多 4 次。头巾晾好，符水先端稳。',
    },
    ultimate: {
      id: 'zj_ult', name: '黄巾围拢', fx: 'ult.yellowRing', target: enemy('all'),
      effects: [
        { t: 'summon', beast: 'yellowKitten', count: 2, perCounter: 'zj_helpers', scale: { atk: 0.7 }, elem: 'magic' },
        heal(0.65, ally('all')),
        status('yarn', 1, { to: enemy('highestEnergy', 1) }),
      ],
      desc: '消耗自身全部黄巾点名，按点名次数呼来小喵当次协战，至少 2 次、最多 4 次；协战开始时，每次独立随机选 1 名存活敌人，造成 70% 攻击的法术伤害，原目标中途睡着则跳过对应余次，不创建留场单位。再治疗友方全体（65% 自身攻击），使元气最高的 1 名存活敌人「毛线缠」，无法施放绝技，持续 1 次其行动结束，仍受控制免疫影响。围拢是点名，杖头不是晒巾架。',
      levelMods: [
        { lv: 3, desc: '符水洗尘：绝技基础效果结束后，净化友方全体各 1 个负面效果。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'cleanse', n: 1, to: ally('all') }] } },
        { lv: 6, desc: '黄巾与黄符：张爪仍在友方场上时，绝技基础效果结束后，为生命比例最低的至多 2 名友方提供 40% 张角角攻击的护盾，持续 2 次其行动结束；选中自身计入本次。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'heroAlive', hero: 'xian_zhangzhua' }, then: [shield(0.4, 2, ally('lowestHpPct', 2))] }] } },
        { lv: 9, desc: '两回添水：每次绝技基础效果结束后，自身累计 1 次送水；满 2 次时，为友方全体施加「呼噜」（各自行动开始回复其最大生命 4%，持续 3 次各自行动结束，自身计入本次；同名更强呼噜保留较高比例），并清空送水计数。',
          patch: { skill: 'ultimate', addEffects: [count('zj_water', 1, 2), { t: 'when', cond: { c: 'counter', key: 'zj_water', atLeast: 2 }, then: [status('purr', 3, { power: 0.04, to: ally('all') }), count('zj_water', -2, 2)] }] } },
      ],
    },
    passive: {
      id: 'zj_passive', name: '黄巾点名册',
      desc: '其他群势力友方每完成一次行动，为张角角累计 1 次黄巾点名，最多 4 次；普攻、绝技与再动均计入，「晕乎乎」跳过不计。自身普攻也会累计 1 次点名，绝技协战时全部消费。点名册上写名字，不写谁抢了晒巾的位置。',
      passive: [{ on: 'onAllyAct', effects: [{ t: 'when', to: ally('source'), cond: { c: 'targetFaction', faction: 'qun' }, then: [count('zj_helpers', 1, 4)] }] }],
    },
    awaken: {
      A: {
        name: '小喵先到',
        desc: '每整轮开始，自身已有至少 3 次黄巾点名时，额外呼来 2 次黄巾小喵当次协战；协战开始时分别随机选敌，各造成 35% 攻击的法术伤害，目标中途睡着则跳过对应余次。不消耗点名，不留下单位。点名册还没合，小喵已经围好了。',
        patches: [{ skill: 'passive', addPassive: { on: 'roundStart', cond: { c: 'counter', key: 'zj_helpers', atLeast: 3 }, effects: [{ t: 'summon', beast: 'yellowKitten', count: 2, scale: { atk: 0.35 }, elem: 'magic' }] } }],
      },
      B: {
        name: '符水护屋檐',
        desc: '绝技出手前、先于基础效果，生命比例最低的至多 2 名友方各净化 1 个负面效果并获得「护佑」（受到直接伤害降低 10%，持续 2 次各自行动结束，自身计入本次；同名较高减伤沿用较高值，不降低持续伤害）。先把屋檐修好，符水就不淋雨。',
        patches: [{ skill: 'passive', addPassive: { on: 'onUlt', target: ally('lowestHpPct', 2), effects: [{ t: 'cleanse', n: 1 }, status('ward', 2, { power: 0.1 })] } }],
      },
    },
  },

  // 沙摩柯：远处用林风送药草；读取真正的团队图腾，而非本人私有计数。
  man_shamoke: {
    heroId: 'man_shamoke',
    basic: {
      id: 'smk_basic', name: '骨朵引风', fx: 'ranged.teal', target: enemy('back', 1),
      effects: [dmg(1.1), status('poison', 3, { snapAtk: 0.18 }), { t: 'when', cond: { c: 'teamCounter', key: 'totem', atLeast: 3 }, then: [status('poison', 3, { snapAtk: 0.18 })] }],
      desc: '对后排随机 1 名敌人造成 110% 攻击的物理伤害，后排空则选择前排；叠 1 层「毒瘴」。若此时己方团队图腾至少 3 层，再给原目标叠 1 层毒瘴。本次普攻贡献的图腾在收招后才增加。毒瘴每层在目标行动开始造成施加时 18% 自身攻击的持续伤害，最多 5 层，持续 3 次其行动结束，同名刷新保留较高攻击快照。骨朵指风向，叶包记药香。',
    },
    ultimate: {
      id: 'smk_ult', name: '五溪送瘴', fx: 'ult.marshMist', target: enemy('random', 2),
      effects: [dmg(1.35), status('poison', 3, { stacks: 2, snapAtk: 0.18 }), { t: 'when', cond: { c: 'teamCounter', key: 'totem', atLeast: 3 }, then: [dmg(0.3)] }],
      desc: '随机选至多 2 名敌人，各造成 135% 攻击的物理伤害并叠 2 层「毒瘴」（施加时 18% 自身攻击的每层持续伤害，最多 5 层，持续 3 次目标行动结束，快照取较高值）。随后若己方团队图腾至少 3 层，对原来选中的存活目标各追加 30% 攻击的物理伤害；绝技不贡献普攻图腾。山风走远些，近处还留着骨朵。',
      levelMods: [
        { lv: 3, desc: '叶包系铃：绝技基础效果结束后，为原来选中的存活目标施加「铃铛标记」（受到直接伤害 +10%，被暴击概率 +10 个百分点，持续 2 次其行动结束）。',
          patch: { skill: 'ultimate', addEffects: [status('mark', 2)] } },
        { lv: 6, desc: '兽鼓接风：木鹿大王仍在友方场上时，绝技基础效果结束后，为蛮势力元气最低的 1 名友方回复 12 点元气。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'heroAlive', hero: 'man_mulu' }, then: [energy(12, ally('lowestEnergy', 1, { faction: 'man' }))] }] } },
        { lv: 9, desc: '两溪回响：每次绝技基础效果结束后，自身累计 1 次送风；满 2 次时，向攻击最高的 1 名存活敌人追加 40% 攻击的物理伤害，并清空送风计数。',
          patch: { skill: 'ultimate', addEffects: [count('sm_wind', 1, 2), { t: 'when', cond: { c: 'counter', key: 'sm_wind', atLeast: 2 }, then: [dmg(0.4, { to: enemy('highestAtk', 1) }), count('sm_wind', -2, 2)] }] } },
      ],
    },
    passive: {
      id: 'smk_passive', name: '图腾认风',
      desc: '自身直接伤害命中已有至少 3 层「毒瘴」的目标后，回复 6 点元气，每整轮最多 2 次；本次攻击之后才新叠的毒瘴不提前算。普攻与绝技读取己方全队图腾，与其他蛮猫共享；图腾达到召兽门槛后会按阵营机制清零。战纹可以左右不齐，图腾计数得看准。',
      passive: [{ on: 'onHit', cond: { c: 'status', id: 'poison', atLeast: 3, who: 'target' }, limit: { per: 'round', n: 2 }, effects: [energy(6, self)] }],
    },
    awaken: {
      A: {
        name: '叶香铺溪',
        desc: '绝技出手前、先于基础效果，为敌方全体各叠 1 层「毒瘴」（施加时 18% 自身攻击的每层持续伤害，最多 5 层，持续 3 次目标行动结束，快照取较高值）。再按原绝技选敌、攻击与叠层。叶包打开，山风顺着每条溪走。',
        patches: [{ skill: 'passive', addPassive: { on: 'onUlt', target: enemy('all'), effects: [status('poison', 3, { snapAtk: 0.18 })] } }],
      },
      B: {
        name: '风回寨门',
        desc: '自身收招时、尚未增加本次普攻图腾前，若己方团队图腾至少 3 层，为生命比例最低的 1 名其他蛮势力友方回复 10 点元气并提供 35% 沙摩柯攻击的护盾，持续 2 次其行动结束；每整轮最多 1 次。风绕一圈，也要认得回寨的门。',
        patches: [{ skill: 'passive', addPassive: { on: 'afterAct', cond: { c: 'teamCounter', key: 'totem', atLeast: 3 }, limit: { per: 'round', n: 1 }, target: ally('lowestHpPct', 1, { faction: 'man', exclSelf: true }), effects: [energy(10), shield(0.35, 2)] } }],
      },
    },
  },

  // 孟优优：开场献宝吸引普攻，回礼确实取本次受伤量。
  man_mengyou: {
    heroId: 'man_mengyou',
    basic: {
      id: 'my_basic', name: '抓板递帖', fx: 'ranged.seal', target: enemy('random', 1),
      effects: [dmg(0.85, { elem: 'magic' }), { t: 'shield', scale: { maxHp: 0.04 }, turns: 2, to: self }],
      desc: '随机对 1 名敌人造成 85% 攻击的法术伤害，自身获得最大生命 4% 的护盾，持续 2 次自身行动结束，计入本次。礼单写得很长，抓板只这一块。',
    },
    ultimate: {
      id: 'my_ult', name: '献宝护营', fx: 'ult.tribute', target: enemy('frontRow'),
      effects: [dmg(0.9, { elem: 'magic' }), heal(0.65, self), { t: 'shield', scale: { maxHp: 0.16 }, turns: 3, to: self }, status('taunt', 3, { to: self })],
      desc: '对敌方前排全体造成 90% 攻击的法术伤害，前排空则作用于敌方全体；自身回复 65% 攻击的生命，获得最大生命 16% 的护盾，并获得「挑衅」，吸引敌方前排单体或随机单体普攻。护盾与挑衅均持续 3 次自身行动结束，计入本次施法。重宝留在门口，软席藏在里头。',
      levelMods: [
        { lv: 3, desc: '礼单掸灰：绝技基础效果结束后，净化自身 1 个负面效果。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'cleanse', n: 1, to: self }] } },
        { lv: 6, desc: '请轻些挠：绝技基础效果结束后，使原来选中的存活敌人「受惊」（攻击降低 10%，持续 2 次其行动结束）。',
          patch: { skill: 'ultimate', addEffects: [status('fright', 2, { power: 0.1 })] } },
        { lv: 9, desc: '两礼一席：每次绝技基础效果结束后，自身累计 1 次献礼；满 2 次时，治疗生命比例最低的 1 名其他存活友方（其最大生命的 8%），并清空献礼计数。',
          patch: { skill: 'ultimate', addEffects: [count('my_gifts', 1, 2), { t: 'when', cond: { c: 'counter', key: 'my_gifts', atLeast: 2 }, then: [{ t: 'heal', scale: { targetMaxHp: 0.08 }, to: ally('lowestHpPct', 1, { exclSelf: true }) }, count('my_gifts', -2, 2)] }] } },
      ],
    },
    passive: {
      id: 'my_passive', name: '抓板回礼',
      desc: '开战时自身获得最大生命 12% 的护盾与「挑衅」，均持续 3 次自身行动结束，吸引敌方前排单体或随机单体普攻。挑衅期间，每整轮首次受到非致命直接伤害后，向存活攻击者回礼：以本次伤害总额（包含护盾吸收部分）的 60% 为基础造成不暴击的真实伤害，仍受阵营、受伤倍率与伤害浮动影响，不反弹持续伤害。抓板旧了，回礼倒记得清。',
      passive: [
        { on: 'battleStart', effects: [{ t: 'shield', scale: { maxHp: 0.12 }, turns: 3, to: self }, status('taunt', 3, { to: self })] },
        { on: 'onHurt', cond: { c: 'status', id: 'taunt' }, limit: { per: 'round', n: 1 }, target: enemy('attacker'), effects: [{ t: 'damage', scale: { hurt: 0.6 }, elem: 'true', noCrit: true }] },
      ],
    },
    awaken: {
      A: {
        name: '礼上再挂铃',
        desc: '挑衅期间，每整轮首次受到非致命直接伤害后，自身回复 8 点元气，并给存活攻击者施加「铃铛标记」（受到直接伤害 +10%，被暴击概率 +10 个百分点，持续 2 次其行动结束）。基础回礼先于挂铃；来客多，礼单记好下一位。',
        patches: [{ skill: 'passive', addPassive: { on: 'onHurt', cond: { c: 'status', id: 'taunt' }, limit: { per: 'round', n: 1 }, target: enemy('attacker'), effects: [energy(8, self), status('mark', 2)] } }],
      },
      B: {
        name: '礼盒留软席',
        desc: '绝技原有效果结束后，生命比例最低的至多 2 名友方各获得 45% 孟优优攻击的护盾，并各净化 1 个负面效果；护盾持续 2 次各自行动结束，选中自身计入本次。抓板摆在前头，礼盒里还有软席。',
        patches: [{ skill: 'ultimate', addEffects: [shield(0.45, 2, ally('lowestHpPct', 2)), { t: 'cleanse', n: 1, to: ally('lowestHpPct', 2) }] }],
      },
    },
  },

  // 南华喵：梦盾照护；九命开场只授予一次，可被净化，也会挡致命 DOT。
  xian_nanhua: {
    heroId: 'xian_nanhua',
    basic: {
      id: 'nh_basic', name: '梦蝶掖被', fx: 'heal.touch', target: ally('lowestHpPct', 1),
      effects: [heal(1), shield(0.35, 2)],
      desc: '治疗生命比例最低的 1 名友方（100% 南华喵攻击），并为其提供 35% 南华喵攻击的梦境护盾，持续 2 次其行动结束；选中自身计入本次。云被掖齐，蝴蝶留在被角。',
    },
    ultimate: {
      id: 'nh_ult', name: '梦里留门', fx: 'ult.dreamDoor', target: ally('all'),
      effects: [heal(1.3), shield(0.55, 2)],
      desc: '治疗友方全体（各为南华喵 130% 攻击），并各提供 55% 南华喵攻击的梦境护盾，持续 2 次各自行动结束，南华喵计入本次施法。梦里若走远，门缝还透着暖光。',
      levelMods: [
        { lv: 3, desc: '云被掸尘：绝技基础效果结束后，净化友方全体各 1 个负面效果。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'cleanse', n: 1, to: ally('all') }] } },
        { lv: 6, desc: '被角留呼噜：绝技基础效果结束后，生命比例最低的至多 2 名友方获得「呼噜」（各自行动开始回复其最大生命 3.5%，持续 3 次各自行动结束，自身计入本次；同名更强呼噜保留较高比例）。',
          patch: { skill: 'ultimate', addEffects: [status('purr', 3, { power: 0.035, to: ally('lowestHpPct', 2) })] } },
        { lv: 9, desc: '两梦一蝶：每次绝技基础效果结束后，自身累计 1 次梦境；满 2 次时，生命比例最低的 1 名其他存活友方获得「幻象」，闪避下一次直接攻击，持续 2 次其行动结束，并清空梦境计数。',
          patch: { skill: 'ultimate', addEffects: [count('nh_dreams', 1, 2), { t: 'when', cond: { c: 'counter', key: 'nh_dreams', atLeast: 2 }, then: [status('illusion', 2, { to: ally('lowestHpPct', 1, { exclSelf: true }) }), count('nh_dreams', -2, 2)] }] } },
      ],
    },
    passive: {
      id: 'nh_passive', name: '梦中认归路',
      desc: '开战时自身获得「九命」，持续 99 次自身行动结束；首次遭受致命直接伤害或持续伤害时，消费九命并保留自身最大生命的 15%，免于睡着。本技能每场只授予 1 次九命，可被净化或到期移除。自身实际受到治疗后回复 6 点元气，每整轮最多 1 次；九命保留生命不算治疗。梦中的归路，先给自己认好。',
      passive: [
        { on: 'battleStart', effects: [status('nine', 99, { to: self })] },
        { on: 'onHealed', limit: { per: 'round', n: 1 }, effects: [energy(6, self)] },
      ],
    },
    awaken: {
      A: {
        name: '醒来晒云被',
        desc: '本场首次在自身收招时生命低于 40%，额外回复自身最大生命 12%，并获得 60% 自身攻击的护盾，持续 2 次自身行动结束，计入当前行动。不再授予九命，先把云被晒暖些。',
        patches: [{ skill: 'passive', addPassive: { on: 'afterAct', cond: { c: 'hpBelow', pct: 0.4 }, limit: { per: 'battle', n: 1 }, effects: [{ t: 'heal', scale: { maxHp: 0.12 }, to: self }, shield(0.6, 2, self)] } }],
      },
      B: {
        name: '门前一声呼噜',
        desc: '敌方施放绝技前，为生命比例最低的 1 名其他存活友方净化 1 个负面效果，并提供 50% 南华喵攻击的护盾，持续 2 次其行动结束；每整轮最多 1 次。暖光先留给身旁，呼噜也轻一声。',
        patches: [{ skill: 'passive', addPassive: { on: 'onEnemyUlt', limit: { per: 'round', n: 1 }, target: ally('lowestHpPct', 1, { exclSelf: true }), effects: [{ t: 'cleanse', n: 1 }, shield(0.5, 2)] } }],
      },
    },
  },

  // 赵喵云：潜行避单选、范围仍可波及；救场只在真正缺生命时用掉机会。
  shu_zhaomiaoyun: {
    heroId: 'shu_zhaomiaoyun',
    basic: {
      id: 'zmy_basic', name: '长枪认路', fx: 'melee.pierce', melee: true, target: enemy('back', 1),
      effects: [dmg(1.2, { ignoreDef: 0.1 })],
      desc: '对后排随机 1 名敌人造成 120% 攻击的物理伤害，无视其 10% 防御；后排空则选择前排。枪缨收好，绳头认得回营的路。',
    },
    ultimate: {
      id: 'zmy_ult', name: '长坂护归', fx: 'ult.whiteDragon', melee: true, target: enemy('back', 1),
      effects: [dmg(2.4, { ignoreDef: 0.2 }), { t: 'when', to: ally('lowestHpPct', 1, { exclSelf: true }), cond: { c: 'allyCount', atLeast: 2 }, then: [shield(0.5, 2), heal(0.7)] }],
      desc: '对后排随机 1 名敌人造成 240% 攻击的物理伤害，无视其 20% 防御，后排空则选择前排。再为生命比例最低的 1 名其他存活友方提供 50% 自身攻击的护盾，并回复 70% 自身攻击的生命；护盾持续 2 次其行动结束。纸篓抱稳，长枪替归途留空。',
      levelMods: [
        { lv: 3, desc: '枪缨缓铃：绝技基础效果结束后，使原敌方目标减少 15 点元气。',
          patch: { skill: 'ultimate', addEffects: [energy(-15)] } },
        { lv: 6, desc: '银甲掸尘：绝技基础效果结束后，净化自身 1 个负面效果。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'cleanse', n: 1, to: self }] } },
        { lv: 9, desc: '主公留篓：刘喵备仍在友方场上时，绝技基础效果结束后，另选当前生命比例最低的 1 名其他存活友方，额外回复其最大生命 5%。',
          patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'heroAlive', hero: 'shu_liumiaobei' }, then: [{ t: 'heal', scale: { targetMaxHp: 0.05 }, to: ally('lowestHpPct', 1, { exclSelf: true }) }] }] } },
      ],
    },
    passive: {
      id: 'zmy_passive', name: '白甲入云',
      desc: '自身直接伤害每次使目标睡着后，回复 12 点元气并获得「潜行」，持续 2 次自身行动结束，在自身行动中触发计入本次。敌方还有其他可选目标时，单体选敌避开潜行；全体及范围技能仍可波及，只剩潜行目标也能被选中。泥落在银甲上，归路仍认得白尾巴。',
      passive: [{ on: 'onKill', effects: [energy(12, self), status('stealth', 2, { to: self })] }],
    },
    awaken: {
      A: {
        name: '七进七出',
        desc: '自身直接伤害使目标睡着后，获得一次再动，每整轮最多触发 1 次；一次正常行动后最多追加一次行动，再动内击睡不继续串联。再动照常消耗潜行的持续次数，收枪后还要把行李点齐。',
        patches: [{ skill: 'passive', addPassive: { on: 'onKill', limit: { per: 'round', n: 1 }, effects: [{ t: 'extraTurn' }] } }],
      },
      B: {
        name: '纸篓先归',
        desc: '本场首次自身收招时有其他存活友方生命低于 40%，治疗其中生命比例最低的 1 名（100% 自身攻击），提供 60% 自身攻击的护盾并净化其 1 个负面效果；护盾持续 2 次其行动结束。没有符合条件的同伴时保留机会，纸篓先走，长枪随后。',
        patches: [{ skill: 'passive', addPassive: { on: 'afterAct', effects: [{ t: 'when', cond: { c: 'not', cond: { c: 'counter', key: 'zy_rescue', atLeast: 1 } }, then: [{ t: 'when', to: ally('lowestHpPct', 1, { exclSelf: true }), cond: { c: 'hpBelow', pct: 0.4, who: 'target' }, then: [heal(1), shield(0.6, 2), { t: 'cleanse', n: 1 }, count('zy_rescue', 1, 1)] }] }] } }],
      },
    },
  },
};
