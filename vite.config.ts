import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// index.html 是游戏本体（Capacitor 打包的入口）；dev / battle 是调试页。
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    rollupOptions: { input: { index: resolve(__dirname, 'index.html'), dev: resolve(__dirname, 'dev.html'), battle: resolve(__dirname, 'battle.html') } },
  },
});
