// 画面模式开关（独立小模块，避免界面层与战斗回放器互相引用）。
import { Renderer3D } from './renderer';

/** illust：有 AI 立绘的猫战斗里用整张立绘；cat3d：全员用 3D 小猫（需要 WebGL）。 */
export const spriteMode = { illust: true, cat3d: false };
/** 当前是否用 3D 小猫 */
export const use3D = (): boolean => spriteMode.cat3d && Renderer3D.ok;
