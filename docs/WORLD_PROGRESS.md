# 世界美术进度

以 [CODEX_WORLD_BRIEF.md](CODEX_WORLD_BRIEF.md) 为准。先完成 A 类 AI 贴图，再制作 B 类程序化道具；每批独立 PR，等待 Claude 给出「通过 / 返修 / 换思路」。状态：未开始 / 制作中 / 待审 / 返修 / 通过；另以「已由 Claude 实现（跳过）」标记固定队列要求跳过的已有道具。

当前批次：**WORLD-A09 · 地砖 / 排水沟盖**，分支 `codex/3d-world-ground-tiles`，交付 1024² 两张，[PR #100](https://github.com/acaozixu123456/myRepository/pull/100) 第 1 轮待审。A01 / A02 / A06 / A07 / A08 已通过并合并；继续 A10 地面贴花。

## A 类队列

按 [固定队列](CODEX_QUEUE.md) 的最新审核意见：[#96](https://github.com/acaozixu123456/myRepository/pull/96) 的 A07 已通过并接入外圈；A08 已通过并接入，接下来 A09 地砖 → A10 地面贴花，其余类别继续保留。与 3D 部件交替推进，完成一批后继续下批，有返修先返修。提前招牌的顺序最初见 [#90 审核评论](https://github.com/acaozixu123456/myRepository/pull/90#issuecomment-6110089599)。

| 批次 | 类别 | 规格 / 数量 | 状态 | 已通过 |
| --- | --- | --- | --- | --- |
| A01 | 外墙 · 脏污金属板 | 1024²，无缝，3～4 张变体 | 通过（本批 3 张） | 3 |
| A02 | 外墙 · 老旧瓷砖 | 1024²，无缝，3～4 张变体 | 通过（本批 3 张） | 3 |
| A06 | 招牌 / 广告 | 横版 1024×256；竖版 256×1024；全息 512×1024 | 通过（本批 6 张） | 6 |
| A07 | 远景天际线 | 2048×1024，上方透明或渐变深紫，1 张 | 通过 | 1 |
| A08 | 地面 · 湿沥青 | 1024²，无缝，1 张 | 已通过并接入 | 1 |
| A09 | 地面 · 地砖 / 排水沟盖 | 1024²，无缝，本批 2 张 | 待审（#100） | 0 |
| A10 | 贴花（地面贴花优先） | 512²，透明；涂鸦 / 海报 / 告示 / 污渍 / 裂缝各 ≥10 张 | 未开始 | 0 |
| A03 | 外墙 · 水渍混凝土 | 1024²，无缝，3～4 张变体 | 未开始 | 0 |
| A04 | 外墙 · 贴纸墙 | 1024²，无缝，3～4 张变体 | 未开始 | 0 |
| A05 | 外墙 · 管线 / 空调外机浮雕 | 1024²，无缝，3～4 张变体 | 未开始 | 0 |

## A01 明细

| 名称 / ID | 素材 | 状态 | 审核轮次 | 截图 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 铆钉钢板 `wall_metal_riveted_01` | [WebP](../assets/world/walls/wall_metal_riveted_01.webp) | 通过 | 1 | [本批缩略图](../assets/world/reviews/metal-walls-a01.webp) | 原生周期 1247×1210，规格化至 1024²；#90 通过并接入 512² 立面底图 |
| 斑驳涂层 `wall_metal_painted_02` | [WebP](../assets/world/walls/wall_metal_painted_02.webp) | 通过 | 1 | [本批缩略图](../assets/world/reviews/metal-walls-a01.webp) | 原生周期 626×629，上采样至 1024²；#90 通过并接入 512² 立面底图 |
| 细肋板 `wall_metal_ribbed_03` | [WebP](../assets/world/walls/wall_metal_ribbed_03.webp) | 通过 | 1 | [本批缩略图](../assets/world/reviews/metal-walls-a01.webp) | 原生周期 627×629，上采样至 1024²；#90 通过并接入 512² 立面底图 |

素材说明见 [外墙素材说明](../assets/world/walls/README.md)，出处、生成提示词及候选选择见 [本批出处记录](../assets/world/walls/metal-walls-a01.provenance.json)。

### A01 制作与审核记录

2026-10-11 · 第 1 轮 **通过**：[PR #90](https://github.com/acaozixu123456/myRepository/pull/90) 已合并。Claude 在 [审核评论](https://github.com/acaozixu123456/myRepository/pull/90#issuecomment-6110089599) 中确认 2×2 / 4×4 平铺无明显接缝、颜色不带光照方向。三张交付素材为 1024²、sRGB、RGB 不透明 WebP（质量 90），已通过数量为 3。

除 [本批缩略图](../assets/world/reviews/metal-walls-a01.webp) 外，另附 [材质灯光样板](../assets/world/reviews/metal-walls-a01-lighting.webp)：独立 Three.js 预览对照中性白光与品红 / 青局部光。

根据 `docs/CODEX_QUEUE.md` 的审核记录，Claude 已通过 `tools/sync-world-assets.py` 将三张缩成 512² 后作为立面底图接入游戏，交付源图保持 1024²。

审核记录在此追加；返修只处理 Claude 点名的问题，在同一 PR 更新。

## A02 明细

| 名称 / ID | 素材 | 状态 | 审核轮次 | 截图 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 灰绿瓷砖 `wall_tile_seafoam_01` | [WebP](../assets/world/walls/wall_tile_seafoam_01.webp) | 通过 | 1 | [本批缩略图](../assets/world/reviews/old-tiles-a02.webp) | 原生周期 1250²，降采样至 1024²；265,528 B；#92 通过，接入青色楼 |
| 暖白瓷砖 `wall_tile_ivory_02` | [WebP](../assets/world/walls/wall_tile_ivory_02.webp) | 通过 | 1 | [本批缩略图](../assets/world/reviews/old-tiles-a02.webp) | 原生周期 1252²，降采样至 1024²；275,070 B；#92 通过，接入奶油色楼 |
| 深灰青瓷砖 `wall_tile_slate_03` | [WebP](../assets/world/walls/wall_tile_slate_03.webp) | 通过 | 1 | [本批缩略图](../assets/world/reviews/old-tiles-a02.webp) | 原生周期 1252²，降采样至 1024²；298,122 B；#92 通过并保留，砖缝偏亮的备注沿用 |

素材说明见 [外墙素材说明](../assets/world/walls/README.md)，提示词、候选选择及导出记录见 [A02 出处记录](../assets/world/walls/old-tiles-a02.provenance.json)。

### A02 制作与审核记录

2026-10-11 · 第 1 轮 **通过**：[PR #92](https://github.com/acaozixu123456/myRepository/pull/92) 已合并，按 [固定队列](CODEX_QUEUE.md) 同步审核结果，已通过数量为 3。三张素材均为 1024²、RGB、sRGB WebP（质量 90），从上述原生周期降采样；原周期与最终 WebP 的 2×2 / 4×4 平铺已完成内部检查。

本批 `npm run typecheck && npm test` 通过（退出码 0；58 个测试文件、912 个测试）。

审核图：[本批素材与平铺缩略图](../assets/world/reviews/old-tiles-a02.webp)（2048×1024，152,228 B）、[材质灯光样板](../assets/world/reviews/old-tiles-a02-lighting.webp)（2048×1024，105,204 B）。

Claude 已将灰绿用于青色楼、暖白用于奶油色楼。深灰青的浅灰缝对比偏强，远观时网格感先于旧砖裂纹，审核记录注明暂留；素材已保留在游戏资源注册表中。

## A06 明细

| 名称 / ID | 素材 | 状态 | 审核轮次 | 截图 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 九命拉面 · RAMEN `sign_ramen_horizontal_01` | [WebP](../assets/world/signs/sign_ramen_horizontal_01.webp) | 通过 | 1 | [本批缩略图](../assets/world/reviews/neon-signs-a06.webp) | 横版 1024×256；46,040 B；#94 已接入拉面店招 |
| 小鱼干当铺 · PAWN `sign_pawn_horizontal_02` | [WebP](../assets/world/signs/sign_pawn_horizontal_02.webp) | 通过 | 1 | [本批缩略图](../assets/world/reviews/neon-signs-a06.webp) | 横版 1024×256；59,224 B；第 3 AI 候选；#94 已接入当铺店招 |
| 猫薄荷药局 · HERBS `sign_pharmacy_horizontal_03` | [WebP](../assets/world/signs/sign_pharmacy_horizontal_03.webp) | 通过 | 1 | [本批缩略图](../assets/world/reviews/neon-signs-a06.webp) | 横版 1024×256；52,360 B；#94 已接入药局店招 |
| 夜猫网咖 · NETCAFE `sign_netcafe_vertical_04` | [WebP](../assets/world/signs/sign_netcafe_vertical_04.webp) | 通过 | 1 | [本批缩略图](../assets/world/reviews/neon-signs-a06.webp) | 竖版 256×1024；64,512 B；#94 已接入网咖店招 |
| 毛线酒吧 · BAR `sign_bar_vertical_05` | [WebP](../assets/world/signs/sign_bar_vertical_05.webp) | 通过 | 1 | [本批缩略图](../assets/world/reviews/neon-signs-a06.webp) | 竖版 256×1024；62,276 B；#94 已接入酒吧店招 |
| 九命有价 · NINE LIVES `ad_ninelives_hologram_06` | [WebP](../assets/world/signs/ad_ninelives_hologram_06.webp) | 通过 | 1 | [本批缩略图](../assets/world/reviews/neon-signs-a06.webp) | 全息广告 512×1024；154,082 B；副标「好梦不赊」；#94 已接入远景广告牌 |

用途与导出规格见 [招牌素材说明](../assets/world/signs/README.md)；出处、提示词、候选选择与导出记录见 [A06 出处文件](../assets/world/signs/neon-signs-a06.provenance.json)。独立 QA 记录见 [审核摘要](../assets/world/signs/neon-signs-a06.qa.md) 与 [机器报告](../assets/world/signs/neon-signs-a06.qa.json)。

### A06 制作与审核记录

2026-10-11 · 第 1 轮 **通过**：[PR #94](https://github.com/acaozixu123456/myRepository/pull/94) 已合并并接入，按 [固定队列](CODEX_QUEUE.md) 同步审核结果，已通过数量为 6。六张素材为 RGB、sRGB WebP（质量 90），包括横版三张、竖版两张、全息广告一张。图像与字形修正由 `image_gen` 完成，导出采用裁切、按目标纵横比补黑边及等比 Lanczos 降采样。候选调整归本轮内部筛选，审核轮次仍为 1。

独立 QA 已完成六图文字、猫元素、2 的幂尺寸、sRGB、文件大小与哈希核对，并局部确认当铺的「铺」和广告的「赊」。Claude 确认字形正确，并按店招文字接入五张招牌，将全息猫广告放到远景广告牌。

本批 `npm run typecheck && npm test` 通过（退出码 0；58 个测试文件、912 个测试）。

审核图：[六图缩略图](../assets/world/reviews/neon-signs-a06.webp)（2048×1024，169,006 B）、[自发光材质样板](../assets/world/reviews/neon-signs-a06-emissive.webp)（2048×1024，236,356 B）。样板为独立 Three.js 平面预览，六图加载成功，页面错误为 0；同材质对比关闭 / 开启 bloom（强度 0.18、半径 0.15、阈值 0.65），六张均测到像素差异。方法与实际参数见 [预览说明](../assets/world/reviews/neon-signs-a06.README.md)。

全息广告的猫毛发偏写实、细节更密；Claude 已明确认可其作为广告牌的表现，本轮成品保持不变。下一批为 A07 天际线。

## A07 明细

| 名称 / ID | 素材 | 状态 | 审核轮次 | 截图 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 猫城远景天际线 `skyline_catcity_01` | [WebP](../assets/world/skyline/skyline_catcity_01.webp) | 通过 | 1 | [本批审图](../assets/world/reviews/skyline-a07.webp) | #96 已合并并接入外圈；2048×1024；131,512 B；原生 1774×887，等比上采样约 15.44%；深紫天空渐变 |

用途与接入建议见 [天际线素材说明](../assets/world/skyline/README.md)，完整提示词、候选与导出记录见 [A07 出处文件](../assets/world/skyline/skyline-a07.provenance.json)。独立 QA 见 [审核摘要](../assets/world/skyline/skyline-a07.qa.md) 与 [机器报告](../assets/world/skyline/skyline-a07.qa.json)。

### A07 制作与审核记录

第 1 轮 **通过**：[PR #96](https://github.com/acaozixu123456/myRepository/pull/96) 已合并并接入外圈，按 [固定队列](CODEX_QUEUE.md) 的明确审核意见同步，已通过数量为 1。选第 3 AI 候选，导出 2048×1024、RGB、sRGB ICC WebP（质量 90）。依据世界工作单生成，修图参考本批第 2 候选。实际原生图为 1774×887，等比 Lanczos 上采样约 15.44% 达到交付规格；上采样不增加原生细节。

顶部 10% 平均 RGB 约为 22.83 / 14.15 / 39.12，采用深紫天空渐变。首尾边缘拼接与柱面三个视角的独立视觉检查未见明显竖缝；画面含高楼剪影、空中走廊、飞行器光点与猫形全息光晕，无真人面孔或文字。此结论对应实际文件和审阅尺度的视觉检查。

审核图：[原图 / 边缘 / 三视角柱面样板](../assets/world/reviews/skyline-a07.webp)（2048×1024，164,908 B）、[成品 1:1 边缘局部](../assets/world/reviews/skyline-a07-native-edge.png)（512×1024，221,531 B）。样板为独立 Three.js 柱面预览，实际加载成功，页面错误为 0；取景、哈希和方法见 [预览说明](../assets/world/reviews/skyline-a07.README.md)。边缘局部取最终 WebP 的右 256 列接左 256 列，保留成品 1:1 像素。

本批 `npm run typecheck && npm test` 通过（退出码 0；58 个测试文件、919 个测试）。

制作时最不满意：原生尺寸略低，近看小窗线偏软。Claude 审核提醒下半部天际线会被近楼挡住，上部深紫天空与雾的表现更重要；本图已通过并接入外圈。后续顺序为 A08 湿沥青 → A09 地砖 → A10 地面贴花。

## A08 明细

| 名称 / ID | 素材 | 状态 | 审核轮次 | 截图 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 湿沥青 `ground_asphalt_wet_01` | [WebP](../assets/world/ground/ground_asphalt_wet_01.webp) | 通过 | 1 | [本批审图](../assets/world/reviews/wet-asphalt-a08.webp) | 1024²；RGB / sRGB ICC；质量 90；491,514 B；原生 1254²，Lanczos 降采样 |

用途与材质建议见 [地面素材说明](../assets/world/ground/README.md)，完整生成与导出记录见 [A08 出处文件](../assets/world/ground/wet-asphalt-a08.provenance.json)。独立检查见 [QA 摘要](../assets/world/ground/wet-asphalt-a08.qa.md) 和 [机器报告](../assets/world/ground/wet-asphalt-a08.qa.json)。

## A08 制作与审核记录

第 1 轮 **待审**，已通过数量为 0。两张初稿与一张 AI 接缝修订候选归本轮内部筛选，最终选第 2 张原稿：原生 1254²，等比 Lanczos 降采样为 1024² RGB / sRGB ICC WebP（质量 90），没有裁切、补边、调色、锐化或手绘接缝，无上采样。未选第 3 修订稿的颗粒更圆、更粗；三张候选原图、完整提示词、工具参数和位移参考保存在出处文件。

独立复核原图及最终编码成品的 2×2 / 4×4 平铺、左右 / 上下直接拼接条带与四角交会，未见贯穿硬直缝、边框或四块分割。细碎沥青颗粒、浅水膜、克制的冷灰 / 青反光、紫褐油膜和两处稀疏黄白残标可辨；未见统一投影、全局亮度坡度或整块明显单向霓虹长亮带。此为本次实际显示尺度的视觉检查。

审核图：[原图 / 2×2 / 4×4 平铺](../assets/world/reviews/wet-asphalt-a08.webp)（2048×1024，349,356 B）、[白光 / 青品红光材质样板](../assets/world/reviews/wet-asphalt-a08-lighting.webp)（2048×1024，137,066 B）、[成品 1:1 左右边缘局部](../assets/world/reviews/wet-asphalt-a08-native-lr.png)（256²，168,566 B）、[成品 1:1 上下边缘局部](../assets/world/reviews/wet-asphalt-a08-native-tb.png)（256²，167,458 B）。样板为独立 Three.js 地面预览，贴图实际加载成功，页面错误为 0。两种光照使用同一源图和材质参数；水膜高光来自原图。1:1 局部仅覆盖所列边界区域，裁拼像素与成品解码数组一致；取景、源图哈希及方法见 [预览说明](../assets/world/reviews/wet-asphalt-a08.README.md)。

本批 `npm run typecheck && npm test` 已通过（退出码 0；58 个测试文件、926 个测试）。

2026-10-12 · 原 [PR #98](https://github.com/acaozixu123456/myRepository/pull/98) 同步到 `00a2ad25` 基线后，再次执行 `npm run typecheck && npm test` 全部通过（退出码 0；59 个测试文件、935 个测试）。Claude 已在主分支钉住经济审计测试的真实时钟，解决跨日后 `1.73` 文字断言失配。图片与出处保持不变，仍为待审第 1 轮；此前失败及双时钟复现保留在 PR 记录中。

最不满意：4×4 平铺可辨认油膜和水洼的大形周期重复，近看细颗粒湿面高光偏密，等待 Claude 按实际地面 UV 尺度评估。审核后继续 A09 地砖，再做 A10 地面贴花。

2026-10-12 · [PR #98](https://github.com/acaozixu123456/myRepository/pull/98) **通过、已合并并接入**：Claude 确认颗粒与水膜表现，作为路面底图并保留中线；实际反光交给游戏光照。以上待审文字保留为制作历史，当前已通过数量为 1。

## A09 明细

| 名称 / ID | 素材 | 状态 | 审核轮次 | 截图 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 旧青灰方砖 `ground_tile_slate_01` | [WebP](../assets/world/ground/ground_tile_slate_01.webp) | 待审 | 1 | [本批审图](../assets/world/reviews/ground-tiles-a09.webp) | 1024²；413,568 B；原生完整周期 1234×1235；低对比灰缝 |
| 青灰砖地 / 连续排水沟盖 `ground_drain_slate_02` | [WebP](../assets/world/ground/ground_drain_slate_02.webp) | 待审 | 1 | [本批审图](../assets/world/reviews/ground-tiles-a09.webp) | 1024²；318,762 B；原生完整周期 1228²；沿上下轴连续 |

用途、来源与导出规格见 [A09 素材说明](../assets/world/ground/ground-tiles-a09.README.md)，完整提示词、工具实参、候选选择、原图路径和原图 / 成品 SHA256 见 [出处记录](../assets/world/ground/ground-tiles-a09.provenance.json)。

### A09 制作与审核记录

2026-10-12 · 第 1 轮待审，已通过数量为 0。每张由 `image_gen` 独立生成后，再以同一工具修订自己的初稿；两个候选是内部筛选，审核轮次仍为 1。原始 PNG 均为 1254²，外侧灰缝中心裁切完整周期后 Lanczos 降采样至 1024²，以 RGB sRGB ICC WebP、质量 90、method 6 导出。没有上采样、程序补画、接缝融合或艺术性后处理。原始 PNG 保留在出处记录的工作空间路径，因单张超过 500,000 B 未提交。

内部视觉复核使用最终编码 WebP 的直接 2×2 / 4×4 重复与四边 / 四角 1:1 局部，未见额外边框或明显接缝条。近看细颗粒有浅微明暗；沟盖最后一段略短、两侧砖宽有差异，需按游戏视距评估。本批是基色贴图，材质湿润反射和霓虹照明交由引擎提供，尚未接入游戏。

审核图：[单张 / 2×2 / 4×4 总览](../assets/world/reviews/ground-tiles-a09.webp)（2048×1024，287,386 B）、[方砖 1:1 四边 / 四角](../assets/world/reviews/ground_tile_slate_01-native-edges.webp)（2048×1024，472,366 B）、[沟盖 1:1 四边 / 四角](../assets/world/reviews/ground_drain_slate_02-native-edges.webp)（2048×1024，394,118 B）。方法见 [预览说明](../assets/world/reviews/ground-tiles-a09.README.md)。

另附 [独立 Three.js 材质灯光样板](../assets/world/reviews/ground-tiles-a09-lighting.webp)（2048×1024，476,746 B）：同一白色 MeshStandardMaterial（roughness 0.65 / metalness 0、map.repeat 2×2）在相同相机与白光下，左右对比只加入青 / 品红点光的响应，无 bloom。实际加载 2/2、HTTP 200、page errors 0、failed requests 0，拍摄前后成品 SHA256 不变；[参数与捕获证据](../assets/world/reviews/ground-tiles-a09-lighting.README.md)。独立 QA 见 [摘要](../assets/world/ground/ground-tiles-a09.qa.md) 和 [机器报告](../assets/world/ground/ground-tiles-a09.qa.json)，当前可交 Claude 审核，尚未审核通过。

A09 同步最新主分支 `bf37bd3` 后验证：`npm run typecheck && npm test` 通过，65 个测试文件、980 项测试，退出码 0。两张素材及审核图保持不变；保留 #98 已通过并接入的最新记录。

## B 类队列

最新 [固定队列](CODEX_QUEUE.md) 说明：`guardrail / manhole / clothesline / busStop` 已由 Claude 在 `src/world/props/street.ts` 实现，后续 B 类制作跳过这四件。以下状态记录实现归属。

| 名称 | 状态 | 截图 |
| --- | --- | --- |
| 路灯（多个变体） | 未开始 | — |
| 横版霓虹灯箱 | 未开始 | — |
| 竖版霓虹灯箱 | 未开始 | — |
| 排气管 / 蒸汽口 | 未开始 | — |
| 街边小吃摊 | 未开始 | — |
| 拉面屋台 | 未开始 | — |
| 投币机 | 未开始 | — |
| 公交站牌 `busStop` | 已由 Claude 实现（跳过） | — |
| 电车站牌 | 未开始 | — |
| 护栏 `guardrail` | 已由 Claude 实现（跳过） | — |
| 井盖 `manhole` | 已由 Claude 实现（跳过） | — |
| 钢架广告牌 | 未开始 | — |
| 天桥 / 空中走廊段 | 未开始 | — |
| 空调外机群 | 未开始 | — |
| 屋顶水箱 | 未开始 | — |
| 天线群 | 未开始 | — |
| 晾衣绳 `clothesline` | 已由 Claude 实现（跳过） | — |
| 晾衣架 | 未开始 | — |
| 纸箱 / 垃圾袋堆 | 未开始 | — |
| 横幅 / 旗帜 | 未开始 | — |
| 无人机 / 飞行器 / 悬浮车 | 未开始 | — |
