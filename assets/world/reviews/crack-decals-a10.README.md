# A10 裂缝贴花审图方法

所有画面读取最终交付 512² RGBA WebP，以原有 Alpha 正常叠加，没有改变透明度、描边、修边或重画。此处为 Pillow `Image.alpha_composite`，不是游戏接入截图。

## 总览

`crack-decals-a10.webp` 为 **2048×1024、RGB、sRGB ICC WebP**，quality=82 / method=6，202,578 B。五列两行按 ID 01～10 排列；每格上方灰砖 / 沥青，下方棋盘 / Alpha。512² 原面板等比 Lanczos 缩至 184²。

## 逐张 512² 原尺度

十张 `decal_crack_*-native-alpha.webp` 均 **2048×1024**。四个 512² 面板位于 y=128…640，自左至右 x=0…512、512…1024、1024…1536、1536…2048（零起点、半开区间）：棋盘底、灰度 Alpha、A09 灰砖、A08 湿沥青。棋格为 32²、RGB 148 / 188；灰度 Alpha 黑=0 / 白=255；两个背景各等比 Lanczos 缩至 512²。

面板没有空间缩放，保留 **1:1 空间尺度**；整张审图为 quality=85 / method=6 的有损 WebP 再编码，解码值不能作为成品 Alpha 的精确值。精确复核使用最终源图与工作空间无损 PNG。

| ID | 原尺度四面板 | 文件大小 |
| --- | --- | --- |
| `decal_crack_branch_fine_01` | [decal_crack_branch_fine_01-native-alpha.webp](decal_crack_branch_fine_01-native-alpha.webp) | 187,172 B |
| `decal_crack_transverse_02` | [decal_crack_transverse_02-native-alpha.webp](decal_crack_transverse_02-native-alpha.webp) | 181,028 B |
| `decal_crack_repair_edge_03` | [decal_crack_repair_edge_03-native-alpha.webp](decal_crack_repair_edge_03-native-alpha.webp) | 188,568 B |
| `decal_crack_stone_diagonal_04` | [decal_crack_stone_diagonal_04-native-alpha.webp](decal_crack_stone_diagonal_04-native-alpha.webp) | 179,820 B |
| `decal_crack_crazing_05` | [decal_crack_crazing_05-native-alpha.webp](decal_crack_crazing_05-native-alpha.webp) | 194,248 B |
| `decal_crack_pit_rim_06` | [decal_crack_pit_rim_06-native-alpha.webp](decal_crack_pit_rim_06-native-alpha.webp) | 187,908 B |
| `decal_crack_joint_ends_07` | [decal_crack_joint_ends_07-native-alpha.webp](decal_crack_joint_ends_07-native-alpha.webp) | 184,262 B |
| `decal_crack_grout_hair_08` | [decal_crack_grout_hair_08-native-alpha.webp](decal_crack_grout_hair_08-native-alpha.webp) | 182,838 B |
| `decal_crack_asphalt_long_09` | [decal_crack_asphalt_long_09-native-alpha.webp](decal_crack_asphalt_long_09-native-alpha.webp) | 183,478 B |
| `decal_crack_threeway_10` | [decal_crack_threeway_10-native-alpha.webp](decal_crack_threeway_10-native-alpha.webp) | 184,976 B |

源背景只读自 A09 `ground_tile_slate_01.webp`（#100）与 A08 `ground_asphalt_wet_01.webp`（#98），原路径 / 哈希见 [出处](../decals/crack-decals-a10.provenance.json)。背景没有送入图像生成工具，也不作为本批源素材提交。原始 PNG、无损棋盘 / Alpha / 双地面叠加、导出脚本保留在 `/workspace/a10-cracks-raw/`。

十图成品四边 Alpha 实测 0；通道与原图 Lanczos 降采样通道逐字节一致，没有阈值清理。裂线在深沥青上较隐约，07 / 09 等靠边但仍全数停在图内，少量灰褐碎屑带材料色细节。请按实际场景尺度评估。
