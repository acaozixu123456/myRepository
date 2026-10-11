import { FACTIONS, FACTION_ORDER } from '../data/factions';
import { HEROES } from '../data/heroes';
import type { Rarity } from '../data/heroes';
import type { GachaPoolDef, QuestDef, RewardDef, ShopItemDef } from './types';

// 计数器统一命名；daily / weekly 按该任务周期统计，achievement / newbie 按存档累计。
// 最高值与收集种类始终读取存档，不能把重复通过或重复招募误当成新进度。
export const QUEST_GOALS = {
  login: '本周期登录天数，同一天只计一次',
  claim_idle: '领取挂机收益次数，每次领取须有实际收益',
  clear_stage: '累计成功通过战役次数，重复同一关也计一次',
  reach_stage: '已首次通过的全局最高关数，第一章第一关为一，第六章末关为一百四十四',
  level_up_hero: '英雄升级次数，一只英雄升一级计一次，不是拥有的英雄数',
  hero_level: '任一英雄达到的最高等级',
  upgrade_skill: '成功提升英雄技能等级的次数',
  recruit: '实际完成的招募次数，十连计十次',
  collect_hero: '已拥有的不同英雄数量，重复英雄不增加',
  arena_battle: '完成竞技比试次数，不要求获胜',
  arena_win: '竞技比试获胜次数',
  guild_help: '完成有效公会互助的次数，同一次互助只计一次',
  spend_fish: '实际消耗的小鱼干数量，不含转存或重复扣款',
  tower_clear: '首次通过的爬塔层数，重复层不计',
  equip_upgrade: '成功提升装备等级的次数',
  visit_friend: '有效拜访好友次数，每位好友每天只计一次',
} as const;

type GoalType = keyof typeof QUEST_GOALS;
type QuestCategory = '养成' | '战役' | '竞技' | '收集' | '社交';
type QuestSeed = { id: string; name: string; desc: string; type: GoalType; target: number; reward: RewardDef };

function quest(kind: QuestDef['kind'], seed: QuestSeed): QuestDef {
  const { type, target, ...data } = seed;
  return { ...data, kind, goal: { type, target } };
}

const DAILY: QuestSeed[] = [
  { id: 'daily_login', name: '军师掀开帘子', desc: '今日登录一次；猫猫们已经把你的座位坐暖了。', type: 'login', target: 1, reward: { fish: 1000, exp: 100, bells: 10, items: [{ id: 'catnip_small', count: 2 }] } },
  { id: 'daily_idle', name: '收好午睡军需', desc: '领取两次实际挂机收益；袋口缝好，别让鱼香一路报信。', type: 'claim_idle', target: 2, reward: { fish: 1500, exp: 300, items: [{ id: 'catnip_small', count: 3 }] } },
  { id: 'daily_campaign', name: '十次踏稳小路', desc: '成功通过十次战役，可重复关卡；回来记得擦净肉垫。', type: 'clear_stage', target: 10, reward: { fish: 2000, exp: 500, bells: 10 } },
  { id: 'daily_growth', name: '闻香肯起床', desc: '累计提升英雄等级三次；猫薄荷比晨钟更管用。', type: 'level_up_hero', target: 3, reward: { fish: 1500, exp: 300, items: [{ id: 'fishbone_small', count: 2 }] } },
  { id: 'daily_skill', name: '爪尖添点学问', desc: '提升一次英雄技能等级；卷轴翻完，先别拿去垫窝。', type: 'upgrade_skill', target: 1, reward: { fish: 1200, exp: 200, items: [{ id: 'claw_scroll_small', count: 2 }] } },
  { id: 'daily_recruit', name: '给来客留个箱', desc: '完成一次招募；有客来访，空纸箱先别收。', type: 'recruit', target: 1, reward: { fish: 1000, exp: 100, items: [{ id: 'recruit_ticket', count: 1 }] } },
  { id: 'daily_arena', name: '比爪也要铺垫', desc: '完成三次竞技比试；睡着的同袍都有软垫接着。', type: 'arena_battle', target: 3, reward: { fish: 1500, exp: 300, items: [{ id: 'paw_seal', count: 60 }] } },
  { id: 'daily_guild', name: '同袍搭一把爪', desc: '完成两次有效公会互助；纸箱太大，就一起抬。', type: 'guild_help', target: 2, reward: { fish: 1500, exp: 300, items: [{ id: 'guild_token', count: 50 }] } },
  { id: 'daily_spend', name: '账本翻一小页', desc: '实际消耗五千条小鱼干；支出记清，香气不用入账。', type: 'spend_fish', target: 5000, reward: { fish: 1500, exp: 300, bells: 10 } },
  { id: 'daily_tower', name: '楼上那块日光', desc: '首次通过两层爬塔；晒暖的地方，值得再上一层。', type: 'tower_clear', target: 2, reward: { fish: 2000, exp: 400, items: [{ id: 'tower_token', count: 50 }] } },
  { id: 'daily_equipment', name: '把铃扣缝牢', desc: '累计提升装备等级两次；将军走过，铃铛也要跟上。', type: 'equip_upgrade', target: 2, reward: { fish: 1500, exp: 300, items: [{ id: 'bell_thread', count: 3 }] } },
  { id: 'daily_friend', name: '邻家窗沿打个招呼', desc: '有效拜访一位好友；敲门用肉垫，别用整张脸。', type: 'visit_friend', target: 1, reward: { fish: 1200, exp: 200, bells: 10 } },
];

const WEEKLY: QuestSeed[] = [
  { id: 'weekly_campaign', name: '行军七日留爪印', desc: '本周成功通过七十次战役，可重复关卡；地图边角也铺平了。', type: 'clear_stage', target: 70, reward: { fish: 5000, exp: 800, bells: 30, items: [{ id: 'fishbone_medium', count: 3 }] } },
  { id: 'weekly_recruit', name: '会盟添些新座位', desc: '本周完成二十次招募；名册渐厚，软垫也得添。', type: 'recruit', target: 20, reward: { fish: 4000, exp: 600, bells: 50, items: [{ id: 'recruit_ticket', count: 3 }] } },
  { id: 'weekly_idle', name: '绒袋装满一周', desc: '本周领取十四次实际挂机收益；这袋军需带着午睡的温度。', type: 'claim_idle', target: 14, reward: { fish: 3500, exp: 700, bells: 20, items: [{ id: 'yarn_small', count: 2 }] } },
  { id: 'weekly_growth', name: '将军长进了', desc: '本周累计提升英雄等级三十次；甲带可要放宽一格？', type: 'level_up_hero', target: 30, reward: { fish: 4500, exp: 800, bells: 30, items: [{ id: 'catnip_medium', count: 5 }] } },
  { id: 'weekly_arena', name: '演武场换张新垫', desc: '本周完成三十次竞技比试；旧垫子睡出了一圈肉垫形。', type: 'arena_battle', target: 30, reward: { fish: 4500, exp: 800, bells: 30, items: [{ id: 'paw_seal', count: 300 }] } },
  { id: 'weekly_guild', name: '同袍的纸箱墙', desc: '本周完成二十次有效公会互助；每块纸板都有人扶过。', type: 'guild_help', target: 20, reward: { fish: 4000, exp: 700, bells: 20, items: [{ id: 'guild_token', count: 250 }] } },
  { id: 'weekly_tower', name: '铃声往高处走', desc: '本周首次通过十五层爬塔；高处的风替铃铛多唱一会。', type: 'tower_clear', target: 15, reward: { fish: 5000, exp: 1000, bells: 30, items: [{ id: 'tower_token', count: 250 }] } },
  { id: 'weekly_skill', name: '卷轴边角都翻暖', desc: '本周提升十次英雄技能等级；连页脚都记住了你的爪印。', type: 'upgrade_skill', target: 10, reward: { fish: 4500, exp: 800, bells: 20, items: [{ id: 'claw_scroll_medium', count: 3 }] } },
];

type AchievementTrack = {
  id: string; category: QuestCategory; type: GoalType; targets: number[];
  names: string[]; goalDesc: (target: number) => string;
  flavours: [string, string, string, string, string, string];
};

const ACHIEVEMENT_TRACKS: AchievementTrack[] = [
  {
    id: 'hero_level', category: '养成', type: 'hero_level', targets: [10, 20, 40, 60, 90, 120],
    names: ['箱沿站稳了', '小甲穿得住', '军师添一笔', '将军坐得稳', '老将还肯学', '九命殿前伸懒腰'],
    goalDesc: (n) => `任一英雄达到${n}级`,
    flavours: [
      '原先只敢探头的猫，已能站稳箱沿，军师还在下面伸着手。',
      '甲带终于不用打两个结，将军却坚持把旧结留作纪念。',
      '军师在名册上添了一笔，墨还没干，猫爪已经盖得端正。',
      '议事的凳子挪到前排，将军坐稳了，尾巴替他敲了敲桌角。',
      '胡须上挂着猫薄荷香，老将说今日只学到午睡之前。',
      '往九命殿去的地图刚铺开，将军已在边角选好伸懒腰的位置。',
    ],
  },
  {
    id: 'level_steps', category: '养成', type: 'level_up_hero', targets: [10, 30, 80, 160, 320, 600],
    names: ['第一罐清香', '午睡稍晚一点', '半营认真听讲', '爪印写满页', '温奶温出好功夫', '天下猫都夸长进'],
    goalDesc: (n) => `累计提升英雄等级${n}次`,
    flavours: [
      '头一罐猫薄荷见了底，盖子被郑重留在枕边，闻着也算复习。',
      '午睡钟敲过了，将军还捧着卷轴，翻到软垫图时才打个哈欠。',
      '一声报到带来半营猫，原来大家都想听听猫薄荷怎么分。',
      '升级簿写到页脚，猫猫主动翻页，顺便按住军师快滑走的笔。',
      '温奶凉了还要再热，将军终于学会在等它温好的时候练爪。',
      '各营来信都夸将军长进，信末却齐齐问他肯不肯来讲一堂课。',
    ],
  },
  {
    id: 'stage_reach', category: '战役', type: 'reach_stage', targets: [12, 24, 48, 72, 96, 144],
    names: ['会盟灯照路', '扶稳天下饭桌', '官渡桥两头通', '江风解开线结', '山林有新座位', '六旗下留一张席'],
    goalDesc: (n) => `首次通过全局第${n}关`,
    flavours: [
      '会盟灯下的路条盖齐了印，军师的手印格外大，得单留半页。',
      '歪桌摆正后，纸箱街多出一张小凳，最先坐上去的是赤兔。',
      '官渡桥两头响起车轮声，曹喵德记清了数，也留空了一格小猫印。',
      '江风吹散空船上的烟，周喵瑜收琴前，先数齐了岸上的尾巴。',
      '南疆的藤席铺成圆圈，孟喵获说这回坐哪里都不算服输。',
      '六旗下留着军师的席，吕布丁替你看住了垫子，赤兔替他坐着。',
    ],
  },
  {
    id: 'stage_clears', category: '战役', type: 'clear_stage', targets: [20, 60, 150, 400, 1000, 2500],
    names: ['旧路也走稳', '纸板磨出光', '铃声穿过长街', '来回都认得路', '军靴晒满窗沿', '喵洲路上好脚力'],
    goalDesc: (n) => `累计成功通过战役${n}次，可重复关卡`,
    flavours: [
      '旧巷的石阶还滑，猫猫已记得在哪一块砖前回头，给同袍伸一只爪。',
      '营门的纸板磨出亮边，修补的线被将军藏成了自己的小穗子。',
      '小铃声从巷头传到巷尾，守夜猫不用看影子，也认得谁回营了。',
      '地图折出了旧痕，军师索性在常走的路旁，添上哪家有温水。',
      '窗沿排满洗净的小军靴，总有猫借半寸日光，把自己的那双挪近些。',
      '一卷路书都写满了，猫猫还替新来的同袍圈出最好走的小道。',
    ],
  },
  {
    id: 'arena_visits', category: '竞技', type: 'arena_battle', targets: [5, 20, 50, 120, 300, 600],
    names: ['比爪先问好', '软垫记住你', '演武场的熟客', '铃一响就列队', '全场都认肉垫', '演武场添张专席'],
    goalDesc: (n) => `累计完成${n}次竞技比试，不要求获胜`,
    flavours: [
      '刚迈进演武场，爪还没举起来，先向对面的同袍认真点了点头。',
      '软垫正中多了熟悉的凹窝，猫猫说这证明自己从来不抢别人位置。',
      '守门猫已经认得你的铃声，连登记册都替你翻到了常用的那一页。',
      '开场铃刚响，将军已站好，尾巴还在摆，却没越过队伍的那条线。',
      '对手看肉垫就喊出名字，将军低头瞧了瞧，原来大家比爪也比得认真。',
      '演武场添了专席，牌子写将军，下面却被值日猫补了请勿磨爪。',
    ],
  },
  {
    id: 'arena_wins', category: '竞技', type: 'arena_win', targets: [1, 5, 15, 40, 100, 240],
    names: ['第一次扶正旗', '小铃为你响', '旗角添个结', '爪印留在榜首', '满架旗都晒暖', '名将也来比一比'],
    goalDesc: (n) => `累计赢得${n}次竞技比试`,
    flavours: [
      '你把刚赢来的小旗扶正，转身先替睡着的同袍找回枕边的铃铛。',
      '小铃响得比昨日轻快，将军不肯晃太久，怕惊了旁边刚睡着的猫。',
      '每回胜利都在旗角添个结，结多了，将军才发现自己的尾巴也缠进去一点。',
      '领奖的册页排得很高，将军先垫一只纸箱，让矮脚同袍也看得见。',
      '满架小旗晒在风里，护旗的猫却把最早那面仔细收好，说那次睡得特别香。',
      '来比爪的名将先问哪块垫子最软，将军指了指自己刚让出的那一块。',
    ],
  },
  {
    id: 'recruit_count', category: '收集', type: 'recruit', targets: [10, 30, 60, 120, 240, 480],
    names: ['来客敲响小铃', '名册多一撮毛', '纸箱排成一行', '会盟簿渐渐厚', '门口总有新脚印', '天下来客都留名'],
    goalDesc: (n) => `累计完成${n}次招募，十连计十次`,
    flavours: [
      '招福符才贴好，门铃便轻响，新来的猫先伸爪扶正门边歪了的纸箱。',
      '名册刚添了来客的名字，书缝里也添了细绒，军师翻页时得格外轻。',
      '空箱沿廊排开，猫猫逐只试过，最后都觉得同袍挨着的那只更合适。',
      '会盟簿厚得像小枕头，守门猫抱得认真，没舍得真拿它垫脑袋。',
      '门槛边的新脚印换了好几种花纹，值日猫擦到一半，想给它们留张像。',
      '来客姓名写满长卷，军师把卷轴撑住，新来的将军替他按着最后那一角。',
    ],
  },
  {
    id: 'hero_collection', category: '收集', type: 'collect_hero', targets: [4, 8, 12, 16, 20, 24],
    names: ['四只猫一条凳', '八枚肉垫留影', '半部图鉴有呼噜', '绒毛名册翻不完', '六族来客渐齐', '整部图鉴都坐暖'],
    goalDesc: (n) => `拥有${n}位不同英雄，重复不计`,
    flavours: [
      '长凳只够并排坐，四只猫商量好先收尾巴，谁都没有被挤下去。',
      '八枚肉垫印摆成一朵花，曹喵德认真说这是会盟凭据，请不要洒水。',
      '图鉴翻到一半，窗边的呼噜恰好接成和声，周喵瑜听过后只点了一次头。',
      '绒毛名册翻了一桌，将军们轮流压住页角，最轻的那只负责不把纸坐皱。',
      '不同颜色的旗凑到一处，领队猫争过站位，最后把最矮的同袍让到前面。',
      '整部图鉴都留着爪印，诸葛喵亮合上书，发现书套早被猫猫睡暖了。',
    ],
  },
  {
    id: 'guild_help', category: '社交', type: 'guild_help', targets: [5, 20, 50, 120, 300, 600],
    names: ['替同袍扶个角', '纸箱搭得更牢', '一营猫一起抬', '公会墙上新爪印', '大营有许多双爪', '天下纸箱都有人扶'],
    goalDesc: (n) => `累计完成${n}次有效公会互助`,
    flavours: [
      '大箱的角被风吹起，借来的爪刚扶住，自己的尾巴又去压住了另一边。',
      '纸箱接缝补好了，公会猫没夸手艺，先钻进去试了一回够不够舒服。',
      '军需箱刚离地，一营猫便齐齐退半步，给抬箱的同袍让出好走的路。',
      '公会墙上添了新肉垫印，写字的猫怕墨凉，悄悄把墨碟挪到了日光里。',
      '搬帐篷时借到许多双爪，最忙的军师后来发现，自己的茶杯也被护送好了。',
      '给远营补箱的信传回来，纸上说风已经进不去，午睡却总有同袍肯让位。',
    ],
  },
  {
    id: 'friend_visits', category: '社交', type: 'visit_friend', targets: [5, 20, 50, 120, 300, 600],
    names: ['邻窗那声小喵', '借来的垫子还暖', '窗沿添了客席', '往来都有小铃', '喵洲巷巷有熟猫', '每扇窗都肯留灯'],
    goalDesc: (n) => `累计有效拜访好友${n}次，每位好友每天计一次`,
    flavours: [
      '邻窗回了一声轻轻的小喵，来客把铃铛捂住，再抬爪敲第二回。',
      '还回的软垫叠得齐整，好友展开才看见，袋角缝着一枚道谢的肉垫印。',
      '窗沿添的小席不够宽，主人把花盆挪了挪，说花也正想多晒点太阳。',
      '往来的小铃收成一串，风一吹，邻居们都知道今日谁家的窗开着。',
      '走到新巷也有猫招手，军师正想认路，熟悉的尾巴已经替他指向屋檐。',
      '每扇窗都留了暖灯，晚归的军师放轻脚步，纸箱里仍有人为他挪出一角。',
    ],
  },
];

export const QUEST_CATEGORIES: Record<string, QuestCategory> = {};
const ACHIEVEMENTS: QuestDef[] = ACHIEVEMENT_TRACKS.flatMap((track) => track.targets.map((target, index) => {
  const id = `achievement_${track.id}_${index + 1}`;
  QUEST_CATEGORIES[id] = track.category;
  const tier = index + 1;
  return quest('achievement', {
    id, name: track.names[index], desc: `${track.goalDesc(target)}；${track.flavours[index]}`, type: track.type, target,
    reward: {
      fish: 1000 * tier * tier, exp: 300 * tier * tier, bells: 10 * tier,
      items: [
        { id: 'catnip_medium', count: tier },
        ...(track.type === 'collect_hero' ? [{ id: 'faction_token', count: 50 * tier }] : []),
      ],
    },
  });
}));

const NEWBIE: QuestSeed[] = [
  { id: 'newbie_arrive', name: '纸箱旁的第一声喵', desc: '首次登录喵洲；先有一个座位，再慢慢学军师的本事。', type: 'login', target: 1, reward: { fish: 1500, exp: 300, bells: 20, items: [{ id: 'recruit_ticket', count: 1 }] } },
  { id: 'newbie_recruit', name: '请一位将军进门', desc: '完成一次招募；纸箱里多了一双认真看你的眼睛。', type: 'recruit', target: 1, reward: { fish: 2500, exp: 500, bells: 30, items: [{ id: 'catnip_small', count: 5 }] } },
  { id: 'newbie_growth', name: '喂香第一罐薄荷', desc: '累计提升英雄等级五次；将军伸了个比昨日更长的懒腰。', type: 'level_up_hero', target: 5, reward: { fish: 3500, exp: 700, bells: 30, items: [{ id: 'fishbone_small', count: 5 }] } },
  { id: 'newbie_equipment', name: '小铃铛跟着走', desc: '提升一次装备等级；铃扣牢了，走到哪都能认出同袍。', type: 'equip_upgrade', target: 1, reward: { fish: 4000, exp: 800, bells: 30, items: [{ id: 'bell_thread', count: 5 }] } },
  { id: 'newbie_skill', name: '卷轴翻开第一页', desc: '提升一次英雄技能等级；这回纸卷终于不用只当枕头。', type: 'upgrade_skill', target: 1, reward: { fish: 5000, exp: 1000, bells: 40, items: [{ id: 'claw_scroll_small', count: 5 }] } },
  { id: 'newbie_stage_six', name: '纸箱街先走一段', desc: '首次通过第一章第六关；灯光里已经有人等你会合。', type: 'reach_stage', target: 6, reward: { fish: 6000, exp: 1200, bells: 40, items: [{ id: 'recruit_ticket', count: 2 }] } },
  { id: 'newbie_arena', name: '铺好第一张演武垫', desc: '完成一次竞技比试；赢了坐一坐，睡了躺一躺。', type: 'arena_battle', target: 1, reward: { fish: 6500, exp: 1300, bells: 40, items: [{ id: 'paw_seal', count: 100 }] } },
  { id: 'newbie_guild', name: '一起抬起这个箱', desc: '完成一次有效公会互助；军师也有可以借爪的时候。', type: 'guild_help', target: 1, reward: { fish: 7000, exp: 1400, bells: 50, items: [{ id: 'guild_token', count: 100 }] } },
  { id: 'newbie_stage_twelve', name: '会盟灯下留个印', desc: '首次通过第一章第十二关；名册上添了军师的手印。', type: 'reach_stage', target: 12, reward: { fish: 8000, exp: 1600, bells: 60, items: [{ id: 'catnip_medium', count: 5 }] } },
  { id: 'newbie_stage_twentyfour', name: '让天下饭桌坐稳', desc: '首次通过第一章第二十四关；这一路的纸箱都有人照看。', type: 'reach_stage', target: 24, reward: { fish: 10000, exp: 2000, bells: 100, items: [{ id: 'recruit_ticket', count: 3 }, { id: 'equip_chest_rare', count: 1 }] } },
];

export const QUESTS: QuestDef[] = [
  ...DAILY.map((seed) => quest('daily', seed)),
  ...WEEKLY.map((seed) => quest('weekly', seed)),
  ...ACHIEVEMENTS,
  ...NEWBIE.map((seed) => quest('newbie', seed)),
];

// 基础概率不含保底；保底提升长期实际高品质出率，不把基础概率冒充最终出率。
const BASE_RATES = { UR: 0.015, SSR: 0.12, SR: 0.865 };
const PITY = { ssrWithin: 10, urWithin: 80, upGuarantee: false };

export const GACHA_RULES = {
  ssrPityIncludesUr: true,
  upUrShare: 0.5,
  newbieDrawLimit: 80,
  newbiePriceFactor: 0.8,
  newbiePity: '新手池提供一次性八十抽优惠额度，额度内可达金边保底；九池均为金边八十抽、紫边或更高十抽保底',
  candidateSelection: '先按稀有度抽取，再在对应候选中等概率选英雄；活动金边英雄另按定向规则抽取',
  ssrPitySelection: '先检查金边保底；否则银蓝连续九次后，按基础金边与紫边权重比例抽取两档',
  counters: '每个池的编号独立保存计数；银蓝两计数都加一，紫边清紫边计数、金边计数加一，金边清两个计数',
  upGuarantee: '无大保底时先按一半概率判断是否命中指定英雄；未命中则排除指定英雄，从其余金边候选中等概率选取，并保证下一次金边为指定英雄；命中后清除该保证',
  tenDraws: '十连按十次单抽依次结算，中途触发保底立即重置，再继续后面的抽取',
  expiry: '计数按池编号持久保存；同一活动池换指定英雄不清计数，新手池抽满八十次关闭',
  readiness: '缺少任何有概率的候选档时禁止抽取，并禁售关联阵营券；不重新分配权重或借其他阵营补位',
} as const;

export const GACHA_POOLS: GachaPoolDef[] = [
  { id: 'normal', name: '天下招福', kind: 'normal', rates: { ...BASE_RATES }, pity: { ...PITY }, cost: { single: { item: 'recruit_ticket', count: 1 }, ten: { item: 'recruit_ticket', count: 10 } } },
  ...FACTION_ORDER.map((faction): GachaPoolDef => ({
    id: `faction_${faction}`, name: `${FACTIONS[faction].name}族来客`, kind: 'faction', faction,
    rates: { ...BASE_RATES }, pity: { ...PITY },
    cost: { single: { item: `recruit_${faction}`, count: 1 }, ten: { item: `recruit_${faction}`, count: 10 } },
  })),
  { id: 'up_template', name: '云端来信', kind: 'up', rates: { ...BASE_RATES }, pity: { ...PITY, upGuarantee: true }, upHeroes: ['xian_zuoci'], cost: { single: { item: 'bells', count: 300 }, ten: { item: 'bells', count: 3000 } } },
  { id: 'newbie', name: '纸箱迎新', kind: 'newbie', rates: { ...BASE_RATES }, pity: { ...PITY }, cost: { single: { item: 'bells', count: 240 }, ten: { item: 'bells', count: 2400 } } },
];

interface PoolReadiness {
  ready: boolean;
  candidates: Record<Rarity, string[]>;
  missingRarities: Rarity[];
  invalidUpHeroes: string[];
}

// 蜀族当前没有银蓝英雄：目录保留设计，但消费端必须读取 ready 才可启用。
export const GACHA_POOL_READINESS: Record<string, PoolReadiness> = Object.fromEntries(GACHA_POOLS.map((pool) => {
  const heroes = HEROES.filter((hero) => !pool.faction || hero.faction === pool.faction);
  const candidates: Record<Rarity, string[]> = {
    UR: heroes.filter((hero) => hero.rarity === 'UR').map((hero) => hero.id),
    SSR: heroes.filter((hero) => hero.rarity === 'SSR').map((hero) => hero.id),
    SR: heroes.filter((hero) => hero.rarity === 'SR').map((hero) => hero.id),
  };
  const missingRarities = (['UR', 'SSR', 'SR'] as const).filter((rarity) => pool.rates[rarity] > 0 && candidates[rarity].length === 0);
  const invalidUpHeroes = (pool.upHeroes ?? []).filter((id) => !candidates.UR.includes(id));
  return [pool.id, { ready: missingRarities.length === 0 && invalidUpHeroes.length === 0, candidates, missingRarities, invalidUpHeroes }];
}));

// 小鱼干等值仅作标价审查，不代表可互换、可出售或永久兑换比例。
// 毛线球价值随进度变化，下表仅为定价锚点；不得据此折现奖励。
export const ITEM_VALUE_FISH: Record<string, number> = {
  fish: 1, bells: 100, paw_seal: 200, guild_token: 300, tower_token: 300, faction_token: 400,
  catnip_small: 250, catnip_medium: 1000, catnip_large: 4000,
  fishbone_small: 1000, fishbone_medium: 3000, fishbone_large: 9000,
  claw_scroll_small: 500, claw_scroll_medium: 1500, claw_scroll_large: 4500,
  awaken_dew: 20000, awaken_jade: 80000, bell_thread: 200,
  yarn_small: 10000, yarn_medium: 20000, yarn_large: 40000,
  recruit_ticket: 30000,
  recruit_wei: 30000, recruit_shu: 30000, recruit_wu: 30000, recruit_qun: 30000, recruit_man: 30000, recruit_xian: 30000,
  equip_chest_rare: 10000, equip_chest_epic: 40000, equip_chest_legend: 160000,
  hero_shard_sr: 1500, hero_shard_ssr: 6000, hero_shard_ur: 24000,
  shard_chest_sr: 15000, shard_chest_ssr: 60000, shard_chest_ur: 240000,
  fish_pouch_small: 1000, fish_pouch_medium: 5000, fish_pouch_large: 20000,
};

type Offer = [id: string, count: number, weeklyLimit: number];
const SHOP_OFFERS: Record<ShopItemDef['shop'], Offer[]> = {
  general: [
    ['catnip_small', 10, 14], ['catnip_medium', 5, 7], ['catnip_large', 2, 3],
    ['fishbone_small', 5, 7], ['fishbone_medium', 3, 3], ['claw_scroll_small', 5, 7],
    ['claw_scroll_medium', 3, 3], ['bell_thread', 10, 7], ['recruit_ticket', 1, 10],
    ['yarn_small', 1, 7], ['equip_chest_rare', 1, 3], ['claw_scroll_large', 2, 2],
  ],
  arena: [
    ['catnip_medium', 5, 7], ['fishbone_small', 10, 7], ['fishbone_medium', 5, 3],
    ['claw_scroll_small', 5, 7], ['claw_scroll_medium', 3, 3], ['bell_thread', 10, 7],
    ['equip_chest_rare', 1, 3], ['equip_chest_epic', 1, 1], ['hero_shard_sr', 10, 3],
    ['hero_shard_ssr', 5, 2], ['recruit_ticket', 1, 3], ['fish_pouch_medium', 1, 7],
  ],
  guild: [
    ['catnip_medium', 5, 7], ['catnip_large', 2, 3], ['fishbone_medium', 5, 3],
    ['fishbone_large', 2, 2], ['claw_scroll_small', 10, 7], ['claw_scroll_large', 2, 2],
    ['bell_thread', 20, 7], ['awaken_dew', 2, 2], ['yarn_small', 1, 7],
    ['equip_chest_epic', 1, 1], ['hero_shard_ssr', 5, 2], ['fish_pouch_large', 1, 3],
  ],
  tower: [
    ['catnip_medium', 5, 7], ['catnip_large', 2, 3], ['fishbone_large', 2, 2],
    ['claw_scroll_medium', 5, 3], ['claw_scroll_large', 2, 2], ['awaken_jade', 1, 1],
    ['awaken_dew', 2, 2], ['yarn_medium', 1, 3], ['equip_chest_legend', 1, 1],
    ['shard_chest_ssr', 1, 1], ['hero_shard_ur', 3, 1], ['fish_pouch_large', 1, 3],
  ],
  faction: [
    ...FACTION_ORDER.map((faction): Offer => [`recruit_${faction}`, 1, 3]),
    ['hero_shard_sr', 10, 3], ['hero_shard_ssr', 5, 2], ['hero_shard_ur', 2, 1],
    ['fishbone_large', 2, 2], ['awaken_jade', 1, 1], ['claw_scroll_large', 2, 2],
  ],
};

const SHOP_CURRENCY = { general: 'fish', arena: 'paw_seal', guild: 'guild_token', tower: 'tower_token', faction: 'faction_token' } as const;

export const SHOP_ITEMS: ShopItemDef[] = (Object.keys(SHOP_OFFERS) as ShopItemDef['shop'][]).flatMap((shop) => SHOP_OFFERS[shop].map(([id, count, weeklyLimit]) => {
  const value = ITEM_VALUE_FISH[id] * count;
  const currency = shop === 'general' && value >= 10000 ? 'bells' : SHOP_CURRENCY[shop];
  const premium = id.startsWith('recruit_') ? 1 : 1.2;
  return {
    id: `${shop}_${id}`, shop, item: { id, count },
    price: { item: currency, count: Math.ceil(value * premium / ITEM_VALUE_FISH[currency]) }, weeklyLimit,
  };
}));

// 对应不可用招募池的票券条目保留在设计目录，禁止作为可购买商品展示。
export const SHOP_ITEM_READINESS: Record<string, boolean> = Object.fromEntries(SHOP_ITEMS.map((offer) => {
  const pool = GACHA_POOLS.find((entry) => entry.cost.single.item === offer.item.id);
  return [offer.id, !pool || GACHA_POOL_READINESS[pool.id].ready];
}));
