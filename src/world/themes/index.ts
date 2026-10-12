// 主题场景分发：LevelDef.theme → 对应的搭建函数（返回和十字街区一样的 Street）。
import type { LevelDef } from '../levels';
import type { Street } from '../street';
import { buildForest } from './forest';
import { buildMarket } from './market';

export function buildTheme(L: LevelDef): Street {
  switch (L.theme) {
    case 'market': return buildMarket(L);
    case 'forest': return buildForest(L);
    default: throw new Error(`未实现的场景主题：${L.theme}`);
  }
}
