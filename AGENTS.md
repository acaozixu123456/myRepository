# AGENTS.md —— 给 Codex / 其他自动化协作者的工作说明

项目：《猫国志》（暂定名），放置挂机卡牌 RPG 手游，玩法参考《三国志幻想大陆》，所有角色是猫猫，六大阵营：魏 / 蜀 / 吴 / 群 / 蛮 / 仙。
技术：Web H5 + TypeScript + Vite，之后用 Capacitor 打包成手游。设计总览见 `docs/00-overview.md`。

> 长期协作的完整工作流程见 `docs/CODEX_STANDING_ORDERS.md`，开工前请先读。

## 分工
- **Claude（主导）**：架构、美术管线（`src/art`）、战斗引擎（`src/engine`）、特效与动画框架（`src/fx`）、UI 设计系统、最终评审与合并。
- **Codex（你）**：大量、重复、可验证的工作：内容数据、数据校验与单元测试、数值模拟脚本、按设计系统实现的二级界面、按模板批量补全技能与特效。每个任务都在对应 GitHub Issue 里说明。
- **美术方向已改为 3D 程序化小猫（Three.js）**：现在的美术工作单是 `docs/CODEX_3D_BRIEF.md`（部件库：头饰 / 衣服 / 披挂 / 武器 / 配饰 / 毛色花纹 / 专属造型），进度见 `docs/ART3D_PROGRESS.md`；此前的 2D 立绘队列（`docs/CODEX_ILLUSTRATION_BRIEF.md`）暂停，已通过的 5 张只作造型参考。你可以改的文件范围以那份工作单为准（`src/art3d/parts/**`、`patterns.ts`、`heroes.ts`）。
- 你的产出**不能拉低整体质量**：画面、文案、可玩性都按下面的质量标准。拿不准的地方，在 PR 里写出来，不要硬猜。

## 分支与 PR 规则（重要）
- 项目主分支是 **`claude/awesome-babbage-ygba4h`**（不是 master）。所有任务**从它切分支**，PR 的 **base 也是它**。
- 分支名：`codex/<issue编号>-<简短英文>`。一个 Issue 一个 PR，PR 描述里写 `Closes #编号`。
- PR 要小而完整，不要顺手重构、不要改无关文件。**不要修改**：`src/art/**`、`src/engine/**`、`src/fx/**`、`src/content/types.ts`、`AGENTS.md`，除非 Issue 明确要求。需要改契约时，在 PR 里提出，由 Claude 处理。
- 提交前必须通过：`npm run typecheck && npm test`。新增数据文件要有对应的校验测试（见下）。
- 有视觉变化的 PR（界面、立绘、特效）必须附截图（用 `tools/shots.mjs` 或 Playwright 截图），放到 PR 描述里。

## 目录与约定
```
src/art       程序化猫猫绘制（Claude 负责）
src/data      阵营 / 猫猫 / 技能 / 状态 / 系统数据
src/content   内容数据：equipment / campaign / story / economy（你主要写这里），契约在 types.ts
src/engine    战斗引擎（Claude）
src/fx        特效与动画（Claude 做框架，你可按模板补）
tests         vitest 测试
tools         脚本
docs          设计文档
```
- 数据文件导出常量，类型来自 `src/content/types.ts`；id 用小写下划线；不要手写重复数据，能用函数生成就生成（但生成结果要在测试里校验）。
- 每个内容文件配一个 `tests/<name>.test.ts`：校验 id 唯一、引用的英雄 / 道具 / 装备 id 都存在、数值在合理范围、奖励曲线单调。

## 文案质量标准（很重要）
- 世界观：喵洲大陆，九命天子只剩最后一命，六族争夺「九命印」；玩家是被召唤来的铲屎官军师。
- 语气：轻松、暖、带冷幽默，**谐音梗要自然**（曹喵德、夏侯墩、吕布丁、董桌），不要油腻、不要网络烂梗、不要说教。
- 没有血腥：倒下的猫猫只是「睡着了」。不出现真实暴力描写。
- 专有名词统一：小鱼干（金币）、金铃铛（钻石）、猫薄荷（养成素材）、毛线球（加速券）、招福符（招募券）、猫爪印（竞技货币）、元气（怒气）。
- 道具 / 装备名要有猫味和三国味，例如「鱼骨偃月刀」「玄甲肉垫靴」。同一套装风格统一，不要出现两个意思相近的重名。
- 英雄性格以 `src/data/heroes.ts` 里的 `lore` / `quote` 为准，台词不能OOC。

## 数值约定
- 战斗属性口径见 `src/data/systems.ts`（`baseStats`）。关卡推荐战力、装备属性、经验曲线要平滑递增，相邻关卡推荐战力增幅约 4%~8%，每章 Boss 关约 +12%。
- 稀有度：SR / SSR / UR（英雄）；装备品质：common / fine / rare / epic / legend。

## 常用命令
```
npm install
npm run typecheck
npm test
npm run dev                      # 本地预览（dev.html 立绘调试页）
node tools/build-showcase.mjs    # 重新生成设定集页面
```
