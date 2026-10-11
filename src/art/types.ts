// 猫猫美术描述：一只猫 = 毛色 + 五官 + 体型 + 装束。
// 所有角色立绘都由这份“描述”程序化绘制成 SVG（矢量、2D、手绘质感）。

export type Pattern =
  | 'solid' // 纯色
  | 'tabby' // 虎斑
  | 'tuxedo' // 奶牛/燕尾服（深色+白胸白爪）
  | 'calico' // 三花
  | 'point' // 重点色（暹罗）
  | 'spots' // 豹纹玫瑰斑
  | 'cow' // 奶牛花斑
  | 'shaded'; // 渐层

export interface Coat {
  base: string; // 主毛色
  light: string; // 浅色（口鼻、肚皮、爪套）
  accent?: string; // 辅色（花斑/重点色/渐层色）
  stripe?: string; // 虎斑纹色
  pattern: Pattern;
  pink?: string; // 鼻头/耳内颜色
}

export type EyeStyle = 'round' | 'sharp' | 'sleepy' | 'happy' | 'fierce' | 'calm' | 'wink' | 'wide' | 'keen' | 'cool';
export type EarStyle = 'pointy' | 'fold' | 'tuft' | 'round' | 'big';
export type TailStyle = 'long' | 'bushy' | 'curl' | 'stub' | 'ring';

export type HeadGear =
  | 'none'
  | 'helmetWei' // 魏·玄甲盔
  | 'helmetGeneral' // 将军盔（红缨）
  | 'scholarCap' // 纶巾
  | 'taoistCrown' // 束发道冠
  | 'pheasant' // 雉尾冠（吕布）
  | 'yellowBand' // 黄巾
  | 'boneCrown' // 南蛮骨冠
  | 'featherHeaddress' // 羽冠
  | 'flowerPin' // 步摇花簪
  | 'emperorCrown' // 冕旒
  | 'rattanHelm' // 藤甲盔
  | 'sailorBandana' // 锦帆头巾
  | 'fortuneHat' // 算命先生帽
  | 'lotusCrown' // 莲冠
  | 'tigerHood' // 虎头帽
  | 'ratCap' // 圆鼠耳帽（杂兵）
  | 'hood' // 夜行兜帽（杂兵）
  | 'leafHat'; // 叶帽（杂兵）

export type BodyGear =
  | 'none'
  | 'armorWei' // 玄甲
  | 'armorHeavy' // 重甲
  | 'armorLight' // 轻甲
  | 'robeScholar' // 文士袍
  | 'robeTaoist' // 道袍
  | 'robeSilk' // 华服
  | 'dress' // 裙装
  | 'tribal' // 兽皮
  | 'rattan' // 藤甲
  | 'vest'; // 短褂

export type BackGear = 'none' | 'cape' | 'capeLong' | 'banner' | 'wings' | 'scrollBack' | 'gourd' | 'furCloak' | 'ribbons';

export type WeaponKind =
  | 'none'
  | 'sword' // 长剑
  | 'dualSwords' // 双股剑
  | 'glaive' // 青龙偃月鱼骨刀
  | 'spear' // 蛇矛
  | 'halberd' // 方天画戟
  | 'fan' // 羽扇
  | 'qin' // 古琴
  | 'bow' // 弓
  | 'staff' // 法杖
  | 'mace' // 狼牙骨棒
  | 'whip' // 铁鞭
  | 'knives' // 飞刀
  | 'scroll' // 卷轴
  | 'talisman' // 符箓
  | 'brush' // 巨笔
  | 'drum' // 兽鼓
  | 'coins' // 铜钱
  | 'herbs' // 药草
  | 'shield' // 圆木盾（杂兵）
  | 'boxShield' // 纸箱盾（杂兵）
  | 'crossbow' // 弩（杂兵）
  | 'slingshot' // 弹弓（杂兵）
  | 'dagger' // 单把短刀（杂兵，不带悬浮飞刀）
  | 'coinsPlain'; // 铜钱（无闪星，杂兵）

export interface Palette {
  main: string; // 阵营主色
  sub: string; // 阵营辅色
  trim: string; // 镶边/金属色
  cloth?: string; // 布料色
}

export interface Outfit {
  pal: Palette;
  head?: HeadGear;
  body?: BodyGear;
  back?: BackGear;
  weapon?: WeaponKind;
  /** 旗帜上的阵营字 */
  glyph?: string;
  /** 额外配饰：披风、胡须、眼罩、铃铛、围巾等 */
  extra?: Extra[];
}

export type Extra =
  | 'eyepatch' // 独眼眼罩
  | 'scar' // 脸上刀疤
  | 'beardLong' // 美髯
  | 'beardGoat' // 山羊须
  | 'bell' // 铃铛颈圈
  | 'scarf' // 围巾
  | 'redFace' // 红脸（关羽）
  | 'warPaint' // 战纹
  | 'monocle'
  | 'earring'
  | 'glowEyes'
  | 'tassel';

export interface CatLook {
  coat: Coat;
  eye: { color: string; style: EyeStyle };
  ear: EarStyle;
  tail: TailStyle;
  /** 体宽系数：0.88 纤细 / 1 标准 / 1.18 圆润 */
  build?: number;
  /** 头部大小系数 */
  head?: number;
  /** 毛茸茸（脸颊绒毛） */
  fluffy?: boolean;
  /** 腮红（默认无，更帅气；年轻/萌系角色可开） */
  blush?: boolean;
  outfit: Outfit;
  /** 关闭默认站姿（动画里自行控制）*/
  stance?: boolean;
  /** 是否水平翻转 */
  flip?: boolean;
}
