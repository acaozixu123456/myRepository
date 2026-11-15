// 数值模拟：每张地图、每个职业，在该地图中段等级、不加装备的情况下，
// 普通攻击几下打死一只同级普通怪，自动战斗打首领要几回合、胜率多少。
// 用法：npm run sim
import * as C from '../src/core/index.js';
import { ZONES, CLASSES, MONSTERS } from '../src/data/index.js';
C.seedRng(7);
const N = 300, rows = [];
for (const z of ZONES.filter(z => z.wild)) for (const cls of Object.keys(CLASSES)) {
  const lv = Math.round((z.lv[0] + z.lv[1]) / 2), s = C.newGame(cls);
  for (let i = 1; i < lv; i++) { s.hero.lv++; const g = CLASSES[cls].grow; for (const k in g) s.hero.attr[k] += g[k]; }
  // 自由点按职业主属性加
  const main = { cat: 'str', fox: 'int', rabbit: 'int' }[cls]; s.hero.attr[main] += (lv - 1) * 2; s.hero.attr.vit += lv - 1;
  let hits = 0;
  for (let i = 0; i < N; i++) {
    const id = z.wild[i % z.wild.length], b = C.startBattle(s, [{ id, lv }], false), h = b.units[0], m = b.units.at(-1);
    let n = 0; while (m.hp > 0 && n < 50) { m.hp -= C.damage(h, m, cls === 'cat' ? { kind: 'phys', power: 1 } : { kind: 'magic', power: 1.4 }).dmg; n++; }
    hits += n;
  }
  let wins = 0, rounds = 0;
  for (let i = 0; i < 100; i++) {
    C.fullHeal(s); s.bag.items.pill = 5; s.bag.items.dew = 3;
    const b = C.startBattle(s, [{ id: z.boss, lv: z.lv[1] + 1 }], true);
    while (!b.over && b.round < 40) C.runRound(b, s, C.autoHeroAction(b, s));
    if (b.over === 'win') { wins++; rounds += b.round; }
  }
  rows.push({ 地图: z.name, 职业: CLASSES[cls].name, 等级: lv, 普通怪几下: +(hits / N).toFixed(1), 单挑首领胜率: wins + '%', 首领回合: wins ? +(rounds / wins).toFixed(1) : '-' });
}
console.table(rows);
