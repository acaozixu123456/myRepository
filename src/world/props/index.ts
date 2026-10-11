// 场景道具注册表：关卡数据里用名字摆放。新增一组道具 = 在本目录新建一个文件，导出 Record<string, PropFactory>，在这里合并。
// 约定：原点在底部中心，+z 是正面；高度单位 ≈ 米（猫高约 3）；不要在构建函数里 new 材质（用 kit.std / kit.glowMat 的缓存）。
import type * as THREE from 'three';
import { bush, cardboardStack, cone, crystal, floatRock, lamp, pillar, planterBox, pole, stall, stoneCat, stoneLantern, trashCan, tree, vending } from '../kit';

export type PropFactory = (seed?: number, arg?: number) => THREE.Group;
export const CORE_PROPS: Record<string, PropFactory> = {
  vending: () => vending('#ff4aa8'),
  vendingCyan: () => vending('#7ff0ff'),
  vendingGold: () => vending('#ffe27a'),
  lamp: () => lamp(),
  lampPink: () => lamp('#ff9ad0'),
  pole: () => pole(),
  tree: (seed = 1, h = 3.4) => tree(h, seed),
  bush: (seed = 1, r = 0.8) => bush(r, seed),
  planter: (_s, w = 2.2) => planterBox(w),
  stall: (_s, v = 0) => stall(v),
  trashB: () => trashCan('#4a3a5a'),
  crystal: (_s, sc = 1) => crystal('#9ab8ff', sc),
  crystalPink: (_s, sc = 1) => crystal('#ff9ad8', sc),
  stoneLantern: () => stoneLantern(),
  pillar: (_s, h = 6) => pillar(h),
  stoneCat: () => stoneCat(),
  rock: (seed = 1, sc = 1) => floatRock(seed, sc),
  cardboard: (seed = 1) => cardboardStack(seed),
  trash: () => trashCan(),
  cone: () => cone(),
};
export const PROPS: Record<string, PropFactory> = { ...CORE_PROPS };
