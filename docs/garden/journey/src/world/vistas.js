// 观景点的记号：一堆叠起来的扁石头，旁边一根高高的木杆，杆顶挂一条长长的布条在风里飘（远远就看得见，夜里杆顶的小灯亮着）。
import * as THREE from 'three';
import { VISTAS } from './route.js';
import { U, patch } from './atmo.js';

const RIB_L = 4.6, RIB_W = 0.55, POLE_H = 7.2;

function ribbonMat(color) {
  const m = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  m.emissive.set(color).multiplyScalar(0.25);
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uPh;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        // x 从杆子往外（0 到 L）；越往外摆得越大，一道波顺着布条往外走
        float k = transformed.x / ${RIB_L.toFixed(2)};
        float w = sin( transformed.x * 1.6 - uTime * 4.2 * uWind + uPh ) * 0.42 + sin( transformed.x * 3.1 - uTime * 6.3 + uPh * 2.0 ) * 0.12;
        transformed.z += w * k * ( 0.7 + 0.3 * uWind );
        transformed.y += -k * k * 0.9 + sin( uTime * 1.7 + uPh + transformed.x ) * 0.15 * k;
      }`);
    sh.uniforms.uPh = m.userData.ph;
  };
  m.userData.ph = { value: Math.random() * 6 };
  patch(m, { rim: 0.2, gobo: true, fog: true });
  return m;
}

export function buildVistas(land) {
  const g = new THREE.Group(); g.name = 'vistas';
  const blocks = [], lamps = [];
  const stone = new THREE.MeshStandardMaterial({ color: '#8d8a80', roughness: 0.95 });
  patch(stone, { rim: 0, gobo: true, fog: true, cover: true });
  const wood = new THREE.MeshStandardMaterial({ color: '#6b4a30', roughness: 0.9 });
  patch(wood, { rim: 0.2, gobo: true, fog: true });
  const lampMat = new THREE.MeshStandardMaterial({ color: '#ffe2a8', emissive: new THREE.Color('#ffb85a'), emissiveIntensity: 0 });
  patch(lampMat, { gobo: false, fog: true });
  const rock = new THREE.DodecahedronGeometry(1, 0);
  const pole = new THREE.CylinderGeometry(0.06, 0.09, POLE_H, 6); pole.translate(0, POLE_H / 2, 0);
  const rib = new THREE.PlaneGeometry(RIB_L, RIB_W, 14, 1); rib.translate(RIB_L / 2, -RIB_W / 2, 0);
  const COLORS = ['#c8462e', '#e0a23a', '#3f6fa8', '#c8462e'];
  VISTAS.forEach((V, i) => {
    const y = land.heightExact(V.x, V.z), v = new THREE.Group();
    v.position.set(V.x, y, V.z);
    // 石堆：越往上越小
    let h = -0.15;
    for (let k = 0; k < 6; k++) {
      const s = 0.62 - k * 0.085, r = new THREE.Mesh(rock, stone);
      r.scale.set(s * (1.1 + 0.2 * Math.sin(k * 3 + i)), s * 0.42, s);
      r.rotation.y = k * 1.3 + i; r.position.set(Math.sin(k * 2.1) * 0.06, h + s * 0.32, Math.cos(k * 1.7) * 0.06);
      h += s * 0.62; r.castShadow = true; r.receiveShadow = true; v.add(r);
    }
    // 旁边几块散石
    for (let k = 0; k < 4; k++) {
      const a = k * 1.7 + i, r = new THREE.Mesh(rock, stone), s = 0.22 + 0.08 * Math.sin(k * 5 + i);
      r.scale.set(s * 1.2, s * 0.6, s); r.position.set(Math.cos(a) * 1.1, s * 0.2, Math.sin(a) * 1.1); r.receiveShadow = true; v.add(r);
    }
    // 杆子在石堆后面一点，布条顺着风往东边飘
    const px = 0.85, pz = -0.4, py = land.heightExact(V.x + px, V.z + pz) - y - 0.2;
    const p = new THREE.Mesh(pole, wood); p.position.set(px, py, pz); p.castShadow = true; v.add(p);
    const top = py + POLE_H - 0.15;
    const r = new THREE.Mesh(rib, ribbonMat(COLORS[i % COLORS.length])); r.position.set(px, top, pz); r.rotation.y = -0.4 + i * 0.3; r.castShadow = true; v.add(r);
    const r2 = new THREE.Mesh(rib, ribbonMat('#f0e6d2')); r2.position.set(px, top - 0.75, pz); r2.rotation.y = -0.2 + i * 0.3; r2.scale.set(0.7, 0.7, 1); v.add(r2);
    // 杆顶的小灯：天黑了亮起来
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lampMat); lamp.position.set(px, top + 0.25, pz); v.add(lamp);
    lamps.push(lamp);
    g.add(v);
    blocks.push([V.x, V.z, 0.75], [V.x + px, V.z + pz, 0.15]);
  });
  g.userData = {
    blocks,
    // dark：天有多暗（0~1）
    update(dark) { lampMat.emissiveIntensity = 2.4 * dark; },
  };
  return g;
}
