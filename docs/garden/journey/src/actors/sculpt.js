// 用代码“捏”出来的人：把 sculptGeo.js 算好的形状绑到现有骨架上（Quaternius 骨架 + Universal Animation Library），
// 所以走、跑、骑马、坐下都不用改。旅人在加载时直接算；路上偶遇的人放到后台线程算（sculptTravelerAsync），不卡画面。
import * as THREE from 'three';
import { Builder, tube } from '../horse/horseB.js';
import { patch } from '../world/atmo.js';
import { Lag } from './sway.js';
import { sculptData, tailOptions, lookOf, LOOKS } from './sculptGeo.js';
export { LOOKS };

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ARM_DOWN = 62 * Math.PI / 180;      // 手臂从水平放下来多少

// 第一步：手臂放下来（A 字站姿），记下每条手臂整体转了多少，按这个姿势定好骨架，再把手臂放回去
function prepare(model) {
  const bones = {}, list = [];
  model.traverse(o => { if (o.isBone) { bones[o.name] = o; list.push(o); } });
  const BI = Object.fromEntries(list.map((b, i) => [b.name, i]));
  model.updateMatrixWorld(true);
  const Zax = new THREE.Vector3(0, 0, 1), keep = {}, arms = {};
  for (const s of ['l', 'r']) {
    const b = bones['upperarm_' + s];
    keep[s] = { q: b.quaternion.clone(), m: b.matrixWorld.clone() };
    const pq = b.parent.getWorldQuaternion(new THREE.Quaternion());
    const r = new THREE.Quaternion().setFromAxisAngle(Zax, s === 'l' ? -ARM_DOWN : ARM_DOWN);
    b.quaternion.copy(pq.clone().invert().multiply(r).multiply(pq).multiply(b.quaternion));
  }
  model.updateMatrixWorld(true);
  for (const s of ['l', 'r']) arms[s] = bones['upperarm_' + s].matrixWorld.clone().multiply(keep[s].m.invert()).toArray();
  const skeleton = new THREE.Skeleton(list), bind = model.matrixWorld.clone();       // 骨头这会儿是 A 字站姿，就按这个姿势绑
  for (const s of ['l', 'r']) bones['upperarm_' + s].quaternion.copy(keep[s].q);
  model.updateMatrixWorld(true);
  return { bones, BI, arms, skeleton, bind };
}

// 第二步：形状算好了，做成网格绑上去
function finish(model, prep, d, P) {
  const { bones, BI } = prep, tail = d.tail;
  // 原来的模型拿掉
  const old = []; model.traverse(o => { if (o.isSkinnedMesh) old.push(o); });
  for (const o of old) o.parent.remove(o);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(d.nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(d.col, 3));
  geo.setAttribute('aGlow', new THREE.BufferAttribute(d.glow, 1));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(d.si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(d.sw, 4));
  geo.setIndex(new THREE.BufferAttribute(d.idx, 1));
  geo.computeBoundingSphere();
  geo.userData = { buildMs: d.buildMs, bodyVerts: d.bodyVerts, tris: d.tris };
  {
    const n = geo.attributes.position.count, root = new Float32Array(n * 3), flex = new Float32Array(n);
    for (let i = tail.from; i < tail.to; i++) { root.set(tail.root, i * 3); flex[i] = Math.pow(Math.min(1, Math.floor((i - tail.from) / tail.seg) / tail.n), 1.15); }
    geo.setAttribute('aRoot', new THREE.BufferAttribute(root, 3)); geo.setAttribute('aFlex', new THREE.BufferAttribute(flex, 1));
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, name: 'sculpt' });
  const sw = { uScarf: { value: new THREE.Vector3() }, uScarfF: { value: 0 } };
  // 自发光一点点：逆光时人不会只剩一个黑影；高光点（aGlow）自己亮
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, sw);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlow; varying float vGlow; attribute vec3 aRoot; attribute float aFlex; uniform vec3 uScarf; uniform float uScarfF;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vGlow = aGlow;
      if ( aFlex > 0.0 ) {
        vec3 jRel = transformed - aRoot; float jLen = length( jRel );
        float jW = sin( uTime * 8.0 - aFlex * 5.5 ), jW2 = sin( uTime * 5.3 - aFlex * 3.0 + 1.7 );
        vec3 jD = ( uScarf + vec3( jW * 0.16, jW2 * 0.07, 0.0 ) * uScarfF ) * aFlex;
        if ( jLen > 1e-4 ) transformed = aRoot + normalize( jRel + jD ) * jLen;
      }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * ( 0.16 + 0.8 * vGlow );');
  };
  patch(mat, { rim: 0.45, gobo: true, fog: true });
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = 'sculpt'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  model.add(mesh);
  mesh.bind(prep.skeleton, prep.bind);
  // 围巾慢半拍：一个被弹簧拴在后背上的小球，落后多少（转回捏的时候的坐标）就把背后那截往哪边摆
  const lag = new Lag({ freq: 1.5, zeta: 0.4, drag: 0.07, max: 0.6 }), sp = bones.spine_03, inv = mesh.skeleton.boneInverses[BI.spine_03];
  const m4 = new THREE.Matrix4(), m3 = new THREE.Matrix3(), v = new THREE.Vector3();
  mesh.userData.sway = (dt, gain = 1) => {
    const o = lag.update(dt, sp.getWorldPosition(v));
    m3.setFromMatrix4(m4.multiplyMatrices(sp.matrixWorld, inv)).invert();
    v.copy(o).applyMatrix3(m3).multiplyScalar(1.6 * gain);
    v.z = Math.min(v.z, 0.03);                 // 不往前摆（前面是行囊）
    sw.uScarf.value.copy(v);
    sw.uScarfF.value = gain * sstep(0.08, 0.5, o.length());
  };
  // 行囊是后来才挂上去的（traveler.js，按站姿量后背）：挂好后把背后那截围巾重新搭一遍。
  // pts(root) 给出当前姿势下的路线（世界坐标，root 是围巾在后颈的那一点），这里转回捏的时候的坐标
  mesh.userData.drape = pts => {
    if (tail.to <= tail.from) return;
    sp.updateWorldMatrix(true, false);
    const toWorld = m4.multiplyMatrices(sp.matrixWorld, inv).clone(), toBind = toWorld.clone().invert(), nm = new THREE.Matrix3().setFromMatrix4(toBind);
    const P2 = pts(v.set(...tail.root).applyMatrix4(toWorld).toArray());
    const B2 = new Builder(BI); tube(B2, P2, tailOptions(P, tail));
    const pos = geo.attributes.position, nor = geo.attributes.normal, root = geo.attributes.aRoot;
    const r = v.set(...P2[0]).applyMatrix4(toBind).toArray();
    for (let i = 0; i < tail.to - tail.from; i++) {
      v.set(B2.pos[i * 3], B2.pos[i * 3 + 1], B2.pos[i * 3 + 2]).applyMatrix4(toBind); pos.setXYZ(tail.from + i, v.x, v.y, v.z);
      v.set(B2.nor[i * 3], B2.nor[i * 3 + 1], B2.nor[i * 3 + 2]).applyMatrix3(nm).normalize(); nor.setXYZ(tail.from + i, v.x, v.y, v.z);
      root.setXYZ(tail.from + i, r[0], r[1], r[2]);
    }
    pos.needsUpdate = nor.needsUpdate = root.needsUpdate = true;
  };
  return mesh;
}

// opts：{ who: 'm'|'f', look: 换颜色、帽子、发型（见 sculptGeo.js 的 LOOKS）, cell: 格子多细 }
export function sculptTraveler(model, opts = {}) {
  const prep = prepare(model);
  return finish(model, prep, sculptData(prep.arms, prep.BI, opts), lookOf(opts));
}

// 同一件事，形状放到后台线程算：算的那零点几秒画面不停。后台线程用不了的话这个承诺会失败，调用的人自己看着办
let worker = null, seq = 0;
const waiting = new Map();
export function sculptTravelerAsync(model, opts = {}) {
  const prep = prepare(model);
  return new Promise((res, rej) => {
    try {
      if (!worker) {
        worker = new Worker(new URL('./sculpt.worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = e => { const w = waiting.get(e.data.id); if (!w) return; waiting.delete(e.data.id); if (e.data.err) w.rej(new Error(e.data.err)); else w.res(e.data.d); };
        worker.onerror = e => { for (const w of waiting.values()) w.rej(new Error(e.message || 'sculpt worker')); waiting.clear(); worker = null; };
      }
      const id = ++seq; waiting.set(id, { res, rej });
      worker.postMessage({ id, arms: prep.arms, BI: prep.BI, opts });
    } catch (e) { rej(e); }
  }).then(d => finish(model, prep, d, lookOf(opts)));
}
