import type { Effect, Scale, TargetSel } from '../../engine/types';
import type { FactionId } from '../factions';

export const enemy = (pick: TargetSel['pick'], n?: number, extra: Partial<TargetSel> = {}): TargetSel => ({ side: 'enemy', pick, n, ...extra });
export const ally = (pick: TargetSel['pick'], n?: number, extra: Partial<TargetSel> = {}): TargetSel => ({ side: 'ally', pick, n, ...extra });
export const self: TargetSel = { side: 'self', pick: 'self' };

export const dmg = (atk: number, o: Partial<Extract<Effect, { t: 'damage' }>> = {}): Effect => ({ t: 'damage', scale: { atk }, ...o });
export const heal = (atk: number, to?: TargetSel): Effect => ({ t: 'heal', scale: { atk }, to });
export const shield = (atk: number, turns: number, to?: TargetSel): Effect => ({ t: 'shield', scale: { atk }, turns, to });
export const status = (id: string, turns: number, o: { p?: number; power?: number; stacks?: number; snapAtk?: number; to?: TargetSel } = {}): Effect => ({
  t: 'status', id, turns, p: o.p, power: o.power, stacks: o.stacks, snap: o.snapAtk ? { atk: o.snapAtk } : undefined, to: o.to,
});
export const energy = (amount: number, to?: TargetSel): Effect => ({ t: 'energy', amount, to });
export const factionAllies = (f: FactionId): TargetSel => ({ side: 'ally', pick: 'all', faction: f });
export const text = (t: string): Effect => ({ t: 'text', text: t });

export const SCALE0: Scale = {};
