// 部件注册表：每种 HeadGear / BodyGear / BackGear / WeaponKind / Extra 对应一个 PartBuilder。
// 现在的实现是「够认得出来」的底版；每个都可以单独替换成更精致的版本（见 docs/CODEX_3D_BRIEF.md），互不影响。
import type * as THREE from 'three';
import { BACK } from './back';
import { BODY } from './body';
import { EXTRA } from './extras';
import { HEADGEAR } from './headgear';
import { WEAPON } from './weapons';
import type { PartBuilder, PartCtx } from './types';

export type PartGroup = 'headgear' | 'body' | 'back' | 'weapon' | 'extra';
export const REGISTRY: Record<PartGroup, Record<string, PartBuilder>> = { headgear: HEADGEAR, body: BODY, back: BACK, weapon: WEAPON, extra: EXTRA };

export function buildPart(group: PartGroup, kind: string, ctx: PartCtx): THREE.Object3D | null {
  const b = REGISTRY[group][kind];
  return b ? b(ctx) : null;
}
export const registeredKinds = (g: PartGroup): string[] => Object.keys(REGISTRY[g]);
