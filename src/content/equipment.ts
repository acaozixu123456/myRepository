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
  pieceFlavors: Record<EquipSlot, string>;
};

const SET_TEMPLATES: SetTemplate[] = [
  {
    id: 'wei_tiger_guard', name: '虎卫玄甲', faction: 'wei', profile: 'front',
    flavor: '虎头帽底下也有软耳朵，只许自己人知道。',
    pieces: ['虎卫鱼骨锤', '虎卫护爪甲', '虎卫虎耳盔', '虎卫点兵铃'],
    pieceFlavors: {
      weapon: '鱼骨锤的握柄垫了厚绒，抡起来很威风，放下时还得轻一点，别吵醒后排。',
      armor: '甲片之间塞着软絮，挡得住风，也容得下一只偷偷伸进来的同伴爪子。',
      head: '虎耳盔的耳尖挺得笔直，里面却全是绒毛；摘下来，虎卫就少了两分严肃。',
      charm: '点兵铃响一声，便有猫应一声。偶尔多出一声，是刚醒的猫替午睡也报了到。',
    },
    bonus2: { desc: '防御增加十八，减伤增加百分之三点五。', stats: { def: 18, dmgReduce: 0.035 } },
    bonus4: { desc: '生命增加一百八十，减伤增加百分之四点五，开局护住同伴。', stats: { hp: 180, dmgReduce: 0.045 }, note: '每场开局为生命最低的友方添加穿戴者最大生命百分之十二的护体毛，持续两回合。' },
  },
  {
    id: 'wei_sleep_strategy', name: '静夜锦囊', faction: 'wei', profile: 'back',
    flavor: '锦囊口系得很紧，免得妙计在午睡时漏出去。',
    pieces: ['静夜薄荷卷', '静夜绒领袍', '静夜卧耳冠', '静夜锦囊铃'],
    pieceFlavors: {
      weapon: '薄荷卷的末页没有字，留给枕着它睡觉的猫补上一枚爪印。醒来时，妙计通常也齐了。',
      armor: '绒领替脖颈留住一圈暖意，军议再长，披袍的猫也能安稳地闭目推演。',
      head: '把两只耳朵卧进冠沿的小窝，世事便安静些；分鱼的声音除外。',
      charm: '锦囊口这枚铃舌裹了棉。摇三下才有人睁眼，袋里的计策却已经排好队。',
    },
    bonus2: { desc: '治疗加成增加百分之十，速度增加四。', stats: { healBonus: 0.1, spd: 4 } },
    bonus4: { desc: '防御增加十，命中增加百分之六，妙计催醒同伴。', stats: { def: 10, hit: 0.06 }, note: '每场开局为元气最低的友方回复十五点元气，同值时按站位先后选择。' },
  },
  {
    id: 'shu_peach_guard', name: '桃园守约', faction: 'shu', profile: 'front',
    flavor: '三只猫挤一张席子，谁也没说自己睡得窄。',
    pieces: ['桃园偃月鱼骨刀', '桃园草席甲', '桃园结义耳冠', '桃园分饭铃'],
    pieceFlavors: {
      weapon: '刀背刻着三道浅痕，原是结义时比爪长留下的。谁最长，至今没有定论。',
      armor: '草席甲边缘多留了一截，夜里铺开，刚好替晚归的兄弟留个暖位置。',
      head: '桃枝绕过耳尖，三条结绳分别打得松松的。兄弟间的约定，倒是越睡越牢。',
      charm: '铃声只管招猫来吃饭，不管谁先到。最后一只猫的碗，照样盛得满满的。',
    },
    bonus2: { desc: '生命增加一百五十，防御增加十二。', stats: { hp: 150, def: 12 } },
    bonus4: { desc: '治疗加成增加百分之六，减伤增加百分之五，危急时互相照应。', stats: { healBonus: 0.06, dmgReduce: 0.05 }, note: '穿戴者生命首次低于百分之三十时，为自身添加最大生命百分之十五的护体毛，持续两回合，每场一次。' },
  },
  {
    id: 'shu_eastwind', name: '卧龙借风', faction: 'shu', profile: 'back',
    flavor: '东风借来了，扇尖那根羽毛也顺便借走了目光。',
    pieces: ['卧龙逗猫羽扇', '卧龙云纹袍', '卧龙观星耳冠', '卧龙借风铃'],
    pieceFlavors: {
      weapon: '扇尾总有一根羽毛晃得特别慢。军师盯着它说：让我再想想。风便多等了一会儿。',
      armor: '云纹沿着袍角绕了三圈，猫走到哪儿，云就跟到哪儿，省去向天借一回。',
      head: '冠上留着一道细窄的月牙，仰头看星时不挡耳朵。低头回来，常会忘记刚才要说什么。',
      charm: '小铃一响，帐中猫便往东看。只是风没有约定从哪扇窗进来。',
    },
    bonus2: { desc: '命中增加百分之七，速度增加五。', stats: { hit: 0.07, spd: 5 } },
    bonus4: { desc: '攻击增加二十四，暴击增加百分之五，失手后再想一步。', stats: { atk: 24, crit: 0.05 }, note: '穿戴者首次施加控制失败时回复二十点元气，每场一次，不改变免疫判定。' },
  },
  {
    id: 'wu_warm_blanket', name: '江东热毯', faction: 'wu', profile: 'front',
    flavor: '老将说这是战袍，晒肚皮时又说是毯子。',
    pieces: ['江东鱼骨铁鞭', '江东热毯甲', '江东暖耳盔', '江东守寨铃'],
    pieceFlavors: {
      weapon: '鞭节擦得锃亮，握柄却缠着旧毯角。老将说，威风归威风，爪子还得暖。',
      armor: '披甲前先晒一刻钟，披甲后再晒一刻钟。黄盖盖管这叫两面备战。',
      head: '耳盔里塞了新棉，老猫听风的本事没变，只是把“风有些凉”那句省了。',
      charm: '守寨铃挂得低，夜巡归来一碰就响。营里添汤的猫知道，该把那碗再热一热。',
    },
    bonus2: { desc: '生命增加一百，减伤增加百分之四点五。', stats: { hp: 100, dmgReduce: 0.045 } },
    bonus4: { desc: '防御增加二十，减伤增加百分之三，挨近了会碰到火星。', stats: { def: 20, dmgReduce: 0.03 }, note: '受到近战伤害后，对攻击者反击一次百分之四十攻击的火焰伤害，每回合最多一次，反击不再触发反击。' },
  },
  {
    id: 'wu_redwall', name: '赤壁琴火', faction: 'wu', profile: 'back',
    flavor: '琴弦调得很准，水碗摆得不太稳。',
    pieces: ['赤壁鱼弦琴', '赤壁火尾披风', '赤壁听风耳冠', '赤壁调弦铃'],
    pieceFlavors: {
      weapon: '鱼弦绷得很准，拨错半个音便有人回头。抚琴的猫说，回头只是顺便理理毛。',
      armor: '披风尾缀着一抹火红，转身像晚霞掠过江面。水碗请放远些，晚霞不擅长游泳。',
      head: '两侧冠翼替江风让路，耳朵听得清，发梢也吹得齐。出征前，仪容算是过了关。',
      charm: '铃舌调到与琴同音，练习时却得裹上丝绢，免得一群猫在每个拍子上都回头。',
    },
    bonus2: { desc: '暴击增加百分之六，暴击伤害增加百分之十二。', stats: { crit: 0.06, critDmg: 0.12 } },
    bonus4: { desc: '攻击增加二十八，命中增加百分之五，水汽引出琴火。', stats: { atk: 28, hit: 0.05 }, note: '绝技首次命中淋湿目标时追加一层灼烧，按穿戴者百分之二十攻击持续两回合，每次绝技最多触发一次。' },
  },
  {
    id: 'qun_box_lord', name: '诸侯箱阵', faction: 'qun', profile: 'front',
    flavor: '会盟座次可以争，纸箱必须先留一只。',
    pieces: ['诸侯鱼骨长戟', '诸侯纸箱战甲', '诸侯箱沿耳盔', '诸侯会盟铃'],
    pieceFlavors: {
      weapon: '长戟搁在箱沿上，戟尾还垫着一团绒。诸侯议事可以各执一词，戟得靠稳。',
      armor: '箱甲内侧画着一张座次表，穿戴者稳坐正中。旁边留的小格，专放会盟带来的小鱼干。',
      head: '裁下的箱沿恰好护住耳根，额前那块纸仍写着“轻放”。诸侯们都表示很赞同。',
      charm: '谁要发言，就先碰一下铃。董桌嫌来回传得慢，提议把饭也按这个规矩送到面前。',
    },
    bonus2: { desc: '防御增加十八，生命增加一百二十。', stats: { def: 18, hp: 120 } },
    bonus4: { desc: '减伤增加百分之六，受惊之前先把箱盖合上。', stats: { dmgReduce: 0.06 }, note: '每场首次受到暴击后获得最大生命百分之十八的护体毛，持续两回合。' },
  },
  {
    id: 'qun_moon_bell', name: '月下追铃', faction: 'qun', profile: 'back',
    flavor: '铃铛还没响，月亮已经往云后躲了一点。',
    pieces: ['月下鱼骨双刃', '月下软尾舞衣', '月下花耳簪', '月下追影铃'],
    pieceFlavors: {
      weapon: '两把鱼骨刃各系一段软绳，收鞘时轻轻一拢，像把月光结成了蝴蝶结。',
      armor: '舞衣给尾巴留了整幅余地，转圈时裙角先停，尾尖还能把余下半拍跳完。',
      head: '一朵绢花别在耳旁，照镜子时只看见半朵。另半朵，留给追来的猫看。',
      charm: '小铃贴着脚步轻响，影子追得最勤。它不需要小鱼干奖励，也从不喊累。',
    },
    bonus2: { desc: '暴击增加百分之八，闪避增加百分之四。', stats: { crit: 0.08, dodge: 0.04 } },
    bonus4: { desc: '暴击伤害增加百分之二十，速度增加五，追铃也能攒元气。', stats: { critDmg: 0.2, spd: 5 }, note: '穿戴者造成暴击后回复八点元气，每回合最多一次，多段攻击共用次数。' },
  },
  {
    id: 'man_rattan_nest', name: '山林藤窝', faction: 'man', profile: 'front',
    flavor: '藤甲编得太舒服，点兵时得先敲敲窝门。',
    pieces: ['山林鱼骨棒', '山林藤窝甲', '山林藤耳盔', '山林醒窝铃'],
    pieceFlavors: {
      weapon: '棒柄缠满藤条，握过的爪印都收在纹路里。新来的猫一摸，便知道前辈爱靠哪边打盹。',
      armor: '藤甲里垫了晒过的草，肚皮一贴就舍不得走。点兵得敲两下，第三下只会换来翻身。',
      head: '两只藤环护住耳朵，环间还编了一枚叶片。林风进门前，总要替它翻个面。',
      charm: '铃绳从藤窝里伸出来，叫早的猫站在外头轻拉。里面应了一声，算醒，起身另议。',
    },
    bonus2: { desc: '生命增加一百八十，减伤增加百分之三。', stats: { hp: 180, dmgReduce: 0.03 } },
    bonus4: { desc: '防御增加二十四，减伤增加百分之三点五，余下的护盾暖回肉垫。', stats: { def: 24, dmgReduce: 0.035 }, note: '穿戴者的护体毛自然到期时，将剩余护盾的百分之二十转为自身治疗，被击破或驱散时不触发。' },
  },
  {
    id: 'man_beast_drum', name: '百兽爪鼓', faction: 'man', profile: 'back',
    flavor: '鼓点一响，山林排好队，狗请站远一点。',
    pieces: ['百兽肉垫鼓', '百兽斑尾披衣', '百兽羽耳冠', '百兽应声铃'],
    pieceFlavors: {
      weapon: '鼓面正中印着一枚肉垫，敲偏了就像挠痒。百兽仍肯排队，只是步子会走得有点歪。',
      armor: '披衣上的斑纹照着山猫绣，尾端却缝了兔绒。大王没看见时，小兽们喜欢挨近一点。',
      head: '冠上羽毛来自换羽时的馈赠，戴好后得慢些低头，免得又被鸟儿当成落脚枝。',
      charm: '鼓停了，铃还叮一声，提醒最后一只小兽跟上。狗若应声，大王就会站得离队伍远一点。',
    },
    bonus2: { desc: '暴击增加百分之六，速度增加六。', stats: { crit: 0.06, spd: 6 } },
    bonus4: { desc: '攻击增加三十，暴击伤害增加百分之十五，图腾齐时百兽应声。', stats: { atk: 30, critDmg: 0.15 }, note: '穿戴者图腾达到三层时，下一次普攻追加百分之二十攻击的山林助攻，每回合最多一次，助攻不积累图腾。' },
  },
  {
    id: 'xian_cloud_mat', name: '云台眠垫', faction: 'xian', profile: 'front',
    flavor: '云是软的，坐垫也是软的，仙猫坚持这叫打坐。',
    pieces: ['云台鱼骨拂尘', '云台绒云甲', '云台莲耳冠', '云台安眠铃'],
    pieceFlavors: {
      weapon: '拂尘扫过石阶，灰尘走了，鱼骨柄上的爪印还在。仙猫说，那是先来的客人替山门签了名。',
      armor: '绒云甲团起来比坐垫还蓬松，披在身上像抱了一团天气。晴天也不必交还。',
      head: '莲瓣托着耳尖，晨露停在冠沿。戴冠的猫低头喝水，顺道替花省了浇水。',
      charm: '铃舌垫了薄绒，响起来像隔着一层云。来访的猫不必轻手轻脚，打坐的猫早就睡熟了。',
    },
    bonus2: { desc: '闪避增加百分之六，防御增加十二。', stats: { dodge: 0.06, def: 12 } },
    bonus4: { desc: '生命增加一百四十，减伤增加百分之四，毛线也留不住云。', stats: { hp: 140, dmgReduce: 0.04 }, note: '每场首次将要受到毛线缠时免疫该次控制，其他负面效果照常判定。' },
  },
  {
    id: 'xian_star_scroll', name: '天机星符', faction: 'xian', profile: 'back',
    flavor: '星图上的小爪印，是仙猫夜里校对过的天机。',
    pieces: ['天机爪印符卷', '天机星尾道袍', '天机望月耳冠', '天机问卦铃'],
    pieceFlavors: {
      weapon: '符卷空白处盖满小爪印，星位倒只标了三个。仙猫记得天机，却常忘是谁借走了印泥。',
      armor: '星线沿袍尾绣到最末一针，走在夜里像拖着短短的银河。洗袍时，星星也得排队晾干。',
      head: '月牙冠向两耳间弯着，老仙猫戴它照池塘。今晚的月亮，便多了两只耳朵。',
      charm: '摇铃问卦之前，先把系在铃旁的小鱼袋填好；天机很远，肚子倒是近在眼前。',
    },
    bonus2: { desc: '命中增加百分之八，治疗加成增加百分之七。', stats: { hit: 0.08, healBonus: 0.07 } },
    bonus4: { desc: '速度增加七，暴击增加百分之四，第一道控制符更稳。', stats: { spd: 7, crit: 0.04 }, note: '穿戴者每场首次施加控制时，控制命中率额外增加十五个百分点，不绕过控制免疫。' },
  },
];

export const EQUIP_SETS: EquipSetDef[] = SET_TEMPLATES.map(({ pieces: _pieces, pieceFlavors: _pieceFlavors, profile: _profile, ...set }) => set);

type GenericQuality = Exclude<Quality, 'legend'>;
const THEMES: { id: 'camp' | 'peach' | 'ferry'; names: string[]; flavors: Record<GenericQuality, Record<EquipSlot, string>> }[] = [
  {
    id: 'camp', names: ['营帐鱼骨剑', '营帐绒垫甲', '营帐护耳盔', '营帐巡夜铃'],
    flavors: {
      common: {
        weapon: '鱼骨剑的绳柄缠得不齐，最后一圈由同营的猫补上；如今握着，爪心能认出那枚小结。',
        armor: '旧绒垫拆下来缝成甲，褶子里还有半根午睡时压弯的毛。出门也算带着家。',
        head: '护耳盔拿粗布收了边，耳尖露在外面。听号令够用，听开饭尤其清楚。',
        charm: '巡夜铃的铜皮有些旧，响声却很勤快。头一夜站岗，先替新猫壮壮胆。',
      },
      fine: {
        weapon: '青绳给剑柄添了稳当的结，剑穗却还爱追着尾巴跑。扎营后，两边才肯歇一歇。',
        armor: '绒垫甲换了细密的针脚，营门风大时把胸口一拢，连那句“有点凉”也收进去了。',
        head: '盔沿夹了薄棉，耳根再不被绳头硌着。巡营的猫因此把夸裁缝的话听全了。',
        charm: '新换的铃舌声音清亮，夜巡归来叮一声就够。炊事猫留着小火，谁也不用喊。',
      },
      rare: {
        weapon: '银纹沿剑脊刻得很直，检查时总有猫拿它比胡须。剑能借，梳子还是各用各的。',
        armor: '甲里的软垫按肩背分了层，蹲下来也不挤肚皮。装作威严的时候尤其省力。',
        head: '银线把盔边镶得亮亮的，月光照来，哨位上的耳朵比旗子更好认。',
        charm: '巡夜铃刻了各营的小记号，交班时铃一递，暖过的挂绳也顺道交给下一只爪。',
      },
      epic: {
        weapon: '锦穗上的穗结编得像小鱼，擦剑的猫每回都多摸两下，算是替它理理鳞。',
        armor: '锦纹绒甲的内衬晒过三遍，连夜行军也留着午后的暖味。老兵说，这件甲有自己的日头。',
        head: '盔顶的锦结压得服帖，耳孔却留得宽宽的。军容齐整归齐整，伸耳朵可不能受委屈。',
        charm: '铃身錾着一圈归营的爪印，夜里听见它响，守门猫总会把灯往回来的方向挪一点。',
      },
    },
  },
  {
    id: 'peach', names: ['草编鱼骨刀', '草编猫窝甲', '草编桃枝冠', '草编结穗铃'],
    flavors: {
      common: {
        weapon: '鱼骨刀用草绳缠柄，沾了雨便透出青草味。擦干后还给同伴，绳结里多了一点掌心的暖。',
        armor: '猫窝拆成一片草甲，边缘还留着枕耳朵的凹痕。穿上它的猫，说今日只是把窝挪远些。',
        head: '桃枝弯成冠，两片小叶子负责遮阳。枝头若开花，同伴会比戴冠的猫先发现。',
        charm: '结穗铃只配一根草绳，晃起来穗子比铃舌勤。赶路时，总像有一株草陪着点头。',
      },
      fine: {
        weapon: '刀柄的青绳里编进新晒的草，打结的猫手巧，特地把扎爪的草尖都藏进了绳芯。',
        armor: '草窝甲加了软软的布里，背上的编纹仍露着。抱过它的兄弟一闻，就知道是桃园来的。',
        head: '冠上的嫩枝分了三股，各朝一个方向伸。走岔路时，倒显得它很有主意。',
        charm: '青穗收得整齐，铃声随步子轻轻摆开。同行的猫累了，便慢下来听它多响一会儿。',
      },
      rare: {
        weapon: '刀背嵌了细银线，像草叶上留住的露珠。握柄仍是草绳，爪子说认老朋友比较安心。',
        armor: '银线沿草甲接缝走了一圈，补缝的猫把午饭耽搁了；试甲时，大家替它留出了最暖的位子。',
        head: '桃枝冠用银扣接好，换季时可以取下枯叶。春天一到，又有新叶来认这对耳朵。',
        charm: '银铃挂着两束麦穗，过小桥时轻轻碰在一起。谁先谁后，都像在互相让路。',
      },
      epic: {
        weapon: '锦绳在刀柄编出细细的桃花，赶路再久也不谢。兄弟说，省下了折花寄家的功夫。',
        armor: '草窝甲衬着桃色软锦，展开能多坐一只猫。护甲做得好不好，桃园有自己的验法。',
        head: '锦结把桃枝拢成圆冠，垂下的花穗碰不到眼睛。裁缝亲手试过，还替三只猫各试了一回。',
        charm: '铃腹刻着三只并排的小碗，锦穗在底下结成花。轻摇一下，兄弟们连散步也走出了开饭的步子。',
      },
    },
  },
  {
    id: 'ferry', names: ['江渡鱼叉枪', '江渡浮绒甲', '江渡风耳帽', '江渡系舟铃'],
    flavors: {
      common: {
        weapon: '枪柄还沾着渡口的白沙，清理时总有一粒藏进绳缝。猫也会留一粒，算带上了岸。',
        armor: '浮绒甲里塞着晒干的芦花，靠在船舷上柔软得很。艄公催上岸时，最好多叫一遍。',
        head: '帽绳分两股绕过耳根，江风拉这边，爪子拉那边。一路下来，帽子仍算跟着猫走。',
        charm: '系舟绳尾多挂一枚旧铃，泊船时响得慢慢的，像在告诉码头：这船猫，都到家了。',
      },
      fine: {
        weapon: '枪柄上的青绳绕得紧，雨后也不打滑。渡船开了，同伴替它把最后一滴水抹去。',
        armor: '青纹甲的里层多缝了芦花，江风吹过背脊也只剩一点凉。船上的猫愿意挨着它坐。',
        head: '帽沿加宽一指，替眼睛挡住迎面的细雨。耳朵照样竖着，不能错过哪家炊烟里有鱼。',
        charm: '系铃的青绳结得很牢，船停稳后才解下来晾。铃声跟着滴水，替渡口数了半场小雨。',
      },
      rare: {
        weapon: '银纹沿着叉尖绕出水波，入鞘后只露一线。渡船的猫看着它，觉得江面也可以随身收好。',
        armor: '浮绒甲的肩缝添了银扣，湿过的外衬可以单独晾。肉垫不用冻着等，先去船舱吃口热的。',
        head: '银线缝在帽沿里面，风吹翻时才亮一下。戴帽的猫说，江风负责替它验收针脚。',
        charm: '银铃刻了渡口的两岸，船到哪边，哪边的灯影便落在铃上。挂绳不急，总会等猫系好。',
      },
      epic: {
        weapon: '鱼叉枪的锦鞘画着一条小渡船，画师还给船尾留了位置。用枪的猫要求，把同行的尾巴也算上。',
        armor: '锦纹甲内衬织出细细水波，裹在身上像把江面晒暖了。落座时，请给湿爪的同伴让半边。',
        head: '帽带上的锦结能收住两侧长穗，迎风也不遮眼。过江的猫终于不用一边看岸，一边追自己的帽子。',
        charm: '铃腹錾着归帆，铃舌包了软锦。夜里靠岸轻响一声，码头那盏灯便留到最后一只猫下船。',
      },
    },
  },
];
const QUALITY_NAMES: Record<Quality, string> = { common: '素纹', fine: '青纹', rare: '银纹', epic: '锦纹', legend: '金纹' };

export const EQUIPS: EquipDef[] = [
  ...SET_TEMPLATES.flatMap((set) => EQUIP_SLOTS.map((slot, index) => makeEquip({
    id: `${set.id}_${slot}`, name: set.pieces[index], slot, quality: 'legend',
    setId: set.id, profile: set.profile, flavor: set.pieceFlavors[slot],
  }))),
  ...THEMES.flatMap((theme) => EQUIP_QUALITIES.filter((quality): quality is GenericQuality => quality !== 'legend').flatMap((quality) =>
    EQUIP_SLOTS.map((slot, index) => makeEquip({
      id: `${theme.id}_${quality}_${slot}`, name: `${QUALITY_NAMES[quality]}${theme.names[index]}`,
      slot, quality, profile: theme.id, flavor: theme.flavors[quality][slot],
    })))),
];
