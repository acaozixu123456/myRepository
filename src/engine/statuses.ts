// 状态规则：把 data/statuses.ts 里的“名字与描述”映射为可计算的修正。
export interface Mods {
  atkPct: number;
  defPct: number;
  spdPct: number;
  dmgTakenPct: number; // 受到伤害加成
  dmgDealtPct: number;
  critRate: number;
  healTakenPct: number;
}
export const ZERO_MODS = (): Mods => ({ atkPct: 0, defPct: 0, spdPct: 0, dmgTakenPct: 0, dmgDealtPct: 0, critRate: 0, healTakenPct: 0 });

export interface StatusRule {
  id: string;
  kind: 'buff' | 'debuff';
  maxStacks: number;
  /** 由 power × stacks 计算修正；返回要累加的 Mods 增量 */
  mods?: (power: number, stacks: number) => Partial<Mods>;
  flags?: ('stun' | 'silence' | 'taunt' | 'confuse' | 'dodge' | 'nine' | 'stealth')[];
  dot?: boolean; // 每回合伤害（snap × stacks）
  hot?: boolean; // 每回合治疗（power × maxHp）
  cc?: boolean; // 控制类：用于控制免疫
}

export const STATUS_RULES: Record<string, StatusRule> = {
  fluff: { id: 'fluff', kind: 'buff', maxStacks: 3, mods: (p, s) => ({ atkPct: p * s }) },
  curl: { id: 'curl', kind: 'buff', maxStacks: 1, mods: (p) => ({ defPct: p }) },
  purr: { id: 'purr', kind: 'buff', maxStacks: 1, hot: true },
  step: { id: 'step', kind: 'buff', maxStacks: 1, mods: (p) => ({ spdPct: p }) },
  ward: { id: 'ward', kind: 'buff', maxStacks: 1, mods: (p) => ({ dmgTakenPct: -p }) },
  poison: { id: 'poison', kind: 'debuff', maxStacks: 5, dot: true },
  stealth: { id: 'stealth', kind: 'buff', maxStacks: 1, flags: ['stealth'] },
  nine: { id: 'nine', kind: 'buff', maxStacks: 1, flags: ['nine'] },
  illusion: { id: 'illusion', kind: 'buff', maxStacks: 1, flags: ['dodge'] },
  taunt: { id: 'taunt', kind: 'buff', maxStacks: 1, flags: ['taunt'] },
  scratch: { id: 'scratch', kind: 'debuff', maxStacks: 3, dot: true },
  burn: { id: 'burn', kind: 'debuff', maxStacks: 5, dot: true },
  wet: { id: 'wet', kind: 'debuff', maxStacks: 1, mods: (p) => ({ defPct: -(p || 0.2) }) },
  dizzy: { id: 'dizzy', kind: 'debuff', maxStacks: 1, flags: ['stun'], cc: true },
  yarn: { id: 'yarn', kind: 'debuff', maxStacks: 1, flags: ['silence'], cc: true },
  fright: { id: 'fright', kind: 'debuff', maxStacks: 1, mods: (p) => ({ atkPct: -p }) },
  nip: { id: 'nip', kind: 'debuff', maxStacks: 1, flags: ['confuse'], mods: () => ({ dmgTakenPct: 0.2 }), cc: true },
  charm: { id: 'charm', kind: 'debuff', maxStacks: 5, mods: (p, s) => ({ dmgTakenPct: (p || 0.1) * s }) },
  mark: { id: 'mark', kind: 'debuff', maxStacks: 1, mods: () => ({ dmgTakenPct: 0.1, critRate: 0.1 }) },
};
