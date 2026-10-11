// 打包可玩原型：docs/app.html（完整文档）与 artifact 片段
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
const outDir = process.argv[2] ?? '.shots';
const res = await build({ entryPoints: ['src/app/main.ts'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false });
const js = res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&family=ZCOOL+KuaiLe&display=swap">';
const body = `<title>猫国志</title>\n<style>html,body{height:100%;margin:0;background:#161225}</style>\n${fonts}\n<div id="app" style="height:100%"></div>\n<script>${js}</script>\n`;
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/app-fragment.html`, body);
mkdirSync('docs', { recursive: true });
writeFileSync('docs/app.html', `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${body.replace('\n<div id="app"', '\n</head><body><div id="app"')}</body></html>`);
console.log('app built', (body.length / 1024).toFixed(0) + 'KB');
