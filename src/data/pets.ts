// 宠物猫：真正的小猫（头大、身子小、不穿袍子），每只有自己的毛色和小配饰，战斗里每 3 个回合出手一次（从第 2 回合起），
// 同时给全队一点属性加成；探索时跟在队伍后面小跑。稀有度 R / SR / SSR。
import type { CatLook } from '../art/types';
import type { Effect, TargetSel } from '../engine/types';
import { ally, dmg, energy, enemy, status } from './kits/helpers';

export type PetRarity = 'R' | 'SR' | 'SSR';
export interface PetSkillDef { name: string; fx: string; target: TargetSel; effects: Effect[]; desc: string }
export interface PetDef { id: string; name: string; rarity: PetRarity; tagline: string; look: CatLook; skill: PetSkillDef }

const pal = (main: string, sub: string, trim = '#e8c15a') => ({ main, sub, trim });
/** 宠物统一小一号：头大、身子圆；没有衣服（body: none），只有颈圈 / 围巾 / 披风 / 翅膀 / 小冠这类配饰 */
const kit = (look: Omit<CatLook, 'build' | 'head'> & { build?: number; head?: number }): CatLook => ({ build: 0.82, head: 1.3, blush: true, ...look } as CatLook);

export const PETS: PetDef[] = [
  { id: 'pet_tuanzi', name: '团子', rarity: 'R', tagline: '圆滚滚的橘白小奶猫，一呼噜全队都暖和。',
    look: kit({ coat: { pattern: 'tuxedo', base: '#f0a24a', light: '#fff4e2' }, eye: { color: '#7a5a2a', style: 'happy' }, ear: 'round', tail: 'stub', outfit: { pal: pal('#f0a24a', '#ff7a8a'), body: 'none', head: 'none', back: 'none', weapon: 'none', extra: ['bell'] } }),
    skill: { name: '呼噜团', fx: 'pet.heal', target: ally('lowestHpPct', 2), effects: [{ t: 'heal', scale: { atk: 1.5 } }], desc: '蜷成团呼噜：治疗生命比例最低的 2 名友方（150% 攻击）。' } },
  { id: 'pet_meiqiu', name: '煤球', rarity: 'R', tagline: '全身漆黑的小酷猫，一双金眼睛，专挑后排下爪。',
    look: kit({ coat: { pattern: 'solid', base: '#2c2a34', light: '#4a4658' }, eye: { color: '#ffd24a', style: 'sharp' }, ear: 'pointy', tail: 'long', blush: false, outfit: { pal: pal('#2c2a34', '#c8352c'), body: 'none', head: 'none', back: 'cape', weapon: 'none', extra: ['scarf'] } }),
    skill: { name: '暗影扑击', fx: 'pet.strike', target: enemy('back'), effects: [dmg(1.7, { critBonus: 0.15 })], desc: '悄悄绕后：对敌方后排造成 170% 攻击的伤害，暴击率 +15%。' } },
  { id: 'pet_huahua', name: '花花', rarity: 'R', tagline: '三花小姑娘，嗓门大，一叫大家都来劲。',
    look: kit({ coat: { pattern: 'calico', base: '#fff4e8', light: '#fffaf2', accent: '#ee9a3a' }, eye: { color: '#3a9a6a', style: 'wide' }, ear: 'pointy', tail: 'curl', outfit: { pal: pal('#fff4e8', '#ff9ac8'), body: 'none', head: 'flowerPin', back: 'none', weapon: 'none', extra: [] } }),
    skill: { name: '喵喵助威', fx: 'pet.energy', target: ally('all'), effects: [energy(25)], desc: '大声喵喵叫：友方全体元气 +25。' } },
  { id: 'pet_xueqiu', name: '雪球', rarity: 'SR', tagline: '雪白长毛的小贵族，披着小斗篷，护着大家。',
    look: kit({ coat: { pattern: 'solid', base: '#f4f8ff', light: '#ffffff' }, eye: { color: '#5aa8e8', style: 'calm' }, ear: 'fold', tail: 'bushy', outfit: { pal: pal('#f4f8ff', '#7ab8e8'), body: 'none', head: 'none', back: 'cape', weapon: 'none', extra: ['bell'] } }),
    skill: { name: '寒霜护体', fx: 'pet.shield', target: ally('all'), effects: [{ t: 'shield', scale: { maxHp: 0.14 }, turns: 2 }], desc: '抖落一身雪花：友方全体获得最大生命 14% 的护盾（2 回合）。' } },
  { id: 'pet_huzai', name: '虎崽', rarity: 'SR', tagline: '虎斑小猛兽，奶凶奶凶，扑过来能让人懵一下。',
    look: kit({ coat: { pattern: 'tabby', base: '#e8a040', light: '#fff0d0', stripe: '#6a3a1a' }, eye: { color: '#e8c030', style: 'fierce' }, ear: 'round', tail: 'ring', blush: false, outfit: { pal: pal('#e8a040', '#c8352c'), body: 'none', head: 'tigerHood', back: 'none', weapon: 'none', extra: [] } }),
    skill: { name: '小老虎扑', fx: 'pet.strike', target: enemy('front'), effects: [dmg(2.2), status('dizzy', 1, { p: 0.5 })], desc: '一个猛扑：对前排敌人造成 220% 攻击的伤害，50% 使其晕乎乎 1 回合。' } },
  { id: 'pet_huihui', name: '灰灰', rarity: 'SR', tagline: '蓝灰色的小淘气，脖子上的铃铛叮铃响，敌人听了就怯场。',
    look: kit({ coat: { pattern: 'shaded', base: '#8a9ab8', light: '#dce4f0', accent: '#5a6a88' }, eye: { color: '#e8b04a', style: 'round' }, ear: 'big', tail: 'long', outfit: { pal: pal('#8a9ab8', '#ffb04a'), body: 'none', head: 'none', back: 'none', weapon: 'none', extra: ['bell', 'tassel'] } }),
    skill: { name: '铃铛乱响', fx: 'pet.debuff', target: enemy('all'), effects: [status('fright', 2, { power: 0.2 })], desc: '叮铃叮铃：敌方全体「受惊」2 回合（攻击 -20%）。' } },
  { id: 'pet_diandian', name: '点点', rarity: 'SR', tagline: '奶牛花斑的小馋猫，叼着小鱼干来慰问。',
    look: kit({ coat: { pattern: 'cow', base: '#ffffff', light: '#ffffff', accent: '#2a2a32' }, eye: { color: '#4a8a5a', style: 'wink' }, ear: 'pointy', tail: 'long', outfit: { pal: pal('#ffffff', '#ff7a6a'), body: 'none', head: 'none', back: 'ribbons', weapon: 'none', extra: ['scarf'] } }),
    skill: { name: '叼来小鱼干', fx: 'pet.heal', target: ally('all'), effects: [{ t: 'heal', scale: { atk: 0.7 } }, status('purr', 2, { power: 0.05 })], desc: '叼着小鱼干分给大家：友方全体回复 70% 攻击，并附「呼噜」2 回合。' } },
  { id: 'pet_jinjin', name: '金金', rarity: 'SR', tagline: '金渐层的小少爷，头顶一枚小金冠，闪到所有猫都想打架。',
    look: kit({ coat: { pattern: 'shaded', base: '#f2c878', light: '#fff2d8', accent: '#d8a040' }, eye: { color: '#3a9a6a', style: 'cool' }, ear: 'pointy', tail: 'bushy', blush: false, outfit: { pal: pal('#f2c878', '#c8352c'), body: 'none', head: 'emperorCrown', back: 'capeLong', weapon: 'none', extra: [] } }),
    skill: { name: '金光闪闪', fx: 'pet.buff', target: ally('all'), effects: [status('fluff', 2, { power: 0.2 })], desc: '金光一闪：友方全体「炸毛」2 回合（攻击 +20%）。' } },
  { id: 'pet_longmao', name: '小龙猫', rarity: 'SSR', tagline: '头上长着小龙角的蓝绿小猫，喷出来的火球刚好够烤鱼。',
    look: kit({ coat: { pattern: 'solid', base: '#4ab8b0', light: '#d8f8f0' }, eye: { color: '#ffd24a', style: 'keen' }, ear: 'tuft', tail: 'curl', blush: false, outfit: { pal: pal('#4ab8b0', '#ff7a4a', '#ffd24a'), body: 'none', head: 'boneCrown', back: 'wings', weapon: 'none', extra: [] } }),
    skill: { name: '龙息', fx: 'pet.fire', target: enemy('all'), effects: [dmg(1.5, { elem: 'fire' }), status('burn', 3, { snapAtk: 0.35 })], desc: '一口小火球：敌方全体 150% 火焰伤害，并「灼烧」3 回合。' } },
  { id: 'pet_jiuwei', name: '九尾', rarity: 'SSR', tagline: '会分身的小狐猫，永远在你以为它在这里的时候在那里。',
    look: kit({ coat: { pattern: 'point', base: '#fff0e0', light: '#ffffff', accent: '#e87a3a' }, eye: { color: '#c05ae8', style: 'happy' }, ear: 'big', tail: 'bushy', outfit: { pal: pal('#fff0e0', '#c05ae8'), body: 'none', head: 'lotusCrown', back: 'ribbons', weapon: 'none', extra: ['earring'] } }),
    skill: { name: '幻影分身', fx: 'pet.buff', target: ally('all'), effects: [status('illusion', 1), energy(15)], desc: '分身一晃：友方全体获得「幻象」（闪避下一次攻击），元气 +15。' } },
  { id: 'pet_shouhu', name: '守护喵', rarity: 'SSR', tagline: '戴着小头盔的铁壁小卫兵，站在哪儿，哪儿就是安全区。',
    look: kit({ coat: { pattern: 'shaded', base: '#9aa8b8', light: '#e8eef4', accent: '#6a7a8e' }, eye: { color: '#5a9ae8', style: 'calm' }, ear: 'pointy', tail: 'stub', blush: false, outfit: { pal: pal('#9aa8b8', '#4a78c8', '#e8c15a'), body: 'none', head: 'helmetWei', back: 'cape', weapon: 'shield', extra: [] } }),
    skill: { name: '铁壁', fx: 'pet.shield', target: ally('all'), effects: [{ t: 'shield', scale: { maxHp: 0.2 }, turns: 3 }, status('ward', 2, { power: 0.15 })], desc: '举盾守护：友方全体获得最大生命 20% 的护盾（3 回合），并「护佑」2 回合（受伤 -15%）。' } },
  { id: 'pet_xingxing', name: '星星', rarity: 'SSR', tagline: '深蓝夜空色的小猫，尾巴尖挂着一颗会掉下来的星星。',
    look: kit({ coat: { pattern: 'spots', base: '#2a3a78', light: '#9ab0f0', accent: '#fff2a8' }, eye: { color: '#fff2a8', style: 'wide' }, ear: 'pointy', tail: 'curl', outfit: { pal: pal('#2a3a78', '#ffd24a', '#fff2a8'), body: 'none', head: 'none', back: 'wings', weapon: 'none', extra: ['bell'] } }),
    skill: { name: '星陨', fx: 'pet.bolt', target: enemy('random', 3), effects: [dmg(1.5, { elem: 'thunder' }), status('charm', 2, { p: 0.7 })], desc: '一阵流星雨：随机 3 名敌人各 150% 雷系伤害，并贴「符咒」。' } },
];
export const PET_BY_ID: Record<string, PetDef> = Object.fromEntries(PETS.map((p) => [p.id, p]));
export const PET_RARITY_NAME: Record<PetRarity, string> = { R: '普通', SR: '稀有', SSR: '传说' };
