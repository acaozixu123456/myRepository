import type { Effect, Kit, TargetSel } from '../../engine/types';
import { ally, dmg, energy, enemy, factionAllies, self, status, text } from './helpers';

const counter = (key: string, add: number, max?: number): Effect => ({ t: 'counter', key, add, max, to: self });
const gainTotem = (): Effect => ({
  t: 'when', cond: { c: 'counter', key: 'ml_deep_forest', atLeast: 1 },
  then: [counter('totem', 1, 9)], else: [counter('totem', 1, 6)],
});
const hpShield = (maxHp: number, turns: number, to: TargetSel = self): Effect => ({ t: 'shield', scale: { maxHp }, turns, to });
const scratchedEnemies = enemy('all', undefined, { hasStatus: 'scratch' });
const qunVanguards = ally('all', undefined, { faction: 'qun', role: '先锋' });

export const KITS_WU_QUN_MAN: Record<string, Kit> = {
  // 黄盖盖：用自己的软垫换全营护盾，诈降与热毯分为延后火计、持续护队。
  wu_huanggai: {
    heroId: 'wu_huanggai',
    basic: {
      id: 'hg_basic', name: '铁鞭', fx: 'melee.mace', melee: true, target: enemy('front'),
      effects: [dmg(1.1)],
      desc: '对前排随机 1 名敌人造成 110% 攻击的物理伤害；前排无人时选择后排。鞭梢收好，别掀掉自己的热毯。',
    },
    ultimate: {
      id: 'hg_ult', name: '苦肉计', fx: 'ult.surrenderBlanket', target: ally('all'),
      effects: [
        { t: 'selfDamage', pctMaxHp: 0.15 },
        { t: 'heal', scale: { maxHp: 0.03 } },
        hpShield(0.15, 3, ally('all')),
        status('fluff', 3, { power: 0.2, to: factionAllies('wu') }),
        text('盖盖不疼，毯子给你。'),
      ],
      desc: '自损 15% 最大生命，至少保留 1 点生命；友方全体各回复黄盖盖最大生命 3% 的生命，并获得其最大生命 15% 的护盾。吴势力友方另获 1 层「炸毛」（每层攻击 +20%，最多 3 层）。护盾与炸毛持续 3 次持有者行动结束，黄盖盖计入本次施放。',
      levelMods: [
        { lv: 3, desc: '抖净毯角：绝技额外净化友方全体各 1 个负面效果。', patch: { skill: 'ultimate', addEffects: [{ t: 'cleanse', n: 1, to: ally('all') }] } },
        { lv: 6, desc: '降书蘸水：绝技后使敌方前排「淋湿」（防御 -20%，持续 2 次其行动结束）；没有前排时选剩余敌人。', patch: { skill: 'ultimate', addEffects: [status('wet', 2, { power: 0.2, to: enemy('frontRow') })] } },
        { lv: 9, desc: '老将递信：周喵瑜仍在友方时，绝技额外为吴势力友方各回复 25 点元气；否则仅为黄盖盖回复 15 点。', patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'heroAlive', hero: 'wu_zhoumiaoyu' }, then: [energy(25, factionAllies('wu'))], else: [energy(15, self)] }] } },
      ],
    },
    passive: {
      id: 'hg_passive', name: '老当益壮',
      desc: '受到攻击后，获得当前已损失生命 8% 的护盾，持续 2 次自身行动结束，每整轮最多 1 次。受到攻击后生命首次低于 30% 时，获得「团团」（防御 +30%，持续 3 次自身行动结束），每场 1 次；在自身行动中触发时计入当前行动。老骨头先趴稳，胡子留在毯子外。',
      passive: [
        { on: 'onHurt', limit: { per: 'round', n: 1 }, effects: [{ t: 'shield', scale: { missingHp: 0.08 }, turns: 2, to: self }] },
        { on: 'lowHp', hpPct: 0.3, effects: [status('curl', 3, { power: 0.3, to: self })] },
      ],
    },
    awaken: {
      A: {
        name: '诈降',
        desc: '绝技后留下一封待发降书；黄盖盖仍醒着时，于下次整轮开始对敌方全体造成 150% 攻击的火焰伤害。同一整轮重复施放只保留一封，递信前先把空船检查好。',
        patches: [
          { skill: 'ultimate', addEffects: [counter('hg_letter', 1, 1)] },
          { skill: 'passive', addPassive: { on: 'roundStart', cond: { c: 'counter', key: 'hg_letter', atLeast: 1 }, target: enemy('all'), effects: [counter('hg_letter', -1), dmg(1.5, { elem: 'fire' }), text('降书到了，猫都上岸。')] } },
        ],
      },
      B: {
        name: '热毯传营',
        desc: '绝技额外使友方全体获得「呼噜」（行动开始回复自身最大生命 6%，持续 3 次其行动结束，黄盖盖计入本次施放）。黄盖盖实际受到治疗后，净化自身 1 个负面效果并回复 10 点元气，每整轮最多 1 次；热毯翻面，暖意继续传。',
        patches: [
          { skill: 'ultimate', addEffects: [status('purr', 3, { power: 0.06, to: ally('all') })] },
          { skill: 'passive', addPassive: { on: 'onHealed', limit: { per: 'round', n: 1 }, effects: [{ t: 'cleanse', n: 1, to: self }, energy(10, self)] } },
        ],
      },
    },
  },

  // 貂蝉喵：薄荷醉与元气压制，选追着月影扩散醉意或替同袍留下幻象。
  qun_diaochan: {
    heroId: 'qun_diaochan',
    basic: {
      id: 'dc_basic', name: '回眸', fx: 'ranged.teal', target: enemy('random', 1),
      effects: [dmg(1.1, { elem: 'magic' }), status('nip', 1, { p: 0.3 })],
      desc: '对随机 1 名敌人造成 110% 攻击的法术伤害，30% 概率施加「猫薄荷醉」，持续 1 次其行动结束。醉意会让下一次行动追错逗猫棒。',
    },
    ultimate: {
      id: 'dc_ult', name: '连环美人计', fx: 'ult.moonRibbons', target: enemy('random', 2),
      effects: [dmg(0.65, { elem: 'magic' }), status('nip', 2)],
      desc: '对随机 2 名敌人各造成 65% 攻击的法术伤害，并施加「猫薄荷醉」，持续 2 次其行动结束。醉着的猫受伤 +20%，行动改为以自身 100% 攻击随机攻击另一名友方；没有其他友方时改攻敌方。月光里那根逗猫棒，谁也没真正拿着。',
      levelMods: [
        { lv: 3, desc: '先留半拍：绝技额外使敌方元气最高的 1 名猫减少 20 点元气。', patch: { skill: 'ultimate', addEffects: [energy(-20, enemy('highestEnergy', 1))] } },
        { lv: 6, desc: '醉意牵铃：绝技后使所有仍带「猫薄荷醉」的敌人获得「铃铛标记」（受伤 +10%，被暴击概率 +10 个百分点），持续 2 次其行动结束。', patch: { skill: 'ultimate', addEffects: [status('mark', 2, { to: enemy('all', undefined, { hasStatus: 'nip' }) })] } },
        { lv: 9, desc: '布丁跟拍：吕布丁仍在友方时，绝技后使群势力先锋获得 1 层「炸毛」（每层攻击 +15%，最多 3 层），持续 3 次其行动结束。', patch: { skill: 'ultimate', addEffects: [{ t: 'when', cond: { c: 'heroAlive', hero: 'qun_lvbuding' }, then: [status('fluff', 3, { power: 0.15, to: qunVanguards })] }] } },
      ],
    },
    passive: {
      id: 'dc_passive', name: '闭月',
      desc: '受到攻击时，25% 概率使仍醒着的攻击者「猫薄荷醉」，每整轮最多触发 1 次。醉意持续 2 次攻击者行动结束；在其行动内触发时，该次也计入。月亮先躲起来，留下对方追自己的尾巴。',
      passive: [{ on: 'onHurt', cond: { c: 'chance', p: 0.25 }, limit: { per: 'round', n: 1 }, target: { side: 'enemy', pick: 'attacker' }, effects: [status('nip', 2)] }],
    },
    awaken: {
      A: {
        name: '月下独舞',
        desc: '貂蝉喵亲自以直接伤害令敌人睡着后，使随机 1 名尚未醉的敌人「猫薄荷醉」（持续 2 次其行动结束），并回复自身 10 点元气，每整轮最多 2 次。上一位追累了，月影就换个方向。',
        patches: [{ skill: 'passive', addPassive: { on: 'onKill', limit: { per: 'round', n: 2 }, target: enemy('random', 1, { noStatus: 'nip' }), effects: [status('nip', 2), energy(10, self)] } }],
      },
      B: {
        name: '月影护舞',
        desc: '绝技后为生命比例最低的 2 名友方各净化 1 个负面效果，并施加「幻象」，可闪避下一次直接攻击，持续 2 次其行动结束；若选中貂蝉喵则计入本次施放。舞步留半寸，替同袍让开一爪。',
        patches: [{ skill: 'ultimate', addEffects: [{ t: 'cleanse', n: 1, to: ally('lowestHpPct', 2) }, status('illusion', 2, { to: ally('lowestHpPct', 2) })] }],
      },
    },
  },

  // 董桌：护盾压住饭桌，以挑衅接住攻击；睡着送鱼或醒着拍桌反击。
  qun_dongzhuo: {
    heroId: 'qun_dongzhuo',
    basic: {
      id: 'dz_basic', name: '拍桌', fx: 'melee.mace', melee: true, target: enemy('front'),
      effects: [dmg(1.0), hpShield(0.05, 2)],
      desc: '对前排随机 1 名敌人造成 100% 攻击的物理伤害，前排无人时选择后排；自身获得最大生命 5% 的护盾，持续 2 次自身行动结束，计入本次普攻。桌面拍响了，盘子要扶稳。',
    },
    ultimate: {
      id: 'dz_ult', name: '掀桌', fx: 'ult.tableFeast', target: enemy('all'),
      effects: [dmg(1.0), status('taunt', 2, { to: self }), hpShield(0.25, 3)],
      desc: '对敌方全体造成 100% 攻击的物理伤害。自身获得「挑衅」（敌方可受挑衅影响的单体普攻优先选择董桌），持续 2 次自身行动结束；另获最大生命 25% 的护盾，持续 3 次自身行动结束，均计入本次施放。饭桌挪开，先给自己留座。',
      levelMods: [
        { lv: 3, desc: '上菜别急：董桌带「挑衅」时受到攻击，额外回复 8 点元气，每整轮最多 2 次。', patch: { skill: 'passive', addPassive: { on: 'onHurt', cond: { c: 'status', id: 'taunt' }, limit: { per: 'round', n: 2 }, effects: [energy(8, self)] } } },
        { lv: 6, desc: '桌布绕爪：绝技额外使敌方基础攻击最高的 1 名猫（不计临时增减）「毛线缠」，无法施放绝技，持续 1 次其行动结束。', patch: { skill: 'ultimate', addEffects: [status('yarn', 1, { to: enemy('highestAtk', 1) })] } },
        { lv: 9, desc: '添一张稳凳：每场首次施放绝技前，生命比例最低的 1 名友方获得「九命」，可抵住 1 次直接致命伤害并保留 15% 最大生命，持续 3 次其行动结束；若选中董桌则计入本次施放。', patch: { skill: 'passive', addPassive: { on: 'onUlt', limit: { per: 'battle', n: 1 }, target: ally('lowestHpPct', 1), effects: [status('nine', 3)] } } },
      ],
    },
    passive: {
      id: 'dz_passive', name: '暴虐',
      desc: '受到攻击后，生命首次低于 90%、60%、30% 时，各叠 1 层「炸毛」（每层攻击 +15%，最多 3 层），持续 99 次自身行动结束；每个门槛每场仅触发一次。盘子空一格，本桌就多催一次菜。',
      passive: [0.9, 0.6, 0.3].map((hpPct) => ({ on: 'lowHp', hpPct, effects: [status('fluff', 99, { power: 0.15, to: self })] })),
    },
    awaken: {
      A: {
        name: '桌下藏鱼',
        desc: '董桌睡着时，桌下的小鱼干滚到同袍身边：其他仍醒着的友方各回复自身最大生命 25% 的生命，每场 1 次。盘子终于端给别人了。',
        patches: [{ skill: 'passive', addPassive: { on: 'onDeath', limit: { per: 'battle', n: 1 }, target: ally('all'), effects: [{ t: 'heal', scale: { targetMaxHp: 0.25 } }, text('鱼在桌下，自己拿。')] } }],
      },
      B: {
        name: '桌脚不挪窝',
        desc: '带「挑衅」时受到攻击，额外对仍醒着的攻击者造成 60% 攻击的物理伤害，每整轮最多 2 次。桌脚扎稳了，递盘子的路还得留着。',
        patches: [{ skill: 'passive', addPassive: { on: 'onHurt', cond: { c: 'status', id: 'taunt' }, limit: { per: 'round', n: 2 }, target: { side: 'enemy', pick: 'attacker' }, effects: [dmg(0.6)] } }],
      },
    },
  },

  // 木鹿大王：个人图腾召兽；余音两轮召兽与蛮族提速压制是两条路线。
  man_mulu: {
    heroId: 'man_mulu',
    basic: {
      id: 'ml_basic', name: '鼓点', fx: 'ranged.bolt', target: enemy('random', 1),
      effects: [dmg(1.1, { elem: 'magic' }), gainTotem()],
      desc: '对随机 1 名敌人造成 110% 攻击的法术伤害，并为木鹿大王自身叠加 1 层图腾，最多 6 层。敲鼓以前，先看看队尾有没有狗。',
    },
    ultimate: {
      id: 'ml_ult', name: '百兽朝鼓', fx: 'ult.beastDrum', target: enemy('random', 1),
      effects: [{ t: 'summon', beast: 'tiger', count: 2, perCounter: 'totem', scale: { atk: 0.9 }, elem: 'phys', applyStatus: { id: 'scratch', turns: 2, snap: { atk: 0.25 } } }],
      desc: '消耗木鹿大王全部个人图腾，召来同等数量的山林虎影，至少 2 只。每只独立随机选敌人，造成 90% 攻击的物理伤害，并叠加 1 层「抓痕」（每层在目标行动开始造成 25% 木鹿攻击的持续伤害，最多 3 层，持续 2 次目标行动结束）。兽影随鼓声散去，不占站位。',
      levelMods: [
        { lv: 3, desc: '雨林回声：绝技召兽后，使所有带「抓痕」的敌人「淋湿」（防御 -20%，持续 2 次其行动结束）。', patch: { skill: 'ultimate', addEffects: [status('wet', 2, { power: 0.2, to: scratchedEnemies })] } },
        { lv: 6, desc: '鼓声催阵：绝技额外为蛮势力友方各回复 15 点元气。', patch: { skill: 'ultimate', addEffects: [energy(15, factionAllies('man'))] } },
        { lv: 9, desc: '林中留铃：绝技召兽后，对所有带「抓痕」的敌人额外造成 45% 攻击的法术伤害，并施加「铃铛标记」（受伤 +10%，被暴击概率 +10 个百分点），持续 2 次其行动结束。', patch: { skill: 'ultimate', addEffects: [dmg(0.45, { elem: 'magic', to: scratchedEnemies }), status('mark', 2, { to: scratchedEnemies })] } },
      ],
    },
    passive: {
      id: 'ml_passive', name: '兽语',
      desc: '其他蛮势力友方每完成一次行动后，有 30% 概率为木鹿大王自身叠加 1 层图腾，最多 6 层；普攻与绝技都可触发。图腾不与别的猫或队伍图腾共用，兽鼓只认自己的拍子。',
      passive: [{
        on: 'onAllyAct', target: { side: 'ally', pick: 'source' },
        effects: [{ t: 'when', cond: { c: 'and', conds: [{ c: 'targetFaction', faction: 'man' }, { c: 'chance', p: 0.3 }] }, then: [gainTotem()] }],
      }],
    },
    awaken: {
      A: {
        name: '万兽齐鸣',
        desc: '个人图腾上限从 6 提高至 9 层。绝技后记下 2 轮余音；木鹿大王仍醒着时，接下来的 2 次整轮开始各召来 2 只虎影，每只随机攻击造成 45% 攻击的物理伤害，并叠加 1 层「抓痕」（每层 25% 木鹿攻击，最多 3 层，持续 2 次目标行动结束）。再施放会将余音刷新为 2 轮，不叠次数；兽影不留场，也不消耗图腾。',
        patches: [
          { skill: 'passive', addPassive: { on: 'battleStart', effects: [counter('ml_deep_forest', 1, 1)] } },
          { skill: 'ultimate', addEffects: [counter('ml_echo', 2, 2)] },
          { skill: 'passive', addPassive: { on: 'roundStart', cond: { c: 'counter', key: 'ml_echo', atLeast: 1 }, effects: [counter('ml_echo', -1), { t: 'summon', beast: 'tiger', count: 2, scale: { atk: 0.45 }, elem: 'phys', applyStatus: { id: 'scratch', turns: 2, snap: { atk: 0.25 } } }] } },
        ],
      },
      B: {
        name: '山林领路',
        desc: '绝技后使所有带「抓痕」的敌人「受惊」（攻击 -20%，持续 2 次其行动结束），并使蛮势力友方获得「猫步」（速度 +15%，持续 2 次其行动结束，木鹿大王计入本次施放）。林间队伍走快些，那只狗就走另一条路。',
        patches: [{ skill: 'ultimate', addEffects: [status('fright', 2, { power: 0.2, to: scratchedEnemies }), status('step', 2, { power: 0.15, to: factionAllies('man') })] }],
      },
    },
  },
};
