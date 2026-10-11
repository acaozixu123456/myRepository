// 静态场景合批：把一个 Group 里所有「静态网格」按（材质 × 投影标记）合并，绘制调用从几百降到几十。
// 带数组材质 / 蒙皮 / 精灵 / 线条的对象保持原样。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const vcStdCache = new Map<string, THREE.MeshStandardMaterial>();
const vcStd = (rough: number, metal: number): THREE.MeshStandardMaterial => {
  const k = `${rough.toFixed(2)}|${metal.toFixed(2)}`; let m = vcStdCache.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough, metalness: metal, vertexColors: true }); vcStdCache.set(k, m); }
  return m;
};
const vcBasicCache = new Map<boolean, THREE.MeshBasicMaterial>();
const vcBasic = (toneMapped: boolean): THREE.MeshBasicMaterial => {
  let m = vcBasicCache.get(toneMapped);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped }); vcBasicCache.set(toneMapped, m); }
  return m;
};

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
    let mat = m.material as THREE.Material;
    // 纯色材质 → 顶点色 + 共享材质（同样的粗糙度 / 金属度合成一个），大幅减少绘制调用
    let tint: THREE.Color | null = null;
    const sm = mat as THREE.MeshStandardMaterial, bm = mat as THREE.MeshBasicMaterial;
    if (sm.isMeshStandardMaterial && !sm.map && !sm.emissiveMap && sm.emissive.getHex() === 0 && !sm.transparent && sm.side === THREE.FrontSide) { mat = vcStd(sm.roughness, sm.metalness); tint = sm.color; }
    else if (bm.isMeshBasicMaterial && !bm.map && !bm.transparent && bm.side === THREE.FrontSide && !bm.userData.noVC) { mat = vcBasic(bm.toneMapped); tint = bm.color; }
    const key = `${mat.uuid}|${m.castShadow ? 1 : 0}|${m.receiveShadow ? 1 : 0}`;
    let e = groups.get(key);
    if (!e) { e = { mat, cast: m.castShadow, recv: m.receiveShadow, geos: [] }; groups.set(key, e); }
    let g = m.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    if (tint) { const n = g.getAttribute('position').count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = tint.r; col[i * 3 + 1] = tint.g; col[i * 3 + 2] = tint.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
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
