// 气力：跑、爬、游、扇翅膀都要用气力，停下来或者慢慢走一会儿就回满。
// 用光了不会出事，只是这一阵跑不动、爬不住、游不远、扇不动翅膀（spent），等回到三成再接着来。
// 一格是 20，一开始五格；以后可以加格（bonus，第三步的羽毛）和吃东西临时多出来的（extra，第二步的料理）。
// free = 自在模式：什么都不耗气力（手记底下可以换）。
export const PIP = 20;

export class Stamina {
  constructor() {
    this.base = 100; this.bonus = 0; this.extra = 0;
    this.v = this.max; this.spent = false; this.free = false;
    this.wait = 0;        // 刚用过气力，等一小会儿才开始回
    this.rate = 1;        // 回得多快（冷的时候慢）
    this.used = 0;        // 这一帧用了多少（界面上用来判断要不要显示）
    this.flash = 0;       // 不够用的时候闪一下
  }
  get max() { return this.base + this.bonus; }
  get frac() { return this.v / this.max; }
  // 够不够用一下子的（跳、扇一下翅膀）
  can(n = 0) { return this.free || (!this.spent && this.v + this.extra > Math.min(n, 1)); }
  // 一下子用掉 n；气力见底就 spent
  use(n) {
    if (this.free) return true;
    if (this.spent) { this.flash = 0.6; return false; }
    this.take(n);
    return true;
  }
  // 持续消耗：每秒 rate，返回还撑不撑得住
  drain(rate, dt) {
    if (this.free) return true;
    if (this.spent) return false;
    this.take(rate * dt);
    return !this.spent;
  }
  take(n) {
    this.used += n; this.wait = 0.9;
    // 先用吃东西多出来的那一截
    const e = Math.min(this.extra, n); this.extra -= e; n -= e;
    this.v -= n;
    if (this.v <= 0) { this.v = 0; this.spent = true; this.flash = 0.8; }
  }
  // 每帧：没在用就慢慢回（resting = 站在地上、没在爬没在游没在天上）
  tick(dt, resting) {
    this.used = 0;
    if (this.flash > 0) this.flash -= dt;
    if (this.wait > 0) { this.wait -= dt; return; }
    if (!resting) return;
    if (this.v < this.max) this.v = Math.min(this.max, this.v + (this.spent ? 22 : 30) * this.rate * dt);
    if (this.spent && this.v >= Math.min(30, this.max * 0.3)) this.spent = false;
  }
  fill() { this.v = this.max; this.spent = false; this.wait = 0; }
  snapshot() { return { v: Math.round(this.v), bonus: this.bonus, extra: Math.round(this.extra) }; }
  restore(s) {
    if (!s) return;
    this.bonus = Math.max(0, Math.min(200, (s.bonus | 0)));
    this.extra = Math.max(0, Math.min(100, +s.extra || 0));
    this.v = Math.max(0, Math.min(this.max, Number.isFinite(+s.v) ? +s.v : this.max));
    this.spent = false;
  }
}
