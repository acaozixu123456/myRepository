// 项目已有 esbuild 内存打包；不生成脚本文件，也不改技能数据。
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

try {
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL('./skill-consistency.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'cjs', target: 'node22', write: false, external: ['typescript'],
  });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const source = readFileSync(new URL('../src/data/skills.ts', import.meta.url), 'utf8');
  process.exitCode = loaded.exports.runSkillConsistencyCli(process.argv.slice(2), loaded.exports.realSkillSources(source));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
