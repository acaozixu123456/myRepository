# WORLD-A10 · 污渍透明贴花首批

按 [世界工作单](../../../docs/CODEX_WORLD_BRIEF.md) 制作的 **10 张独立地面污渍贴花**，第 1 轮待审，通过数量为 0。A10 的污渍数量在本批达到 10 张；裂缝、涂鸦、海报、告示另外排批。游戏接入由 Claude 审核后处理。

每张交付 **512×512、RGBA、sRGB ICC WebP**。煤烟、泥拖痕、油污、盐渍、锈流痕、鞋印 / 猫爪泥迹、轮胎擦痕、雨洗积尘、粗颗粒污点与藻绿湿痕分别生成，未通过旋转、复制或程序改色凑变体。

| ID | 外观 | 素材 / 文件大小 | 四种背景审图 |
| --- | --- | --- | --- |
| `decal_stain_soot_01` | 煤烟粉尘 | [107,802 B](decal_stain_soot_01.webp) | [1:1 审图](../reviews/decal_stain_soot_01-native-alpha.webp) |
| `decal_stain_mud_drag_02` | 湿泥拖痕 | [59,860 B](decal_stain_mud_drag_02.webp) | [1:1 审图](../reviews/decal_stain_mud_drag_02-native-alpha.webp) |
| `decal_stain_oil_film_03` | 褐色油膜 | [86,828 B](decal_stain_oil_film_03.webp) | [1:1 审图](../reviews/decal_stain_oil_film_03-native-alpha.webp) |
| `decal_stain_mineral_04` | 矿物水渍 | [93,502 B](decal_stain_mineral_04.webp) | [1:1 审图](../reviews/decal_stain_mineral_04-native-alpha.webp) |
| `decal_stain_rust_run_05` | 淡锈褐流痕 | [88,942 B](decal_stain_rust_run_05.webp) | [1:1 审图](../reviews/decal_stain_rust_run_05-native-alpha.webp) |
| `decal_stain_mixed_tracks_06` | 鞋印 / 猫爪泥迹 | [46,818 B](decal_stain_mixed_tracks_06.webp) | [1:1 审图](../reviews/decal_stain_mixed_tracks_06-native-alpha.webp) |
| `decal_stain_tire_scuff_07` | 轮胎擦痕 | [63,744 B](decal_stain_tire_scuff_07.webp) | [1:1 审图](../reviews/decal_stain_tire_scuff_07-native-alpha.webp) |
| `decal_stain_rain_dust_08` | 雨洗积尘 | [107,214 B](decal_stain_rain_dust_08.webp) | [1:1 审图](../reviews/decal_stain_rain_dust_08-native-alpha.webp) |
| `decal_stain_grit_spots_09` | 粗颗粒污点 | [63,850 B](decal_stain_grit_spots_09.webp) | [1:1 审图](../reviews/decal_stain_grit_spots_09-native-alpha.webp) |
| `decal_stain_algae_10` | 藻绿湿痕 | [56,404 B](decal_stain_algae_10.webp) | [1:1 审图](../reviews/decal_stain_algae_10-native-alpha.webp) |

## 来源与导出

10 张分别调用 `image_gen` 且设置 `transparent_background: true`。油污、锈流、轮胎痕各以同一工具编辑自己的初稿一次，共 13 次真实调用。初稿没有外部参考；修订引用链、确切完整提示词、实参、13 份原图路径及 SHA256、候选选弃见 [出处记录](stain-decals-a10.provenance.json)。接口没有返回模型版本或随机种子。

原始 PNG 均为 **1254² RGBA**，原生 Alpha 由图像工具输出，仍保存在出处记录的 `/workspace/generated_images/` 路径。保持完整画布、等比 Lanczos 降采样为 512²，再以 Pillow 12.3.0 / libwebp 1.6.0 导出：quality=90、method=6、alpha_quality=100、exact=true，嵌入 sRGB ICC。没有抠底、程序阈值改 Alpha、手绘遮罩、调色或艺术补造。每张成品 Alpha 与原图等比降采样后的 Alpha 逐字节一致，哈希见出处。

## 审图与限制

[十图总览](../reviews/stain-decals-a10.webp) 与逐张 1:1 审图均以最终编码成品做叠加；审图专用的棋盘、灰砖与湿沥青底不在贴花源文件里。四个面板分别为棋盘底、灰度 Alpha、灰砖底、湿沥青底，方法见 [预览说明](../reviews/stain-decals-a10.README.md)。背景只读自 #100 A09 与 #98 A08，不作为本批源素材重复提交。

内部自查未见矩形底板或明显边缘黑线。三张图（01 / 03 / 04）的最外圈有最大 **1/255** 微量 Alpha，其余七张四边全零；如实记录原生 / 降采样结果，没有遮罩清理。全透明比例约 51.8%～85.6%，保留真实半透明软边。

[实际 Three.js 透明叠加样板](../reviews/stain-decals-a10-overlay.webp)（2048×1024，454,868 B）将十贴花放到两种地面：同一材质和白光下，左右只增加青 / 品红局部光。normal transparent / alphaTest 0.01 / depthWrite false，源 Alpha 未改。加载 12/12、页面与控制台错误 0，十成品拍摄前后哈希一致；[参数与证据](../reviews/stain-decals-a10-overlay.README.md)。独立 QA 见 [摘要](stain-decals-a10.qa.md) 与 [机器报告](stain-decals-a10.qa.json)，结论可交 Claude 审核。

近看材料细颗粒有浅微明暗；矿物盐痕和雨洗沉积偏浅亮，在深色沥青上更醒目。接入时按场景视距控制贴花尺度与摆放密度。本批为基色 + 透明度，没有法线、粗糙度、位移或自发光，也未接入游戏。

Three.js 中将颜色 map 设为 `SRGBColorSpace`，使用透明贴花材质、保留源 Alpha，按实际接入控制 `depthWrite` 与微小地面偏移。透明贴花无需像地面底图一样重复平铺，避免堆叠后形成突兀规律。

在快进合并主分支 `bf37bd3` 后，主线程执行 `npm run typecheck && npm test` 全部通过（退出码 0，65 个测试文件 / 980 个测试）；日志保留在 `/workspace/a10-raw/tests-bf37.log`。图片哈希和导出参数保持不变。
