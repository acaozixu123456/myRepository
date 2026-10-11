import type { BattleLoop } from './battleLoop';
import type { PlayerState } from '../game/state';

export type ScreenId = 'home' | 'lineup' | 'gacha' | 'campaign' | 'bag';

export interface AppCtx {
  s: PlayerState;
  root: HTMLElement;
  loop: BattleLoop;
  save(): void;
  toast(msg: string): void;
  go(screen: ScreenId): void;
  openHero(id: string): void;
  /** 重新渲染当前界面与顶栏 */
  refresh(): void;
  screen: ScreenId;
}
