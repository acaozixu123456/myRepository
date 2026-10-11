// 重放基线 campaign；当前引擎和英雄保持一致，只比较规则改动。
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const options = { games: 100, seed: 20261011, baseline: 'e5c024c', out: 'docs/BOSS_BALANCE_REPORT.md' };
try {
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    if (!Object.hasOwn(options, key) || args[i + 1] === undefined) throw new Error('参数：--games N --seed N --baseline REF --out PATH');
    options[key] = key === 'games' || key === 'seed' ? Number(args[i + 1]) : args[i + 1];
  }
  if (!Number.isSafeInteger(options.games) || options.games < 1 || options.games > 5000 ||
      !Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 2 ** 32 - 1) throw new Error('games须为1～5000整数，seed须为uint32整数');
  if (!/^[a-zA-Z0-9_./-]+$/.test(options.baseline)) throw new Error('baseline须为git引用');
  const baseline = execFileSync('git', ['rev-parse', '--verify', options.baseline + '^{commit}'], { cwd: root, encoding: 'utf8' }).trim();
  const campaign = execFileSync('git', ['show', baseline + ':src/content/campaign.ts'], { cwd: root, encoding: 'utf8' });
  async function loadProbe(contents) {
    const plugins = contents === undefined ? [] : [{
      name: 'baseline-campaign',
      setup(builder) {
        builder.onLoad({ filter: /[/\\]src[/\\]content[/\\]campaign\.ts$/ }, () => ({
          contents, loader: 'ts', resolveDir: resolve(root, 'src/content'),
        }));
      },
    }];
    const bundled = await build({
      entryPoints: [resolve(root, 'tools/boss-balance.ts')], bundle: true,
      platform: 'node', format: 'esm', target: 'node22', write: false, plugins,
    });
    return import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  }
  const before = await loadProbe(campaign);
  const after = await loadProbe();
  const oldRows = before.probeBosses(options.games, options.seed);
  const rows = after.probeBosses(options.games, options.seed);
  const output = resolve(root, options.out);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, after.renderBossComparison(oldRows, rows, baseline, options.seed), 'utf8');
  console.log('报告：' + output);
  for (const row of rows) {
    const old = oldRows.find((entry) => entry.stageId === row.stageId);
    console.log(row.stageId + '：' + old.wins + '/' + row.games + ' → ' + row.wins + '/' + row.games);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
