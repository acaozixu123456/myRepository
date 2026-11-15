// 四种光照（白天、清晨、黄昏、夜晚）和对应的界面配色。
export const LIGHT = {
  day:   { skyTop: 0x7fc3ef, skyBot: 0xfdf3dc, sun: 0xfff2d6, sunI: 3.2, sunPos: [-14, 22, 10], hemiS: 0xcfe8ff, hemiG: 0x8a7a5a, hemiI: 1.6, night: 0, leaf: 0.2, rim: [0xfff1d8, 0.32] },
  dusk:  { skyTop: 0x6a6fae, skyBot: 0xffbf8a, sun: 0xffa766, sunI: 2.6, sunPos: [18, 7, -4], hemiS: 0xb7a5d6, hemiG: 0x6b4a3a, hemiI: 1.0, night: 0.45, leaf: 0.08, rim: [0xffc79a, 0.36] },
  dawn:  { skyTop: 0x86a8dc, skyBot: 0xffd9c2, sun: 0xffc9a0, sunI: 2.4, sunPos: [-18, 8, 8], hemiS: 0xc4d0ee, hemiG: 0x7a6455, hemiI: 1.15, night: 0.25, leaf: 0.09, rim: [0xffe2cc, 0.3] },
  night: { skyTop: 0x0b1636, skyBot: 0x2f3f78, sun: 0x9fb6ff, sunI: 0.95, sunPos: [-10, 20, -12], hemiS: 0x5c70b4, hemiG: 0x23233a, hemiI: 1.15, night: 1, leaf: 0.07, rim: [0x9db4ff, 0.42] },
};
// 界面配色令牌（见设计文档 2.4）。白天、清晨、黄昏用暖色奶白面板，夜晚用深蓝半透明面板。
const DAY = { panel: 'rgba(255,248,238,.88)', panelSolid: '#fff8ee', card: '#ffffff', ink: '#4a3b2f', ink2: '#8c7b6b', line: 'rgba(255,255,255,.9)', shade: 'rgba(90,60,30,.14)', accent: '#f0875a', accentInk: '#ffffff', track: 'rgba(74,59,47,.14)' };
export const UI_THEME = {
  day: DAY, dawn: DAY,
  dusk: { ...DAY, panel: 'rgba(255,240,230,.88)', accent: '#e3775a' },
  night: { panel: 'rgba(30,42,68,.84)', panelSolid: '#1e2a44', card: 'rgba(255,255,255,.08)', ink: '#f3eee6', ink2: '#a9b4c8', line: 'rgba(160,180,255,.25)', shade: 'rgba(0,0,10,.35)', accent: '#f2b65e', accentInk: '#2a2030', track: 'rgba(255,255,255,.16)' },
};
