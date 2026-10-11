# 猫国志（暂定名）

放置挂机卡牌 RPG 手游，玩法参考《三国志幻想大陆》。所有角色都是猫猫，六大阵营：魏 / 蜀 / 吴 / 群 / 蛮 / 仙。

- 设计总览：[docs/00-overview.md](docs/00-overview.md)
- 设定集展示页：`docs/showcase.html`（浏览器直接打开）
- 阵营 / 图鉴 / 战斗语言：`docs/01-factions.md`、`docs/02-heroes.md`、`docs/03-battle-language.md`

## 开发
```bash
npm install
npm run dev                         # 本地预览（dev.html 为立绘调试页）
node tools/build-showcase.mjs       # 重新生成 docs/showcase.html
npx esbuild tools/gen.ts --bundle --platform=node --format=esm --outfile=.shots/gen.mjs && node .shots/gen.mjs   # 重新生成文档与 SVG
node tools/export-png.mjs           # 导出立绘 PNG
```
