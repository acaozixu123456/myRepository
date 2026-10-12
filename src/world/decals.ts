// 地面贴花：把 Codex 交付的透明污渍 / 裂缝贴图（assets/world/decals）散落在路面和人行道上，让地面不再是一整张干净的贴图。
// 位置由种子决定（同一关每次一样），只贴在「路面」和「街区石板」上；贴花不挡路、不进碰撞。
import * as THREE from 'three';
import { worldImg } from './tex';

const STAINS = ['decal_stain_soot_01', 'decal_stain_mud_drag_02', 'decal_stain_oil_film_03', 'decal_stain_rust_run_05', 'decal_stain_tire_scuff_07', 'decal_stain_rain_dust_08'];
const CRACKS = ['decal_crack_branch_fine_01', 'decal_crack_transverse_02', 'decal_crack_stone_diagonal_04', 'decal_crack_crazing_05', 'decal_crack_asphalt_long_09', 'decal_crack_threeway_10'];
const mats = new Map<string, THREE.MeshStandardMaterial>();
function matOf(name: string): THREE.MeshStandardMaterial | null {
  let m = mats.get(name);
  if (m) return m;
  const img = worldImg(name);
  if (!img) return null;
  const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
  m = new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.85, metalness: 0, opacity: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mats.set(name, m);
  return m;
}
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

/** half = 街区半宽。路面（宽 9 的十字）贴在 y=0.036，四块石板（边长 half-4.5）贴在 y=0.335 */
export function buildGroundDecals(half: number, seed = 11): THREE.Group {
  const g = new THREE.Group();
  const r = rng(seed);
  const place = (names: string[], x: number, z: number, y: number, size: number) => {
    const m = matOf(names[Math.floor(r() * names.length)]);
    if (!m) return;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
    p.rotation.set(-Math.PI / 2, 0, r() * Math.PI * 2);
    p.position.set(x, y, z);
    p.userData.noMirror = true;
    p.renderOrder = 2;
    g.add(p);
  };
  // 路面：横路 / 竖路各 9 块（污渍偏多），远离中心十字口一点
  for (let i = 0; i < 9; i++) {
    const along = (r() * 2 - 1) * (half - 3), across = (r() * 2 - 1) * 3.4;
    place(i % 3 === 0 ? CRACKS : STAINS, along, across, 0.036, 3 + r() * 3);
    const along2 = (r() * 2 - 1) * (half - 3), across2 = (r() * 2 - 1) * 3.4;
    place(i % 3 === 1 ? CRACKS : STAINS, across2, along2, 0.036, 3 + r() * 3);
  }
  // 石板：每块 4~5 块，裂缝多一点
  const w = half - 4.5;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cx = sx * (4.5 + w / 2), cz = sz * (4.5 + w / 2);
    for (let i = 0; i < 5; i++) place(i < 3 ? CRACKS : STAINS, cx + (r() * 2 - 1) * (w / 2 - 2), cz + (r() * 2 - 1) * (w / 2 - 2), 0.335, 2.6 + r() * 2.6);
  }
  return g;
}
