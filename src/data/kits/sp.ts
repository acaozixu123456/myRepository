// 3 只「至尊 SP」的技能组：仅限氪金获得，数值明显强于 UR，绝技画面也是最华丽的一档。
// 设计原则：不靠“白送属性”拉开差距，而是更大的倍率 + 额外联动，让它们成为阵容的核心而不是替代品。
import type { Kit } from '../../engine/types';
import { ally, dmg, energy, enemy, heal, self, shield, status, text } from './helpers';

export const KITS_SP: Record<string, Kit> = {
  // ================= 魏 · 司马喵懿：忍到最后的冢虎 =================
  wei_simamiyi: {
    heroId: 'wei_simamiyi',
    basic: {
      id: 'sm_basic', name: '狼顾', fx: 'ranged.seal', target: enemy('random', 2),
      effects: [dmg(1.25, { elem: 'magic' }), energy(10, self), energy(-8, enemy('highestEnergy', 1))],
      desc: '回头一看：对随机 2 名敌人各造成 125% 攻击的法术伤害，自身回复 10 点元气，并偷走敌方元气最高者 8 点元气。',
    },
    ultimate: {
      id: 'sm_ult', name: '冢虎出笼', fx: 'ult.tigerTomb', target: enemy('all'),
      effects: [
        dmg(2.7, { elem: 'magic', ignoreDef: 0.3 }),
        status('fright', 2, { power: 0.25, to: enemy('all') }),
        shield(0.9, 3, ally('all')),
        energy(15, ally('all')),
        { t: 'when', cond: { c: 'allyFaction', faction: 'wei', atLeast: 3 }, then: [dmg(1.0, { elem: 'magic' }), status('ward', 2, { power: 0.2, to: ally('all') }), text('魏·铁壁')] },
      ],
      desc: '忍了很久的老虎终于出笼：对敌方全体造成 270% 攻击的法术伤害（无视 30% 防御），敌方全体「受惊」（攻击 -25%，2 回合）；友方全体获得「护体毛」（90% 攻击，3 回合）并回复 15 点元气。场上魏势力≥3 时追加 100% 攻击伤害，并让友方全体「护佑」（受伤 -20%，2 回合）。',
      levelMods: [
        { lv: 3, desc: '后发制猫：敌方元气最高者再被偷走 30 点元气。', patch: { skill: 'ultimate', addEffects: [energy(-30, enemy('highestEnergy', 1))] } },
        { lv: 6, desc: '收网：敌方全体「毛线缠」1 回合（40% 概率）。', patch: { skill: 'ultimate', addEffects: [status('yarn', 1, { p: 0.4, to: enemy('all') })] } },
        { lv: 9, desc: '天下归我：整体效果 +25%。', patch: { skill: 'ultimate', scaleMul: 1.25 } },
      ],
    },
    passive: {
      id: 'sm_passive', name: '隐忍',
      desc: '开战时全队「护佑」（受伤 -20%，3 回合）；每回合开始自身回复 12 点元气；友方猫猫倒下时，自身「炸毛」（攻击 +20%，可叠 3 层）。',
      passive: [
        { on: 'battleStart', effects: [status('ward', 3, { power: 0.2, to: ally('all') })] },
        { on: 'roundStart', effects: [energy(12, self)] },
        { on: 'onAllyDeath', effects: [status('fluff', 3, { power: 0.2, to: self })] },
      ],
    },
    awaken: {
      A: { name: '三马同槽', desc: '绝技伤害 +20%，且额外使敌方元气最高的两只猫各失去 25 点元气。',
        patches: [{ skill: 'ultimate', scaleMul: 1.2, addEffects: [energy(-25, enemy('highestEnergy', 2))] }] },
      B: { name: '空城', desc: '开战时自身获得「九命」与「潜行」2 回合；友方全体防御 +15%（团团 2 回合）。',
        patches: [{ skill: 'passive', addPassive: { on: 'battleStart', effects: [status('nine', 3, { to: self }), status('stealth', 2, { to: self }), status('curl', 2, { power: 0.15, to: ally('all') })] } }] },
    },
  },

  // ================= 蜀 · 庞喵统：连环喷嚏的小凤凰 =================
  shu_pangmiaotong: {
    heroId: 'shu_pangmiaotong',
    basic: {
      id: 'pt_basic', name: '火羽箭', fx: 'ranged.arrow', target: enemy('random', 1),
      effects: [dmg(1.35, { elem: 'fire', hits: 2 }), status('burn', 2, { p: 0.5, stacks: 1, snapAtk: 0.35 })],
      desc: '射出两支火羽箭，各造成 135% 攻击的火焰伤害（对随机 1 名敌人）；50% 概率附带「灼烧」2 回合。',
    },
    ultimate: {
      id: 'pt_ult', name: '凤雏燎原', fx: 'ult.phoenixRain', target: enemy('all'),
      effects: [
        dmg(1.6, { elem: 'fire', hits: 2 }),
        status('burn', 3, { stacks: 2, snapAtk: 0.5, to: enemy('all') }),
        { t: 'detonate', id: 'burn', per: 0.3, elem: 'fire', keep: 1, to: enemy('all') },
        status('fluff', 3, { power: 0.25, to: ally('all') }),
      ],
      desc: '金凤凰展翅，火雨落满战场：对敌方全体连续两次造成 160% 攻击的火焰伤害，并叠加 2 层「灼烧」（3 回合）；随后引爆灼烧——每层再造成 30% 攻击的伤害（保留 1 层）。友方全体「炸毛」（攻击 +25%，3 回合）。',
      levelMods: [
        { lv: 3, desc: '浴火：蜀势力友方额外获得「呼噜」（每回合 8% 最大生命，3 回合）。', patch: { skill: 'ultimate', addEffects: [status('purr', 3, { power: 0.08, to: { side: 'ally', pick: 'all', faction: 'shu' } })] } },
        { lv: 6, desc: '焦土：敌方全体「受惊」（攻击 -20%，2 回合）。', patch: { skill: 'ultimate', addEffects: [status('fright', 2, { power: 0.2, to: enemy('all') })] } },
        { lv: 9, desc: '凤鸣九天：整体效果 +25%。', patch: { skill: 'ultimate', scaleMul: 1.25 } },
      ],
    },
    passive: {
      id: 'pt_passive', name: '涅槃',
      desc: '生命首次低于 30% 时：回复 50% 最大生命，获得「九命」与「炸毛」（攻击 +30%）并回复 60 点元气（每场一次）；每次暴击额外回复 8 点元气。',
      passive: [
        { on: 'lowHp', hpPct: 0.3, limit: { per: 'battle', n: 1 }, effects: [{ t: 'heal', scale: { maxHp: 0.5 } }, status('nine', 2, { to: self }), status('fluff', 3, { power: 0.3, to: self }), energy(60, self), text('涅槃重生')] },
        { on: 'onCrit', effects: [energy(8, self)] },
      ],
    },
    awaken: {
      A: { name: '连环', desc: '绝技结尾再追加一轮 90% 攻击的火焰伤害（对敌方全体）；普攻「火羽箭」必定附带「灼烧」。',
        patches: [{ skill: 'ultimate', addEffects: [dmg(0.9, { elem: 'fire', to: enemy('all') })] }, { skill: 'basic', addEffects: [status('burn', 2, { stacks: 1, snapAtk: 0.35 })] }] },
      B: { name: '落凤坡', desc: '涅槃额外净化自身全部负面，并让友方全体回复 20% 最大生命。',
        patches: [{ skill: 'passive', addPassive: { on: 'lowHp', hpPct: 0.3, limit: { per: 'battle', n: 1 }, effects: [{ t: 'cleanse', to: self }, { t: 'heal', scale: { maxHp: 0.2 }, to: ally('all') }] } }] },
    },
  },

  // ================= 仙 · 嫦喵：把月光揉成珠子的医者 =================
  xian_changmiao: {
    heroId: 'xian_changmiao',
    basic: {
      id: 'cm_basic', name: '月爪', fx: 'heal.touch', target: ally('lowestHpPct', 2),
      effects: [heal(1.6), energy(8, ally('lowestEnergy', 1))],
      desc: '月光落在生命比例最低的 2 名友方身上，各回复 160% 攻击的生命，并让元气最低的友方回复 8 点元气。',
    },
    ultimate: {
      id: 'cm_ult', name: '广寒月华', fx: 'ult.moonPalace', target: ally('all'),
      effects: [
        heal(2.7),
        shield(1.0, 3, ally('all')),
        { t: 'cleanse', to: ally('all') },
        status('purr', 3, { power: 0.1, to: ally('all') }),
        { t: 'when', cond: { c: 'allyCount', atMost: 4 }, then: [heal(1.0), energy(25, ally('all')), text('月满')] },
      ],
      desc: '广寒宫开，月华如瀑：友方全体回复 270% 攻击的生命，获得「护体毛」（100% 攻击，3 回合）与「呼噜」（每回合 10% 最大生命，3 回合），并净化全部负面效果。若有友方倒下（场上不足 5 只），再追加 100% 攻击的治疗并回复 25 点元气。',
      levelMods: [
        { lv: 3, desc: '桂花雨：友方全体「护佑」（受伤 -15%，2 回合）。', patch: { skill: 'ultimate', addEffects: [status('ward', 2, { power: 0.15, to: ally('all') })] } },
        { lv: 6, desc: '玉兔捣药：友方全体「炸毛」（攻击 +25%，3 回合）。', patch: { skill: 'ultimate', addEffects: [status('fluff', 3, { power: 0.25, to: ally('all') })] } },
        { lv: 9, desc: '月满西楼：整体效果 +25%。', patch: { skill: 'ultimate', scaleMul: 1.25 } },
      ],
    },
    passive: {
      id: 'cm_passive', name: '月魄',
      desc: '友方猫猫倒下时，嫦喵立刻让其以 35% 生命起身（每场一次）；每回合开始，生命比例最低的友方回复 6% 最大生命的「月光」。',
      passive: [
        { on: 'onAllyDeath', limit: { per: 'battle', n: 1 }, effects: [text('月魄归位'), { t: 'revive', hpPct: 0.35, to: ally('source') }] },
        { on: 'roundStart', effects: [{ t: 'heal', scale: { targetMaxHp: 0.06 }, to: ally('lowestHpPct', 1) }] },
      ],
    },
    awaken: {
      A: { name: '满月', desc: '绝技治疗 +20%，护盾额外 +30% 攻击；友方暴击率提高（炸毛 2 回合）。',
        patches: [{ skill: 'ultimate', scaleMul: 1.2, addEffects: [status('fluff', 2, { power: 0.2, to: ally('all') })] }] },
      B: { name: '玉兔归巢', desc: '月魄可触发 2 次，且起身生命提高到 50%。',
        patches: [{ skill: 'passive', addPassive: { on: 'onAllyDeath', limit: { per: 'battle', n: 1 }, effects: [{ t: 'revive', hpPct: 0.5, to: ally('source') }] } }] },
    },
  },
};
