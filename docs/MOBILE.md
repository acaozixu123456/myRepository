# 打包成手游（Capacitor）

游戏本体是 `index.html`（Vite 构建到 `dist/`）。目前只做了 Web 版，原生壳按下面步骤生成即可，**不需要改游戏代码**。

```bash
npm run build                                 # 产物在 dist/
npm i -D @capacitor/core @capacitor/cli
npx cap init 猫国志 com.maoguozhi.app --web-dir=dist
npm i @capacitor/android @capacitor/ios
npx cap add android && npx cap add ios
npx cap sync && npx cap open android          # 或 ios
```

## 已经是可安装的网页应用（PWA）
`public/` 里有 `manifest.webmanifest`、图标（`icons/`，由程序化猫猫渲染的占位图标）和 `sw.js`（同源请求「先用缓存、后台更新」）。正式构建（`npm run build`）后首次联网打开，之后断网也能启动；手机浏览器里可以「添加到主屏幕」。开发服务器不注册 Service Worker。图标是占位，上架前请换成手绘图标（见下）。

## 开发者发放（测试号福利）
`src/app/main.ts` 里有一次性的「20 万月光珠」测试发放：开发服务器和单文件试玩版（`docs/app.html`）会发；**Vite 正式构建（`npm run build`）默认不发**，要在地址后加 `?dev=1` 才发。上架前请确认删掉这段发放。

## 上架前要补的事
- **字体离线化**：现在从 Google Fonts 加载 `ZCOOL KuaiLe` / `Noto Sans SC`，手机离线会退回系统字体。上架前把字体子集化后放进 `public/fonts/`，在 `index.html` 里改成本地 `@font-face`。
- **存档**：目前是 `localStorage`（键 `maoguozhi.save.v1`，`v` 字段为存档版本）。上架前换 `@capacitor/preferences`，并加云存档。
- **安全区**：已经使用 `env(safe-area-inset-*)`；真机验收刘海 / 底部手势条。
- **性能**：立绘与背景首次进入时会栅格化并缓存（`buildRig` / `bg` 缓存）；低端机需要真机跑一遍确认首场战斗的加载时间。
- **图标 / 启动图**：用 `@capacitor/assets` 生成；图标素材需要手绘，不要用 AI 图。
