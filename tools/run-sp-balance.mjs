// 使用已有 esbuild 内存打包；导入纯工具不会自动开始模拟。
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

try {
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL('./sp-balance.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false,
  });
  const tool = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
  tool.runSpBalanceCli(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
