import type { FactionId } from './factions';
import type { Rarity, Role } from './heroes';

export interface RoleDef {
  role: Role;
  desc: string;
  row: '前排' | '后排';
  base: { hp: number; atk: number; def: number; spd: number };
}

export const ROLES: Record<Role, RoleDef> = {
  守护: { role: '守护', row: '前排', desc: '吸收伤害、嘲讽与护盾，队伍的“猫抓板”。', base: { hp: 1200, atk: 95, def: 80, spd: 90 } },
  先锋: { role: '先锋', row: '前排', desc: '近身高爆发，擅长切入与追击。', base: { hp: 900, atk: 130, def: 55, spd: 105 } },
  神射: { role: '神射', row: '后排', desc: '远程物理输出，多段与暴击。', base: { hp: 760, atk: 150, def: 40, spd: 110 } },
  谋士: { role: '谋士', row: '后排', desc: '法术群伤与控制，战场的指挥官。', base: { hp: 720, atk: 145, def: 38, spd: 100 } },
  医者: { role: '医者', row: '后排', desc: '治疗、净化与复活，队伍的“猫薄荷”。', base: { hp: 800, atk: 90, def: 50, spd: 100 } },
  刺客: { role: '刺客', row: '后排', desc: '绕后飞刀，专杀后排脆皮。', base: { hp: 700, atk: 150, def: 38, spd: 125 } },
};

export const RARITY_MULT: Record<Rarity, number> = { SR: 0.88, SSR: 1.0, UR: 1.15, SP: 1.55 };

export function baseStats(role: Role, rarity: Rarity) {
  const b = ROLES[role].base;
  const m = RARITY_MULT[rarity];
  return { hp: Math.round(b.hp * m), atk: Math.round(b.atk * m), def: Math.round(b.def * m), spd: Math.round(b.spd * (0.96 + (m - 0.82) * 0.1)) };
}

/** 阵营克制环：A 克制 B，伤害 +7%；被克制 -7%（用镜像对局标定：约等于对面少 1 级，克制方胜率 ≈ 62%） */
export const COUNTER_BONUS = 0.07;
export const COUNTER_RING: FactionId[] = ['wei', 'qun', 'shu', 'man', 'wu', 'xian'];
export const COUNTER_REASON: Record<FactionId, string> = {
  wei: '以铁壁军纪镇压乱世群雄',
  qun: '以乱世暴击压制仁义之师',
  shu: '以攻心之计七擒南蛮',
  man: '以山林毒瘴与地利伏击水师',
  wu: '以赤壁烈火焚尽符箓玄门',
  xian: '以天机术数看破铁壁阵势',
};

export interface Bond {
  name: string;
  heroes: string[];
  desc: string;
}

export const BONDS: Bond[] = [
  { name: '桃园结义', heroes: ['shu_liumiaobei', 'shu_guanyunmiao', 'shu_zhangmiaofei'], desc: '三猫全属性 +20%；任一阵亡，其余两只攻击 +30%。' },
  { name: '火烧赤壁', heroes: ['shu_zhugemiaoliang', 'wu_zhoumiaoyu'], desc: '我方施加的「灼烧」每跳伤害 +30%。' },
  { name: '魏武之道', heroes: ['wei_caomiaode', 'wei_xiahoudun', 'wei_xuhuchi'], desc: '魏势力给出的「护体毛」+30%；曹喵德元气获取 +20%。' },
  { name: '美人连环', heroes: ['qun_diaochan', 'qun_lvbuding', 'qun_dongzhuo'], desc: '敌人「猫薄荷醉」时长 +1 回合；吕布丁攻击 +25%。' },
  { name: '七擒七纵', heroes: ['man_mengmiaohuo', 'man_zhurong', 'man_mulu', 'man_wutugu'], desc: '蛮势力友方生命 +15%；图腾猛兽所需的普攻次数 6 → 5。' },
  { name: '天机四象', heroes: ['xian_zuoci', 'xian_zhangzhua', 'xian_shuijing', 'xian_guanlu'], desc: '「天命」触发率 +15%。' },
  { name: '杏林同盟', heroes: ['qun_huatuo', 'wei_guojia', 'xian_shuijing'], desc: '我方治疗量 +20%；净化成功时附带「呼噜」1 回合。' },
  { name: '江东之虎', heroes: ['wu_sunxiaoba', 'wu_sunxiangxiang', 'wu_huanggai'], desc: '吴势力友方暴击率 +15%；灼烧目标受到的所有伤害 +10%。' },
];
