// 打包战斗演示页：docs/battle.html（完整文档）与 artifact 片段
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
const outDir = process.argv[2] ?? '.shots';
const res = await build({ entryPoints: ['src/demo/battle.ts'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false });
const js = res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&family=ZCOOL+KuaiLe&display=swap">';
const body = `<title>猫国志战斗演示</title>\n${fonts}\n<div id="app"></div>\n<script>${js}</script>\n`;
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/battle-fragment.html`, body);
mkdirSync('docs', { recursive: true });
writeFileSync('docs/battle.html', `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#161225}</style>${body.replace('\n<div id="app">', '\n</head><body><div id="app">')}</body></html>`);
console.log('battle built', (body.length / 1024).toFixed(0) + 'KB');
