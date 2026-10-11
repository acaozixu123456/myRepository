import type { Palette } from '../art/types';

export type FactionId = 'wei' | 'shu' | 'wu' | 'qun' | 'man' | 'xian';

export interface Faction {
  id: FactionId;
  name: string; // 阵营名
  glyph: string; // 旗帜字
  motto: string; // 口号
  full: string; // 全称
  land: string; // 领地
  role: string; // 定位
  mechanic: string; // 阵营机制名
  mechanicDesc: string;
  counters: FactionId; // 克制谁
  color: string; // 主题色
  pal: Palette;
  breeds: string; // 代表猫种
  vibe: string; // 一句话气质
}

export const FACTIONS: Record<FactionId, Faction> = {
  wei: {
    id: 'wei',
    name: '魏',
    glyph: '魏',
    full: '玄甲猫军',
    motto: '令行禁止，铁壁如山',
    land: '北境·铁爪关',
    role: '守护 · 控场',
    mechanic: '铁壁',
    mechanicDesc: '护盾与减伤体系。每回合开始为血量最低的魏势力友方添加「护体毛」，护盾量随场上魏势力猫猫数量提升。',
    counters: 'qun',
    color: '#3f63ad',
    pal: { main: '#3f63ad', sub: '#26397a', trim: '#e6c25a', cloth: '#e8edf7' },
    breeds: '英短蓝猫 · 俄罗斯蓝猫 · 苏格兰折耳',
    vibe: '纪律严明的蓝灰色正规军，连打哈欠都要列队。',
  },
  shu: {
    id: 'shu',
    name: '蜀',
    glyph: '蜀',
    full: '仁义猫盟',
    motto: '同饮一碗水，共守一片瓦',
    land: '西川·喵都',
    role: '治疗 · 增益',
    mechanic: '桃园',
    mechanicDesc: '互助与复活体系。蜀势力猫猫阵亡时，全体蜀友方获得「炸毛」并回复生命；队伍里蜀势力越多，治疗与暴击越高。',
    counters: 'man',
    color: '#4f9e5e',
    pal: { main: '#4f9e5e', sub: '#2a6040', trim: '#e6c25a', cloth: '#f2efdc' },
    breeds: '橘猫 · 狸花猫 · 三花猫',
    vibe: '一碗猫粮分着吃的暖心大家庭，眼神永远亮晶晶。',
  },
  wu: {
    id: 'wu',
    name: '吴',
    glyph: '吴',
    full: '赤焰水师',
    motto: '借东风，烧连环',
    land: '东南·鱼骨湾',
    role: '法攻 · 持续伤害',
    mechanic: '赤壁',
    mechanicDesc: '灼烧与湿透联动。吴势力的火焰技能对「湿透」目标额外造成伤害；灼烧每叠一层，爆燃时追加一次伤害。',
    counters: 'xian',
    color: '#d6483c',
    pal: { main: '#d6483c', sub: '#8c2a28', trim: '#e6c25a', cloth: '#fbeee4' },
    breeds: '暹罗猫 · 孟加拉豹猫 · 金渐层',
    vibe: '爱玩水、爱玩火的海盗派，一言不合就放把火。',
  },
  qun: {
    id: 'qun',
    name: '群',
    glyph: '群',
    full: '乱世群英',
    motto: '天下大乱，爪下见真章',
    land: '中原·无主之地',
    role: '爆发 · 单点',
    mechanic: '乱世',
    mechanicDesc: '混搭友好。队伍中每多一个不同阵营，群势力猫猫的暴击伤害提升；击杀敌人时返还元气并追加一次攻击。',
    counters: 'shu',
    color: '#7d5aa8',
    pal: { main: '#7d5aa8', sub: '#463066', trim: '#e6c25a', cloth: '#efe6f4' },
    breeds: '黑猫 · 玳瑁猫 · 奶牛猫',
    vibe: '谁也不服谁的独行猫，只信自己的爪子。',
  },
  man: {
    id: 'man',
    name: '蛮',
    glyph: '蛮',
    full: '南蛮猫寨',
    motto: '山是爪，林是牙',
    land: '南疆·喵蛮山',
    role: '狂暴 · 召唤',
    mechanic: '图腾',
    mechanicDesc: '野性体系。生命越低攻击越高；「抓痕」与普攻为蛮势力猫猫积累「图腾」，满层召唤山林猛兽助战。',
    counters: 'wu',
    color: '#e0902c',
    pal: { main: '#e0902c', sub: '#7a4f26', trim: '#f4ead0', cloth: '#d8c9a0' },
    breeds: '豹猫 · 狞猫 · 缅因猫',
    vibe: '住在树上的野性大猫，饭要抢着吃才香。',
  },
  xian: {
    id: 'xian',
    name: '仙',
    glyph: '仙',
    full: '天机玄门',
    motto: '三分天命，七分爪功',
    land: '云端·喵山观',
    role: '辅助 · 封印',
    mechanic: '天机',
    mechanicDesc: '符箓体系。仙势力技能附带「毛线缠」「符咒」，并有概率触发「天命」：额外行动、回复元气或抵挡一次致命伤害。',
    counters: 'wei',
    color: '#2fa6a1',
    pal: { main: '#2fa6a1', sub: '#1d6370', trim: '#f1d98a', cloth: '#f3f7f2' },
    breeds: '布偶猫 · 白猫 · 波斯猫',
    vibe: '看不懂但很厉害的玄学派，据说能看见别人看不见的小飞虫。',
  },
};

export const FACTION_ORDER: FactionId[] = ['wei', 'shu', 'wu', 'qun', 'man', 'xian'];
