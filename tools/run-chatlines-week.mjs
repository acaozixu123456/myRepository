// worldFeed 在模块加载时建立本地开服日；先固定 UTC，再加载真实游戏模块。
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.length > 1 || args.some((arg) => !['--json', '--help'].includes(arg))) {
  process.stderr.write('用法：npm run chatlines:week -- [--json|--help]\n');
  process.exitCode = 2;
} else if (args[0] === '--help') {
  process.stdout.write('固定 UTC 2026-10-05 至 2026-10-11，运行真实 worldFeed；--json 输出可核验数据。\n');
} else {
  process.env.TZ = 'UTC';
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL('./chatlines-week.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false,
  });
  const module = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  const report = module.simulateChatlineWeek();
  process.stdout.write(args[0] === '--json' ? JSON.stringify(report, null, 2) + '\n' : module.renderChatlineWeek(report));
}
