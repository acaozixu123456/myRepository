// 立绘「木偶」锚点：每只猫的肩 / 手 / 武器尖 / 头颈 / 尾巴位置，坐标是立绘裁边后的归一化 (u, v)，左上角为 (0,0)。
// 没填的猫用 DEFAULT_ANCHORS（按立绘统一构图估的）。新立绘入库后，在 ANCHORS 里补一行就能让它的手臂 / 武器 / 尾巴单独动起来。
export type P2 = [number, number];
export interface ArmAnchor { shoulder: P2; hand: P2; tip?: P2 } // tip：武器 / 法器末端，整条链一起摆
export interface PuppetAnchors {
  head: P2; // 头部中心
  neck: P2; // 头部转动支点（下巴稍下）
  main: ArmAnchor; // 持武器的手臂（对应招式姿势里的 armR）
  off: ArmAnchor; // 另一只手臂（armL）
  tail?: { base: P2; tip: P2 };
  hip: P2; // 腰部支点：弯腰 / 后仰绕它转
}

export const DEFAULT_ANCHORS: PuppetAnchors = {
  head: [0.5, 0.22],
  neck: [0.5, 0.42],
  main: { shoulder: [0.72, 0.44], hand: [0.82, 0.58], tip: [0.9, 0.3] },
  off: { shoulder: [0.28, 0.44], hand: [0.2, 0.58] },
  tail: { base: [0.8, 0.78], tip: [0.95, 0.6] },
  hip: [0.5, 0.78],
};

export const ANCHORS: Record<string, Partial<PuppetAnchors>> = {
  // 刘喵备：双剑
  shu_liumiaobei: {
    head: [0.49, 0.19], neck: [0.5, 0.36],
    main: { shoulder: [0.72, 0.42], hand: [0.81, 0.52], tip: [0.95, 0.08] },
    off: { shoulder: [0.28, 0.42], hand: [0.18, 0.53], tip: [0.05, 0.08] },
    tail: { base: [0.83, 0.78], tip: [0.95, 0.6] },
  },
  // 庞喵统：长弓（弓在画面右手），尾巴在左
  shu_pangmiaotong: {
    head: [0.51, 0.24], neck: [0.5, 0.44],
    main: { shoulder: [0.72, 0.43], hand: [0.9, 0.57], tip: [0.88, 0.2] },
    off: { shoulder: [0.3, 0.44], hand: [0.21, 0.57] },
    tail: { base: [0.16, 0.72], tip: [0.04, 0.6] },
  },
  // 曹喵德：剑在画面左手
  wei_caomiaode: {
    head: [0.5, 0.26], neck: [0.5, 0.47],
    main: { shoulder: [0.28, 0.43], hand: [0.14, 0.57], tip: [0.05, 0.05] },
    off: { shoulder: [0.68, 0.43], hand: [0.74, 0.55] },
    tail: { base: [0.8, 0.78], tip: [0.96, 0.62] },
  },
  // 司马喵懿：羽扇在画面右手，尾巴在左
  wei_simamiyi: {
    head: [0.51, 0.27], neck: [0.5, 0.47],
    main: { shoulder: [0.7, 0.46], hand: [0.74, 0.72], tip: [0.83, 0.52] },
    off: { shoulder: [0.3, 0.46], hand: [0.26, 0.63] },
    tail: { base: [0.16, 0.74], tip: [0.05, 0.48] },
  },
  // 嫦喵：灵草在画面左手
  xian_changmiao: {
    head: [0.51, 0.17], neck: [0.5, 0.39],
    main: { shoulder: [0.28, 0.42], hand: [0.12, 0.53], tip: [0.05, 0.35] },
    off: { shoulder: [0.66, 0.42], hand: [0.7, 0.53] },
    tail: { base: [0.75, 0.83], tip: [0.95, 0.58] },
  },
};

export const anchorsOf = (id: string): PuppetAnchors => ({ ...DEFAULT_ANCHORS, ...(ANCHORS[id] ?? {}) });
