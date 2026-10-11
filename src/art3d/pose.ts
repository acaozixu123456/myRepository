// 把战斗里已有的「关节姿势」（actor.ts 的 POSES：armR/armL/torso/head/legL/legR 的角度与平移）映射成 3D 关节旋转，
// 再叠加待机动画（呼吸 / 摆头 / 甩尾 / 耳朵抖动 / 眨眼）。所以全部招式编排（choreo / skills）不用改，3D 猫直接就会动。
import type { Cat3D } from './cat3d';

const D = Math.PI / 180;
const UNIT = 1 / 168; // 战斗骨骼单位 → 3D 单位（猫高 560 骨骼单位 ≈ 2.6）

export interface PoseOpts { alive: boolean; moving: boolean; t: number; squash?: number }

export function applyPose(cat: Cat3D, P: Record<string, number>, o: PoseOpts): void {
  const { j } = cat;
  const g = (k: string, d = 0) => P[k] ?? d;
  const live = o.alive ? 1 : 0;
  const tt = o.t * 2 + cat.phase;
  const b = Math.sin(tt);
  const run = o.moving ? Math.sin(o.t * 16) : 0;

  // 躯干：前倾 + 平移 + 呼吸
  j.torso.rotation.set(g('torso.0') * D * 1.0 + live * Math.sin(tt * 0.5) * 0.015 + run * 0.06, 0, 0);
  j.torso.position.set(0, g('torso.2') * -UNIT * 0.8 + (o.moving ? Math.abs(run) * 0.05 : 0), g('torso.1') * UNIT * 0.9);
  j.torso.scale.set(1 + 0.008 * live * b, 1 + 0.014 * live * b, 1);
  j.root.scale.set(1 + (o.squash ?? 0) * 0.1, 1 - (o.squash ?? 0) * 0.14, 1);
  // 头
  j.head.rotation.set(g('head.0') * D + live * b * 0.012, live * Math.sin(tt * 0.45 + 1) * 0.05, live * Math.sin(tt * 0.6) * 0.02);
  j.head.position.set(0, 0.46 + live * 0.012 * b + g('head.2') * -UNIT * 0.5, g('head.1') * UNIT * 0.5);
  // 手臂：负角度 = 向前上方抬起；R 臂 = 持武器手
  const armR = g('armR.0'), armL = g('armL.0');
  // 举过头顶时随抬高向外张开，手不会穿进脑袋
  const lift = (a: number) => Math.max(a * D * 1.15, -2.55);
  const splay = (a: number) => 0.12 + Math.max(0, -a) * 0.0042;
  j.shoulderR.rotation.set(lift(armR), 0, splay(armR) + live * Math.sin(tt + 0.3) * 0.02);
  j.shoulderL.rotation.set(lift(armL), 0, -splay(armL) + live * Math.sin(tt + 0.6) * 0.02);
  // 手臂举过肩时，肘部自然弯一点
  j.elbowR.rotation.set(-0.15 - Math.min(0.45, Math.max(0, -armR - 40) * D * 0.35), 0, 0);
  j.elbowL.rotation.set(-0.15 - Math.min(0.45, Math.max(0, -armL - 40) * D * 0.35), 0, 0);
  // 腿
  const lg = (side: 'L' | 'R', sgn: number) => {
    const h = side === 'L' ? j.hipL : j.hipR, k = side === 'L' ? j.kneeL : j.kneeR;
    const a = -g(`leg${side}.0`) * D * 1.0 + (o.moving ? run * sgn * 0.7 : 0);
    h.rotation.set(a, 0, 0);
    k.rotation.set(Math.max(0, -a) * 0.5, 0, 0);
  };
  lg('L', 1); lg('R', -1);
  // 尾巴：链式摆动
  j.tail.forEach((s, i) => {
    const base = i === 0 ? (cat.look.tail === 'curl' ? 0.7 : 0.9) : cat.look.tail === 'curl' ? -0.34 : -0.18;
    s.rotation.set(base + live * Math.sin(o.t * 2.4 + i * 0.7 + cat.phase) * 0.05 * (1 + i * 0.15), live * Math.sin(o.t * 1.6 + i * 0.9 + cat.phase) * (0.1 + i * 0.045) + (o.moving ? Math.sin(o.t * 11 - i) * 0.1 : 0), 0);
  });
  // 耳朵偶尔抖一下
  const tw = Math.max(0, Math.sin(o.t * 0.7 + cat.phase * 3) - 0.92) * 9;
  j.earL.rotation.z = -0.32 + tw * 0.4;
  j.earR.rotation.z = 0.32 - tw * 0.4;
  // 眨眼：每 ~3.5 秒一次
  const bl = Math.max(0, 1 - Math.abs(((o.t + cat.phase) % 3.6) - 3.45) * 14);
  for (const e of j.eyes) e.scale.y = 1 - 0.9 * bl * live;
}
