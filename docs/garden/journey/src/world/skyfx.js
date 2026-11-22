// 天上的小惊喜：雨刚停、太阳出来的时候，背对太阳会挂一道彩虹；晴天的夜里时不时划过一颗流星。
// 都是跟着镜头的远处一片面（不写深度），按方向算颜色，画在天空之后、地形之前：远山会挡住彩虹的下半截。
import * as THREE from 'three';
import { U } from './atmo.js';
import { SKY } from './sky.js';

const D = 1600;    // 离镜头多远

const RB_VS = /* glsl */`
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
// vP 是平面上的坐标（米）；半径换成离反日点的角度，主虹 42°、副虹 51°（颜色反过来、淡很多）
const RB_FS = /* glsl */`
uniform float uK; uniform float uR; varying vec2 vP;
vec3 spec( float t ) { return clamp( vec3( 1.5 - abs( t - 1.0 ) * 2.6, 1.3 - abs( t - 0.55 ) * 3.0, 1.3 - abs( t - 0.12 ) * 3.6 ), 0.0, 1.0 ); }
void main() {
  float ang = degrees( atan( length( vP ) / uR ) );
  float t1 = ( ang - 40.4 ) / 2.2;          // 0 紫 → 1 红
  float t2 = ( 53.4 - ang ) / 3.4;
  vec3 c = spec( t1 ) * smoothstep( -0.05, 0.12, t1 ) * smoothstep( 1.08, 0.9, t1 );
  c += spec( t2 ) * smoothstep( -0.05, 0.12, t2 ) * smoothstep( 1.08, 0.9, t2 ) * 0.32;
  // 虹里面亮一点
  c += vec3( 0.06, 0.06, 0.07 ) * smoothstep( 41.0, 30.0, ang ) * smoothstep( 10.0, 30.0, ang );
  // 靠地平线的一截淡掉（vP.y 是往上）
  float a = uK * smoothstep( -0.05 * uR, 0.2 * uR, vP.y + uR * 0.15 );
  gl_FragColor = vec4( c * a * 0.55, 1.0 );
}`;
const MT_VS = /* glsl */`
attribute float aT; attribute float aS; varying float vT; varying float vS;
void main() { vT = aT; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
const MT_FS = /* glsl */`
uniform float uK; uniform float uHead; varying float vT; varying float vS;
void main() {
  // vT：0 尾巴 → 1 头；头跟着 uHead 往前走，尾巴淡出
  float d = uHead - vT;
  float a = smoothstep( 0.55, 0.0, d ) * step( 0.0, d ) * ( 1.0 - abs( vS ) );
  gl_FragColor = vec4( vec3( 1.0, 0.95, 0.85 ) * a * uK * 1.6, 1.0 );
}`;

const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3();

export function makeSkyFx() {
  const g = new THREE.Group(); g.name = 'skyfx';
  // ---- 彩虹 ----
  const R = D * Math.tan(55 * Math.PI / 180);
  const rbU = { uK: { value: 0 }, uR: { value: D } };
  const rb = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R), new THREE.ShaderMaterial({
    uniforms: rbU, vertexShader: RB_VS, fragmentShader: RB_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  rb.frustumCulled = false; rb.renderOrder = -5; rb.visible = false;
  g.add(rb);
  // ---- 流星：一条细长的带子 ----
  const N = 24, P = [], T = [], Sd = [];
  for (let i = 0; i <= N; i++) { const t = i / N; P.push(0, 0, 0, 0, 0, 0); T.push(t, t); Sd.push(-1, 1); }
  const idx = []; for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); mg.setAttribute('aT', new THREE.Float32BufferAttribute(T, 1)); mg.setAttribute('aS', new THREE.Float32BufferAttribute(Sd, 1)); mg.setIndex(idx);
  const mtU = { uK: { value: 0 }, uHead: { value: 0 } };
  const mt = new THREE.Mesh(mg, new THREE.ShaderMaterial({ uniforms: mtU, vertexShader: MT_VS, fragmentShader: MT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  mt.frustumCulled = false; mt.renderOrder = -4; mt.visible = false;
  g.add(mt);
  const pos = mg.attributes.position;
  let rbK = 0, meteorT = 18, m = null, auK = 0, auDay = -1, auRoll = 0, auForce = false;
  g.userData = {
    rainbow: 0, onSeen: null,
    fire() { meteorT = 0; },          // 调试：马上来一颗流星
    aurora: 0, lights(on = true) { auForce = on; },   // 调试：极光亮起来
    // c: { camera, sunPos 太阳方向（单位向量）, night 0~1, wx: weather（k、wet）, dt, often 流星多一点（坐在火边、在海角、湖边） }
    update(c) {
      const { camera, sunPos, dt } = c, W = c.wx, k = W.k;
      // 彩虹：地面还湿着（刚下过雨）、雨快停了、云不太厚、太阳在 2°~40° 高
      const sunEl = Math.asin(Math.max(-1, Math.min(1, sunPos.y))) * 180 / Math.PI;
      const want = W.wet > 0.35 && k.r < 0.35 && k.o < 0.8 && sunEl > 2 && sunEl < 40 ? Math.min(1, (0.35 - k.r) / 0.2) * Math.min(1, (0.8 - k.o) / 0.25) * Math.min(1, (40 - sunEl) / 6) * Math.min(1, W.wet / 0.6) : 0;
      rbK += (want - rbK) * (1 - Math.exp(-dt / 6));
      g.userData.rainbow = rbK;
      rb.visible = rbK > 0.01;
      if (rb.visible) {
        // 平面中心在反日点方向上
        _f.copy(sunPos).negate().normalize();
        rb.position.copy(camera.position).addScaledVector(_f, D);
        _u.set(0, 1, 0).addScaledVector(_f, -_f.y).normalize();
        _r.crossVectors(_u, _f);
        rb.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(_r, _u, _f.clone().negate()));
        rbU.uK.value = rbK;
        if (rbK > 0.45 && c.camFwd.dot(_f) > 0.35) g.userData.onSeen?.('rainbow');
      }
      // 极光：晴天的夜里。在雪原、冰湖那一带天天有；别的地方看运气（大约三夜里有一夜）
      if (c.day !== undefined && c.day !== auDay) { auDay = c.day; auRoll = Math.random(); }
      const auWant = auForce || (c.night > 0.85 && k.o < 0.4 && k.f < 0.35 && k.r < 0.05 && (c.cold || auRoll < 0.35)) ? 1 : 0;
      auK += (auWant - auK) * (1 - Math.exp(-dt / (auWant ? 9 : 5)));
      g.userData.aurora = auK; SKY.uAurora.value = auK * (0.75 + 0.25 * Math.sin(U.uTime.value * 0.13));
      if (auK > 0.6 && c.camFwd.z < -0.2 && c.camFwd.y > -0.25) g.userData.onSeen?.('aurora');
      // 流星
      const clearNight = c.night > 0.7 && k.o < 0.35 && k.f < 0.35 && k.r < 0.05 && k.s < 0.05;
      if (!m) {
        meteorT -= dt * (clearNight ? (c.often ? 2.2 : 1) : 0);
        if (meteorT <= 0) {
          meteorT = 25 + Math.random() * 45;
          // 起点：镜头前方左右 70° 以内、仰角 25°~60° 的天上
          const cy = Math.atan2(c.camFwd.x, c.camFwd.z) + (Math.random() - 0.5) * 2.4, el = (25 + Math.random() * 35) * Math.PI / 180;
          const a = new THREE.Vector3(Math.sin(cy) * Math.cos(el), Math.sin(el), Math.cos(cy) * Math.cos(el));
          // 往下斜着划过去 12°~22°
          const side = new THREE.Vector3(Math.cos(cy), 0, -Math.sin(cy)).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
          const dir = side.multiplyScalar(0.8).add(new THREE.Vector3(0, -0.6, 0)).normalize();
          const len = (12 + Math.random() * 10) * Math.PI / 180;
          m = { a, dir, len, t: 0, dur: 0.9 + Math.random() * 0.5, seen: false };
          for (let i = 0; i <= N; i++) {
            const t = i / N, p = a.clone().addScaledVector(dir, len * t).normalize().multiplyScalar(D);
            const w = D * 0.0011 * (0.3 + 0.7 * t), n = new THREE.Vector3().crossVectors(p, dir).normalize().multiplyScalar(w);
            pos.setXYZ(i * 2, p.x - n.x, p.y - n.y, p.z - n.z); pos.setXYZ(i * 2 + 1, p.x + n.x, p.y + n.y, p.z + n.z);
          }
          pos.needsUpdate = true;
          mt.visible = true;
        }
      }
      if (m) {
        m.t += dt;
        const k2 = m.t / m.dur;
        mtU.uHead.value = k2 * 1.55; mtU.uK.value = Math.sin(Math.min(1, k2) * Math.PI) * c.night;
        mt.position.copy(camera.position);
        if (!m.seen && k2 > 0.3 && k2 < 0.9) {
          const h = m.a.clone().addScaledVector(m.dir, m.len * 0.5).normalize();
          if (h.dot(c.camFwd) > 0.55) { m.seen = true; g.userData.onSeen?.('meteor'); }
        }
        if (k2 > 1.6) { m = null; mt.visible = false; }
      }
    },
  };
  return g;
}
