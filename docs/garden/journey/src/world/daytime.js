// 一天的光：按钟点（0–24）在几组调色之间插值。太阳的方位和高度按时辰走，夕阳仍然落进北偏西的山口；
// 天黑以后由月光接手（主光换成月亮方向）。太阳被远山挡住时（清晨刚出山之前）直射光变弱。
import * as THREE from 'three';
import { U } from './atmo.js';
const _cool = new THREE.Color('#8f9cf0');
import { SKY } from './sky.js';
import { farH } from './land.js';
import { SEA_U } from './sea.js';

const DEG = Math.PI / 180;
const _k = new THREE.Vector3();
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// 各个时段的调色。sunI 是主光强度（夜里是月光），exp 是曝光，stars 星星，water 溪水亮度，birds 鸟叫
const S = {
  night: {
    sun: '#a9bde8', sunI: 0.62, hemiSky: '#3c4e84', hemiGround: '#1e1e28', hemiI: 0.66, fogSun: '#2c3a5e', fogFar: '#1a2341', fogD: 0.0024, fogH: 0.04,
    zenith: '#070a18', mid: '#151c36', glow: '#34497e', cloudLit: '#52648c', cloudShade: '#1a223c', exp: 1.5, stars: 1, water: 0.13, birds: 0, cloud: 0.3,
  },
  dawn: {
    sun: '#ff9f7c', sunI: 0.5, hemiSky: '#6e7ab2', hemiGround: '#3a3442', hemiI: 0.74, fogSun: '#e9a48c', fogFar: '#7d88b6', fogD: 0.0042, fogH: 0.055,
    zenith: '#2a4480', mid: '#8a8ab8', glow: '#ffa282', cloudLit: '#f2b4a2', cloudShade: '#6a6a98', exp: 1.28, stars: 0.3, water: 0.45, birds: 0.5, cloud: 0.42,
  },
  sunrise: {
    sun: '#ffb47e', sunI: 2.0, hemiSky: '#a8b4dc', hemiGround: '#6e5e4e', hemiI: 0.98, fogSun: '#ffc4a0', fogFar: '#a9b1d3', fogD: 0.0038, fogH: 0.05,
    zenith: '#4a6eae', mid: '#c4b8d6', glow: '#ffb48a', cloudLit: '#ffd8be', cloudShade: '#a096ba', exp: 1.08, stars: 0, water: 0.85, birds: 1, cloud: 0.48,
  },
  morning: {
    sun: '#ffe4bc', sunI: 2.9, hemiSky: '#c6d6f2', hemiGround: '#8c8858', hemiI: 1.25, fogSun: '#ffe0b8', fogFar: '#bccbe2', fogD: 0.0025, fogH: 0.04,
    zenith: '#6a9ad8', mid: '#b0c8e8', glow: '#ffe0b0', cloudLit: '#fff6e8', cloudShade: '#b8b4cc', exp: 1.0, stars: 0, water: 1, birds: 1, cloud: 0.45,
  },
  noon: {
    sun: '#fff2dc', sunI: 3.2, hemiSky: '#c4d8f6', hemiGround: '#8a8a56', hemiI: 1.32, fogSun: '#e8eef4', fogFar: '#bccbe6', fogD: 0.0017, fogH: 0.035,
    zenith: '#4f86d0', mid: '#9cc0ea', glow: '#fff0d0', cloudLit: '#ffffff', cloudShade: '#b9c0d4', exp: 0.96, stars: 0, water: 1, birds: 0.8, cloud: 0.4,
  },
  afternoon: {
    sun: '#ffd9a8', sunI: 3.1, hemiSky: '#bfd0f2', hemiGround: '#94844f', hemiI: 1.3, fogSun: '#ffcf98', fogFar: '#b4c0dc', fogD: 0.0019, fogH: 0.035,
    zenith: '#6c98d4', mid: '#a8bde0', glow: '#ffc98a', cloudLit: '#fff1dc', cloudShade: '#b5a8c4', exp: 1.0, stars: 0, water: 1, birds: 1, cloud: 0.5,
  },
  golden: {
    sun: '#ffa66a', sunI: 2.45, hemiSky: '#b6b8e2', hemiGround: '#8a6e4c', hemiI: 0.95, fogSun: '#ffae7c', fogFar: '#b2aed0', fogD: 0.0019, fogH: 0.035,
    zenith: '#5b7ec2', mid: '#b4b2d8', glow: '#ffa46e', cloudLit: '#ffd2ae', cloudShade: '#a898bc', exp: 1.0, stars: 0, water: 1, birds: 0.8, cloud: 0.5,
  },
  sunset: {
    sun: '#ff8c56', sunI: 1.55, hemiSky: '#9e9ed2', hemiGround: '#6a5048', hemiI: 0.86, fogSun: '#ff9c70', fogFar: '#9c94c2', fogD: 0.0021, fogH: 0.037,
    zenith: '#46669e', mid: '#b49cc0', glow: '#ff8c5c', cloudLit: '#ffb48e', cloudShade: '#8a7aa6', exp: 1.08, stars: 0, water: 0.88, birds: 0.5, cloud: 0.48,
  },
  dusk: {
    sun: '#d68e92', sunI: 0.36, hemiSky: '#6870a8', hemiGround: '#363042', hemiI: 0.74, fogSun: '#c4827c', fogFar: '#5c6498', fogD: 0.0024, fogH: 0.04,
    zenith: '#1c2e60', mid: '#585a92', glow: '#e8866c', cloudLit: '#c08c92', cloudShade: '#4a4a74', exp: 1.32, stars: 0.4, water: 0.34, birds: 0.1, cloud: 0.4,
  },
};
for (const s of Object.values(S)) for (const k in s) if (typeof s[k] === 'string') s[k] = new THREE.Color(s[k]);

// 钟点 → 时段
const KEYS = [[0, 'night'], [4.4, 'night'], [5.4, 'dawn'], [6.3, 'sunrise'], [7.8, 'morning'], [11.5, 'noon'], [15, 'afternoon'], [17.3, 'golden'], [18.5, 'sunset'], [19.3, 'dusk'], [20.4, 'night'], [24, 'night']];
// 太阳：钟点 → [方位角（从正北顺时针，度）, 仰角（度）]。早上从东南偏南的山后出来，傍晚落进北偏西的山口
const SUNK = [[3.5, 170, -24], [5.4, 158, -6], [6.3, 150, 2], [7.8, 132, 14], [11.5, 72, 50], [15, 14, 28], [17.3, -12, 13.5], [18.5, -16, 3.5], [19.3, -18, -3.5], [20.4, -22, -12], [22, -30, -24]];
// 月亮：一夜从东边升到南边再往西
const MOONK = [[18, 80, 4], [20.4, 96, 18], [0, 150, 42], [4.4, 205, 22], [7, 232, 4]];

// 一天里的几个时辰（时间按钮按顺序跳）
export const PERIODS = [
  { name: '清晨', at: 5.7 }, { name: '上午', at: 8.4 }, { name: '正午', at: 12 }, { name: '午后', at: 15.3 }, { name: '黄昏', at: 17.6 }, { name: '夜晚', at: 20.8 },
];
export function periodOf(h) {
  let p = PERIODS[PERIODS.length - 1];
  for (const q of PERIODS) if (h >= q.at - 0.3) p = q;
  if (h < PERIODS[0].at - 0.3) p = PERIODS[PERIODS.length - 1];
  return p;
}

function keyAt(keys, h) {
  for (let i = 0; i < keys.length - 1; i++) if (h >= keys[i][0] && h <= keys[i + 1][0]) return [keys[i], keys[i + 1], sstep(keys[i][0], keys[i + 1][0], h)];
  return [keys[0], keys[0], 0];
}
const dirOf = (az, el, out) => out.set(Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), -Math.cos(az * DEG) * Math.cos(el * DEG));
export function sunAngles(h) {
  h = ((h % 24) + 24) % 24;
  if (h < SUNK[0][0]) return [SUNK[0][1], -24];
  if (h > SUNK[SUNK.length - 1][0]) return [SUNK[SUNK.length - 1][1], -24];
  const [a, b, t] = keyAt(SUNK, h);
  return [lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
function moonAngles(h) {
  const hh = h < 12 ? h + 24 : h;          // 傍晚到第二天早上连成一段
  const ks = MOONK.map(([t, az, el]) => [t < 12 ? t + 24 : t, az, el]);
  if (hh <= ks[0][0]) return [ks[0][1], ks[0][2]];
  if (hh >= ks[ks.length - 1][0]) return [ks[ks.length - 1][1], ks[ks.length - 1][2]];
  const [a, b, t] = keyAt(ks, hh);
  return [lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export class DayLight {
  // o: { sun: DirectionalLight, hemi, renderer, water: 溪水 mesh }
  constructor(o) {
    Object.assign(this, o);
    this.st = {}; for (const k in S.noon) this.st[k] = S.noon[k] instanceof THREE.Color ? new THREE.Color() : 0;
    this.sunPos = new THREE.Vector3(); this.moonPos = new THREE.Vector3();
    this.h = -1; this.horiz = 7; this.horizAt = null; this.horizT = 0;
    if (this.water) { const u = this.water.material.uniforms; this.wBase = { s: u.uShallow.value.clone(), d: u.uDeep.value.clone(), f: u.uFoam.value.clone() }; }
    // 替身树的环境光 = 半球光颜色 × 强度 × 这个系数（按原来下午的样子定）
    const k = (a, b, i) => new THREE.Vector3(a.r / (b.r * i), a.g / (b.g * i), a.b / (b.b * i));
    this.kA = k(U.uAmb.value, new THREE.Color('#bfd0f2'), 1.3); this.kG = k(U.uAmbG.value, new THREE.Color('#94844f'), 1.3);
    this.night = 0; this.moonW = 0;
  }
  // 太阳方向上远山的地平线仰角（度），从 eye 往外取几处远景高度
  horizon(eye, az) {
    const dx = Math.sin(az * DEG), dz = -Math.cos(az * DEG);
    let m = -10;
    for (const d of [90, 180, 320, 520, 760, 1050, 1400, 1850, 2400, 3100]) {
      const h = farH(eye.x + dx * d, eye.z + dz * d) - (eye.y + 1.6);
      m = Math.max(m, Math.atan2(h, d) / DEG);
    }
    return m;
  }
  // h：钟点；eye：人的位置（算远山挡太阳）
  apply(h, eye, dt = 0) {
    h = ((h % 24) + 24) % 24;
    const [ka, kb, t] = keyAt(KEYS, h), A = S[ka[1]], B = S[kb[1]], st = this.st;
    for (const k in st) st[k] = st[k] instanceof THREE.Color ? st[k].copy(A[k]).lerp(B[k], t) : lerp(A[k], B[k], t);
    const [saz, sel] = sunAngles(h), [maz, mel] = moonAngles(h);
    dirOf(saz, sel, this.sunPos); dirOf(maz, mel, this.moonPos);
    // 远山挡住太阳：每隔一会儿重算一次地平线
    this.horizT -= dt;
    if (eye && (this.horizT <= 0 || !this.horizAt || Math.abs(this.horizAt.az - saz) > 2 || this.horizAt.p.distanceToSquared(eye) > 400)) {
      this.horiz = this.horizon(eye, saz); this.horizT = 1.5;
      this.horizAt = { az: saz, p: (this.horizAt?.p || new THREE.Vector3()).copy(eye) };
    }
    const vis = sstep(this.horiz - 1.2, this.horiz + 1.6, sel);
    // 主光：太阳落到地平线下以后慢慢转到月亮（转的时候光很弱，雾里朝光的一边也跟着慢慢挪过去）
    const w = this.moonW = sstep(-1.5, -6, sel) * sstep(-1, 6, mel);
    const key = _k.copy(this.sunPos).lerp(this.moonPos, w).normalize();
    const sunI = st.sunI * lerp(lerp(0.16, 1, vis) * (1 - sstep(-1.5, -4.5, sel)), sstep(-1, 8, mel), w);
    this.night = sstep(-3, -12, sel);
    U.uSunDir.value.copy(key);
    U.uSunColor.value.copy(st.sun).multiplyScalar(Math.max(0.12, sunI / 3.1));
    U.uFogSun.value.copy(st.fogSun); U.uFogFar.value.copy(st.fogFar);
    U.uFogDensity.value = st.fogD; U.uFogHeight.value = st.fogH;
    SKY.uZenith.value.copy(st.zenith); SKY.uMid.value.copy(st.mid); SKY.uSunGlow.value.copy(st.glow);
    SKY.uCloudLit.value.copy(st.cloudLit); SKY.uCloudShade.value.copy(st.cloudShade);
    SKY.uSunPos.value.copy(this.sunPos); SKY.uMoonDir.value.copy(this.moonPos);
    SKY.uCloudCover.value = st.cloud; SKY.uStars.value = st.stars; SKY.uSunVis.value = vis; SKY.uMoonI.value = sstep(0, 8, mel) * Math.max(st.stars, this.night * 0.8);
    this.sun.color.copy(st.sun); this.sun.intensity = sunI;
    this.hemi.color.copy(st.hemiSky); this.hemi.groundColor.copy(st.hemiGround); this.hemi.intensity = st.hemiI;
    // 天光更亮更偏蓝紫：影子里透着冷色，而不是一片深褐；主光稍微收一点保持总亮度（夜里不动）
    { const d = 1 - this.night; this.hemi.color.lerp(_cool, 0.35 * d); this.hemi.intensity *= 1 + 0.38 * d; this.sun.intensity *= 1 - 0.06 * d; }
    const a = U.uAmb.value, g = U.uAmbG.value, hs = st.hemiSky, hg = st.hemiGround, hi = st.hemiI;
    a.setRGB(hs.r * hi * this.kA.x, hs.g * hi * this.kA.y, hs.b * hi * this.kA.z); g.setRGB(hg.r * hi * this.kG.x, hg.g * hi * this.kG.y, hg.b * hi * this.kG.z);
    if (this.renderer) this.renderer.toneMappingExposure = st.exp;
    if (this.water && this.wBase) { const u = this.water.material.uniforms, b = this.wBase; u.uShallow.value.copy(b.s).multiplyScalar(st.water); u.uDeep.value.copy(b.d).multiplyScalar(st.water); u.uFoam.value.copy(b.f).multiplyScalar(st.water * st.water); }
    SEA_U.uDay.value = st.water;
    this.h = h;
    return st;
  }
}
