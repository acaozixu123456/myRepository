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
      id: 'gn_ult', name: '锦帆夜袭', fx: 'ult.knifeStorm', melee: true, target: enemy('back', 1),
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
      id: 'hx_ult', name: '温盏叫阵', fx: 'ult.glaiveWave', melee: true, target: enemy('front', 1),
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
      id: 'yj_ult', name: '符水济众', fx: 'ult.herbMist', target: ally('all'),
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

  // 固定表蜀族草稿：名单争议尚待主导确认，不在本文件之外注册。
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
      id: 'hz_ult', name: '百步铃箭', fx: 'ult.arrowVolley', target: enemy('back', 1),
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
      id: 'mc_ult', name: '锦马破阵', fx: 'ult.glaiveWave', melee: true, target: enemy('front', 1),
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
      id: 'jw_ult', name: '再赴祁山', fx: 'ult.eightArray', target: enemy('frontRow'),
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
};
