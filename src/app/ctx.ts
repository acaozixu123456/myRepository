import type { BattleLoop } from './battleLoop';
import type { PlayerState } from '../game/state';

export type ScreenId = 'home' | 'lineup' | 'gacha' | 'campaign' | 'bag' | 'quests' | 'shop' | 'pay';

export interface AppCtx {
  s: PlayerState;
  root: HTMLElement;
  loop: BattleLoop;
  save(): void;
  toast(msg: string): void;
  go(screen: ScreenId): void;
  openHero(id: string): void;
  /** 结算弹窗：win / 标题 / 奖励 / 失败提示 / 主按钮 */
  result(o: { win: boolean; title: string; gain?: { fish?: number; exp?: number; bells?: number; catnip?: number }; hint?: string; again?: { act: string; label: string; data?: Record<string, string> } }): void;
  /** 重新渲染当前界面与顶栏 */
  refresh(): void;
  screen: ScreenId;
}
