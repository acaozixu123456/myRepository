# 第三方素材与许可

| 内容 | 来源 | 许可 |
| --- | --- | --- |
| 界面图标（`src/ui/noto.ts`） | [Noto Emoji](https://github.com/googlefonts/noto-emoji)（Google），通过 [@iconify-json/noto](https://www.npmjs.com/package/@iconify-json/noto) 取得 SVG | Apache License 2.0 |
| 页面文字里的 emoji（`src/ui/emoji.ts` + `emojify.ts` 运行时替换为内嵌矢量图，所有设备长得一样） | 同上 Noto Emoji；emoji → 名称对照用 [unicode-emoji-json](https://www.npmjs.com/package/unicode-emoji-json)（MIT） | Apache-2.0 / MIT |
| 地面贴图（`assets/world/ground/cc0_*.webp`，已缩到 512²）：云岛草地 Grass005、沙漠风纹沙地 Ground080、雪岭雪地 Snow014、海湾沙滩 Ground093C 与湿沙滩涂 Ground054（森林草地、码头木栈板改用 Codex 的 AI 贴图，更贴合场景色调） | [ambientCG](https://ambientcg.com/)（Lance / Struffel Productions） | CC0（公有领域） |
| 3D 库 | [three.js](https://threejs.org/) | MIT |

按钮上的 ✕ / ✔ / ＋ / ⬆ 等功能符号为自绘。新增第三方素材请先确认许可（优先 CC0 / MIT / Apache 2.0），并在此登记。
