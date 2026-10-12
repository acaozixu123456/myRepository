# A10 天空横向重复与原生接边审图

[总览](sky-panorama-a10-first.webp)为 2048 × 1024 RGB sRGB WebP，82,762 B。三行依次为现成 Kenney 橘粉、参考编辑 AI 赤云、PH CC0 原雾标准 SDR 直接适配。总览是排版缩略，不代替原生尺寸检查。

| 素材 | 完整横向直接重复 | 成品解码 1:1 无损接边 |
| --- | --- | --- |
| 橘粉黄昏 | [2 倍](sky_dusk_peach_01-2x-horizontal.webp) / [4 倍](sky_dusk_peach_01-4x-horizontal.webp) | [完整 512 高 LR](sky_dusk_peach_01-native-lr.png) / [上下角独立 LR](sky_dusk_peach_01-native-corners.png) |
| 赤云晚霞 | [2 倍](sky_sunset_redcloud_02-2x-horizontal.webp) / [4 倍](sky_sunset_redcloud_02-4x-horizontal.webp) | [完整 512 高 LR](sky_sunset_redcloud_02-native-lr.png) / [上下角独立 LR](sky_sunset_redcloud_02-native-corners.png) |
| 灰蓝晨雾 | [2 倍](sky_dawn_tealmist_03-2x-horizontal.webp) / [4 倍](sky_dawn_tealmist_03-4x-horizontal.webp) | [完整 512 高 LR](sky_dawn_tealmist_03-native-lr.png) / [上下角独立 LR](sky_dawn_tealmist_03-native-corners.png) |

重复图分别 4096 × 512、8192 × 512：将最终 WebP 解码后的 2048 × 512 图直接复制 2 / 4 次，复制前不缩放，不补缝或融合；然后 WebP quality 85 / method 6 重编码。最大重复图 312,986 B，所有提交图 ≤500,000 B、尺寸均为 2 的幂、嵌入同一 sRGB ICC。

LR PNG 为 256 × 512：右 128 列接左 128 列，空间尺度 1:1，覆盖所有 512 行。角 PNG 为 256²：上行 TR128｜TL128，下行 BR128｜BL128；上下两行各自展示横向周期接边，不代表上下垂直循环。天空仅要求横向循环；没有 TB 平铺指标。六张 PNG 无损保留成品解码精确 RGB。

正式离线图为总览 1 + 完整重复 6 + 原生边角 6 = 13 张，另有[实际 GPU 圆柱图](sky-panorama-a10-first-render.webp)，总计 14 张，不称地砖批次的 17 张。WebP 审图有有损重编码误差，原生 PNG 与成品 RGB 精确关系和 GPU 原 PNG 的精确关系分别验证。

低频云团 / 雾色周期在 4 倍重复可见。赤云侧边更柔但仍有颜色和细纹相位差；现用原雾没有人为青色条带，颜色灰蓝较素 / 无明显绿色。LR MAE 0.339 / 1.954 / 0.206 只用于诊断，不是数学无缝证明。第 1 轮待审，通过 0。[来源及参数](../skies/sky-panorama-a10-first.provenance.json)、[素材说明](../skies/sky-panorama-a10-first.README.md)与[独立 QA](../skies/sky-panorama-a10-first.qa.md)。
