// 场景氛围：天空 / 雾 / 光 / 调色 / 泛光的整套参数（纯数据）。每个场景有自己的时间与天气：
// 街区是赛博雨夜，夜市是黄昏的暖光，港口是晚霞，森林是清晨，云岛是正午，宫阙是午后金光——不再千篇一律都是暗色霓虹。
export type MoodId = 'neon' | 'street' | 'market' | 'redcliff' | 'forest' | 'mist' | 'palace' | 'meadow';
export interface Atmos {
  /** 天空穹顶（false = 沿用纯色背景，街区的暗夜不用穹顶） */
  dome: boolean;
  skyTop: number; skyMid: number; horizon: number;
  /** 太阳 / 月亮的光盘颜色与大小 */
  discColor: number; discSize: number;
  fog: number; fogD: number;
  hemiSky: number; hemiGnd: number; hemiI: number;
  sun: number; sunI: number; sunPos: [number, number, number];
  exposure: number; env: number;
  bloom: [number, number, number]; // 强度 / 半径 / 阈值
  /** 调色：cool = 暗部偏青、亮部偏品红的赛博味（0~1）；ca = 边缘色散；vig = 暗角；sat = 饱和度；tint = 整体色偏 */
  grade: { cool: number; ca: number; vig: number; sat: number; tint: [number, number, number] };
  /** 跟着队伍的暖光强度（白天要弱，夜里要强） / 猫的光色中性化强度 */
  keyLight: number; lit: number;
}

const NEON: Atmos = {
  dome: false, skyTop: 0x0a0618, skyMid: 0x1a1030, horizon: 0x2a1448, discColor: 0x8aa4ff, discSize: 0,
  fog: 0x1a1030, fogD: 0.0075, hemiSky: 0x5a68d0, hemiGnd: 0x1c1030, hemiI: 0.5, sun: 0x8aa4ff, sunI: 0.6, sunPos: [-30, 50, 24],
  exposure: 1.05, env: 0.2, bloom: [0.72, 0.55, 0.78], grade: { cool: 1, ca: 0.014, vig: 1.25, sat: 1, tint: [1, 1, 1] }, keyLight: 2.3, lit: 0.7,
};
export const ATMOS: Record<MoodId, Atmos> = {
  neon: NEON, street: NEON, meadow: NEON,
  // 夜市：黄昏，天边橘粉，灯笼刚亮
  market: {
    dome: true, skyTop: 0x4a4a9a, skyMid: 0xe0788a, horizon: 0xffb878, discColor: 0xffd8a0, discSize: 0.05,
    fog: 0xd89080, fogD: 0.0048, hemiSky: 0xffc0a0, hemiGnd: 0x5a3a48, hemiI: 1.0, sun: 0xffb070, sunI: 2.1, sunPos: [-50, 26, -34],
    exposure: 1.1, env: 0.4, bloom: [0.5, 0.5, 0.85], grade: { cool: 0.1, ca: 0.004, vig: 0.8, sat: 1.12, tint: [1.06, 0.98, 0.92] }, keyLight: 0.7, lit: 0.4,
  },
  // 港口：赤壁的晚霞，天红水红
  redcliff: {
    dome: true, skyTop: 0x2a2a6a, skyMid: 0xc84060, horizon: 0xff9040, discColor: 0xffc070, discSize: 0.07,
    fog: 0xe0704c, fogD: 0.0052, hemiSky: 0xffa080, hemiGnd: 0x40242c, hemiI: 0.95, sun: 0xff7a3a, sunI: 2.3, sunPos: [44, 20, -38],
    exposure: 1.1, env: 0.45, bloom: [0.55, 0.5, 0.82], grade: { cool: 0.08, ca: 0.004, vig: 0.9, sat: 1.15, tint: [1.08, 0.96, 0.9] }, keyLight: 1.1, lit: 0.45,
  },
  // 森林：清晨，阳光从树冠漏下来
  forest: {
    dome: true, skyTop: 0x4aa8e8, skyMid: 0x9ad8f0, horizon: 0xe8f8d0, discColor: 0xfff4c8, discSize: 0.045,
    fog: 0xc4ecc8, fogD: 0.0042, hemiSky: 0xdaf4ff, hemiGnd: 0x3a5a40, hemiI: 1.15, sun: 0xfff0c0, sunI: 2.7, sunPos: [34, 62, 26],
    exposure: 1.0, env: 0.5, bloom: [0.32, 0.5, 0.92], grade: { cool: 0, ca: 0, vig: 0.7, sat: 1.14, tint: [1.02, 1.03, 0.97] }, keyLight: 0.55, lit: 0.3,
  },
  // 云岛：正午，云海之上
  mist: {
    dome: true, skyTop: 0x5a9ae8, skyMid: 0xa8d0ff, horizon: 0xfff4ec, discColor: 0xffffff, discSize: 0.05,
    fog: 0xe4eeff, fogD: 0.0036, hemiSky: 0xeaf4ff, hemiGnd: 0x9ab0d8, hemiI: 1.35, sun: 0xfff8e8, sunI: 2.5, sunPos: [-22, 70, 30],
    exposure: 1.02, env: 0.6, bloom: [0.38, 0.5, 0.9], grade: { cool: 0, ca: 0, vig: 0.65, sat: 1.1, tint: [1, 1.01, 1.03] }, keyLight: 0.45, lit: 0.25,
  },
  // 宫阙：午后金光，朱墙金瓦
  palace: {
    dome: true, skyTop: 0x3a86d8, skyMid: 0x8cc8f0, horizon: 0xffecd0, discColor: 0xfff0c0, discSize: 0.05,
    fog: 0xf0e0c8, fogD: 0.0034, hemiSky: 0xfff0dc, hemiGnd: 0x8a5a4a, hemiI: 1.1, sun: 0xffe8b0, sunI: 2.9, sunPos: [42, 55, 32],
    exposure: 1.02, env: 0.5, bloom: [0.4, 0.5, 0.9], grade: { cool: 0, ca: 0, vig: 0.7, sat: 1.18, tint: [1.04, 1.0, 0.95] }, keyLight: 0.55, lit: 0.3,
  },
};
export const atmosOf = (m: string): Atmos => ATMOS[m as MoodId] ?? NEON;
