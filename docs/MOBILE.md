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

## 上架前要补的事
- **字体离线化**：现在从 Google Fonts 加载 `ZCOOL KuaiLe` / `Noto Sans SC`，手机离线会退回系统字体。上架前把字体子集化后放进 `public/fonts/`，在 `index.html` 里改成本地 `@font-face`。
- **存档**：目前是 `localStorage`（键 `maoguozhi.save.v1`，`v` 字段为存档版本）。上架前换 `@capacitor/preferences`，并加云存档。
- **安全区**：已经使用 `env(safe-area-inset-*)`；真机验收刘海 / 底部手势条。
- **性能**：立绘与背景首次进入时会栅格化并缓存（`buildRig` / `bg` 缓存）；低端机需要真机跑一遍确认首场战斗的加载时间。
- **图标 / 启动图**：用 `@capacitor/assets` 生成；图标素材需要手绘，不要用 AI 图。
