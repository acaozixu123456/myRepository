// 天气：晴、多云、小雨、起雾、下雪。默认“随天”——过一阵换一种（清晨容易起雾，海边雾多，雪山上下的是雪）；
// 也可以在右上角定成某一种。天气只是在一天的光上再调一调：阴天把天和光压灰、太阳藏进云里，
// 起雾把雾拉浓，下雨地面慢慢变湿变深、海面打出小圈，下雪草地上慢慢盖一层薄雪；雨丝和雪花都只在镜头周围一块地方（着色器里循环）。
import * as THREE from 'three';
import { U } from './atmo.js';
import { SKY } from './sky.js';
import { SEA_U } from './sea.js';

export const WEATHERS = [
  { id: 'clear', name: '晴' }, { id: 'cloudy', name: '多云' }, { id: 'rain', name: '小雨' }, { id: 'fog', name: '起雾' }, { id: 'snow', name: '下雪' },
];
export const wxName = id => WEATHERS.find(w => w.id === id)?.name || '晴';
// 每种天气：阴（云多厚）、雨、雾、雪
const TARGET = {
  clear: { o: 0, r: 0, f: 0, s: 0 },
  cloudy: { o: 0.6, r: 0, f: 0.08, s: 0 },
  rain: { o: 0.92, r: 1, f: 0.22, s: 0 },
  fog: { o: 0.42, r: 0, f: 1, s: 0 },
  snow: { o: 0.8, r: 0, f: 0.3, s: 1 },
};
const lerp = (a, b, t) => a + (b - a) * t;
const _c = new THREE.Color(), _g = new THREE.Color();
const grey = (c, k, dim = 1) => { const l = c.r * 0.3 + c.g * 0.55 + c.b * 0.15; _g.setRGB(l * dim, l * dim * 1.01, l * dim * 1.05); return c.lerp(_g, k); };

// 雨丝：竖着的细长条，跟着镜头的一个盒子里循环往下落，被风吹得有点斜
const RAIN_VS = /* glsl */`
attribute vec4 aSeed; uniform float uTime; uniform vec3 uCam; uniform float uAmt; uniform float uBox;
varying float vA; varying float vY;
void main() {
  float B = uBox, H = 22.0;
  vec3 base = aSeed.xyz * vec3( B, H, B );
  float fall = uTime * ( 9.0 + aSeed.w * 4.0 );
  vec3 p = vec3( base.x + fall * 0.12, base.y - fall, base.z + fall * 0.05 );
  p = mod( p - uCam + vec3( B * 0.5, H * 0.45, B * 0.5 ), vec3( B, H, B ) ) + uCam - vec3( B * 0.5, H * 0.45, B * 0.5 );
  // 竖条：position.x 是左右（-1,1），position.y 是上下（0,1）
  vec3 toCam = normalize( vec3( cameraPosition.x - p.x, 0.0, cameraPosition.z - p.z ) + 1e-4 );
  vec3 side = vec3( toCam.z, 0.0, -toCam.x );
  vec3 dir = normalize( vec3( 0.12, -1.0, 0.05 ) );
  float len = 0.55 + aSeed.w * 0.35;
  float dc = length( p - cameraPosition );
  // 远处的雨丝加宽一点（不然细得看不见、还闪）
  vec3 wp = p + side * position.x * ( 0.01 + dc * 0.0016 ) - dir * position.y * len;
  vY = position.y;
  float d = length( wp - uCam );
  // 只有一部分雨丝在下（雨小的时候少）；贴着镜头的不画
  vA = uAmt * step( aSeed.w, uAmt * 1.05 ) * smoothstep( 1.2, 3.5, dc ) * ( 1.0 - smoothstep( uBox * 0.3, uBox * 0.5, d ) );
  gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
  if ( vA < 0.003 ) gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 );
}`;
const RAIN_FS = /* glsl */`
uniform vec3 uAmb; uniform vec3 uSunColor;
varying float vA; varying float vY;
void main() {
  float a = vA * 0.42 * sin( vY * 3.14159 );
  gl_FragColor = vec4( ( uAmb * 1.1 + uSunColor * 0.2 + vec3( 0.1 ) ), a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
// 雪花：软软的白点，慢慢飘，左右晃
const SNOW_VS = /* glsl */`
attribute vec4 aSeed; uniform float uTime; uniform vec3 uCam; uniform float uAmt; uniform float uBox; uniform float uPx;
varying float vA;
void main() {
  float B = uBox, H = 14.0;
  vec3 base = aSeed.xyz * vec3( B, H, B );
  float t = uTime, ph = aSeed.w * 40.0;
  float fall = t * ( 0.9 + aSeed.w * 0.7 );
  vec3 p = vec3( base.x + sin( t * 0.7 + ph ) * 0.6 + t * 0.3, base.y - fall, base.z + cos( t * 0.55 + ph * 1.3 ) * 0.6 );
  p = mod( p - uCam + vec3( B * 0.5, H * 0.45, B * 0.5 ), vec3( B, H, B ) ) + uCam - vec3( B * 0.5, H * 0.45, B * 0.5 );
  vec4 mv = viewMatrix * vec4( p, 1.0 );
  float d = max( -mv.z, 0.1 );
  vA = uAmt * step( aSeed.w, uAmt * 1.05 ) * smoothstep( 0.4, 1.5, d ) * ( 1.0 - smoothstep( uBox * 0.3, uBox * 0.5, d ) );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp( uPx * 0.085 * ( 0.7 + 0.6 * fract( aSeed.w * 7.0 ) ) / d, 1.5, 32.0 );
  if ( vA < 0.01 ) gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 );
}`;
const SNOW_FS = /* glsl */`
uniform vec3 uAmb; uniform vec3 uSunColor;
varying float vA;
void main() {
  float r = length( gl_PointCoord - 0.5 ) * 2.0;
  float a = ( 1.0 - smoothstep( 0.3, 1.0, r ) ) * vA * 0.9;
  if ( a < 0.01 ) discard;
  gl_FragColor = vec4( vec3( 0.96, 0.98, 1.0 ) * ( uAmb * 0.95 + uSunColor * 0.35 + vec3( 0.08 ) ), a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function makeRain(n) {
  const pos = [], seed = [], idx = [];
  for (let i = 0; i < n; i++) {
    const s = [Math.random(), Math.random(), Math.random(), Math.random()];
    for (const [x, y] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) { pos.push(x, y, 0); seed.push(...s); }
    const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 4));
  g.setIndex(idx);
  const m = new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uAmb: U.uAmb, uSunColor: U.uSunColor, uCam: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uBox: { value: 36 } },
    vertexShader: RAIN_VS, fragmentShader: RAIN_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.name = 'rain'; mesh.visible = false;
  return mesh;
}
function makeSnow(n) {
  const pos = new Float32Array(n * 3), seed = [];
  for (let i = 0; i < n; i++) seed.push(Math.random(), Math.random(), Math.random(), Math.random());
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 4));
  const m = new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uAmb: U.uAmb, uSunColor: U.uSunColor, uCam: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uBox: { value: 26 }, uPx: { value: 1000 } },
    vertexShader: SNOW_VS, fragmentShader: SNOW_FS, transparent: true, depthWrite: false });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 6; pts.name = 'snowfall'; pts.visible = false;
  return pts;
}

export class Weather {
  constructor() {
    this.kind = 'clear';        // 现在（或者正要变成）的天气
    this.lock = null;           // 定住的天气（null = 随天）
    this.k = { o: 0, r: 0, f: 0, s: 0 };   // 现在的程度（慢慢靠向目标）
    this.wet = 0; this.cover = 0;          // 地面湿了多少、积了多少雪
    this.nextH = 3;                        // 再过几个钟头换天气
    this.local = { snow: 0, coast: 0, valley: 1 };
    this.group = new THREE.Group(); this.group.name = 'weather';
    this.rain = makeRain(1500); this.snow = makeSnow(3000);
    this.group.add(this.rain, this.snow);
    this.onChange = null;
  }
  get id() { return this.lock || this.kind; }
  set(id) { this.lock = id; if (id) this.kind = id; }
  // 随天：按时辰和地方挑下一种
  pick(tod) {
    const L = this.local, morning = tod > 4.5 && tod < 9.5;
    const w = { clear: 0.42, cloudy: 0.25, rain: 0.15, fog: 0.08 + (morning ? 0.18 : 0) + L.coast * 0.1, snow: 0.04 + L.snow * 0.3 };
    w[this.kind] *= 0.35;                  // 不太会连着两回一样
    let sum = 0; for (const v of Object.values(w)) sum += v;
    let u = Math.random() * sum;
    for (const [id, v] of Object.entries(w)) { u -= v; if (u <= 0) return id; }
    return 'clear';
  }
  // 时间过了 dh 个钟头
  tick(dh, tod) {
    if (this.lock) { this.kind = this.lock; return; }
    this.nextH -= dh;
    if (this.nextH <= 0) {
      const prev = this.kind;
      this.kind = this.pick(tod);
      this.nextH = (this.kind === 'clear' ? 2.5 : 1.6) + Math.random() * 2.5;
      if (this.kind !== prev) this.onChange?.(this.kind, prev);
    }
  }
  // 每帧：程度慢慢变过去，再把天、光、雾调一调（在一天的光之后调用）
  apply(day, dt, focus, px) {
    const T = TARGET[this.kind], k = this.k, a = 1 - Math.exp(-dt / 14), b = 1 - Math.exp(-dt / 6);
    // 这里是雪山：下雨就是下雪；海边雾大一点
    const cold = this.local.snow;
    const tr = T.r * (1 - cold), ts = Math.max(T.s, T.r * cold);
    k.o += (T.o - k.o) * a; k.f += (Math.min(1, T.f + this.local.coast * 0.15 * T.f) - k.f) * a;
    k.r += (tr - k.r) * b; k.s += (ts - k.s) * b;
    // 地面：下雨一两分钟湿透，停了慢慢干；下雪慢慢积起来（不下了慢慢化）
    this.wet += ((k.r > 0.3 ? 1 : 0) - this.wet) * (1 - Math.exp(-dt / (k.r > 0.3 ? 50 : 140)));
    this.cover += ((k.s > 0.3 ? 0.8 : 0) - this.cover) * (1 - Math.exp(-dt / (k.s > 0.3 ? 90 : 160)));
    const o = k.o, f = k.f, st = day.st;
    // 天：阴天云厚、颜色发灰；太阳和星星藏起来
    SKY.uCloudCover.value = lerp(SKY.uCloudCover.value, 1.55, o * 0.85);
    for (const u of [SKY.uZenith, SKY.uMid, SKY.uSunGlow]) grey(u.value, o * 0.78, 0.92);
    grey(SKY.uCloudLit.value, o * 0.7, 0.86); grey(SKY.uCloudShade.value, o * 0.6, 0.8);
    SKY.uOvercast.value = o;
    SKY.uStars.value *= 1 - o * 0.95; SKY.uMoonI.value *= 1 - o * 0.9;
    // 光：太阳弱下去，天光多一点；树影淡了
    const dim = Math.max(0.1, 1 - 0.88 * o - 0.35 * f);
    day.sun.intensity *= dim;
    U.uSunColor.value.multiplyScalar(Math.max(0.2, 1 - 0.7 * o - 0.3 * f));
    grey(U.uAmb.value, o * 0.5); grey(U.uAmbG.value, o * 0.3);
    grey(day.hemi.color, o * 0.5); grey(day.hemi.groundColor, o * 0.3);
    day.hemi.intensity *= 1 + 0.3 * o + 0.15 * f;
    U.uAmb.value.multiplyScalar(1 + 0.3 * o + 0.15 * f); U.uAmbG.value.multiplyScalar(1 + 0.3 * o + 0.15 * f);
    U.uGoboStrength.value = 0.85 * (1 - 0.85 * o);
    if (day.renderer) day.renderer.toneMappingExposure = st.exp * (1 + 0.12 * o + 0.05 * f);
    // 雾：浓雾一百来米外就看不清了，颜色发白（朝太阳那边也不暖了）
    const fogC = _c.copy(U.uFogFar.value); grey(fogC, 0.7, 1.08);
    U.uFogFar.value.lerp(fogC, Math.max(f, o * 0.6));
    U.uFogSun.value.lerp(U.uFogFar.value, Math.max(f * 0.85, o * 0.75));
    U.uFogDensity.value = lerp(U.uFogDensity.value, 0.026, f * f) + 0.0016 * o;
    U.uFogHeight.value = lerp(U.uFogHeight.value, 0.012, f);
    U.uHaze.value = 0.00032 + 0.0035 * f * f + 0.0004 * o;
    U.uWet.value = this.wet; U.uSnowCover.value = this.cover;
    U.uWind.value = 1 + 0.7 * k.r + 0.4 * k.s + 0.3 * o;
    SEA_U.uRain.value = k.r; SEA_U.uOvercast.value = o;
    // 雨丝、雪花跟着镜头
    this.rain.visible = k.r > 0.02; this.snow.visible = k.s > 0.02;
    this.rain.material.uniforms.uAmt.value = k.r; this.rain.material.uniforms.uCam.value.copy(focus);
    this.snow.material.uniforms.uAmt.value = k.s; this.snow.material.uniforms.uCam.value.copy(focus); this.snow.material.uniforms.uPx.value = px || 1000;
  }
  // 存档
  snapshot() { return { kind: this.kind, lock: this.lock, next: Math.round(this.nextH * 100) / 100, wet: Math.round(this.wet * 100) / 100, cover: Math.round(this.cover * 100) / 100 }; }
  restore(s) {
    if (!s || typeof s !== 'object') return;
    const ok = id => WEATHERS.some(w => w.id === id);
    this.kind = ok(s.kind) ? s.kind : 'clear'; this.lock = ok(s.lock) ? s.lock : null;
    this.nextH = Number.isFinite(+s.next) ? Math.max(0.3, +s.next) : 2;
    this.wet = Math.min(1, Math.max(0, +s.wet || 0)); this.cover = Math.min(0.8, Math.max(0, +s.cover || 0));
    // 一进来就是那种天气（不用等它慢慢变）
    Object.assign(this.k, TARGET[this.kind]);
  }
  // 现在的天气立刻到位（截图、读档用）
  settle() { Object.assign(this.k, TARGET[this.kind]); const c = this.local.snow; this.k.s = Math.max(this.k.s, this.k.r * c); this.k.r *= 1 - c; this.wet = this.k.r > 0.3 ? 1 : this.wet; this.cover = this.k.s > 0.3 ? 0.6 : this.cover; }
}
