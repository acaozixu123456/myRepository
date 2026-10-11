// 24 只猫猫的技能设定。每只 4 个技能：普攻 / 绝技(元气满100释放) / 被动 / 觉醒(★5解锁)。
// 新增技能组与补齐升级词条的 SSR 直接复用 DSL 说明，展示页与战斗执行保持同一口径。
import type { Kit } from '../engine/types';
import { KITS_SR } from './kits/sr';
import { KITS_SSR } from './kits/ssr';
import { KITS_SP } from './kits/sp';
export type SkillKind = 'basic' | 'ultimate' | 'passive' | 'awaken';

export interface SkillDef {
  name: string;
  kind: SkillKind;
  target: string;
  desc: string;
  tags: string[]; // 用于筛选与 UI 标签
}

export const SKILL_KIND_NAME: Record<SkillKind, string> = {
  basic: '普攻',
  ultimate: '绝技',
  passive: '被动',
  awaken: '觉醒',
};

const S = (kind: SkillKind, name: string, target: string, desc: string, tags: string[] = []): SkillDef => ({ kind, name, target, desc, tags });

const FROM_KIT = (kit: Kit, targets: [string, string, string], tags: [string[], string[], string[]]): SkillDef[] => [
  S('basic', kit.basic.name, targets[0], kit.basic.desc, tags[0]),
  S('ultimate', kit.ultimate.name, targets[1], [kit.ultimate.desc, ...(kit.ultimate.levelMods ?? []).map((mod) => `【${mod.lv}级】${mod.desc}`)].join(' '), tags[1]),
  S('passive', kit.passive.name, targets[2], kit.passive.desc, tags[2]),
  S('awaken', `${kit.awaken.A.name} / ${kit.awaken.B.name}`, '五星择一路线', `路线甲「${kit.awaken.A.name}」：${kit.awaken.A.desc} 路线乙「${kit.awaken.B.name}」：${kit.awaken.B.desc}`, ['觉醒', '双路线']),
];

export const SKILLS: Record<string, SkillDef[]> = {
  // ---------------- 魏 ----------------
  wei_caomiaode: [
    S('basic', '令爪', '敌方随机 1 名', '造成 110% 攻击的法术伤害，并使友方元气最低的猫猫回复 8 点元气。', ['法伤', '回能']),
    S('ultimate', '挟天子以令诸猫', '敌方全体 + 友方全体', '对敌方全体造成 180% 攻击的法术伤害；为友方全体添加「护体毛」（60% 攻击，3 回合）。场上魏势力猫猫≥3 时，护盾翻倍。', ['群伤', '护盾', '魏·铁壁']),
    S('passive', '宁我负猫', '自身', '友方猫猫阵亡时，曹喵德立刻获得 30 点元气，并使全队「炸毛」（攻击 +15%，可叠 3 层）。', ['被动', '增益']),
    S('awaken', '魏武挥鞭', '—', '绝技额外使敌方全体「受惊」（攻击 -25%，2 回合）；「宁我负猫」的元气返还提高到 50 点。', ['觉醒']),
  ],
  wei_xiahoudun: FROM_KIT(KITS_SR.wei_xiahoudun, ['敌方前排单体', '敌方前排单体 + 自身', '自身'], [['物伤'], ['单体', '吸取', '低生命'], ['被动', '九命']]),
  wei_xuhuchi: FROM_KIT(KITS_SR.wei_xuhuchi, ['敌方前排单体', '敌方全体 + 自身', '其他魏势力友方'], [['物伤', '防御'], ['群伤', '挑衅', '护盾'], ['被动', '魏·铁壁']]),
  wei_guojia: FROM_KIT(KITS_SR.wei_guojia, ['生命比例最低的友方', '友方全体', '随机友方'], [['治疗'], ['群疗', '唤醒'], ['被动', '净化']]),

  // ---------------- 蜀 ----------------
  shu_liumiaobei: [
    S('basic', '仁爪', '友方生命最低 1 名 + 敌方单体', '回复 100% 攻击的生命；并对敌方单体造成 80% 攻击的伤害。', ['治疗', '输出']),
    S('ultimate', '桃园结义', '友方全体', '回复 180% 攻击的生命，并「炸毛」（攻击 +30%，3 回合）；蜀势力友方额外获得「呼噜」（每回合 8% 最大生命，3 回合）。', ['群疗', '增益', '蜀·桃园']),
    S('passive', '仁德', '友方', '友方生命首次低于 30% 时，自动获得一次 150% 攻击的治疗（每猫每场 1 次）。', ['被动', '保命']),
    S('awaken', '汉室永续', '—', '关云喵、张喵飞同在场时触发「结义」：三猫全属性 +20%；其中一只阵亡时，另外两只攻击再 +30%。', ['觉醒', '羁绊']),
  ],
  shu_guanyunmiao: FROM_KIT(KITS_SSR.shu_guanyunmiao, ['敌方前排单体', '敌方纵列', '自身'], [['物伤'], ['列伤', '追击'], ['被动', '暴击']]),
  shu_zhangmiaofei: FROM_KIT(KITS_SSR.shu_zhangmiaofei, ['敌方前排单体', '敌方全体', '自身'], [['物伤', '控制'], ['群伤', '受惊'], ['被动', '防御']]),
  shu_zhugemiaoliang: FROM_KIT(KITS_SSR.shu_zhugemiaoliang, ['随机敌方单体', '敌方全体 + 友方全体', '友方全体 + 自身'], [['法伤', '毛线缠'], ['群伤', '护盾', '减速'], ['被动', '回能']]),

  // ---------------- 吴 ----------------
  wu_zhoumiaoyu: [
    S('basic', '琴音', '敌方随机 2 名', '各造成 90% 攻击的火焰伤害，并施加「灼烧」（每回合 25% 攻击，2 回合）。', ['火伤', '灼烧']),
    S('ultimate', '赤壁火海', '敌方全体', '造成 200% 攻击的火焰伤害并「灼烧」3 回合；对「淋湿」目标额外 +60% 伤害。', ['群伤', '灼烧', '吴·赤壁']),
    S('passive', '曲有误', '敌方', '敌方每次释放绝技，周喵瑜立刻对其造成 80% 攻击的伤害，并叠加 1 层灼烧。', ['被动', '反制']),
    S('awaken', '连环计·燎原', '—', '灼烧每回合自动叠加 1 层（最多 5 层）；灼烧目标死亡时，把所有层数传给随机敌人。', ['觉醒']),
  ],
  wu_sunxiaoba: FROM_KIT(KITS_SR.wu_sunxiaoba, ['敌方前排单体', '敌方前排', '自身'], [['物伤'], ['排伤', '淋湿', '吴·赤壁'], ['被动', '首攻暴击']]),
  wu_sunxiangxiang: FROM_KIT(KITS_SSR.wu_sunxiangxiang, ['敌方后排单体', '随机敌方多段', '攻击者'], [['物伤', '后排'], ['多段', '状态联动'], ['被动', '反击']]),
  wu_huanggai: FROM_KIT(KITS_SR.wu_huanggai, ['敌方前排单体', '自身 + 友方全体', '自身'], [['物伤'], ['群盾', '增益', '自损'], ['被动', '护盾']]),

  // ---------------- 群 ----------------
  qun_lvbuding: [
    S('basic', '画戟', '敌方单体', '造成 140% 攻击的物理伤害，暴击时 20% 概率追加一次攻击。', ['物伤', '连击']),
    S('ultimate', '天下无双', '敌方后排全体', '造成 250% 攻击的物理伤害，本次暴击率 +50%；击杀目标时返还 50 点元气。', ['后排', '暴击', '群·乱世']),
    S('passive', '飞将', '自身', '战斗开始时攻击 +20%；速度高于目标时伤害 +20%。', ['被动', '速度']),
    S('awaken', '赤兔（兔）', '—', '每回合首次行动后，50% 概率立刻额外行动一次（骑着一只很胖的兔子）。', ['觉醒']),
  ],
  qun_diaochan: FROM_KIT(KITS_SR.qun_diaochan, ['随机敌方单体', '随机 2 名敌人', '攻击者'], [['法伤', '猫薄荷醉'], ['混乱', '元气压制'], ['被动', '反制']]),
  qun_dongzhuo: FROM_KIT(KITS_SR.qun_dongzhuo, ['敌方前排单体', '敌方全体 + 自身', '自身'], [['物伤', '护盾'], ['挑衅', '群伤', '护盾'], ['被动', '低生命']]),
  qun_huatuo: FROM_KIT(KITS_SSR.qun_huatuo, ['生命比例最低的友方', '友方全体', '生命比例最低的两名友方'], [['治疗'], ['群疗', '净化'], ['被动', '持续治疗']]),

  // ---------------- 蛮 ----------------
  man_mengmiaohuo: [
    S('basic', '骨棒', '敌方前排单体', '造成 120% 攻击的物理伤害，并为自身叠加 1 层「图腾」。', ['物伤', '图腾']),
    S('ultimate', '七擒七纵', '敌方单体', '造成 250% 攻击的物理伤害并使其「晕乎乎」1 回合；自身获得「九命」（3 回合内至少保留 1 点生命）。', ['单体', '控制', '免死']),
    S('passive', '不服', '自身', '生命每降低 10%，伤害 +4%、防御 +4%，最多 +40%。', ['被动', '狂暴']),
    S('awaken', '第七次', '自身', '每场战斗中，第 7 次受到攻击时立刻满元气并回复 30% 生命。', ['觉醒']),
  ],
  man_zhurong: FROM_KIT(KITS_SSR.man_zhurong, ['敌方后排单体', '敌方后排', '自身'], [['物伤', '抓痕'], ['多段', '火伤', '灼烧'], ['被动', '回能']]),
  man_mulu: FROM_KIT(KITS_SR.man_mulu, ['随机敌方单体', '每只兽影随机选敌人', '其他蛮势力友方行动'], [['法伤', '图腾'], ['召兽', '抓痕', '蛮·图腾'], ['被动', '个人图腾']]),
  man_wutugu: FROM_KIT(KITS_SR.man_wutugu, ['敌方前排单体', '自身', '自身'], [['物伤', '防御'], ['自疗', '护盾'], ['被动', '受击印记']]),

  // ---------------- 仙 ----------------
  xian_zuoci: [
    S('basic', '幻爪', '敌方单体', '造成 120% 攻击的法术伤害，30% 概率使其「毛线缠」1 回合。', ['法伤', '沉默']),
    S('ultimate', '千幻万象', '敌方全体 + 友方全体', '对敌方全体造成 160% 攻击的法术伤害；友方全体获得「幻象」（闪避下一次攻击）。', ['群伤', '闪避']),
    S('passive', '天命', '自身', '每回合开始 30% 概率触发天命，随机获得其一：额外行动 / 回复 50 点元气 / 无敌 1 回合。', ['被动', '随机']),
    S('awaken', '庄周梦猫', '—', '天命触发率提高到 50%，且每次同时触发两种效果。', ['觉醒']),
  ],
  xian_zhangzhua: FROM_KIT(KITS_SR.xian_zhangzhua, ['随机敌方单体', '敌方全体', '自身'], [['法伤', '符咒'], ['群伤', '毛线缠', '仙·天机'], ['被动', '同袍接力']]),
  xian_shuijing: FROM_KIT(KITS_SR.xian_shuijing, ['生命比例最低的友方', '友方全体', '友方'], [['治疗', '护盾'], ['群疗', '回能'], ['被动', '授课']]),
  wei_simamiyi: FROM_KIT(KITS_SP.wei_simamiyi, ['随机 2 名敌人', '敌方全体 + 友方全体', '全队 + 自身'], [['法伤', '偷元气'], ['群伤', '护盾', '受惊', '魏·铁壁'], ['被动', '护佑', '回能']]),
  shu_pangmiaotong: FROM_KIT(KITS_SP.shu_pangmiaotong, ['随机敌方单体', '敌方全体 + 友方全体', '自身'], [['火伤', '灼烧'], ['群伤', '引爆', '增益'], ['被动', '涅槃']]),
  xian_changmiao: FROM_KIT(KITS_SP.xian_changmiao, ['生命比例最低的 2 名友方', '友方全体', '友方'], [['治疗', '回能'], ['群疗', '护盾', '净化'], ['被动', '复活']]),
  xian_guanlu: FROM_KIT(KITS_SR.xian_guanlu, ['随机敌方单体', '敌方全体 + 友方全体', '敌方元气最高的猫'], [['法伤', '铜钱'], ['随机', '群伤', '护盾'], ['被动', '元气压制']]),
};
