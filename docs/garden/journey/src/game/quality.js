// 画质档位：极高 / 高 / 中 / 低。自动模式下帧率连续几秒偏低就降一档（只减草木、阴影和地面细节，清晰度 pr 不降）；点右上角可以手动切换，手动选的档位连清晰度一起降。
// 「极高」是给电脑准备的：远处也有真影子、贴地的暗、更远的真树和草。自动模式下电脑从它开始，手机从「高」开始。
export const TIERS = {
  ultra: { label: '极高', pr: 2, shadow: 4096, shadowR: 34, far: { R: 170, size: 4096 }, ao: true, rays: true, water: true },
  high: { label: '高', pr: 2, shadow: 2048, shadowR: 26 },
  mid: { label: '中', pr: 1.5, shadow: 1536, shadowR: 24 },
  low: { label: '低', pr: 1.15, shadow: 1024, shadowR: 20 },
};
const ORDER = ['ultra', 'high', 'mid', 'low'];
// 手机上「极高」排在最后（点一下不会先跳到最重的一档）
const CYCLE = ['auto', 'ultra', 'high', 'mid', 'low'], CYCLE_M = ['auto', 'high', 'mid', 'low', 'ultra'];
// 像是电脑（鼠标、不是手机平板）就从「极高」开始
export const isDesktop = () => { try { return matchMedia('(pointer: fine)').matches && !navigator.maxTouchPoints && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent); } catch { return false; } };

export class Quality {
  // apply(tier) 由外面实现：改像素比、阴影贴图和植被半径
  constructor(apply, start = 'high') {
    this.apply = apply; this.mode = 'auto'; this.tier = start; this.autoStart = start;
    this.acc = 0; this.frames = 0; this.fps = 0; this.low = 0; this.cool = 4;
    this.samples = []; // 骑行中每秒的帧率，结尾统计用
    this.recording = false;
  }
  get label() { return (this.mode === 'auto' ? '自动·' : '') + TIERS[this.tier].label; }
  // 每帧调用，dt 是真实间隔（秒）
  frame(dt) {
    if (dt > 0.5) { this.acc = 0; this.frames = 0; return false; } // 切到后台回来，丢掉
    this.acc += dt; this.frames++;
    if (this.acc < 1) return false;
    this.fps = this.frames / this.acc; this.acc = 0; this.frames = 0;
    if (this.recording) this.samples.push(this.fps);
    if (this.mode === 'auto') {
      if (this.cool > 0) this.cool--;
      else {
        this.low = this.fps < 46 ? this.low + 1 : 0;
        if (this.low >= 3 && this.tier !== 'low') { this.set(ORDER[ORDER.indexOf(this.tier) + 1]); this.onAutoDrop?.(this.tier); }
      }
    }
    return true;
  }
  set(tier) { this.tier = tier; this.low = 0; this.cool = 4; this.apply(tier); }
  // 点按切换：自动 → 极高 → 高 → 中 → 低 → 自动
  cycle() {
    const C = isDesktop() ? CYCLE : CYCLE_M;
    this.mode = C[(C.indexOf(this.mode) + 1) % C.length];
    if (this.mode === 'auto') { this.autoStart = isDesktop() ? 'ultra' : 'high'; this.onAutoDrop?.(null); this.set(this.autoStart); } else this.set(this.mode);
  }
  stats() {
    const a = this.samples; if (!a.length) return null;
    const avg = a.reduce((x, y) => x + y, 0) / a.length;
    const sorted = [...a].sort((x, y) => x - y);
    return { avg: Math.round(avg), low: Math.round(sorted[Math.floor(sorted.length * 0.05)]), n: a.length };
  }
}
