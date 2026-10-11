// 夏侯墩、许虎痴、郭嘉喵与孙小霸：续战、护阵、唤醒、踏浪各有一门功课。
import type { Effect, Kit } from '../../engine/types';
import { ally, dmg, energy, enemy, factionAllies, heal, self, shield, status, text } from './helpers';

// 首次攻击按「攻击行动」计：横扫的一整排共用一次判定，之后本回合不再保暴击。
const tigerStrike = (atk: number): Effect => ({
  t: 'when', cond: { c: 'not', cond: { c: 'counter', key: 'tiger_first_attack', atLeast: 1 } },
  then: [dmg(atk, { critBonus: 1 }), { t: 'counter', key: 'tiger_first_attack', add: 1, max: 1, to: self }],
  else: [dmg(atk)],
});

export const KITS_WEI_WU: Record<string, Kit> = {
  wei_xiahoudun: {
    heroId: 'wei_xiahoudun',
    basic: {
      id: 'xhd_basic', name: '墩爪', fx: 'melee.pierce', melee: true, target: enemy('front', 1),
      effects: [dmg(1.3)],
      desc: '墩墩的爪子很稳：对敌方前排随机 1 名猫猫造成 130% 攻击的物理伤害；前排无人时选择后排。',
    },
    ultimate: {
      id: 'xhd_ult', name: '拔矢啖睛', fx: 'ult.yarnResolve', melee: true, target: enemy('front', 1),
      effects: [dmg(3.2, { lifesteal: 0.5, bonus: [{ cond: { c: 'hpBelow', pct: 0.5 }, mult: 1.5 }] })],
      desc: '眼罩扶正，毛线球追回：对敌方前排随机 1 名猫猫造成 320% 攻击的物理伤害，回复所造成伤害 50% 的生命；出手时自身生命低于 50%，本次伤害提高 50%。前排无人时选择后排。',
      levelMods: [
        { lv: 3, desc: '看穿小心思：使目标「受惊」（攻击降低 15%，持续 2 次其行动结束）。', patch: { skill: 'ultimate', addEffects: [status('fright', 2, { power: 0.15 })] } },
        { lv: 6, desc: '眼罩别缠线：绝技后净化自身 1 个负面效果。', patch: { skill: 'ultimate', addEffects: [{ t: 'cleanse', n: 1, to: self }] } },
        { lv: 9, desc: '追球有余力：若目标被本次绝技送去睡觉，自身回复 25 点元气。', patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'killed' }, then: [energy(25, self), text('球还没追上！')] }] } },
      ],
    },
    passive: {
      id: 'xhd_passive', name: '刚烈',
      desc: '开战获得「九命」（持续 99 次自身行动结束，可被驱散），抵挡一次直接致命伤害并保留 15% 最大生命。受直接伤害后生命首次低于 30%，另回复 15% 最大生命并「团团」（防御提高 20%，持续 1 次自身行动结束）；若在自身行动中触发，计入当次。',
      passive: [
        { on: 'battleStart', effects: [status('nine', 99, { to: self })] },
        { on: 'lowHp', hpPct: 0.3, effects: [{ t: 'heal', scale: { maxHp: 0.15 } }, status('curl', 1, { power: 0.2 }), text('眼罩还在，稳着呢。')] },
      ],
    },
    awaken: {
      A: {
        name: '铁头不倒',
        desc: '受到直接攻击时有 30% 概率反击攻击者，造成 80% 攻击的物理伤害，每整轮最多 1 次。受直接伤害后生命首次低于 50%，自身叠加 1 层「炸毛」（每层攻击提高 40%，最多 3 层，持续 3 次自身行动结束）。',
        patches: [
          { skill: 'passive', addPassive: { on: 'onHurt', cond: { c: 'chance', p: 0.3 }, limit: { per: 'round', n: 1 }, target: enemy('attacker'), effects: [dmg(0.8)] } },
          { skill: 'passive', addPassive: { on: 'lowHp', hpPct: 0.5, effects: [status('fluff', 3, { power: 0.4, to: self })] } },
        ],
      },
      B: {
        name: '独眼认路',
        desc: '普攻给目标挂上「铃铛标记」（受到伤害提高 10%、被暴击概率提高 10 个百分点，持续 2 次其行动结束）；绝技后若曹喵德仍在友方场上，所有魏势力友方回复 10 点元气。一个铃铛，主公也认得路。',
        patches: [
          { skill: 'basic', addEffects: [status('mark', 2)] },
          { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'heroAlive', hero: 'wei_caomiaode' }, then: [energy(10, factionAllies('wei'))] }] },
        ],
      },
    },
  },

  wei_xuhuchi: {
    heroId: 'wei_xuhuchi',
    basic: {
      id: 'xhc_basic', name: '虎扑', fx: 'melee.mace', melee: true, target: enemy('front', 1),
      effects: [{ t: 'damage', scale: { atk: 1.1, def: 0.5 } }],
      desc: '虎头帽往前一晃，对敌方前排随机 1 名猫猫造成 110% 攻击加 50% 防御的物理伤害；前排无人时选择后排。',
    },
    ultimate: {
      id: 'xhc_ult', name: '虎痴咆哮', fx: 'ult.tigerHoodRoar', target: enemy('all'),
      effects: [
        dmg(0.8), status('taunt', 2, { to: self }),
        { t: 'shield', scale: { maxHp: 0.2 }, turns: 2, to: self }, status('curl', 2, { power: 0.3, to: self }),
      ],
      desc: '嗷，鱼干请排队！对敌方全体造成 80% 攻击的物理伤害；自身获得「挑衅」、相当于自身最大生命 20% 的「护体毛」与「团团」（防御提高 30%），均持续 2 次自身行动结束，计入本次施放。挑衅吸引选择前排或随机单体的敌方普攻。',
      levelMods: [
        { lv: 3, desc: '护主回响：所有魏势力友方回复 10 点元气。', patch: { skill: 'ultimate', addEffects: [energy(10, factionAllies('wei'))] } },
        { lv: 6, desc: '虎帽也有威风：使敌方全体「受惊」（攻击降低 15%，持续 2 次其行动结束）。', patch: { skill: 'ultimate', addEffects: [status('fright', 2, { power: 0.15 })] } },
        { lv: 9, desc: '吼完歇口气：自身获得「呼噜」（每次行动前回复 5% 最大生命，持续 2 次自身行动结束，计入本次施放）。', patch: { skill: 'ultimate', addEffects: [status('purr', 2, { power: 0.05, to: self })] } },
      ],
    },
    passive: {
      id: 'xhc_passive', name: '护主',
      desc: '每整轮开始有 30% 概率，为除自己外生命比例最低的 1 名魏势力友方准备「护体毛」（许虎痴最大生命的 10%，持续 2 次持有者行动结束）；曹喵德仍在友方场上时，该目标额外获得许虎痴 30% 攻击的护盾，也持续 2 次其行动结束。',
      passive: [{
        on: 'roundStart', cond: { c: 'chance', p: 0.3 }, target: ally('lowestHpPct', 1, { faction: 'wei', exclSelf: true }),
        effects: [
          { t: 'shield', scale: { maxHp: 0.1 }, turns: 2 },
          { t: 'when', cond: { c: 'heroAlive', hero: 'wei_caomiaode' }, then: [shield(0.3, 2)] },
        ],
      }],
    },
    awaken: {
      A: {
        name: '真·老虎',
        desc: '自身带有「挑衅」时受到直接攻击，向攻击者反扑，造成 45% 攻击的物理伤害，并回复自身 5 点元气；每整轮最多 2 次。帽子是真的，老虎还在练习。',
        patches: [{ skill: 'passive', addPassive: { on: 'onHurt', cond: { c: 'status', id: 'taunt' }, limit: { per: 'round', n: 2 }, target: enemy('attacker'), effects: [dmg(0.45), energy(5, self)] } }],
      },
      B: {
        name: '码骨成墙',
        desc: '每次普攻前码好 1 根鱼骨；每码满 3 根便收起鱼骨，为所有魏势力友方施加许虎痴 60% 攻击的「护体毛」（持续 2 次持有者行动结束，许虎痴计入本次普攻）。骨头摆得齐，主公睡得稳。',
        patches: [{ skill: 'passive', addPassive: {
          on: 'onBasic', effects: [
            { t: 'counter', key: 'guard_bones', add: 1, max: 3, to: self },
            { t: 'when', cond: { c: 'counter', key: 'guard_bones', atLeast: 3 }, then: [shield(0.6, 2, factionAllies('wei')), { t: 'counter', key: 'guard_bones', add: -3, to: self }, text('骨头整整齐齐。')] },
          ],
        } }],
      },
    },
  },

  wei_guojia: {
    heroId: 'wei_guojia',
    basic: {
      id: 'gj_basic', name: '锦囊妙计', fx: 'heal.touch', target: ally('lowestHpPct', 1),
      effects: [heal(1.2)],
      desc: '把装着小鱼干的锦囊递给生命比例最低的 1 名友方，回复 120% 攻击的生命。',
    },
    ultimate: {
      id: 'gj_ult', name: '遗计', fx: 'ult.partingPouch', target: ally('all'),
      effects: [heal(1.5), { t: 'counter', key: 'yiji_window', add: 3, max: 3, to: self }, text('锦囊放这儿，先别睡。')],
      desc: '友方全体回复 150% 攻击的生命；重整锦囊，本整轮及其后 2 轮内，若郭嘉喵仍清醒，第一位睡着的友方可被唤醒至 30% 最大生命。锦囊整场仅用 1 次，不能唤醒自己；该同伴已被其他技能先唤醒时，也消耗本次锦囊机会。',
      levelMods: [
        { lv: 3, desc: '锦囊附笺：友方元气最低的 1 名猫猫回复 20 点元气。', patch: { skill: 'ultimate', addEffects: [energy(20, ally('lowestEnergy', 1))] } },
        { lv: 6, desc: '软垫留座：友方全体获得郭嘉喵 40% 攻击的「护体毛」，持续 2 次持有者行动结束，郭嘉喵计入本次施放。', patch: { skill: 'ultimate', addEffects: [shield(0.4, 2, ally('all'))] } },
        { lv: 9, desc: '奶渍也擦净：净化友方全体所有负面效果。', patch: { skill: 'ultimate', addEffects: [{ t: 'cleanse', to: ally('all') }] } },
      ],
    },
    passive: {
      id: 'gj_passive', name: '酒葫芦',
      desc: '每整轮开始有 30% 概率为随机 1 名友方净化 1 个负面效果。整轮结束收起一页遗计；唤醒同伴须在锦囊有效时，且本喵仍清醒。葫芦里是奶，误会留给敌方。',
      passive: [
        { on: 'roundStart', cond: { c: 'chance', p: 0.3 }, target: ally('random', 1), effects: [{ t: 'cleanse', n: 1 }] },
        { on: 'roundEnd', cond: { c: 'counter', key: 'yiji_window', atLeast: 1 }, effects: [{ t: 'counter', key: 'yiji_window', add: -1, to: self }] },
        {
          on: 'onAllyDeath', cond: { c: 'counter', key: 'yiji_window', atLeast: 1 }, limit: { per: 'battle', n: 1 }, target: ally('source'),
          effects: [{ t: 'revive', hpPct: 0.3 }, { t: 'counter', key: 'yiji_saved', add: 1, max: 1, to: self }, text('先看锦囊，再睡。')],
        },
      ],
    },
    awaken: {
      A: {
        name: '十胜十败',
        desc: '遗计首次有效触发的同伴额外回复自身最大生命的 20%，并获得 1 层「炸毛」（每层攻击提高 20%，最多 3 层，持续 2 次其行动结束）；即使已被其他技能先唤醒也会获得这份照料，整场仅 1 次。十条鱼干，先吃醒神的那条。',
        patches: [{ skill: 'passive', addPassive: {
          on: 'onAllyDeath', cond: { c: 'and', conds: [{ c: 'counter', key: 'yiji_window', atLeast: 1 }, { c: 'counter', key: 'yiji_saved', atLeast: 1 }] }, limit: { per: 'battle', n: 1 }, target: ally('source'),
          effects: [{ t: 'heal', scale: { targetMaxHp: 0.2 } }, status('fluff', 2, { power: 0.2 })],
        } }],
      },
      B: {
        name: '午后分奶',
        desc: '每整轮开始为生命比例最低的 2 名友方分好猫薄荷奶，施加「呼噜」（每次行动前回复持有者最大生命的 4%，持续 2 次其行动结束）。锦囊管急事，午睡也有章程。',
        patches: [{ skill: 'passive', addPassive: { on: 'roundStart', target: ally('lowestHpPct', 2), effects: [status('purr', 2, { power: 0.04 })] } }],
      },
    },
  },

  wu_sunxiaoba: {
    heroId: 'wu_sunxiaoba',
    basic: {
      id: 'sxb_basic', name: '长剑突', fx: 'melee.slash', melee: true, target: enemy('front', 1),
      effects: [tigerStrike(1.3)],
      desc: '长剑比澡盆先到：对敌方前排随机 1 名猫猫造成 130% 攻击的物理伤害，享受「江东猛虎」的首次攻击行动必暴击；前排无人时选择后排。',
    },
    ultimate: {
      id: 'sxb_ult', name: '霸王横扫', fx: 'ult.tideSweep', melee: true, target: enemy('frontRow'),
      effects: [tigerStrike(2.3), status('wet', 2, { power: 0.2 })],
      desc: '剑风带翻水碗，对敌方前排全体造成 230% 攻击的物理伤害并施加「淋湿」（防御降低 20%，持续 2 次其行动结束）；前排无人时横扫全体。若是本整轮首次攻击行动，整次横扫必暴击。',
      levelMods: [
        { lv: 3, desc: '浪花留铃：横扫目标获得「铃铛标记」（受到伤害提高 10%、被暴击概率提高 10 个百分点，持续 2 次其行动结束）。', patch: { skill: 'ultimate', addEffects: [status('mark', 2)] } },
        { lv: 6, desc: '曲里藏浪：周喵瑜仍在友方场上时，使所有「淋湿」敌人再获得 1 层「灼烧」（每层在行动前造成孙小霸 20% 攻击的伤害，持续 2 次持有者行动结束，最多 5 层）。', patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'heroAlive', hero: 'wu_zhoumiaoyu' }, then: [status('burn', 2, { snapAtk: 0.2, to: enemy('all', undefined, { hasStatus: 'wet' }) })] }] } },
        { lv: 9, desc: '江东跟上：所有吴势力友方回复 10 点元气。', patch: { skill: 'ultimate', addEffects: [energy(10, factionAllies('wu'))] } },
      ],
    },
    passive: {
      id: 'sxb_passive', name: '江东猛虎',
      desc: '每整轮首次普攻或绝技的攻击行动必定暴击；每次暴击回复 5 点元气，每整轮最多 3 次。水碗可以扶，冲劲先别拦。',
      passive: [
        { on: 'roundStart', cond: { c: 'counter', key: 'tiger_first_attack', atLeast: 1 }, effects: [{ t: 'counter', key: 'tiger_first_attack', add: -1, to: self }] },
        { on: 'onCrit', limit: { per: 'round', n: 3 }, effects: [energy(5, self)] },
      ],
    },
    awaken: {
      A: {
        name: '小霸王归位',
        desc: '睡着时留下一阵浪花，对敌方全体造成 200% 攻击的物理伤害，并使所有吴势力友方叠加 1 层「炸毛」（每层攻击提高 25%，最多 3 层，持续 3 次其行动结束）；整场仅 1 次。退场也要把水碗摆得热闹。',
        patches: [{ skill: 'passive', addPassive: { on: 'onDeath', limit: { per: 'battle', n: 1 }, target: enemy('all'), effects: [dmg(2), status('fluff', 3, { power: 0.25, to: factionAllies('wu') })] } }],
      },
      B: {
        name: '踏浪跑酷',
        desc: '普攻也使目标「淋湿」（防御降低 20%，持续 2 次其行动结束）；绝技后自身获得「猫步」（速度提高 20%，持续 2 次自身行动结束，计入本次施放）。浪花归队友，澡盆仍绕开。',
        patches: [
          { skill: 'basic', addEffects: [status('wet', 2, { power: 0.2 })] },
          { skill: 'ultimate', addEffects: [status('step', 2, { power: 0.2, to: self })] },
        ],
      },
    },
  },
};
