import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { HEROES } from '../src/data/heroes';
import { MOBS } from '../src/content/mobs';
import { lookOf } from '../src/data/units';
import { buildCat3D } from '../src/art3d/cat3d';
import { applyPose } from '../src/art3d/pose';
import { POSES } from '../src/fx/actor';
import { REGISTRY } from '../src/art3d/parts';
import type { PartGroup } from '../src/art3d/parts';

const types = readFileSync(new URL('../src/art/types.ts', import.meta.url), 'utf8');
const union = (name: string): string[] => {
  const m = types.match(new RegExp(`export type ${name} =([^;]+);`));
  return [...(m?.[1].matchAll(/'([A-Za-z]+)'/g) ?? [])].map((x) => x[1]).filter((k) => k !== 'none');
};
const GROUPS: [PartGroup, string][] = [['headgear', 'HeadGear'], ['body', 'BodyGear'], ['back', 'BackGear'], ['weapon', 'WeaponKind'], ['extra', 'Extra']];

describe('3D 部件库', () => {
  for (const [g, tname] of GROUPS) {
    it(`${g}：契约里每个取值都有 3D 部件`, () => {
      const missing = union(tname).filter((k) => !REGISTRY[g][k]);
      expect(missing, `缺少 ${g} 部件`).toEqual([]);
    });
  }
  it('契约解析没出错（每组至少有若干取值）', () => {
    for (const [, tname] of GROUPS) expect(union(tname).length).toBeGreaterThan(5);
  });
});

const ids = [...HEROES.map((h) => h.id), ...MOBS.map((m) => m.id)];
describe('3D 小猫', () => {
  it('全部英雄与杂兵都能生成，尺寸与面数在预算内', () => {
    for (const id of ids) {
      const cat = buildCat3D(lookOf(id));
      cat.root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(cat.root);
      const size = box.getSize(new THREE.Vector3());
      expect(size.y, `${id} 高度`).toBeGreaterThan(2.4);
      expect(size.y, `${id} 高度`).toBeLessThan(4.6); // 长兵器 / 冠饰可以超出一点，取景框 y∈[-0.25, 3.6] 外会被裁
      expect(size.x, `${id} 宽度`).toBeLessThan(5.2);
      let meshes = 0;
      cat.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
      expect(meshes, `${id} 网格数`).toBeLessThan(420);
    }
  });
  it('所有招式姿势下关节旋转有限', () => {
    const cat = buildCat3D(lookOf('wei_caomiaode'));
    for (const [name, pose] of Object.entries(POSES)) {
      const P: Record<string, number> = {};
      for (const [part, d] of Object.entries(pose)) (d as number[]).forEach((v, i) => { P[`${part}.${i}`] = v; });
      for (const t of [0, 1.3]) {
        applyPose(cat, P, { alive: true, moving: name === 'dash', t });
        cat.root.traverse((o) => { for (const v of [o.rotation.x, o.rotation.y, o.rotation.z, o.position.x, o.position.y, o.position.z]) expect(Number.isFinite(v), name).toBe(true); });
      }
    }
  });
});
