# 贡献者指南

项目主分支与所有PR的base均为 **claude/awesome-babbage-ygba4h**。文档导航见 [docs目录入口](README.md)。

## 开工到评审

1. 先完整阅读 [AGENTS.md](../AGENTS.md)、[长期协作守则](CODEX_STANDING_ORDERS.md)、[设计总览](00-overview.md)及对应Issue；人物文案还要读 [英雄设定](../src/data/heroes.ts) 的 lore、quote、likes。
2. 按守则优先处理开放的Codex Issue或 [总表 #23](https://github.com/acaozixu123456/myRepository/issues/23) 中可直接做的任务。自选池工作先在总表认领，避免重复开发。
3. 一个Issue一个分支一个PR，从更新后的项目主分支建立任务分支。下面以本任务为例，新任务替换编号和英文简称：

   ~~~bash
   git fetch origin
   git switch -c codex/55-contributor-guide origin/claude/awesome-babbage-ygba4h
   npm install
   npm run dev
   ~~~

   Vite入口是根路径的游戏、/dev.html立绘调试页、/battle.html战斗演示页。常用工作目录见 [目录导航](README.md)。
4. 按Issue逐条实现，保持改动范围。遇到契约缺口或口径冲突，先在Issue提出具体方案，并继续不受影响的部分；最终在PR写明未确定事项。
5. 提交前运行：

   ~~~bash
   npm run typecheck && npm test
   git diff --check
   ~~~

   数据新增应验证唯一性、真实引用与数值边界；行为改动应覆盖可观察的成功、失败和兼容路径。验证工具与报告要写清种子、样本、版本及限制。纯文档变化核对本地链接和命令，无需额外造测试。
6. 有界面、立绘或特效变化时，把真实运行截图放进 docs/screenshots/，每个文件不超过500KB，并在PR附图。可用 [截图工具](../tools/shots.mjs) 或项目已有Playwright；脚本依赖其中配置的Chromium路径，先核对本机浏览器可用。
7. 推送任务分支后创建PR：base填写项目主分支，描述包含问题与结果、验证命令及结果、截图（适用时）、遗留事项，以及 **Closes #55**（新任务替换编号）。不要自行合并。查看Claude评审，修改后重新验证、push，直到评审合并。

## 修改边界与质量

Claude负责架构、src/art/、src/engine/、src/fx/、UI设计系统与最终评审。协作任务通常在 [内容数据](../src/content/)、[设定数据](../src/data/)、[纯游戏逻辑](../src/game/)、[验证工具](../tools/)和 [测试](../tests/) 中展开；二级界面遵循现有设计系统。

除Issue明确授权，不修改上述三个保护目录、[内容契约](../src/content/types.ts)、[AGENTS.md](../AGENTS.md)或 [长期协作守则](CODEX_STANDING_ORDERS.md)，不新增依赖、CI变更或无关重构。纯游戏逻辑不依赖DOM。

文案轻松、暖、带自然冷幽默；人物遵从设定，不复制风味句或使用网络烂梗。倒下的猫只是睡着。资源名统一为小鱼干、金铃铛、猫薄荷、毛线球、招福符、猫爪印、元气。数值调整先用已有模拟器取证，不凭感觉改战斗。

## 常规与至尊英雄口径

[heroes.ts](../src/data/heroes.ts) 导出三套集合，按功能选用，不把SP混入常规统计：

| 集合 | 范围与用途 |
|---|---|
| STANDARD_HEROES | SR / SSR / UR常规英雄；常规招募候选与当前平衡模拟器使用此集合 |
| PREMIUM_HEROES | SP至尊英雄；独立系统见 [premium.ts](../src/game/premium.ts) |
| HEROES | 全量英雄，包含上述两类；图鉴、立绘或完整引用检查按具体功能取用 |

本指南基线92646fc为24只常规、3只SP、全量27只。后续新增英雄按实际集合计算数量；历史报告按其运行时的名册解读，不把未合入名单当成当前数据。

## 生成产物与真实命令

在仓库根目录运行；源数据、源码与生成文件一起核对。以下命令均来自现有package脚本或tools，按任务需要生成，避免把无关产物带进PR。

| 产物 | 来源 | 命令 |
|---|---|---|
| dist/ | Vite应用 | npm run build |
| docs/app.html、.shots/app-fragment.html | src/app/main.ts | npm run app |
| docs/showcase.html、.shots/showcase-fragment.html | src/showcase/main.ts及style.css | npm run showcase |
| docs/battle.html、.shots/battle-fragment.html | src/demo/battle.ts | node tools/build-battle.mjs |
| docs/01-factions.md、02-heroes.md、03-battle-language.md及assets/heroes/svg/ | src/data经tools/gen.ts | 下方两步命令 |
| assets/heroes/*.png | 已生成的立绘SVG | node tools/export-png.mjs |
| 平衡Markdown报告 | 当前常规英雄、技能和引擎 | npm run balance -- --out .shots/balance-check.md |
| Boss前后对照报告 | 当前规则与git基线 | node tools/run-boss-balance.mjs --out .shots/boss-check.md |

~~~bash
npx esbuild tools/gen.ts --bundle --platform=node --format=esm --outfile=.shots/gen.mjs
node .shots/gen.mjs
~~~

gen.ts会同时覆盖三份设定文档并导出全量HEROES的SVG，其中仍有“首批24只”等固定标题；生成后检查diff与当前名册口径，不能只把它当成导图命令。PNG导出同样依赖脚本配置的Chromium。模拟器参数可查看 npm run balance -- --help；Boss对照的基线必须能在本地git历史解析。

node_modules/、dist/、.shots/是已忽略的本地目录，node_modules软链接也不入库；所需截图、报告或生成页只随对应Issue提交。
