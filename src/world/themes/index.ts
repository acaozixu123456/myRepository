// 主题场景分发：LevelDef.theme → 对应的搭建函数（返回和十字街区一样的 Street）。
import type { LevelDef } from '../levels';
import type { Street } from '../street';
import { buildCloud } from './cloud';
import { buildDesert } from './desert';
import { buildForest } from './forest';
import { buildHarbor } from './harbor';
import { buildMarket } from './market';
import { buildPalace } from './palace';
import { buildSnow } from './snow';
import { buildBeach } from './beach';

export function buildTheme(L: LevelDef): Street {
  switch (L.theme) {
    case 'palace': return buildPalace(L);
    case 'cloud': return buildCloud(L);
    case 'harbor': return buildHarbor(L);
    case 'market': return buildMarket(L);
    case 'forest': return buildForest(L);
    case 'desert': return buildDesert(L);
    case 'snow': return buildSnow(L);
    case 'beach': return buildBeach(L);
    default: throw new Error(`未实现的场景主题：${L.theme}`);
  }
}
