// 合击技：羁绊（BONDS）凑齐、成员都在场时，每 3 个回合（第 3、6、9…回合开头）全员齐出手一次。
// 施放者取成员里攻击最高的一只；伤害按施放者的攻击计，效果用战斗语言（DSL）描述，和普通技能同一套引擎。
import type { Effect, TargetSel } from '../engine/types';
import { ally, dmg, energy, enemy, status } from './kits/helpers';

export interface ComboDef { bond: string; name: string; fx: string; color: string; desc: string; target: TargetSel; effects: Effect[] }
export const COMBO_EVERY = 3;

export const COMBOS: ComboDef[] = [
  { bond: '桃园结义', name: '桃园三结义', fx: 'combo.oath', color: '#ff7aa8', desc: '三杰齐出：敌方全体 130% 攻击伤害；友方全体回复 60% 攻击并「炸毛」。', target: enemy('all'),
    effects: [dmg(1.3), { t: 'heal', scale: { atk: 0.6 }, to: ally('all') }, status('fluff', 2, { power: 0.2, to: ally('all') })] },
  { bond: '火烧赤壁', name: '借东风·火烧连营', fx: 'combo.fire', color: '#ff7a3a', desc: '孔明借风、公瑾点火：敌方全体 150% 火焰伤害并「灼烧」3 回合。', target: enemy('all'),
    effects: [dmg(1.5, { elem: 'fire' }), status('burn', 3, { snapAtk: 0.35 })] },
  { bond: '魏武之道', name: '挟天子令诸侯', fx: 'combo.imperial', color: '#4f8aff', desc: '魏军齐令：友方全体获得最大生命 18% 的护盾 2 回合；敌方前排 160% 攻击伤害。', target: enemy('frontRow'),
    effects: [dmg(1.6), { t: 'shield', scale: { maxHp: 0.18 }, turns: 2, to: ally('all') }] },
  { bond: '美人连环', name: '连环计·醉倾城', fx: 'combo.charm', color: '#d86aff', desc: '貂蝉起舞、吕布出戟：敌方 2 名随机目标 180% 伤害并「猫薄荷醉」1 回合。', target: enemy('random', 2),
    effects: [dmg(1.8), status('nip', 1, { p: 0.8 })] },
  { bond: '七擒七纵', name: '七擒七纵·万兽奔腾', fx: 'combo.beasts', color: '#5fb85a', desc: '蛮王驱兽：敌方全体 120% 攻击伤害并「抓痕」；友方全体元气 +20。', target: enemy('all'),
    effects: [dmg(1.2), status('scratch', 2, { snapAtk: 0.3 }), energy(20, ally('all'))] },
  { bond: '天机四象', name: '天机四象·星罗棋布', fx: 'combo.stars', color: '#7a8aff', desc: '四象归位：敌方全体 110% 雷法伤害并贴「符咒」；友方全体元气 +15。', target: enemy('all'),
    effects: [dmg(1.1, { elem: 'thunder' }), status('charm', 2, { p: 1 }), energy(15, ally('all'))] },
  { bond: '杏林同盟', name: '杏林春满', fx: 'combo.bloom', color: '#6adf9a', desc: '三位名医同施妙手：友方全体回复 110% 攻击，净化 1 个负面状态，并附「呼噜」。', target: ally('all'),
    effects: [{ t: 'heal', scale: { atk: 1.1 } }, { t: 'cleanse', n: 1, kind: 'debuff' }, status('purr', 2, { power: 0.06 })] },
  { bond: '江东之虎', name: '江东虎啸', fx: 'combo.tiger', color: '#ff9a3a', desc: '三虎同吼：敌方全体 140% 攻击伤害并「受惊」2 回合。', target: enemy('all'),
    effects: [dmg(1.4), status('fright', 2, { power: 0.2 })] },
];
export const COMBO_BY_BOND: Record<string, ComboDef> = Object.fromEntries(COMBOS.map((c) => [c.bond, c]));
