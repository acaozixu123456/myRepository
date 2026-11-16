// 海角灯塔：白塔身两道红箍，上面一圈小平台和栏杆，玻璃灯室，红顶；旁边一间看灯人的小屋。
// 天一暗灯就亮：灯室里一团暖光，两道光柱慢慢转（起雾、下雨的时候也亮着），远远就能看见。
import * as THREE from 'three';
import { LIGHTHOUSE } from './route.js';
import { patch, U, FOG_FN } from './atmo.js';

const BEAM_VS = /* glsl */`
varying vec3 vWP; varying float vL; varying vec3 vN;
void main() {
  vL = position.y;           // 光柱的几何沿 y 方向（0 在灯，1 在远处），装的时候转平
  vec4 w = modelMatrix * vec4( position, 1.0 ); vWP = w.xyz;
  vN = normalize( mat3( modelMatrix ) * normal );
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const BEAM_FS = /* glsl */`
uniform float uOn; uniform vec3 uCol;
${FOG_FN}
varying vec3 vWP; varying float vL; varying vec3 vN;
void main() {
  vec3 V = normalize( cameraPosition - vWP );
  float edge = pow( abs( dot( V, normalize( vN ) ) ), 1.6 );        // 光柱的边淡、中间亮
  float a = uOn * edge * ( 1.0 - smoothstep( 0.0, 1.0, vL ) ) * smoothstep( 0.0, 0.03, vL ) * 0.55;
  float fa = jFogAmount( vWP );
  gl_FragColor = vec4( uCol * a * ( 1.0 - fa * 0.7 ), 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildLighthouse(land) {
  const g = new THREE.Group(); g.name = 'lighthouse';
  const X = LIGHTHOUSE.x, Z = LIGHTHOUSE.z, Y = land.height(X, Z) - 0.1;
  g.position.set(X, Y, Z);
  const lam = (c, o = {}) => { const m = new THREE.MeshLambertMaterial({ color: c, ...o }); patch(m, { gobo: false, fog: true }); return m; };
  // 塔身：车床旋出来（底下粗、上面细），按高度上色：白、红箍
  const prof = [];
  const H = 13.5;
  for (let i = 0; i <= 18; i++) { const t = i / 18, y = t * H; prof.push(new THREE.Vector2(2.35 - 0.85 * t - 0.15 * Math.sin(t * Math.PI), y)); }
  const towerGeo = new THREE.LatheGeometry(prof, 24);
  {
    const P = towerGeo.attributes.position, col = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i) / H, red = (y > 0.36 && y < 0.5) || (y > 0.72 && y < 0.84);
      const c = red ? [0.62, 0.13, 0.1] : y < 0.06 ? [0.62, 0.6, 0.56] : [0.93, 0.91, 0.86];
      col.set(c, i * 3);
    }
    towerGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const white = lam(0xffffff, { vertexColors: true });
  const tower = new THREE.Mesh(towerGeo, white); g.add(tower);
  // 小门、两扇小窗
  const dark = lam(0x3a3430);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.3), lam(0x5a3a28)); door.position.set(0, 0.9, 2.28); g.add(door);
  for (const [y, a] of [[5.2, 0.9], [9.4, -2.2]]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.2), dark); w.position.set(Math.sin(a) * (2.25 - 0.85 * y / H - 0.12), y, Math.cos(a) * (2.25 - 0.85 * y / H - 0.12)); w.rotation.y = a; g.add(w); }
  // 平台、栏杆
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 1.75, 0.3, 24), lam(0x6e6a64)); deck.position.y = H + 0.1; g.add(deck);
  const railM = lam(0x2e2e30);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1.98, 0.035, 4, 32), railM); rail.rotation.x = Math.PI / 2; rail.position.y = H + 1.0; g.add(rail);
  const postG = new THREE.CylinderGeometry(0.025, 0.025, 0.8, 4);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, p = new THREE.Mesh(postG, railM); p.position.set(Math.cos(a) * 1.98, H + 0.62, Math.sin(a) * 1.98); g.add(p); }
  // 灯室：深色的玻璃（夜里亮成暖黄），红顶，顶上一颗球
  const glassM = new THREE.MeshLambertMaterial({ color: 0x24303a, emissive: new THREE.Color('#ffd27a'), emissiveIntensity: 0 });
  patch(glassM, { gobo: false, fog: true });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.7, 12, 1, true), glassM); glass.position.y = H + 1.1; g.add(glass);
  const frames = new THREE.Mesh(new THREE.CylinderGeometry(1.13, 1.13, 1.7, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0x202022, wireframe: true })); frames.position.y = H + 1.1; g.add(frames);
  const roofM = lam(0x8a2a1e);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.45, 1.2, 16), roofM); roof.position.y = H + 2.55; g.add(roof);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), railM); ball.position.y = H + 3.25; g.add(ball);
  // 看灯人的小屋：白墙、红褐色的人字顶，一个小烟囱
  const hut = new THREE.Group(); hut.position.set(-5.2, 0, 3.0); hut.rotation.y = 0.5; g.add(hut);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.4, 3.2), lam(0xe8e2d4)); wall.position.y = 1.2; hut.add(wall);
  const rs = new THREE.Shape(); rs.moveTo(-2.45, 0); rs.lineTo(0, 1.4); rs.lineTo(2.45, 0); rs.lineTo(-2.45, 0);
  const roofH = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: 3.6, bevelEnabled: false }), roofM); roofH.position.set(0, 2.4, -1.8); hut.add(roofH);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 0.45), lam(0x8a8078)); chim.position.set(1.2, 3.3, 0.6); hut.add(chim);
  const hd = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.1), lam(0x5a3a28)); hd.position.set(0.6, 0.8, 1.62); hut.add(hd);
  const hwM = new THREE.MeshLambertMaterial({ color: 0x3a3a3e, emissive: new THREE.Color('#ffc070'), emissiveIntensity: 0 }); patch(hwM, { gobo: false, fog: true });
  const hw = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.1), hwM); hw.position.set(-1.0, 1.4, 1.62); hut.add(hw);
  g.traverse(o => { if (o.isMesh && o.material !== frames.material) { o.castShadow = true; o.receiveShadow = true; } });

  // 灯：一团光晕（贴片，永远朝着镜头）+ 两道转着的光柱
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.25, 'rgba(255,214,140,0.55)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  glow.scale.setScalar(9); glow.position.y = H + 1.1; glow.renderOrder = 7; g.add(glow);
  const beamGeo = new THREE.CylinderGeometry(7, 0.35, 1, 16, 1, true); beamGeo.translate(0, 0.5, 0);
  const beamMat = new THREE.ShaderMaterial({ uniforms: { ...U, uOn: { value: 0 }, uCol: { value: new THREE.Color('#ffe2a8') } }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const spin = new THREE.Group(); spin.position.y = H + 1.1; g.add(spin);
  for (const a of [0, Math.PI]) {
    const b = new THREE.Mesh(beamGeo, beamMat);
    b.scale.set(1, 95, 1); b.rotation.z = -Math.PI / 2 + 0.035; b.rotation.y = a; b.renderOrder = 7; b.frustumCulled = false;
    const h = new THREE.Group(); h.rotation.y = a; h.add(b); b.rotation.y = 0; spin.add(h);
  }
  g.userData.blocks = [[X, Z, 2.6], [X - 5.2, Z + 3.0, 2.5]];
  g.userData.top = new THREE.Vector3(X, Y + H + 1.1, Z);
  let on = 0, beam = 0;
  // dark：天有多暗（0~1）；fog：雾/雨有多大。白天起雾下雨灯也亮着，但光柱只有天暗了才看得见
  g.userData.update = (dt, dark, fog) => {
    const want = Math.min(1, Math.max(dark, fog * 0.8)), k = 1 - Math.exp(-dt * 0.7);
    on += (want - on) * k; beam += (dark * (1 + 0.3 * fog) - beam) * k;
    spin.rotation.y += dt * 0.42;
    beamMat.uniforms.uOn.value = Math.min(1.3, beam);
    spin.visible = beam > 0.02;
    glow.material.opacity = on;
    glassM.emissiveIntensity = on * 2.2;
    hwM.emissiveIntensity = on * 1.4;
  };
  return g;
}
