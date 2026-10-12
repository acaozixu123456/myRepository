# WORLD-A10 · 裂缝透明贴花首批

按 [世界工作单](../../../docs/CODEX_WORLD_BRIEF.md) 制作的 **10 张独立地面裂缝贴花**，第 1 轮待审，通过数量为 0。此前的污渍 10 张已另批提交 [PR #103](https://github.com/acaozixu123456/myRepository/pull/103)，本批使 A10「裂缝」数量达到 10 张；涂鸦、海报、告示另外排批。

每张为 **512×512、RGBA、sRGB ICC WebP**，分别提供分叉、横断、修补口边、短斜裂、网裂、坑缘、缝端、灰缝发丝裂、长走向与三叉裂。没有复制旋转凑数或程序描边。

| ID | 外观 | 素材 / 文件大小 | 四种背景审图 |
| --- | --- | --- | --- |
| `decal_crack_branch_fine_01` | 细分叉裂 | [18,416 B](decal_crack_branch_fine_01.webp) | [1:1 审图](../reviews/decal_crack_branch_fine_01-native-alpha.webp) |
| `decal_crack_transverse_02` | 浅横断裂 | [8,084 B](decal_crack_transverse_02.webp) | [1:1 审图](../reviews/decal_crack_transverse_02-native-alpha.webp) |
| `decal_crack_repair_edge_03` | 旧修补口边裂 | [26,260 B](decal_crack_repair_edge_03.webp) | [1:1 审图](../reviews/decal_crack_repair_edge_03-native-alpha.webp) |
| `decal_crack_stone_diagonal_04` | 石材短斜裂 | [8,362 B](decal_crack_stone_diagonal_04.webp) | [1:1 审图](../reviews/decal_crack_stone_diagonal_04-native-alpha.webp) |
| `decal_crack_crazing_05` | 网状细龟裂 | [34,734 B](decal_crack_crazing_05.webp) | [1:1 审图](../reviews/decal_crack_crazing_05-native-alpha.webp) |
| `decal_crack_pit_rim_06` | 坑缘碎裂 | [27,918 B](decal_crack_pit_rim_06.webp) | [1:1 审图](../reviews/decal_crack_pit_rim_06-native-alpha.webp) |
| `decal_crack_joint_ends_07` | 伸缩缝端枝裂 | [18,652 B](decal_crack_joint_ends_07.webp) | [1:1 审图](../reviews/decal_crack_joint_ends_07-native-alpha.webp) |
| `decal_crack_grout_hair_08` | 砖缝发丝裂 | [13,530 B](decal_crack_grout_hair_08.webp) | [1:1 审图](../reviews/decal_crack_grout_hair_08-native-alpha.webp) |
| `decal_crack_asphalt_long_09` | 沥青长走向裂 | [16,332 B](decal_crack_asphalt_long_09.webp) | [1:1 审图](../reviews/decal_crack_asphalt_long_09-native-alpha.webp) |
| `decal_crack_threeway_10` | 三叉断裂 | [15,462 B](decal_crack_threeway_10.webp) | [1:1 审图](../reviews/decal_crack_threeway_10-native-alpha.webp) |

## 来源与导出

10 张分别独立调用 `image_gen`，均 `transparent_background: true`。没有参考灰砖 / 沥青合成底或外部图片，未修图；完整确切提示词、实参、原图路径 / SHA256 和候选选择见 [出处](crack-decals-a10.provenance.json)。接口未返回模型版本或随机种子。

原始 PNG 全为 **1254² RGBA**，文件大小 119,088～389,612 B，原生透明度由图像工具产生。原图保留在出处 `/workspace/generated_images/` 路径；1254² 为非 2 的幂原生尺寸，本批只提交符合规格的 512² 交付 WebP。

使用完整画布、等比 Lanczos 降采样至 512²；Pillow 12.3.0 / libwebp 1.6.0 以 quality=90、method=6、alpha_quality=100、exact=true 编码并嵌入 sRGB ICC。没有裁切、上采样、调色、抠底、阈值清 Alpha、手绘遮罩或程序补裂线。成品 Alpha 与对应原图等比降采样 Alpha 逐字节一致，哈希见出处。

## 审图与限制

[十图总览](../reviews/crack-decals-a10.webp) 与每张 1:1 四面板使用最终编码 WebP：棋盘底、灰度 Alpha、A09 灰砖、A08 湿沥青；[方法](../reviews/crack-decals-a10.README.md)。背景只用于审图，未用于生成或重复提交。

十图四边 Alpha 均为 **0**，全透明比例 **91.8%～98.2%**，部分内侧裂线与灰褐碎屑保留半透明。提示词要求的 8%空边距未全数满足：07 / 09 等纵向裂线更近边缘，但仍未触到或截断至边界。灰砖上裂线可读；深色粗颗粒湿沥青会掩盖细线。接入时按场景视距、贴花尺度与区域评估，不以白框或烘焙照明强行提高反差。

本批为基色 + 透明度，不含法线、裂缝真实深度、粗糙度、位移或自发光，未接入游戏。Three.js 接入将颜色 map 设为 `SRGBColorSpace`，使用透明贴花材质、保留源 Alpha，按实际流程控制 `depthWrite` 和地面微小偏移；不应像地面底图一样规律重复。

主线程在基线 `aa9afd3` 执行 `npm run typecheck && npm test` 全部通过（退出码 0，66 个测试文件 / 987 个测试）；日志 `/workspace/scratch/world-cracks-aa9-tests.log`。图像另经独立视觉与出处 / Alpha QA，测试通过不代表 Claude 审核通过。

另附 [实际 Three.js 透明叠加样板](../reviews/crack-decals-a10-overlay.webp)（2048×1024，435,688 B），两底、同白光下对比青 / 品红局部光；normal transparent、alphaTest 0.01、depthWrite false，源 Alpha 未改。加载 12/12、十二 HTTP 200、page / console errors 0，十成品拍前后哈希相同；[参数与证据](../reviews/crack-decals-a10-overlay.README.md)。湿沥青缩略区域大多数裂线很难辨认，如实保留显示限制。

独立 QA 见 [摘要](crack-decals-a10.qa.md) 与 [机器报告](crack-decals-a10.qa.json)，当前可交 Claude 审核，未审核通过。
