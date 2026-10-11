import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { runBalance } from '../src/game/balance';
import type { BalanceOptions } from '../src/game/balance';
import { renderBalanceReport } from './balance-report';

const usage = `猫国志数值平衡模拟器

npm run balance -- [参数]
  --games <正偶数>                 随机主样本实际局数，默认 3000（交换双方）
  --level <整数>                   英雄等级，默认 60
  --star <1～5>                    星级，默认 5
  --seed <整数>                    随机种子，默认 20261011
  --random-awakening <true|false>   随机选择觉醒分支，默认 true
  --no-random-awakening            五星统一使用路线 A
  --out <路径>                     报告路径，默认 docs/BALANCE_REPORT.md
  --help                           显示帮助

另跑克制环和羁绊探针，样本数、实际总局数与统计口径见生成报告。
技能等级固定 10；星级不足 5 时不应用觉醒，五星关闭随机时统一用路线 A。`;

function parseArgs(args: string[]): { options: BalanceOptions; output: string } {
  const options: BalanceOptions = {};
  let output = 'docs/BALANCE_REPORT.md';
  const numeric = new Map<string, 'games' | 'level' | 'star' | 'seed'>([
    ['--games', 'games'], ['--level', 'level'], ['--star', 'star'], ['--seed', 'seed'],
  ]);
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--no-random-awakening') { options.randomAwakening = false; continue; }
    const key = numeric.get(flag);
    if (!key && flag !== '--random-awakening' && flag !== '--out') throw new Error(`未知参数：${flag}，使用 --help 查看用法`);
    const value = args[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} 缺少参数值`);
    if (key) {
      if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`${flag} 须为安全整数`);
      options[key] = Number(value);
    } else if (flag === '--random-awakening') {
      if (value !== 'true' && value !== 'false') throw new Error('--random-awakening 须为 true 或 false');
      options.randomAwakening = value === 'true';
    } else {
      if (!value.trim()) throw new Error('--out 不能为空');
      output = value;
    }
  }
  return { options, output };
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return; }
  const { options, output } = parseArgs(args);
  const started = performance.now();
  const report = runBalance(options);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, renderBalanceReport(report, new Date().toISOString()), 'utf8');
  console.log(`报告：${output}（${((performance.now() - started) / 1000).toFixed(2)} 秒）`);
  console.log('异常清单：');
  for (const anomaly of report.anomalies) console.log(`- ${anomaly.message}`);
  if (!report.anomalies.length) console.log('- 没有达到阈值的项目。');
  if (report.lowSamples.length) console.log(`低样本提示：${report.lowSamples.map((sample) => `${sample.name} ${sample.samples}/${sample.required}`).join('；')}`);
}

try { main(); }
catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
