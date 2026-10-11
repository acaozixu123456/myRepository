import { describe, expect, it } from 'vitest';
import { ANCHORS, anchorsOf } from '../src/art/illust-rig';
import { ILLUST } from '../src/art/illust-index';
import { NV, PuppetMesh, REST, gridIndices, puppetPose } from '../src/fx/puppet';
import { POSES } from '../src/fx/actor';

const mk = (id = '') => new PuppetMesh(400, 560, anchorsOf(id));

describe('立绘木偶', () => {
  it('静止姿势下顶点等于静止位置', () => {
    const m = mk();
    const pos = m.deform(REST);
    for (let i = 0; i < NV * 2; i++) expect(pos[i]).toBeCloseTo(m.rest[i], 4);
  });
  it('网格索引合法', () => {
    const idx = gridIndices();
    expect(Math.max(...idx)).toBe(NV - 1);
  });
  it('锚点都在画面内（0~1）', () => {
    for (const [id, a] of Object.entries(ANCHORS)) {
      const full = anchorsOf(id);
      const pts = [full.head, full.neck, full.hip, full.main.shoulder, full.main.hand, full.off.shoulder, full.off.hand, ...(full.main.tip ? [full.main.tip] : []), ...(full.off.tip ? [full.off.tip] : []), ...(a.tail ? [a.tail.base, a.tail.tip] : [])];
      for (const [u, v] of pts) { expect(u, id).toBeGreaterThanOrEqual(0); expect(u, id).toBeLessThanOrEqual(1); expect(v, id).toBeGreaterThanOrEqual(0); expect(v, id).toBeLessThanOrEqual(1); }
    }
  });
  it('已有立绘的猫都配了专属锚点', () => {
    for (const id of Object.keys(ILLUST)) expect(ANCHORS[id], `${id} 缺少木偶锚点`).toBeTruthy();
  });
  it('所有招式姿势下顶点有限，且脚底基本不动', () => {
    const m = mk('shu_liumiaobei');
    const footIdx: number[] = [];
    for (let i = 0; i < NV; i++) if (m.rest[i * 2 + 1] > 560 * 0.97) footIdx.push(i);
    for (const [name, pose] of Object.entries(POSES)) {
      const P: Record<string, number> = {};
      for (const [part, d] of Object.entries(pose)) (d as number[]).forEach((v, i) => { P[`${part}.${i}`] = v; });
      for (const t of [0, 0.7, 1.9]) {
        const pos = m.deform(puppetPose(P, t, 0.3, { alive: true, moving: name === 'dash' }));
        for (let i = 0; i < NV * 2; i++) expect(Number.isFinite(pos[i]), name).toBe(true);
        for (const k of footIdx) {
          expect(Math.abs(pos[k * 2] - m.rest[k * 2]), name).toBeLessThan(30);
          expect(Math.abs(pos[k * 2 + 1] - m.rest[k * 2 + 1]), name).toBeLessThan(30);
        }
      }
    }
  });
  it('举起武器手臂：手尖上移', () => {
    for (const id of Object.keys(ANCHORS)) {
      const m = mk(id);
      let k = 0, best = 1e9;
      for (let i = 0; i < NV; i++) { const d = Math.hypot(m.rest[i * 2] - m.A.handMain[0], m.rest[i * 2 + 1] - m.A.handMain[1]); if (d < best) { best = d; k = i; } }
      const up = m.deform({ ...REST, main: -70 });
      expect(up[k * 2 + 1], id).toBeLessThan(m.rest[k * 2 + 1] - 10);
    }
  });
});
