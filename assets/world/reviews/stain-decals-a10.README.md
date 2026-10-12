# A10 污渍贴花审图方法

所有面板读取最终交付 512² RGBA WebP，保留成品原有 Alpha 做正常叠加；没有调低透明度、抠底、修边或重新绘制。审图是 Pillow `Image.alpha_composite`，不是引擎接入截图。

## 十图总览

`stain-decals-a10.webp` 为 **2048×1024、RGB、sRGB ICC WebP**，quality=82 / method=6，250,354 B。五列两行，依 ID 01～10 排列。每个格上方为灰砖 / 湿沥青叠加，下方为棋盘底 / 灰度 Alpha；各 512² 原面板等比 Lanczos 缩到 184²。

## 逐张 512² 原尺度

每张 `decal_stain_*-native-alpha.webp` 均为 **2048×1024**，四个面板位于 y=128…640，自左至右 x=0…512、512…1024、1024…1536、1536…2048（坐标零起点、半开区间）：

1. 棋盘底：32² 棋格、RGB 148 / 188，仅用于说明透明区。
2. 灰度 Alpha：成品 Alpha 原数值，黑=0 全透明，白=255 不透明。
3. A09 青灰方砖：背景等比缩到 512²，再叠加成品。
4. A08 湿沥青：背景等比缩到 512²，再叠加成品。

逐张审图面板没有空间缩放，保持 **1:1 空间尺度**。审图本身以 WebP quality=85 / method=6 有损再编码，不能将审图解码值当成成品 Alpha 的精确数值；成品及无损 PNG 拼图用于精确检查。

| ID | 1:1 四面板审图 | 文件大小 |
| --- | --- | --- |
| `decal_stain_soot_01` | [decal_stain_soot_01-native-alpha.webp](decal_stain_soot_01-native-alpha.webp) | 212,106 B |
| `decal_stain_mud_drag_02` | [decal_stain_mud_drag_02-native-alpha.webp](decal_stain_mud_drag_02-native-alpha.webp) | 202,610 B |
| `decal_stain_oil_film_03` | [decal_stain_oil_film_03-native-alpha.webp](decal_stain_oil_film_03-native-alpha.webp) | 215,162 B |
| `decal_stain_mineral_04` | [decal_stain_mineral_04-native-alpha.webp](decal_stain_mineral_04-native-alpha.webp) | 212,204 B |
| `decal_stain_rust_run_05` | [decal_stain_rust_run_05-native-alpha.webp](decal_stain_rust_run_05-native-alpha.webp) | 212,576 B |
| `decal_stain_mixed_tracks_06` | [decal_stain_mixed_tracks_06-native-alpha.webp](decal_stain_mixed_tracks_06-native-alpha.webp) | 198,564 B |
| `decal_stain_tire_scuff_07` | [decal_stain_tire_scuff_07-native-alpha.webp](decal_stain_tire_scuff_07-native-alpha.webp) | 206,584 B |
| `decal_stain_rain_dust_08` | [decal_stain_rain_dust_08-native-alpha.webp](decal_stain_rain_dust_08-native-alpha.webp) | 221,194 B |
| `decal_stain_grit_spots_09` | [decal_stain_grit_spots_09-native-alpha.webp](decal_stain_grit_spots_09-native-alpha.webp) | 198,588 B |
| `decal_stain_algae_10` | [decal_stain_algae_10-native-alpha.webp](decal_stain_algae_10-native-alpha.webp) | 197,822 B |

源背景只读使用 A09 `ground_tile_slate_01.webp`（#100）与 A08 `ground_asphalt_wet_01.webp`（#98），路径和哈希见 [出处](../decals/stain-decals-a10.provenance.json) 的 `review_backgrounds`；没有重复提交背景源图。原始 RGBA PNG、无损棋盘 / Alpha / 两种地面合成 PNG、导出脚本保留在工作空间 `/workspace/a10-raw/`，用于独立复核。

三张成品（01 / 03 / 04）最外圈有 ≤1/255 微量 Alpha，另外七张边界为 0；这份诊断来自成品通道，没有阈值改图。缩放后 Alpha 与对应原图 Lanczos 降采样 Alpha 逐字节一致。细颗粒浅微明暗与两种浅色盐尘的高对比按实际视距评估。
