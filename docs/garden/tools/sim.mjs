// 数值模拟：每张地图、每个职业，在该地图中段等级、均衡加点、不加装备的情况下，
// 1) 普通攻击（或主力法术）几下打死一只同级普通怪（目标 3 到 4 下）
// 2) 英雄 + 两只同级伙伴自动打首领，胜率和英雄回合数（目标 8 到 12 回合）
// 3) 普通遭遇战的胜率和英雄回合数
// 用法：npm run sim  （可加场数：npm run sim -- 300）
import * as C from '../src/core/index.js';
import { ZONES, CLASSES } from '../src/data/index.js';
C.seedRng(7);
const N = +(process.argv[2] || 1000), rows = [];

function heroAt(cls, lv, zone) {
  const s = C.newGame(cls);
  for (let i = 1; i < lv; i++) {
    s.hero.lv++; s.hero.sp++; const g = CLASSES[cls].grow; for (const k in g) s.hero.attr[k] += g[k];
    const learned = CLASSES[cls].skills.find(([l]) => l === s.hero.lv); if (learned) s.hero.skills[learned[1]] = 1;
  }
  const main = { cat: 'str', fox: 'int', rabbit: 'int' }[cls]; s.hero.attr[main] += (lv - 1) * 2; s.hero.attr.vit += lv - 1;
  // 技能点平均加
  const ids = C.heroSkills(s); for (let i = 0; s.hero.sp > 0 && i < 200; i++) C.raiseSkill(s, ids[i % ids.length]);
  // 两只本地图的伙伴
  for (const id of zone.wild.slice(0, 2)) C.addPet(s, id, lv);
  s.world.zone = zone.id;
  return s;
}
function fight(s, enemies, isBoss) {
  C.fullHeal(s); s.bag.items.pill = 3; s.bag.items.dew = 2;
  const b = C.startBattle(s, enemies, isBoss); let ev = C.play(b, s, null);
  while (!b.over && b.turn < 60) ev = C.play(b, s, C.autoHeroAction(b, s));
  return b;
}

for (const z of ZONES.filter(z => z.wild)) for (const cls of Object.keys(CLASSES)) {
  const lv = Math.round((z.lv[0] + z.lv[1]) / 2), s = heroAt(cls, lv, z);
  let hits = 0;
  for (let i = 0; i < N; i++) {
    const id = z.wild[i % z.wild.length], b = C.startBattle(s, [{ id, lv }], false), h = b.units[0], m = b.units.at(-1);
    const sk = cls === 'cat' ? { kind: 'phys', power: 1 } : C.skillAt(CLASSES[cls].skills[0][1], s.hero.skills[CLASSES[cls].skills[0][1]]);
    let n = 0; while (m.hp > 0 && n < 50) { m.hp -= C.damage(h, m, sk).dmg; n++; }
    hits += n;
  }
  let bw = 0, bt = 0, nb = Math.ceil(N / 5); const sb = heroAt(cls, z.lv[1], z); // 打首领时按地图上限等级
  for (let i = 0; i < nb; i++) { const b = fight(sb, [{ id: z.boss, lv: z.lv[1] + 1 }, { id: z.wild[i % z.wild.length], lv: z.lv[1] }], true); if (b.over === 'win') { bw++; bt += b.turn; } }
  let ww = 0, wt = 0, nw = Math.ceil(N / 5);
  for (let i = 0; i < nw; i++) { const b = fight(s, C.makeEncounter(z, z.wild[i % z.wild.length], false), false); if (b.over === 'win') { ww++; wt += b.turn; } }
  rows.push({ 地图: z.name, 职业: CLASSES[cls].name, 等级: lv, 普通怪几下: +(hits / N).toFixed(1), 野战胜率: Math.round(ww / nw * 100) + '%', 野战回合: ww ? +(wt / ww).toFixed(1) : '-', 首领时等级: z.lv[1], 首领胜率: Math.round(bw / nb * 100) + '%', 首领回合: bw ? +(bt / bw).toFixed(1) : '-' });
}
console.table(rows);
