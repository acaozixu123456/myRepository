// Compile the pure TypeScript scanner in memory; load the existing TypeScript
// package with Node's normal resolver so its CommonJS built-ins remain usable.
import { build } from 'esbuild';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HELP = [
  '用法：npm run lint:content -- [--strict] [--max-sentence-length N]',
  '  --max-sentence-length N, --max N  单句阈值，默认50；支持 =N',
  '  --strict                         有警示时退出码1；默认仅报告',
  '  --help, -h                       显示帮助',
  '扫描当前工作目录的 src/content/** 与 src/data/**；不改写历史文案。',
].join('\n');

async function sourceFiles(directory) {
  const found = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await sourceFiles(path));
    else if (entry.isFile() && /\.(?:[cm]?[jt]s|[jt]sx)$/u.test(entry.name)) found.push(path);
  }
  return found.sort();
}

try {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('./lint-content.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'cjs', target: 'node18', write: false,
    external: ['typescript'],
  });
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(
    createRequire(import.meta.url), compiled, compiled.exports,
  );
  const { lintSource, resolveOptions, lintExitCode } = compiled.exports;
  const options = resolveOptions(process.argv.slice(2));
  if (options.help) console.log(HELP);
  else {
    const root = process.cwd();
    const files = (await Promise.all([
      sourceFiles(join(root, 'src/content')),
      sourceFiles(join(root, 'src/data')),
    ])).flat().sort();
    let scanned = 0;
    let allowlisted = 0;
    const findings = [];
    console.log('内容文案检查：单句阈值 ' + options.maxSentenceLength + ' 字');
    for (const file of files) {
      const path = relative(root, file).split('\\').join('/');
      const result = lintSource(await readFile(file, 'utf8'), path, options);
      scanned += result.scanned;
      allowlisted += result.allowlisted;
      for (const finding of result.findings) {
        findings.push(finding);
        console.log(path + ':' + finding.line + ':' + finding.column + ' [' + finding.rule + '] ' + finding.message);
        console.log('  ' + JSON.stringify(finding.text));
      }
    }
    console.log('已扫描 ' + files.length + ' 个文件 / ' + scanned + ' 个字符串片段；技术上下文白名单 '
      + allowlisted + ' 个；警示 ' + findings.length + ' 条。');
    const counts = new Map();
    for (const finding of findings) counts.set(finding.rule, (counts.get(finding.rule) ?? 0) + 1);
    console.log(['sentence-length', 'english', 'violence', 'terminology']
      .map((rule) => rule + '=' + (counts.get(rule) ?? 0)).join('，'));
    process.exitCode = lintExitCode(findings, options.strict);
  }
} catch (error) {
  console.error('文案检查未完成：' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 2;
}
