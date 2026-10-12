# A09-NM · 夜市地面审图方法

所有审图均读取三张最终编码 1024² RGB WebP。画面内只排列、直接重复或常规等比缩放，没有材质画缝、颜色融合、手绘边界或调色。每份图嵌入 sRGB ICC，2 的幂尺寸，均 ≤500,000 B。

[总览](market-ground-a09-nm.webp) 为 2048×1024、RGB WebP（quality 85 / method 6），188,266 B。三列对应陶砖 / 青石 / 篮织砂石；上方 512² 单图，下方 256² 的 2×2 / 4×4 缩略。总览是审图布局，不是生成联系表。

## 独立直接平铺

| ID | 2×2（1024²） | 4×4（1024²） |
| --- | --- | --- |
| `ground_market_terracotta_01` | [163,170 B](ground_market_terracotta_01-2x2.webp) | [134,648 B](ground_market_terracotta_01-4x4.webp) |
| `ground_market_slate_02` | [243,170 B](ground_market_slate_02-2x2.webp) | [197,628 B](ground_market_slate_02-4x4.webp) |
| `ground_market_sandstone_weave_03` | [111,114 B](ground_market_sandstone_weave_03-2x2.webp) | [105,412 B](ground_market_sandstone_weave_03-4x4.webp) |

每个 2×2 单元由最终源图 Lanczos 缩为 512²，再直接重复；4×4 单元为 256²。WebP quality 85 / method 6 有损再编码，适合看接缝 / 大形周期，不作为最终源图通道的精确数值证据。

## 1:1 无损四边与四角

坐标均零起点、半开区间。LR 图 128×1024，自左至右为成品右 64 列（x=960…1024）接左 64 列（x=0…64），覆盖完整高度。TB 图 1024×128，上方是成品底 64 行（y=960…1024）、下方顶 64 行（y=0…64），覆盖完整宽度。四角图 256²，由每角 128² 裁片拼成，左上 / 右上 / 左下 / 右下分别为 BR / BL / TR / TL。

这些 PNG 没有缩放，也没有有损再编码；RGB 像素与最终 WebP 解码裁片逐字节一致。审图只复制像素，不声称源图边界差为零。

| ID | 左右全边 | 上下全边 | 四角交会 |
| --- | --- | --- | --- |
| 陶砖 | [128×1024](ground_market_terracotta_01-native-lr.png) | [1024×128](ground_market_terracotta_01-native-tb.png) | [256²](ground_market_terracotta_01-native-corners.png) |
| 青石 | [128×1024](ground_market_slate_02-native-lr.png) | [1024×128](ground_market_slate_02-native-tb.png) | [256²](ground_market_slate_02-native-corners.png) |
| 篮织砂石 | [128×1024](ground_market_sandstone_weave_03-native-lr.png) | [1024×128](ground_market_sandstone_weave_03-native-tb.png) | [256²](ground_market_sandstone_weave_03-native-corners.png) |

自查：陶砖上下包裹为正常单砖缝，局部砖高稍变；青石边界存在正常石缝而非额外宽接缝；篮织两轴形状接续。4×4 有可辨低频色块 / 材料颗粒周期。单行接缝和全帧重复各自有观察范围，不能等同数学无缝证明。

真实 GPU 光色对照另见 [灯光样板](market-ground-a09-nm-lighting.webp) 和 [固定参数](market-ground-a09-nm-lighting.README.md)。出处及原图 / 成品 / 审图哈希见 [provenance](../ground/market-ground-a09-nm.provenance.json)。

