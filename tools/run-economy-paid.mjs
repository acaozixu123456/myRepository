// 使用现有 esbuild 在内存加载纯审查工具；固定 UTC，输出Markdown或完整JSON。
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.env.TZ = 'UTC';
try {
const args = process.argv.slice(2);
const options = {};
let output;
let json = false;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help') {
    console.log('用法：node tools/run-economy-paid.mjs [--seed 正整数] [--start UTC周一日期] [--out 路径] [--json]');
    process.exit(0);
  }
  if (arg === '--json') { json = true; continue; }
  if (!['--seed', '--start', '--out'].includes(arg) || !args[i + 1]?.trim() || args[i + 1].startsWith('--')) throw new Error(`未知或不完整参数：${arg}`);
  const value = args[++i];
  if (arg === '--seed') options.seed = Number(value);
  else if (arg === '--start') options.start = Date.parse(`${value}T00:00:00.000Z`);
  else output = value;
}
const bundled = await build({ entryPoints: [fileURLToPath(new URL('./economy-paid.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false });
const { runEconomyPaid, renderEconomyPaid } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const report = runEconomyPaid(options);
const root = fileURLToPath(new URL('../', import.meta.url));
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const spFile = fileURLToPath(new URL('../docs/SP_BALANCE_PAID.md', import.meta.url));
let spSummary;
if (existsSync(spFile)) {
  const paragraphs = readFileSync(spFile, 'utf8').split(/\r?\n\r?\n/);
  const summary = paragraphs.find((p) => p.startsWith('启用命名羁绊、同战力汇总：'));
  const baseline = paragraphs.find((p) => p.startsWith('运行时 HEAD：'));
  if (summary) spSummary = `独立SP报告摘要（复算时请先运行SP工具）：\n\n${baseline ?? '基线见独立报告。'}\n\n${summary}`;
}
const text = json ? `${JSON.stringify(report, null, 2)}\n` : renderEconomyPaid(report, revision, spSummary);
if (output) { writeFileSync(output, text); console.log(`已写入 ${output}（UTC，seed=${report.seed}，${report.scenarios.length}收益情景）`); }
else process.stdout.write(text);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
