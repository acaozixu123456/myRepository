// 打包设定集展示页：docs/showcase.html（完整文档）与 artifact 片段（给发布用）
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const outDir = process.argv[2] ?? '.shots';
const res = await build({ entryPoints: ['src/showcase/main.ts'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false });
const js = res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const css = readFileSync('src/showcase/style.css', 'utf8');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&family=ZCOOL+KuaiLe&display=swap">';
const body = `<title>猫国志设定集</title>\n${fonts}\n<style>${css}</style>\n<div id="app"></div>\n<script>${js}</script>\n`;
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/showcase-fragment.html`, body);
mkdirSync('docs', { recursive: true });
writeFileSync('docs/showcase.html', `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${body.replace('<title>', '<title>').replace(/\n<div id="app">/, '\n</head><body><div id="app">')}</body></html>`.replace('</head><body><div id="app"></div>\n<script>', '</head><body><div id="app"></div>\n<script>'));
console.log('built', (body.length / 1024).toFixed(0) + 'KB');
