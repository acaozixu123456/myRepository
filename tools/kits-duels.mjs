// #20 的可复算首版报告；不设胜率门槛、不根据报告自动改动战斗数值。
// node tools/kits-duels.mjs [seed 数=20] > .shots/kits-duels.md
import { build } from 'esbuild';

const seeds = Number(process.argv[2] ?? 20);
if (!Number.isInteger(seeds) || seeds < 1 || seeds > 1000) throw new Error('seed 数须为 1～1000 的整数');
const bundled = await build({
  stdin: {
    contents: "export { simulate } from './src/engine/battle'; export { HEROES } from './src/data/heroes'; export { KITS_SR } from './src/data/kits/sr';",
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', target: 'node22', write: false,
});
const { simulate, HEROES, KITS_SR } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const setup = (heroId) => [{ heroId, level: 60, star: 1, skillLv: 1, pos: 0 }];
const pct = (n, total) => `${(100 * n / total).toFixed(1)}%`;

console.log('# 剩余十二只猫：单挑模拟\n');
console.log(`命令：\`node tools/kits-duels.mjs ${seeds}\`。十二只分别对战其他 23 只英雄，seed 1～${seeds}，每个 seed 交换双方。均为 60 级、1 星、绝技 1 级、零元气开局、30 回合上限。`);
console.log(`\n每只 ${23 * seeds * 2} 局；结算胜率为胜局占总局数，平局另列。上限局指双方仍有猫存活时由引擎按剩余生命比例判胜，不能等同于击倒。单挑不能衡量群疗、群盾、阵营或指定英雄联动的团队价值。\n`);
console.log('| 猫猫 | 稀有度 / 职业 | 胜 / 负 / 平 | 结算胜率 | 击倒胜率 | 上限局比例 |');
console.log('| --- | --- | --- | ---: | ---: | ---: |');
for (const hero of HEROES.filter((candidate) => Object.hasOwn(KITS_SR, candidate.id))) {
  let wins = 0, losses = 0, draws = 0, capped = 0, knockouts = 0;
  for (const other of HEROES.filter((candidate) => candidate.id !== hero.id)) {
    for (let seed = 1; seed <= seeds; seed++) {
      for (const side of ['A', 'B']) {
        const result = simulate({
          seed, maxRounds: 30, startEnergy: 0,
          A: setup(side === 'A' ? hero.id : other.id),
          B: setup(side === 'B' ? hero.id : other.id),
        });
        if (result.events.at(-1)?.t !== 'end') throw new Error(`战斗未结束：${hero.id}/${other.id}/${seed}`);
        const bothAlive = ['A', 'B'].every((team) => result.units.some((unit) => unit.side === team && unit.alive));
        if (bothAlive) capped++;
        if (result.winner === side) { wins++; if (!bothAlive) knockouts++; }
        else if (result.winner === 'draw') draws++;
        else losses++;
      }
    }
  }
  const total = wins + losses + draws;
  console.log(`| ${hero.name} | ${hero.rarity} / ${hero.role} | ${wins} / ${losses} / ${draws} | ${pct(wins, total)} | ${pct(knockouts, total)} | ${pct(capped, total)} |`);
}
