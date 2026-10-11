// 静态场景合批：把一个 Group 里所有「静态网格」按（材质 × 投影标记）合并，绘制调用从几百降到几十。
// 带数组材质 / 蒙皮 / 精灵 / 线条的对象保持原样。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function bakeStatic(root: THREE.Object3D): { before: number; after: number } {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<string, { mat: THREE.Material; cast: boolean; recv: boolean; geos: THREE.BufferGeometry[] }>();
  const taken: THREE.Mesh[] = [];
  let before = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    before++;
    if (Array.isArray(m.material) || (m as THREE.SkinnedMesh).isSkinnedMesh || m.userData.noBake) return;
    const mat = m.material as THREE.Material;
    const key = `${mat.uuid}|${m.castShadow ? 1 : 0}|${m.receiveShadow ? 1 : 0}`;
    let e = groups.get(key);
    if (!e) { e = { mat, cast: m.castShadow, recv: m.receiveShadow, geos: [] }; groups.set(key, e); }
    let g = m.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    e.geos.push(g);
    taken.push(m);
  });
  const merged: THREE.Mesh[] = [];
  for (const e of groups.values()) {
    const mg = e.geos.length === 1 ? e.geos[0] : mergeGeometries(e.geos, false);
    if (!mg) continue;
    const mesh = new THREE.Mesh(mg, e.mat);
    mesh.castShadow = e.cast; mesh.receiveShadow = e.recv;
    merged.push(mesh);
  }
  for (const m of taken) m.removeFromParent();
  for (const m of merged) root.add(m);
  return { before, after: before - taken.length + merged.length };
}
