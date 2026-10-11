# 猫国志开发文档入口

先读 [贡献者指南](CONTRIBUTING.md)、[AGENTS.md](../AGENTS.md) 与 [长期协作守则](CODEX_STANDING_ORDERS.md)。项目主分支和PR base：**claude/awesome-babbage-ygba4h**。

这里按阅读目的分组；设计规划、历史报告和当前源码有不同时间范围，运行能力与英雄数量以当前源码为准。常规英雄使用STANDARD_HEROES，SP使用PREMIUM_HEROES，全量集合为HEROES，详见 [贡献者指南的统计口径](CONTRIBUTING.md#常规与至尊英雄口径)。

## 内容数据与设定

| 文档 | 对应源码 |
|---|---|
| [早期设计总览与世界观](00-overview.md) | [内容契约](../src/content/types.ts) |
| [六族阵营](01-factions.md) | [factions.ts](../src/data/factions.ts) |
| [英雄图鉴与人物设定](02-heroes.md) | [heroes.ts](../src/data/heroes.ts)、[技能组](../src/data/kits/) |
| [战斗状态与职业](03-battle-language.md) | [statuses.ts](../src/data/statuses.ts)、[systems.ts](../src/data/systems.ts) |
| [战役与规则](CAMPAIGN.md) | [campaign.ts](../src/content/campaign.ts)、[主线对白](../src/content/story.ts) |
| [装备与套装](EQUIPMENT.md) | [equipment.ts](../src/content/equipment.ts)、[道具](../src/content/items.ts) |
| [杂兵与外观](MOBS.md) | [mobs.ts](../src/content/mobs.ts)、[mob-looks.ts](../src/data/mob-looks.ts) |
| [经济与成长预算](ECONOMY.md) | [economy.ts](../src/content/economy.ts)、[成长公式](../src/content/progression.ts) |

## 游戏逻辑与界面接入

| 文档或入口 | 对应源码 |
|---|---|
| [背包与装备实例](INVENTORY.md) | [inventory.ts](../src/game/inventory.ts)、[装备战斗适配](../src/game/gear.ts) |
| [任务追踪与周期](QUESTS.md) | [quests.ts](../src/game/quests.ts)、[periods.ts](../src/game/periods.ts) |
| [商店与购买](SHOP.md) | [shop.ts](../src/game/shop.ts) |
| [存档与养成](../src/game/state.ts)、[招募](../src/game/gacha.ts) | [至尊系统](../src/game/premium.ts) |
| [关卡适配](../src/game/stage.ts)、[爬塔](../src/game/tower.ts) | [日常副本](../src/game/dungeon.ts) |
| [模拟世界频道](../src/game/npc.ts) | [聊天语料](../src/data/chatlines.ts) |
| [手游打包方案与待办](MOBILE.md) | [应用入口](../src/app/main.ts)、[现有二级界面](../src/app/screens/) |

## 验证工具

| 工具 | 用途 |
|---|---|
| [tests/](../tests/) | npm run typecheck与npm test；Issue对应的数据与行为验收 |
| [平衡CLI](../tools/balance.ts)、[参数解析](../tools/balance-args.ts) | npm run balance -- --help；常规队随机对战、克制与羁绊探针 |
| [Boss对照runner](../tools/run-boss-balance.mjs)、[探针](../tools/boss-balance.ts) | 当前规则对git基线，同队同种子重放 |
| [截图脚本](../tools/shots.mjs) | node tools/shots.mjs URL OUT [宽] [高] [选择器] |
| [设定与SVG生成器](../tools/gen.ts)、[PNG导出](../tools/export-png.mjs) | 生成命令、覆盖范围和浏览器条件见 [贡献者指南](CONTRIBUTING.md#生成产物与真实命令) |

## 设计评审与模拟报告

- [当前常规平衡报告](BALANCE_REPORT.md)与 [命名羁绊开关对照](BALANCE_BONDS_COMPARISON.md)。
- [Issue #20技能组说明](KITS_20.md)与 [该任务基线报告](BALANCE_REPORT_KITS_20.md)。
- [Boss已实现阶段和待定契约](BOSS_TODO.md)、[Boss通关率对照](BOSS_BALANCE_REPORT.md)。
- [规则契约待办](RULES_TODO.md)与 [特效待办](FX_TODO.md)。

报告保留生成时的名册、种子和统计限制；待办中的建议不是已实现能力。

## 生成页面

- [单文件可玩版](app.html)：npm run app，源入口 [src/app/main.ts](../src/app/main.ts)。
- [设定集](showcase.html)：npm run showcase，源入口 [src/showcase/main.ts](../src/showcase/main.ts)。
- [战斗演示](battle.html)：node tools/build-battle.mjs，源入口 [src/demo/battle.ts](../src/demo/battle.ts)。

这些页面由构建器生成，改源码再按对应Issue生成，不直接修打包内容。

## 截图证据

完整附件见 [screenshots/目录](screenshots/)；示例按任务归档：

- [装备详情](screenshots/bag-25-detail.jpg)、[背包材料](screenshots/bag-25-items.jpg)。
- [魏杂兵联排](screenshots/mobs-26-wei.jpg)、[仙杂兵联排](screenshots/mobs-26-xian.jpg)。
- [每日任务](screenshots/quests-27-daily.jpg)、[领取结果](screenshots/quests-27-completed.jpg)。
- [普通商店](screenshots/shop-28-general.jpg)、[购买确认](screenshots/shop-28-confirm.jpg)。

图片应来自真实应用或既有绘制组件，视觉变化在PR附对应状态截图，单文件不超过500KB。
