import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { runBalance } from '../src/game/balance';
import { renderBalanceReport } from './balance-report';
import { parseBalanceArgs } from './balance-args';

const usage = `猫国志数值平衡模拟器

npm run balance -- [参数]
  --games <正偶数>                 随机主样本实际局数，默认 3000（交换双方）
  --level <整数>                   英雄等级，默认 60
  --star <1～5>                    星级，默认 5
  --seed <整数>                    随机种子，默认 20261011
  --random-awakening <true|false>   随机选择觉醒分支，默认 true
  --no-random-awakening            五星统一使用路线 A
  --no-bonds                       所有样本关闭命名羁绊，同族机制保留
  --out <路径>                     报告路径，默认 docs/BALANCE_REPORT.md
  --help                           显示帮助

另跑克制环和羁绊探针；克制探针始终关闭命名羁绊，同族机制保留。
样本数、实际总局数与统计口径见生成报告。
技能等级固定 10；星级不足 5 时不应用觉醒，五星关闭随机时统一用路线 A。`;

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return; }
  const { options, output } = parseBalanceArgs(args);
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
