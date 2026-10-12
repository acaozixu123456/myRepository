# 初始认领历史 · 第0轮

此记录保留初始认领时点；当前状态以进度表最新送审段为准。

## 当前制作认领 · SSR 魏族首批专属战器

分支 `codex/3d-heroes-wei-icons`，基线 `913334948c16a0f9a9bb899edc943fb86c322337`，base 为 `claude/awesome-babbage-ygba4h`。按本表专属造型的 SP → UR → SSR 顺序，接着制作前三位 SSR 的武器覆盖。当前制作中、第0轮、通过0，尚无成品或 Claude 裁决；同一草稿PR认领，真实部件、shots3d与战斗截图、独立QA完成后转第1轮待审。

| 英雄 / ID | 专属覆盖 | 状态 | 轮次 | 备注 |
| --- | --- | --- | --- | --- |
| 夏侯墩 `wei_xiahoudun` | weapon · 长矛 | 制作中 | 0 | 棕木细杆、冷白柳叶枪头、金枪座与魏蓝短穗 |
| 许虎痴 `wei_xuhuchi` | weapon · 狼牙骨棒 | 制作中 | 0 | 长卵木棒、两道金箍、短钝乳白骨齿 |
| 张喵辽 `wei_zhangliao` | weapon · 双短刀 | 制作中 | 0 | 宽短微弯银刀、魏蓝握柄、银护口，真实offhand |

最新固定队列确认六位UR #118、衣服 #113、披挂 #111/#119、配饰 #120已通过并合并；周喵瑜古琴契约暂不做。SP #107由另一owner送审，披挂与配饰后续也由原owner认领；本批只改三位SSR武器，不重复其部件或恢复2D绘画。现通用部件与六UR映射保持。

认领前在本工作树实际执行 `npm run typecheck && npm test`，整体退出0，71测试文件 /1047测试通过；命令07:06:44 UTC、Vitest07:06:50 UTC、28.38秒，日志 `/workspace/three-review/heroes-wei-icons/required-checks-claim.log`。此为认领基线检查，不代替最终部件检查。
