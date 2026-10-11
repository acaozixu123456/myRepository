# 玩法系统总览（社交 / 氪金 / 活动）

这一页是给接手的人（包括 Codex）看的地图：每个玩法在哪个文件、状态存在哪、怎么测、怎么扩展。**所有「充值」都是模拟下单**，由 `premium.recordOrder` 记账，上线时只需把入账接到支付回调。

## 一张表看全

| 玩法 | 逻辑 | 界面 | 状态字段 | 测试 |
|---|---|---|---|---|
| 氪金：月光珠 / 月卡 / VIP / 至尊招募 | `game/premium.ts` | `screens/pay.ts` | `pay`、`res.moon` | `tests/premium.test.ts` |
| 月光珠商铺（按周限购，VIP 折扣） | `game/moonshop.ts` | `screens/pay.ts` | `pay.moonShop` | `tests/moonshop.test.ts` |
| 模拟玩家 / 世界聊天 / 竞技场 / 好友 | `game/npc.ts`、`game/social.ts` | `screens/social.ts` | `social` | `tests/npc.test.ts`、`tests/social.test.ts` |
| 公会（互助、捐献、纸箱、周榜） | `game/guild.ts` | `screens/social.ts` 的「公会」页 | `guild` | `tests/guild.test.ts` |
| 公会 Boss | `game/guildboss.ts` | 同上 | `gboss` | `tests/guildboss.test.ts` |
| 世界 Boss（每周轮换） | `game/worldboss.ts` | `screens/campaign.ts` 的「Boss」页 | `wboss` | `tests/worldboss.test.ts` |
| 七日签到 / 快速探索 | `game/daily.ts` | `screens/daily.ts` | `daily` | `tests/daily.test.ts` |
| 纸箱迷宫（肉鸽：8 层、三选一加成、血量元气带到下一层） | `game/maze.ts` | `screens/campaign.ts` 的「迷宫」页 | `maze` | `tests/maze.test.ts` |
| 自动闯关（挂机时战力够了自动推下一关，失败有冷却） | `game/autopush.ts` | 主城战斗区右上角开关 | `settings.autoPush` | `tests/autopush.test.ts` |
| 日常秘境 | `game/dungeon.ts` | `screens/campaign.ts` | `dungeon` | `tests/dungeon.test.ts` |
| **活动中心**（见下） | `game/events.ts` | `screens/events.ts` | `events` | `tests/events.test.ts` |
| 好感度（撸毛 / 点心，属性最高 +5%） | `game/affection.ts` | `screens/detail.ts` 英雄详情页 | `heroes[id].aff` | `tests/affection.test.ts` |
| 猫窝（家具 → 每日小鱼干） | `game/nest.ts` | `screens/events.ts` 的「猫窝」页 | `nest` | `tests/nest.test.ts` |

## 活动中心（`game/events.ts`）

入口：主城快捷栏「活动」（红点由 `eventsDot` 判断）。一个文件、一份状态 `s.events`，每个活动一小段，数据与逻辑分开，奖励统一用 `Reward` + `grant()` 发放。

**免费活动**
- 七日喵程：新号前 7 天，每天解锁 2 个目标（按实时进度计算，可补领），全部完成开终极大箱。
- 嘉年华：每周换主题，做日常攒活动点（每天上限 400），7 档周奖。`addPoints` 由 `quests.track` / 秘境 / Boss 回调。
- 幸运猫抓机：每天 1 次免费（VIP3 / VIP8 / 月卡各 +1），可花铃铛加抓，每 10 次保底招福符。
- 每日问答：每天 3 题（题库 30 题，`QUIZ`），按日期确定。
- 许愿池：每天给指定猫猫碎片，连续 7 天大奖。
- 招募盛典：本周累计招募次数领奖；**限时 UP 招募**每 14 天换一只 UR（`upHeroOf`），累抽有礼。
- 周战力冲榜：与模拟玩家比本周最高战力，下周一结算。
- 开服冲榜：新号前 7 天，每天一个主题（关卡 / 战力 / 等级），前 15 名领当日奖。
- 节日活动：按公历日期轮换（`FESTIVALS`），签到 + 限定礼盒。
- 图鉴收集奖励：收集数里程碑（6 / 12 / 20 / 30 / 41 只）+ 六族集齐奖，一次性。
- 邮件：欢迎信 / 每周一来信 / 节日来信 / 感谢信，附小礼物。

**氪金活动**（档位越高越丰厚，全部走 `recordOrder`，计入 VIP 累计充值）
- 首充豪礼、周累充（6 档）、成长基金（98 元，随主线推进分 9 档领回月光珠）、喵喵通行证（68 / 128 元，赛季 28 天，三条轨道）、限时礼包（日 / 周 / 月三档）、节日礼盒。

## 两条设计约定

1. **一切皆「墙上时钟的纯函数」**：模拟玩家的在线、聊天、公会贡献、Boss 伤害、周榜都由「种子 + 时间」推出，不需要服务器，也不进存档；玩家离线很久回来也能补出这段时间发生的事。要写新的模拟内容，用 `npc.ts` 的 `rnd(...)`。
2. **新状态一律 `??=` 迁移**：所有 `ensureXxx(s)` 都在读取时补全缺字段，旧存档直接可用（`tests/soak.test.ts` 有「旧存档读取后所有新系统能初始化」的测试）。

## 怎么加一个新活动

1. 在 `game/events.ts` 里写数据（`Reward`）与逻辑，状态字段加进 `EventState` 并在 `ensureEvents` 里补默认值。
2. 在 `screens/events.ts` 加一个 `xxxHtml`、一个 Tab、`handleEvents` 的 case，需要红点就改 `eventsDot`。
3. 在 `tests/events.test.ts` 补测试，并把 `tests/soak.test.ts` 里的 90 天浸泡跑一遍。
4. 有稳定产出的活动，到 `tools/economy-paid.ts` 的 `supplement()` 或 `incomeDay` 加一行，跑 `npm run economy:paid -- --out docs/ECONOMY_PAID.md`。

## 常用工具

- `npm run economy:paid`：付费经济审查，生成 `docs/ECONOMY_PAID.md`；SP 强度用 `npm run balance:sp`。
- `npm run monkey`：随机点击 + 切页，抓页面报错（先 `npm run dev`）。
- 背景音乐 `src/app/bgm.ts` 是程序合成的五声音阶八音盒循环（无音频文件），设置里可关。
- `python3 tools/sync-illust.py`：把 `assets/heroes/illust/` 的 AI 立绘整理进游戏（见 `docs/CODEX_ILLUSTRATION_BRIEF.md`）。
