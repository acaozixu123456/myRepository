import type { EquipDef, EquipSetDef, EquipSlot, Quality, StatBlock, StatKey } from './types';

export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'armor', 'head', 'charm'];
export const EQUIP_QUALITIES: Quality[] = ['common', 'fine', 'rare', 'epic', 'legend'];

export const QUALITY_CURVE: Record<Quality, { base: number; growth: number; levelCap: number }> = {
  common: { base: 1, growth: 1, levelCap: 20 },
  fine: { base: 1.35, growth: 1.4, levelCap: 30 },
  rare: { base: 1.8, growth: 1.95, levelCap: 40 },
  epic: { base: 2.4, growth: 2.65, levelCap: 50 },
  legend: { base: 3.2, growth: 3.6, levelCap: 60 },
};

// 同品质按职业路线换副属性；武器、铠甲的主属性始终保持一致。
const PROFILES: Record<'front' | 'back' | 'camp' | 'peach' | 'ferry', Record<EquipSlot, StatBlock>> = {
  front: {
    weapon: { atk: 12, crit: 0.008 }, armor: { hp: 90, def: 6 },
    head: { def: 5, hp: 40, dmgReduce: 0.006 }, charm: { dodge: 0.012, spd: 1 },
  },
  back: {
    weapon: { atk: 12, critDmg: 0.018 }, armor: { hp: 90, def: 6 },
    head: { def: 5, spd: 1.5 }, charm: { crit: 0.012, hit: 0.01, healBonus: 0.008 },
  },
  camp: {
    weapon: { atk: 12, crit: 0.008 }, armor: { hp: 90, def: 6 },
    head: { def: 5, hp: 40 }, charm: { dodge: 0.012, spd: 1 },
  },
  peach: {
    weapon: { atk: 12, critDmg: 0.018 }, armor: { hp: 90, def: 6 },
    head: { def: 5, dmgReduce: 0.006 }, charm: { healBonus: 0.014, hit: 0.01 },
  },
  ferry: {
    weapon: { atk: 12, crit: 0.008 }, armor: { hp: 90, def: 6 },
    head: { def: 5, spd: 1.5 }, charm: { crit: 0.012, hit: 0.01 },
  },
};

function scaledStats(profile: StatBlock, scale: number): StatBlock {
  return Object.fromEntries(Object.entries(profile).map(([key, value]) => {
    const precision = ['hp', 'atk', 'def', 'spd'].includes(key) ? 100 : 1_000_000;
    return [key, Math.round(value * scale * precision) / precision];
  })) as Partial<Record<StatKey, number>>;
}

export function makeEquip(spec: {
  id: string; name: string; slot: EquipSlot; quality: Quality; flavor: string;
  setId?: string; profile?: keyof typeof PROFILES;
}): EquipDef {
  const { profile = 'camp', ...fields } = spec;
  const curve = QUALITY_CURVE[spec.quality];
  const stats = PROFILES[profile][spec.slot];
  return {
    ...fields,
    base: scaledStats(stats, curve.base),
    growth: scaledStats(stats, curve.growth * 0.06),
    levelCap: curve.levelCap,
  };
}

type SetTemplate = EquipSetDef & {
  profile: 'front' | 'back';
  pieces: [string, string, string, string];
};

const SET_TEMPLATES: SetTemplate[] = [
  {
    id: 'wei_tiger_guard', name: '虎卫玄甲', faction: 'wei', profile: 'front',
    flavor: '虎头帽底下也有软耳朵，只许自己人知道。',
    pieces: ['虎卫鱼骨锤', '虎卫护爪甲', '虎卫虎耳盔', '虎卫点兵铃'],
    bonus2: { desc: '防御增加十八，减伤增加百分之三点五。', stats: { def: 18, dmgReduce: 0.035 } },
    bonus4: { desc: '生命增加一百八十，减伤增加百分之四点五，开局护住同伴。', stats: { hp: 180, dmgReduce: 0.045 }, note: '每场开局为生命最低的友方添加穿戴者最大生命百分之十二的护体毛，持续两回合。' },
  },
  {
    id: 'wei_sleep_strategy', name: '静夜锦囊', faction: 'wei', profile: 'back',
    flavor: '锦囊口系得很紧，免得妙计在午睡时漏出去。',
    pieces: ['静夜薄荷卷', '静夜绒领袍', '静夜卧耳冠', '静夜锦囊铃'],
    bonus2: { desc: '治疗加成增加百分之十，速度增加四。', stats: { healBonus: 0.1, spd: 4 } },
    bonus4: { desc: '防御增加十，命中增加百分之六，妙计催醒同伴。', stats: { def: 10, hit: 0.06 }, note: '每场开局为元气最低的友方回复十五点元气，同值时按站位先后选择。' },
  },
  {
    id: 'shu_peach_guard', name: '桃园守约', faction: 'shu', profile: 'front',
    flavor: '三只猫挤一张席子，谁也没说自己睡得窄。',
    pieces: ['桃园偃月鱼骨刀', '桃园草席甲', '桃园结义耳冠', '桃园分饭铃'],
    bonus2: { desc: '生命增加一百五十，防御增加十二。', stats: { hp: 150, def: 12 } },
    bonus4: { desc: '治疗加成增加百分之六，减伤增加百分之五，危急时互相照应。', stats: { healBonus: 0.06, dmgReduce: 0.05 }, note: '穿戴者生命首次低于百分之三十时，为自身添加最大生命百分之十五的护体毛，持续两回合，每场一次。' },
  },
  {
    id: 'shu_eastwind', name: '卧龙借风', faction: 'shu', profile: 'back',
    flavor: '东风借来了，扇尖那根羽毛也顺便借走了目光。',
    pieces: ['卧龙逗猫羽扇', '卧龙云纹袍', '卧龙观星耳冠', '卧龙借风铃'],
    bonus2: { desc: '命中增加百分之七，速度增加五。', stats: { hit: 0.07, spd: 5 } },
    bonus4: { desc: '攻击增加二十四，暴击增加百分之五，失手后再想一步。', stats: { atk: 24, crit: 0.05 }, note: '穿戴者首次施加控制失败时回复二十点元气，每场一次，不改变免疫判定。' },
  },
  {
    id: 'wu_warm_blanket', name: '江东热毯', faction: 'wu', profile: 'front',
    flavor: '老将说这是战袍，晒肚皮时又说是毯子。',
    pieces: ['江东鱼骨铁鞭', '江东热毯甲', '江东暖耳盔', '江东守寨铃'],
    bonus2: { desc: '生命增加一百，减伤增加百分之四点五。', stats: { hp: 100, dmgReduce: 0.045 } },
    bonus4: { desc: '防御增加二十，减伤增加百分之三，挨近了会碰到火星。', stats: { def: 20, dmgReduce: 0.03 }, note: '受到近战伤害后，对攻击者反击一次百分之四十攻击的火焰伤害，每回合最多一次，反击不再触发反击。' },
  },
  {
    id: 'wu_redwall', name: '赤壁琴火', faction: 'wu', profile: 'back',
    flavor: '琴弦调得很准，水碗摆得不太稳。',
    pieces: ['赤壁鱼弦琴', '赤壁火尾披风', '赤壁听风耳冠', '赤壁调弦铃'],
    bonus2: { desc: '暴击增加百分之六，暴击伤害增加百分之十二。', stats: { crit: 0.06, critDmg: 0.12 } },
    bonus4: { desc: '攻击增加二十八，命中增加百分之五，水汽引出琴火。', stats: { atk: 28, hit: 0.05 }, note: '绝技首次命中淋湿目标时追加一层灼烧，按穿戴者百分之二十攻击持续两回合，每次绝技最多触发一次。' },
  },
  {
    id: 'qun_box_lord', name: '诸侯箱阵', faction: 'qun', profile: 'front',
    flavor: '会盟座次可以争，纸箱必须先留一只。',
    pieces: ['诸侯鱼骨长戟', '诸侯纸箱战甲', '诸侯箱沿耳盔', '诸侯会盟铃'],
    bonus2: { desc: '防御增加十八，生命增加一百二十。', stats: { def: 18, hp: 120 } },
    bonus4: { desc: '减伤增加百分之六，受惊之前先把箱盖合上。', stats: { dmgReduce: 0.06 }, note: '每场首次受到暴击后获得最大生命百分之十八的护体毛，持续两回合。' },
  },
  {
    id: 'qun_moon_bell', name: '月下追铃', faction: 'qun', profile: 'back',
    flavor: '铃铛还没响，月亮已经往云后躲了一点。',
    pieces: ['月下鱼骨双刃', '月下软尾舞衣', '月下花耳簪', '月下追影铃'],
    bonus2: { desc: '暴击增加百分之八，闪避增加百分之四。', stats: { crit: 0.08, dodge: 0.04 } },
    bonus4: { desc: '暴击伤害增加百分之二十，速度增加五，追铃也能攒元气。', stats: { critDmg: 0.2, spd: 5 }, note: '穿戴者造成暴击后回复八点元气，每回合最多一次，多段攻击共用次数。' },
  },
  {
    id: 'man_rattan_nest', name: '山林藤窝', faction: 'man', profile: 'front',
    flavor: '藤甲编得太舒服，点兵时得先敲敲窝门。',
    pieces: ['山林鱼骨棒', '山林藤窝甲', '山林藤耳盔', '山林醒窝铃'],
    bonus2: { desc: '生命增加一百八十，减伤增加百分之三。', stats: { hp: 180, dmgReduce: 0.03 } },
    bonus4: { desc: '防御增加二十四，减伤增加百分之三点五，余下的护盾暖回肉垫。', stats: { def: 24, dmgReduce: 0.035 }, note: '穿戴者的护体毛自然到期时，将剩余护盾的百分之二十转为自身治疗，被击破或驱散时不触发。' },
  },
  {
    id: 'man_beast_drum', name: '百兽爪鼓', faction: 'man', profile: 'back',
    flavor: '鼓点一响，山林排好队，狗请站远一点。',
    pieces: ['百兽肉垫鼓', '百兽斑尾披衣', '百兽羽耳冠', '百兽应声铃'],
    bonus2: { desc: '暴击增加百分之六，速度增加六。', stats: { crit: 0.06, spd: 6 } },
    bonus4: { desc: '攻击增加三十，暴击伤害增加百分之十五，图腾齐时百兽应声。', stats: { atk: 30, critDmg: 0.15 }, note: '穿戴者图腾达到三层时，下一次普攻追加百分之二十攻击的山林助攻，每回合最多一次，助攻不积累图腾。' },
  },
  {
    id: 'xian_cloud_mat', name: '云台眠垫', faction: 'xian', profile: 'front',
    flavor: '云是软的，坐垫也是软的，仙猫坚持这叫打坐。',
    pieces: ['云台鱼骨拂尘', '云台绒云甲', '云台莲耳冠', '云台安眠铃'],
    bonus2: { desc: '闪避增加百分之六，防御增加十二。', stats: { dodge: 0.06, def: 12 } },
    bonus4: { desc: '生命增加一百四十，减伤增加百分之四，毛线也留不住云。', stats: { hp: 140, dmgReduce: 0.04 }, note: '每场首次将要受到毛线缠时免疫该次控制，其他负面效果照常判定。' },
  },
  {
    id: 'xian_star_scroll', name: '天机星符', faction: 'xian', profile: 'back',
    flavor: '星图上的小爪印，是仙猫夜里校对过的天机。',
    pieces: ['天机爪印符卷', '天机星尾道袍', '天机望月耳冠', '天机问卦铃'],
    bonus2: { desc: '命中增加百分之八，治疗加成增加百分之七。', stats: { hit: 0.08, healBonus: 0.07 } },
    bonus4: { desc: '速度增加七，暴击增加百分之四，第一道控制符更稳。', stats: { spd: 7, crit: 0.04 }, note: '穿戴者每场首次施加控制时，控制命中率额外增加十五个百分点，不绕过控制免疫。' },
  },
];

export const EQUIP_SETS: EquipSetDef[] = SET_TEMPLATES.map(({ pieces: _pieces, profile: _profile, ...set }) => set);

const THEMES: { id: 'camp' | 'peach' | 'ferry'; names: string[]; flavor: string }[] = [
  { id: 'camp', names: ['营帐鱼骨剑', '营帐绒垫甲', '营帐护耳盔', '营帐巡夜铃'], flavor: '行军的纸箱收好了，里面还留着午睡的位置。' },
  { id: 'peach', names: ['草编鱼骨刀', '草编猫窝甲', '草编桃枝冠', '草编结穗铃'], flavor: '桃枝编进草绳里，兄弟认得这股晒暖的味道。' },
  { id: 'ferry', names: ['江渡鱼叉枪', '江渡浮绒甲', '江渡风耳帽', '江渡系舟铃'], flavor: '渡口风大，先把尾巴和行囊一起系稳。' },
];
const QUALITY_NAMES: Record<Quality, string> = { common: '素纹', fine: '青纹', rare: '银纹', epic: '锦纹', legend: '金纹' };

export const EQUIPS: EquipDef[] = [
  ...SET_TEMPLATES.flatMap((set) => EQUIP_SLOTS.map((slot, index) => makeEquip({
    id: `${set.id}_${slot}`, name: set.pieces[index], slot, quality: 'legend',
    setId: set.id, profile: set.profile, flavor: set.flavor,
  }))),
  ...THEMES.flatMap((theme) => EQUIP_QUALITIES.filter((quality) => quality !== 'legend').flatMap((quality) =>
    EQUIP_SLOTS.map((slot, index) => makeEquip({
      id: `${theme.id}_${quality}_${slot}`, name: `${QUALITY_NAMES[quality]}${theme.names[index]}`,
      slot, quality, profile: theme.id, flavor: theme.flavor,
    })))),
];
