// 用项目已有 esbuild 在内存里打包，参数原样交给 tools/balance.ts。
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('./balance.ts', import.meta.url))],
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false,
});
await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
