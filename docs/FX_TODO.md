# 十二只猫猫的绝技画面（#20）

**已全部实现**（`src/fx/skills2.ts`，注册在 `SKILL_FX`）。下表保留当初的画面设想，便于对照。

| 猫猫 | 新特效 id | 画面设想 |
| --- | --- | --- |
| 夏侯墩 | `ult.yarnResolve` | 眼罩闪一下，爪风追上滚动毛线球，肉垫光点回流。 |
| 许虎痴 | `ult.tigerHoodRoar` | 虎头帽放大成柔软声浪，蓝色毛盾绕着鱼骨圈展开。 |
| 郭嘉喵 | `ult.partingPouch` | 葫芦奶光洒开，锦囊里的小鱼干轻轻唤醒睡猫。 |
| 孙小霸 | `ult.tideSweep` | 长剑带翻水碗，前排铺开水弧与爪印浪花。 |
| 黄盖盖 | `ult.surrenderBlanket` | 老将把软毯分到同袍身边，空船上的降书留下一点暖橙火光。 |
| 貂蝉喵 | `ult.moonRibbons` | 月影间两条软绸绕出逗猫棒的轮廓，薄荷光点让目标追错方向。 |
| 董桌 | `ult.tableFeast` | 饭桌轻轻转开，盘子原地打转，桌布围成一圈厚实护盾。 |
| 木鹿大王 | `ult.beastDrum` | 鼓面亮起图腾，虎形兽影按拍子奔出，留下草叶与小爪印。 |
| 兀突骨 | `ult.rattanNest` | 藤窝慢慢合拢，暖色护盾与呼噜线绕在窝沿。 |
| 张爪 | `ult.yellowHeaven` | 黄巾扬起，符纸像小旗落到敌阵，毛线沿符边轻轻收拢。 |
| 水镜喵 | `ult.waterMirror` | 水纹映出友猫轮廓，茶色光点落下，撑起透明薄盾。 |
| 管辂喵 | `ult.coinDivination` | 铜钱逐枚翻面，正面飞出卦纹、反面织成护盾，五枚正面串起小铜钱剑。 |

普攻复用已有 id：`melee.slash`、`melee.mace`、`melee.pierce`、`ranged.bolt`、`ranged.seal`、`ranged.teal`、`heal.touch`。画面里猫猫只追球、追影或睡着，不出现真实伤口。
