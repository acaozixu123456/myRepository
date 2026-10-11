// 立绘木偶：把一整张立绘切成网格，按「肩 / 头 / 腰 / 尾」几组权重做柔性形变（线性蒙皮），
// 让静态立绘也能挥手臂、甩尾巴、点头、呼吸、衣摆飘动。形变在 CPU 算（315 个顶点），绘制交给 mesh.ts 的 WebGL。
import type { ArmAnchor, PuppetAnchors, P2 } from '../art/illust-rig';

export const COLS = 26;
export const ROWS = 38;
export const NV = (COLS + 1) * (ROWS + 1);

/** 每帧的形变参数（角度单位：度；顺时针为正） */
export interface PuppetPose {
  main: number; // 持武器手臂（已按左右手折算成「抬起为负」之前的原始姿势角，由 puppetPose 折算）
  off: number;
  head: number;
  bend: number; // 腰部前倾 / 后仰
  tail: number;
  dx: number; // 上半身整体平移（rig 单位）
  dy: number;
  breath: number; // 呼吸（-1..1）
  wave: number; // 衣摆摆幅（rig 单位）
  wavePhase: number;
  squash: number; // 压扁（>0 压扁，<0 拉长）
}
export const REST: PuppetPose = { main: 0, off: 0, head: 0, bend: 0, tail: 0, dx: 0, dy: 0, breath: 0, wave: 0, wavePhase: 0, squash: 0 };

const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function segDist(px: number, py: number, a: P2, b: P2): number {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy || 1;
  const t = clampN(((px - a[0]) * vx + (py - a[1]) * vy) / l2, 0, 1);
  return Math.hypot(px - (a[0] + vx * t), py - (a[1] + vy * t));
}

export class PuppetMesh {
  /** 静止顶点（图内像素坐标，左上角为原点） */
  rest = new Float32Array(NV * 2);
  uv = new Float32Array(NV * 2);
  pos = new Float32Array(NV * 2);
  wMain = new Float32Array(NV);
  wOff = new Float32Array(NV);
  wTipM = new Float32Array(NV); // 武器末端：手腕反向转，让剑 / 弓保持竖直
  wTipO = new Float32Array(NV);
  wHead = new Float32Array(NV);
  wTail = new Float32Array(NV);
  wBend = new Float32Array(NV);
  wHem = new Float32Array(NV);
  wTop = new Float32Array(NV);
  wChest = new Float32Array(NV);
  /** 锚点（图内像素） */
  A: { handOff: P2; hasTipM: boolean; hasTipO: boolean; head: P2; neck: P2; mainS: P2; offS: P2; tailB: P2; hip: P2; hasTail: boolean; handMain: P2; headC: P2 };
  /** 主手 / 副手在图左（右）侧：决定「抬手」是顺时针还是逆时针 */
  signMain: number;
  signOff: number;

  constructor(public w: number, public h: number, anchors: PuppetAnchors) {
    const px = (p: P2): P2 => [p[0] * w, p[1] * h];
    const a = anchors;
    this.A = { head: px(a.head), neck: px(a.neck), mainS: px(a.main.shoulder), offS: px(a.off.shoulder), tailB: a.tail ? px(a.tail.base) : [0, 0], hip: px(a.hip), hasTail: !!a.tail, handOff: px(a.off.hand), hasTipM: !!a.main.tip, hasTipO: !!a.off.tip, handMain: px(a.main.hand), headC: px(a.head) };
    this.signMain = a.main.shoulder[0] > 0.5 ? 1 : -1;
    this.signOff = a.off.shoulder[0] > 0.5 ? 1 : -1;
    const chain = (arm: ArmAnchor): P2[] => [px(arm.shoulder), px(arm.hand), ...(arm.tip ? [px(arm.tip)] : [])];
    const cm = chain(a.main), co = chain(a.off);
    const tailC: P2[] | null = a.tail ? [px(a.tail.base), px(a.tail.tip)] : null;
    const R = h * 0.09; // 手臂 / 武器「骨头」的粗细
    const neckV = a.neck[1];
    for (let j = 0; j <= ROWS; j++) {
      for (let i = 0; i <= COLS; i++) {
        const k = j * (COLS + 1) + i;
        const x = (i / COLS) * w, y = (j / ROWS) * h;
        const u = i / COLS, v = j / ROWS;
        this.rest[k * 2] = x; this.rest[k * 2 + 1] = y;
        this.uv[k * 2] = u; this.uv[k * 2 + 1] = v;
        const armW = (c: P2[]) => {
          let d = 1e9;
          for (let s = 0; s + 1 < c.length; s++) d = Math.min(d, segDist(x, y, c[s], c[s + 1]));
          // 肩根处渐入，避免和躯干撕开
          const ds = Math.hypot(x - c[0][0], y - c[0][1]);
          return (1 - sm(R * 0.9, R * 2.4, d)) * sm(R * 0.15, R * 1.1, ds);
        };
        // 头部椭圆：椭圆内只跟着头走（手臂权重清零），椭圆外的武器 / 袖子照常跟手臂
        const n = Math.hypot((x - a.head[0] * w) / (0.37 * w), (y - a.head[1] * h) / (0.31 * h));
        const inHead = 1 - sm(0.95, 1.25, n);
        const tipW = (c: P2[]) => {
          if (c.length < 3) return 0;
          const L = Math.hypot(c[2][0] - c[1][0], c[2][1] - c[1][1]);
          // 以「手 → 武器末端」方向投影：越靠近末端越多
          const vx = (c[2][0] - c[1][0]) / L, vy = (c[2][1] - c[1][1]) / L;
          const proj = ((x - c[1][0]) * vx + (y - c[1][1]) * vy) / L;
          return sm(0.0, 0.2, proj);
        };
        this.wTipM[k] = tipW(cm);
        this.wTipO[k] = tipW(co);
        this.wMain[k] = armW(cm) * (1 - inHead);
        this.wOff[k] = armW(co) * (1 - inHead);
        this.wHead[k] = (1 - sm(neckV - 0.05, neckV + 0.05, v)) * (1 - sm(1.0, 1.6, n));
        if (tailC) {
          const d = segDist(x, y, tailC[0], tailC[1]);
          const dsb = Math.hypot(x - tailC[0][0], y - tailC[0][1]);
          this.wTail[k] = (1 - sm(R * 0.9, R * 2.2, d)) * sm(R * 0.3, R * 2.6, dsb);
        }
        this.wBend[k] = 1 - sm(a.hip[1] - 0.42, a.hip[1] + 0.02, v);
        this.wHem[k] = sm(0.56, 0.78, v) * (1 - sm(0.88, 0.97, v));
        this.wTop[k] = 1 - v;
        this.wChest[k] = sm(0.28, 0.45, v) * (1 - sm(0.55, 0.75, v));
      }
    }
    this.pos.set(this.rest);
  }

  /** 按姿势算出形变后的顶点（图内像素坐标） */
  deform(p: PuppetPose): Float32Array {
    const { rest, pos, A } = this;
    const mS = A.mainS, oS = A.offS, nk = A.neck, tb = A.tailB, hp = A.hip;
    const h = this.h, w = this.w;
    const am = p.main * this.signMain, ao = p.off * this.signOff;
    const rot = (x: number, y: number, c: P2, deg: number): [number, number] => {
      const r = (deg * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r);
      const dx = x - c[0], dy = y - c[1];
      return [c[0] + dx * co - dy * si, c[1] + dx * si + dy * co];
    };
    for (let k = 0; k < NV; k++) {
      let x = rest[k * 2], y = rest[k * 2 + 1];
      const x0 = x, y0 = y;
      let wm = this.wMain[k], wo = this.wOff[k], wh = this.wHead[k], wt = this.wTail[k];

      if (wm > 0.001 && am) {
        let r = rot(x, y, mS, am * wm);
        if (A.hasTipM) { const hp2 = rot(A.handMain[0], A.handMain[1], mS, am); r = rot(r[0], r[1], hp2, -0.7 * am * wm * this.wTipM[k]); }
        x = r[0]; y = r[1];
      }
      if (wo > 0.001 && ao) {
        let r = rot(x, y, oS, ao * wo);
        if (A.hasTipO) { const hp2 = rot(A.handOff[0], A.handOff[1], oS, ao); r = rot(r[0], r[1], hp2, -0.7 * ao * wo * this.wTipO[k]); }
        x = r[0]; y = r[1];
      }
      if (wh > 0.001 && p.head) { const r = rot(x, y, nk, p.head * wh); x = r[0]; y = r[1]; }
      if (wt > 0.001 && p.tail && A.hasTail) { const r = rot(x, y, tb, p.tail * wt); x = r[0]; y = r[1]; }
      // 呼吸：上半身略微拉高，胸口横向鼓一点
      const br = p.breath;
      if (br) {
        y = h + (y - h) * (1 + 0.016 * br * (1 - y0 / h));
        x = w / 2 + (x - w / 2) * (1 + 0.012 * br * this.wChest[k]);
      }
      // 压扁 / 拉长（绕脚底）
      if (p.squash) {
        y = h + (y - h) * (1 - 0.14 * p.squash);
        x = w / 2 + (x - w / 2) * (1 + 0.1 * p.squash);
      }
      // 弯腰 / 后仰
      const wb = this.wBend[k];
      if (wb > 0.001) {
        if (p.bend) { const r = rot(x, y, hp, p.bend * wb); x = r[0]; y = r[1]; }
        x += p.dx * wb; y += p.dy * wb;
      }
      // 衣摆
      const wv = this.wHem[k];
      if (wv > 0.001 && p.wave) x += p.wave * wv * Math.sin(p.wavePhase + (y0 / h) * 8 + (x0 / w) * 3);
      pos[k * 2] = x; pos[k * 2 + 1] = y;
    }
    return pos;
  }
}

export function gridIndices(): Uint16Array {
  const idx = new Uint16Array(COLS * ROWS * 6);
  let n = 0;
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const a = j * (COLS + 1) + i, b = a + 1, c = a + COLS + 1, d = c + 1;
      idx[n++] = a; idx[n++] = c; idx[n++] = b; idx[n++] = b; idx[n++] = c; idx[n++] = d;
    }
  }
  return idx;
}

/** 把 Actor 的关节姿势（POSES 里的角度）+ 待机时间折算成木偶形变参数。纯函数，可测试。 */
export function puppetPose(P: Record<string, number>, t: number, phase: number, o: { alive: boolean; moving: boolean }): PuppetPose {
  const g = (k: string, d = 0) => P[k] ?? d;
  const tt = t * 2 + phase;
  const live = o.alive ? 1 : 0;
  const b = Math.sin(tt);
  const run = o.moving ? Math.sin(t * 16) : 0;
  const armK = 0.42;
  return {
    main: clampN(g('armR.0') * armK, -72, 40) + live * Math.sin(tt + 0.3) * 2.2,
    off: clampN(g('armL.0') * armK, -50, 32) + live * Math.sin(tt + 0.6) * 2.4,
    head: g('head.0') * 0.9 + live * b * 1.2,
    bend: g('torso.0') * 1.1 + live * (Math.sin(tt * 0.5) * 0.7 + run * 2.5),
    tail: live * (Math.sin(tt * 0.8 + 1.2) * 9 + (o.moving ? Math.sin(t * 11) * 6 : 0)),
    dx: g('torso.1') * 0.7 + live * Math.sin(tt * 0.5) * 1.2,
    dy: g('torso.2') * 0.7 + (o.moving ? -Math.abs(run) * 3 : 0),
    breath: live * b,
    wave: live ? 2.4 + (o.moving ? 3 : 0) : 0.5,
    wavePhase: tt * 1.1,
    squash: 0,
  };
}
