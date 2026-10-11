import { FACTIONS } from '../data/factions';
import type { FactionId } from '../data/factions';
import type { RuleFx } from '../engine/types';
import { HERO_BY_ID } from '../data/heroes';
import type { ChapterDef, EnemySpawn, RewardDef, StageDef, WaveDef } from './types';

export const CHAPTER_COUNT = 6;
export const STAGES_PER_CHAPTER = 24;
// #14 尚未合入时使用的约定 id；合入后校验测试直接对照道具目录。
export const PENDING_CAMPAIGN_ITEMS = ['catnip_small', 'fishbone_small'] as const;

// 144 关从 300 到 30000，共 137 个普通增长间隔、6 个首领增长间隔。
// 若每个普通间隔至少 4%，终点将约为 12.8 万，无法同时满足约 3 万。
// 暂保留首尾锚点与首领 +12%，其余间隔约 +2.91%；待 Claude 决定最终口径。
const REGULAR_POWER_FACTOR = Math.pow(30_000 / 300 / Math.pow(1.12, 6), 1 / 137);

export function powerCurve(chapter: number, index: number): number {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > CHAPTER_COUNT
    || !Number.isInteger(index) || index < 1 || index > STAGES_PER_CHAPTER) {
    throw new RangeError('章节须为一至六，关卡须为一至二十四。');
  }
  const ordinal = (chapter - 1) * STAGES_PER_CHAPTER + index;
  const bosses = Math.floor(ordinal / STAGES_PER_CHAPTER);
  return Math.round(300 * Math.pow(REGULAR_POWER_FACTOR, ordinal - 1 - bosses) * Math.pow(1.12, bosses));
}

type RulePlan = { text: string; fx?: RuleFx[]; todo?: string };
const ready = (text: string, fx: RuleFx[]): RulePlan => ({ text, fx });

type ChapterPlan = Omit<ChapterDef, 'stages'> & {
  primary: FactionId;
  secondary: FactionId;
  boss: string;
  support: string;
  landmarks: string[];
  rules: RulePlan[];
};

const PLANS: ChapterPlan[] = [
  {
    id: 1, name: '黄昏纸箱街', theme: '暮色巷道、纸箱营垒与歪了腿的饭桌',
    focusFactions: ['qun', 'wei'], primary: 'qun', secondary: 'wei',
    boss: 'qun_dongzhuo', support: 'qun_huatuo',
    intro: '黄昏落进纸箱街，铲屎官从一只旧箱里请出了诸葛喵亮。董桌把天下的饭桌掀得东倒西歪，连九命天子的最后一碗饭也扣住了。各路猫雄带着空碗会盟，玄甲猫军却先封了街口。先替邻居扶稳纸箱，再找回散落的小鱼干；这场讨董大计，要从让每只猫坐下吃饭开始。',
    landmarks: ['旧箱巷口', '鱼香摊前', '玄甲街垒', '会盟灯下', '倾斜饭桌', '桌王门前'],
    rules: [
      ready('纸箱挡风，双方前排首回合减伤增加百分之十。', [{ t: 'takenMul', side: 'both', to: 'front', mult: 0.9, rounds: 1 }]),
      ready('敌方开局获得各自最大生命百分之十的护体毛，持续两次持有者行动结束。', [{ t: 'startShield', side: 'B', to: 'all', pct: 0.1, turns: 2 }]),
      ready('玄甲巡街，敌方魏阵营首回合防御增加百分之十五。', [{ t: 'startStatus', side: 'B', to: 'faction:wei', id: 'curl', turns: 1, power: 0.15 }]),
      ready('街灯照出爪印，双方命中增加百分之十，持续全场。', [{ t: 'hitAdd', side: 'both', to: 'all', add: 0.1 }]),
      ready('窄巷难转身，双方后排首回合速度降低百分之十。', [{ t: 'startStatus', side: 'both', to: 'back', id: 'step', turns: 1, power: -0.1 }]),
      ready('会盟鼓响，敌方先锋开局回复十五点元气。', [{ t: 'startEnergy', side: 'B', to: 'role:先锋', amount: 15 }]),
      ready('空碗传声，友方医者首次治疗效果增加百分之二十。', [{ t: 'firstHealMul', side: 'A', to: 'role:医者', mult: 1.2 }]),
      ready('董桌的护体毛首次被击破时，敌方全体元气降低十点。', [{ t: 'on', ev: 'shieldBreak', side: 'B', hero: 'qun_dongzhuo', act: { k: 'energy', amount: -10, who: 'foes' } }]),
    ],
    bossNote: '开局阶段以拍桌叠护体毛；生命低于百分之七十与三十五时，各预告一回合后释放掀桌并获得百分之二十五最大生命的护盾。低生命阶段保留暴虐增攻，睡着时桌下藏鱼为同伴恢复。玩家先处理华佗喵，再集中破盾，以治疗或护盾接住群体技能；中段魏军让纯群阵容承受克制压力。',
  },
  {
    id: 2, name: '官渡鱼市', theme: '鱼市账房、粮仓纸袋与官渡木桥',
    focusFactions: ['wei', 'shu'], primary: 'wei', secondary: 'shu',
    boss: 'wei_caomiaode', support: 'wei_guojia',
    intro: '纸箱街的饭桌刚摆正，官渡鱼市又添了两本账。曹喵德按爪印分配鱼干，刘喵备却想让没带印章的猫也吃上饭。郭嘉喵抱着锦囊靠在粮仓边，看似打盹，耳朵一直听着算盘。鱼市半途还有仙族来校对天机，铁壁也得换个方向站；穿过账房和木桥，才能问清这批鱼究竟给谁。',
    landmarks: ['鱼市东门', '草鞋摊边', '天机账房', '官渡木桥', '鱼干粮仓', '主公案前'],
    rules: [
      ready('粮仓飘香，双方每只猫的首次普通攻击额外回复五点元气。', [{ t: 'firstBasicEnergy', side: 'both', amount: 5 }]),
      ready('魏军守账，敌方守护开局获得最大生命百分之十二的护体毛，持续到持有者第二次行动结束。', [{ t: 'startShield', side: 'B', to: 'role:守护', pct: 0.12, turns: 2 }]),
      ready('天机校账，敌方仙阵营命中增加百分之十，持续全场。', [{ t: 'hitAdd', side: 'B', to: 'faction:xian', add: 0.1 }]),
      ready('锦囊待拆，敌方每名医者的首次治疗额外净化目标一个负面效果。', [{ t: 'on', ev: 'heal', side: 'B', to: 'role:医者', act: { k: 'cleanse', n: 1, who: 'target' } }]),
      ready('木桥排队，双方速度最高的猫首回合速度降低百分之十。', [{ t: 'startStatus', side: 'both', to: 'all', pick: 'highestSpd', id: 'step', turns: 1, power: -0.1 }]),
      ready('仁义分饭，友方蜀阵营首次受到治疗的效果增加百分之十五。', [{ t: 'firstHealTakenMul', side: 'A', to: 'faction:shu', mult: 1.15 }]),
      ready('账册催阵，敌方元气最低的猫每回合开始回复五点元气。', [{ t: 'roundEnergyLowest', side: 'B', amount: 5 }]),
      ready('曹喵德首次释放绝技前，先预告一整轮。', [{ t: 'telegraph', side: 'B', hero: 'wei_caomiaode', first: true }]),
    ],
    bossNote: '开局铁壁阶段由曹喵德与郭嘉喵搭配前排；生命低于百分之六十时回复三十点元气，首次挟天子以令诸猫前预告一回合。百分之三十以下进入魏武阶段，绝技附带受惊。先压制郭嘉喵的续航，再用控制或元气削减错开全队护盾，带净化应对受惊；中段仙族克制魏队，鼓励换入吴系输出。',
  },
  {
    id: 3, name: '赤壁水寨', theme: '连环战船、水碗雨幕与赤红琴台',
    focusFactions: ['wu', 'wei'], primary: 'wu', secondary: 'wei',
    boss: 'wu_zhoumiaoyu', support: 'wu_sunxiaoba',
    intro: '赤壁的船用毛线连成一片，曹喵德说这样摇晃少，水碗却先摇出了浪。诸葛喵亮与周喵瑜借风合奏，黄盖盖抱着热毯子准备一封降书。山林来的猫踩着漂木混进水寨，提醒水师也有怕的地利。正式出船前，周喵瑜亲自主持联军合演；接住淋湿与灼烧的节拍，才能把火留在空船上。',
    landmarks: ['连环船头', '魏营水碗', '漂木林口', '热毯码头', '借风琴台', '联军合演'],
    rules: [
      ready('全场开局淋湿，持续至各自首次行动结束；淋湿使受到的火焰与雷电直接伤害增加百分之二十五。', [{ t: 'startStatus', side: 'both', to: 'all', id: 'wet', turns: 1 }]),
      ready('敌方吴阵营每只猫的首次普通攻击命中时，使目标淋湿，持续到目标下一次行动结束。', [{ t: 'on', ev: 'basicHit', side: 'B', to: 'faction:wu', act: { k: 'status', id: 'wet', turns: 1, who: 'target' } }]),
      ready('漂木遮挡，敌方蛮阵营前两个整轮闪避增加十个百分点。', [{ t: 'dodgeAdd', side: 'B', to: 'faction:man', add: 0.1, rounds: 2 }]),
      ready('每逢偶数整轮开始，双方前排获得淋湿，持续至各自下一次行动结束。', [{ t: 'roundStatus', side: 'both', to: 'front', id: 'wet', every: 2, turns: 1 }]),
      ready('烘帆火星，带有灼烧的目标受到治疗的效果降低百分之十。', [{ t: 'healMul', side: 'both', mult: 0.9, needStatus: 'burn' }]),
      ready('降书藏火，敌方前排首次护体毛到期时，为我方随机前排附加一层灼烧（两次行动结束，每回合二成攻击）。', [{ t: 'on', ev: 'shieldExpire', side: 'B', to: 'front', per: 'side', act: { k: 'status', id: 'burn', turns: 2, snapAtk: 0.2, who: 'randomFoeFront' } }]),
      ready('东风转向，我方首次净化淋湿时，同时清除该目标的一层灼烧。', [{ t: 'on', ev: 'cleanse', side: 'A', status: 'wet', per: 'side', act: { k: 'removeStack', id: 'burn', who: 'target' } }]),
      ready('合演开场双方前排淋湿，持续到各自第二次行动结束；吴阵营的火焰伤害增加百分之二十。', [{ t: 'startStatus', side: 'both', to: 'front', id: 'wet', turns: 2 }, { t: 'dmgMul', side: 'B', to: 'faction:wu', elem: 'fire', mult: 1.2 }]),
    ],
    bossNote: '此战为出征前的联军合演，首领仍是周喵瑜。开局水相阶段由孙小霸施加淋湿；生命低于百分之六十时转琴火阶段，预告一回合后释放赤壁火海。百分之三十以下开启燎原，灼烧叠层并在猫猫睡着后传递。玩家需及时净化淋湿和灼烧、错开绝技避免曲有误反应，用持续治疗稳住后排；中段蛮族伏击压制吴队。',
  },
  {
    id: 4, name: '喵蛮山林', theme: '藤编猫窝、山林兽鼓与七次宴席',
    focusFactions: ['man', 'shu'], primary: 'man', secondary: 'shu',
    boss: 'man_mengmiaohuo', support: 'man_mulu',
    intro: '水寨的东风吹进南疆，山林里却已经摆好了第七张饭席。孟喵获说这回一定不服，骨头棒旁的小碗倒是先递了过来。藤甲小喵守着最舒服的路口，木鹿大王的兽鼓把林子敲得齐齐点头。蜀猫沿山道分饭劝和，让蛮族阵容也尝到被攻心的滋味；每赢一场就放一回，最后还得让盟主心服口服。',
    landmarks: ['南疆树门', '藤窝小径', '桃园山道', '兽鼓回廊', '第六宴席', '七纵高台'],
    rules: [
      ready('藤窝遮雨，敌方守护首回合减伤增加百分之十五。', [{ t: 'takenMul', side: 'B', to: 'role:守护', mult: 0.85, rounds: 1 }]),
      ready('兽鼓回响，敌方蛮阵营每只猫的首次普通攻击，额外为全队积累一层图腾。', [{ t: 'on', ev: 'basic', side: 'B', to: 'faction:man', act: { k: 'totem', amount: 1 } }]),
      ready('桃园劝和，敌方蜀阵营首次治疗效果增加百分之二十。', [{ t: 'firstHealMul', side: 'B', to: 'faction:shu', mult: 1.2 }]),
      ready('山路绕行，双方刺客首回合速度增加百分之十。', [{ t: 'startStatus', side: 'both', to: 'role:刺客', id: 'step', turns: 1, power: 0.1 }]),
      ready('晒暖藤甲，带护体毛的目标受到火焰伤害增加百分之十五。', [{ t: 'takenMul', side: 'both', elem: 'fire', mult: 1.15, needShield: true }]),
      ready('饭席未散，敌方医者开局回复二十点元气。', [{ t: 'startEnergy', side: 'B', to: 'role:医者', amount: 20 }]),
      ready('鼓点渐急，敌方每只猫每第三次普通攻击后，下一次攻击增加百分之十。', [{ t: 'on', ev: 'basic', side: 'B', every: 3, max: 99, act: { k: 'status', id: 'fluff', turns: 1, power: 0.1, who: 'actor' } }]),
      ready('孟喵获每第七次受到攻击立即回复三十点元气，最多两次。', [{ t: 'on', ev: 'hurt', side: 'B', hero: 'man_mengmiaohuo', every: 7, max: 2, act: { k: 'energy', amount: 30, who: 'actor' } }]),
    ],
    bossNote: '开局骨棒积累图腾，木鹿大王准备百兽朝鼓；生命低于百分之六十与三十时，分别获得两回合九命并预告下一次七擒七纵。第七次受击回复元气，低生命不服叠防御。玩家计算攻击次数，在九命结束后集中输出，先控制兽鼓并用蜀系克制或火焰破藤甲；中段蜀队专门压制纯蛮阵容。',
  },
  {
    id: 5, name: '云端玄门', theme: '绒云台阶、符水池塘与真假鱼雨',
    focusFactions: ['xian', 'wu'], primary: 'xian', secondary: 'wu',
    boss: 'xian_zuoci', support: 'xian_shuijing',
    intro: '云台不收门票，只问铲屎官能不能分清真鱼和画在云上的鱼。左慈喵留下一串软软的爪印，张爪端来符水，水镜喵已经说了三声好。吴族的红帆却从半山探出头，火光让符纸的边角微微卷起。顺着星图往上走，要留意毛线缠住的是脚还是念头；九命印的线索，就藏在最后一阵小鱼雨里。',
    landmarks: ['绒云台阶', '符水池边', '红帆云渡', '星图回廊', '真假鱼雨', '幻猫云台'],
    rules: [
      ready('云层藏影，敌方前两个整轮闪避增加百分之二十。', [{ t: 'dodgeAdd', side: 'B', to: 'all', add: 0.2, rounds: 2 }]),
      ready('符水入阵，敌方每名医者的首次治疗，使目标获得呼噜（每次行动前回复百分之五最大生命），持续一次行动结束。', [{ t: 'on', ev: 'heal', side: 'B', to: 'role:医者', act: { k: 'status', id: 'purr', turns: 1, power: 0.05, who: 'target' } }]),
      ready('红帆照云，敌方吴阵营火焰伤害增加百分之十五，持续两回合。', [{ t: 'dmgMul', side: 'B', to: 'faction:wu', elem: 'fire', mult: 1.15, rounds: 2 }]),
      ready('星图落爪，每一方首次施加的毛线缠多持续一次行动结束。', [{ t: 'on', ev: 'statusApply', side: 'both', status: 'yarn', per: 'side', act: { k: 'extend', turns: 1 } }]),
      ready('云风解结，我方首次净化控制后，被净化者回复十点元气。', [{ t: 'on', ev: 'cleanse', side: 'A', cc: true, per: 'side', act: { k: 'energy', amount: 10, who: 'target' } }]),
      ready('天机换位，敌方速度最低的猫第二回合速度增加百分之二十。', [{ t: 'roundStatus', side: 'B', to: 'all', pick: 'lowestSpd', id: 'step', every: 1, at: 2, turns: 1, power: 0.2 }]),
      ready('鱼雨微凉，双方开局获得最大生命百分之八的护体毛，持续到持有者第二次行动结束。', [{ t: 'startShield', side: 'both', to: 'all', pct: 0.08, turns: 2 }]),
      ready('左慈喵每次释放绝技前，都先预告一整轮。', [{ t: 'telegraph', side: 'B', hero: 'xian_zuoci' }]),
    ],
    bossNote: '开局幻象阶段由水镜喵续航；生命低于百分之六十五时，千幻万象每次只为两名后排添加一次闪避。百分之三十以下每两回合预告一次天命，交替额外行动与回复元气，不随机连续无敌。玩家以多段攻击先消耗幻象，控制医者并预留净化处理毛线缠；中段吴系火焰克制仙队，提醒防御阵容需要更换输出。',
  },
  {
    id: 6, name: '九命殿', theme: '六族旗帜、肉垫印阶与最后一张软席',
    focusFactions: ['qun', 'wei', 'shu', 'man', 'wu', 'xian'], primary: 'qun', secondary: 'wei',
    boss: 'qun_lvbuding', support: 'qun_diaochan',
    intro: '九命殿的门口挤满六族旗帜，九命天子却只给自己留了一张小席子。吕布丁骑着胖赤兔守在台阶上，说谁能接住他的画戟，谁才配替天下端稳饭碗。各族轮番列阵，旧时的克制与羁绊都得重新盘算。铲屎官一路收来的爪印终于拼出九命印的轮廓；最后这场较量，赢的该是让大家都有座位的办法。',
    landmarks: ['六旗殿门', '结义长廊', '玄甲印阶', '天机侧殿', '赤兔软席', '九命正殿'],
    rules: [
      ready('六旗齐举，敌方含三种以上阵营时，前排防御增加百分之十，持续全场。', [{ t: 'startStatus', side: 'B', to: 'front', id: 'curl', turns: 99, power: 0.1, needFactions: 3 }]),
      ready('殿鼓催行，双方每只猫的首次普通攻击额外回复十点元气。', [{ t: 'firstBasicEnergy', side: 'both', amount: 10 }]),
      ready('玄甲封阶，敌方魏阵营开局获得最大生命百分之十五的护体毛，持续到持有者第二次行动结束。', [{ t: 'startShield', side: 'B', to: 'faction:wei', pct: 0.15, turns: 2 }]),
      ready('旧盟照应，友方含三种以上阵营时，每只猫的首次治疗效果增加百分之十五。', [{ t: 'firstHealMul', side: 'A', mult: 1.15, needFactions: 3 }]),
      ready('软席安神，每一方首次净化猫薄荷醉时，被净化者回复十点元气。', [{ t: 'on', ev: 'cleanse', side: 'both', status: 'nip', per: 'side', act: { k: 'energy', amount: 10, who: 'target' } }]),
      ready('六族轮值，敌方每回合首次暴击后，为最低元气同伴回复五点元气。', [{ t: 'on', ev: 'crit', side: 'B', per: 'round', act: { k: 'energy', amount: 5, who: 'lowestAlly' } }]),
      ready('九命印亮，双方后排开局命中增加百分之十，持续两回合。', [{ t: 'hitAdd', side: 'both', to: 'back', add: 0.1, rounds: 2 }]),
      ready('吕布丁每次释放绝技前，都先预告一整轮。', [{ t: 'telegraph', side: 'B', hero: 'qun_lvbuding' }]),
    ],
    bossNote: '开局飞将阶段与貂蝉喵组成混阵；生命低于百分之六十时开启天下无双，优先寻找后排并预告一回合。百分之二十五以下赤兔每两回合给一次额外行动，禁止连锁触发，并在连续行动后减速。玩家以前排护卫、净化和护盾保护后排，利用减速窗口集中输出；各段依克制环轮换敌军，中段魏军压制群队，收官检验混搭与羁绊。',
  },
];

function factionAt(plan: ChapterPlan, index: number, wave: number): FactionId {
  // 9～16 关固定呈现克制主焦点阵营的压力，而非只写进说明。
  if (index >= 9 && index <= 16) {
    return Object.values(FACTIONS).find((faction) => faction.counters === plan.primary)!.id;
  }
  if (plan.id === 6) return ['qun', 'shu', 'man', 'wu', 'xian', 'wei'][(index + wave - 1) % 6] as FactionId;
  return (index + wave) % 4 === 0 ? plan.secondary : plan.primary;
}

function buildWaves(plan: ChapterPlan, index: number, kind: StageDef['kind']): WaveDef[] {
  const ordinal = (plan.id - 1) * STAGES_PER_CHAPTER + index;
  const waveCount = kind === 'boss' ? 3 : kind === 'elite' || index >= 17 ? 2 : 1;
  const count = kind === 'normal' ? (index <= 4 ? 3 : 4) : 5;
  const positions = count === 3 ? [0, 1, 3] : count === 4 ? [0, 1, 3, 4] : [0, 1, 2, 3, 4];
  return Array.from({ length: waveCount }, (_, wave) => {
    const faction = factionAt(plan, index, wave);
    const level = 1 + Math.floor((ordinal - 1) * 0.7) + wave;
    const enemies: EnemySpawn[] = positions.map((pos) => {
      const role = pos === 0 ? 'guard' : pos === 1 ? 'vanguard' : pos === 2 ? 'guard'
        : pos === 3 ? (index % 2 === 0 ? 'strategist' : 'archer') : (index % 3 === 0 ? 'healer' : 'assassin');
      const unitFaction = plan.id === 6 && !(index >= 9 && index <= 16)
        ? (['wei', 'shu', 'man', 'wu', 'xian', 'qun'] as FactionId[])[(index + wave + pos) % 6] : faction;
      return { unit: `mob_${unitFaction}_${role}`, level, pos };
    });
    if (kind !== 'normal' && wave === waveCount - 1) {
      const factionHeroes = Object.values(HERO_BY_ID).filter((entry) => entry.faction === faction);
      const hero = kind === 'boss' ? HERO_BY_ID[plan.boss] : factionHeroes[Math.floor(index / 6) % factionHeroes.length];
      const front = hero.role === '守护' || hero.role === '先锋';
      const pos = front ? 1 : 3;
      enemies[enemies.findIndex((enemy) => enemy.pos === pos)] = { unit: hero.id, level: level + (kind === 'boss' ? 4 : 2), pos };
      if (kind === 'boss') {
        const support = HERO_BY_ID[plan.support];
        const supportPos = support.role === '先锋' || support.role === '守护' ? 0 : 4;
        enemies[enemies.findIndex((enemy) => enemy.pos === supportPos)] = { unit: support.id, level: level + 2, pos: supportPos };
      }
    }
    return { enemies };
  });
}

function stageRewards(ordinal: number): { rewards: RewardDef; firstClear: RewardDef } {
  return {
    rewards: { fish: 40 + ordinal * 8, exp: 20 + ordinal * 4, items: [{ id: 'catnip_small', count: 1 + Math.floor((ordinal - 1) / 48) }] },
    firstClear: {
      fish: 120 + ordinal * 32, exp: 40 + ordinal * 12, bells: 4 + Math.floor((ordinal - 1) / 3),
      items: [
        { id: 'catnip_small', count: 2 + Math.floor((ordinal - 1) / 12) },
        { id: 'fishbone_small', count: 1 + Math.floor((ordinal - 1) / 24) },
      ],
    },
  };
}

function buildStage(plan: ChapterPlan, index: number): StageDef {
  const kind = index === 24 ? 'boss' : index % 6 === 0 ? 'elite' : 'normal';
  const ordinal = (plan.id - 1) * STAGES_PER_CHAPTER + index;
  const { rewards, firstClear } = stageRewards(ordinal);
  if (kind === 'boss') firstClear.heroShards = [{ heroId: plan.boss, count: 5 + (plan.id - 1) * 3 }];
  const stage: StageDef = {
    id: `${plan.id}-${index}`,
    name: kind === 'boss' ? `${HERO_BY_ID[plan.boss].name}的较量`
      : `${plan.landmarks[Math.floor((index - 1) / 4)]}·${kind === 'elite' ? '守将' : ['初探', '会合', '较量', '前行'][(index - 1) % 4]}`,
    kind, recommendedPower: powerCurve(plan.id, index), waves: buildWaves(plan, index, kind), rewards, firstClear,
  };
  if (index % 3 === 0) {
    const rule = plan.rules[index / 3 - 1];
    stage.rule = rule.text;
    if (rule.fx) stage.ruleFx = rule.fx.map((effect) => ({ ...effect }));
  }
  if (index === 1) stage.storyId = `c${plan.id}_open`;
  if (index === 12) stage.storyId = `c${plan.id}_mid`;
  if (index === 24) {
    stage.storyId = `c${plan.id}_boss_pre`;
    stage.storyPostId = `c${plan.id}_boss_post`;
  }
  return stage;
}

export const CHAPTERS: ChapterDef[] = PLANS.map(({ primary: _primary, secondary: _secondary, boss: _boss, support: _support, landmarks: _landmarks, rules: _rules, ...chapter }) => ({
  ...chapter,
  stages: Array.from({ length: STAGES_PER_CHAPTER }, (_, index) => buildStage(PLANS[chapter.id - 1], index + 1)),
}));

// 每条未落地规则都保留原文与明确的原语提案，供 docs/RULES_TODO.md 对照。
export const RULES_TODO = PLANS.flatMap((chapter) => chapter.rules.flatMap((rule, index) =>
  rule.todo ? [{ chapter: chapter.id, stageId: `${chapter.id}-${(index + 1) * 3}`, text: rule.text, need: rule.todo }] : [],
));
