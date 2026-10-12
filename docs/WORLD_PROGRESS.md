# 世界美术进度

以最新 [固定队列](CODEX_QUEUE.md) 和 [WORLD3D 场景主题](WORLD3D.md) 为当前方向；旧 [WORLD 工作单](CODEX_WORLD_BRIEF.md) 仅保留已做赛博素材的历史说明。每批独立 PR，有返修先返修，完成一批继续下批，不等 Claude 审核才开工。状态：未开始 / 制作中 / 待审 / 返修 / 通过；另以「已由 Claude 实现（跳过）」标记历史队列已实现的道具。

当前批次：**WORLD-A09-NM · 喵洲夜市地面**，分支 `codex/3d-world-nightmarket-ground`，1024² RGB 三张，第 1 轮待审，通过数量为 0。夜市按新场景黄昏庙会主题制作；旧赛博 A08 [#98](https://github.com/acaozixu123456/myRepository/pull/98) 已通过 / 接入，旧 A09 [#100](https://github.com/acaozixu123456/myRepository/pull/100)、污渍 [#103](https://github.com/acaozixu123456/myRepository/pull/103)、裂缝 [#106](https://github.com/acaozixu123456/myRepository/pull/106) 保留已提交待审记录。

## 主题素材 · 2026-10-12 新方向

场景已各自独立，颜色明亮清爽：夜市黄昏 / 码头晚霞 / 森林清晨 / 云岛正午 / 宫阙午后金光。按新固定队列推进，后续不继续旧暗紫霓虹街贴花计划；已交付赛博批次保留在历史记录。地面每个场景一批三张独立变体，命名带场景前缀防止覆盖旧 A09。

| 批次 | 场景素材 | 规格 / 数量 | 状态 | 已通过 |
| --- | --- | --- | --- | --- |
| A09-NM | 喵洲夜市 · 暖砖 / 青石 / 篮织砂石 | 1024² 无缝，3张 | 待审，第1轮 | 0 |
| A09-HB | 赤壁港 · 旧木栈板（竖纹） | 1024² 无缝，3变体 | 未开始 | 0 |
| A09-MR | 九重宫阙 · 汉白玉淡金纹 | 1024² 无缝，3变体 | 未开始 | 0 |
| A09-FR | 光之森 · 草地与落叶 | 1024² 无缝，3变体 | 未开始 | 0 |
| A09-CL | 云端雾岛 · 粉绿草地与小花 | 1024² 无缝，3变体 | 未开始 | 0 |
| A10-SKY | 天空全景（只有天空与云） | 2048×512 横向无缝，五种时段 | 未开始 | 0 |
| A11 | 青瓦 / 金琉璃 / 朱红瓦 | 512²，无缝俯视瓦垄 | 未开始 | 0 |
| A12 | 柔边多朵云朵精灵图 | 透明底 | 未开始 | 0 |

### A09-NM 明细与本轮记录

| 名称 / ID | 素材 | 状态 | 审核轮次 | 审图 | 字节 |
| --- | --- | --- | --- | --- | ---: |
| 暖陶砖 `ground_market_terracotta_01` | [WebP](../assets/world/ground/ground_market_terracotta_01.webp) | 待审 | 1 | [2×2](../assets/world/reviews/ground_market_terracotta_01-2x2.webp) / [4×4](../assets/world/reviews/ground_market_terracotta_01-4x4.webp) | 252,934 |
| 暖青灰大板 `ground_market_slate_02` | [WebP](../assets/world/ground/ground_market_slate_02.webp) | 待审 | 1 | [2×2](../assets/world/reviews/ground_market_slate_02-2x2.webp) / [4×4](../assets/world/reviews/ground_market_slate_02-4x4.webp) | 322,152 |
| 浅砂石篮织 `ground_market_sandstone_weave_03` | [WebP](../assets/world/ground/ground_market_sandstone_weave_03.webp) | 待审 | 1 | [2×2](../assets/world/reviews/ground_market_sandstone_weave_03-2x2.webp) / [4×4](../assets/world/reviews/ground_market_sandstone_weave_03-4x4.webp) | 213,164 |

2026-10-12 · 新主题首批，第1轮待审，通过数量0。基线 `e6e89a9`，实读最新 queue / WORLD3D / market.ts / atmos.ts，并实际看主分支第2章夜市场景作为色板参考；不改引擎或接入注册表。每图独立 image_gen，另两次真实 AI 陶砖编辑：第一修订未纠正末行，弃选；第二参考原图双轴各627px精确循环位移，由AI修复中部旧外缘错误，采用该输出整图。程序未画缝、补色或艺术补造。

五原稿均1254² RGB，保留真实工具提示词、实参、raw标识/路径/SHA与选弃。三交付完整画布等比 Lanczos 降至1024² RGB sRGB ICC WebP（quality90/method6），没有裁切、回移、上采样、调色或补边。素材总788,250 B，单张均≤500,000 B。[素材说明](../assets/world/ground/market-ground-a09-nm.README.md)、[完整出处](../assets/world/ground/market-ground-a09-nm.provenance.json)。

[三图总览](../assets/world/reviews/market-ground-a09-nm.webp)（2048×1024，188,266 B），另各2×2/4×4直接平铺与9张无损PNG全边/四角，覆盖最终解码RGB精确1:1像素；[方法](../assets/world/reviews/market-ground-a09-nm.README.md)。陶砖包裹处为正常单缝，少许行高差仍可见；青石上下边差含正常石缝；篮织两轴接续。提示词精确8行/4块未全数实现，篮织约6×6块；4×4低频色块周期可辨，不声称数学逐像素相等。

[真实 Three 白光/夜市暖光样板](../assets/world/reviews/market-ground-a09-nm-lighting.webp)（2048×1024，171,564 B），同白材质 roughness.85/metalness0、相机/强度/位置/曝光，仅换 ATMOS.market 光色；repeat[3,1]，无bloom/阴影，3/3加载、HTTP200×3、page/console errors0、failed0，六renderer各1drawcall，三sourceSHA拍前后恒定。[固定参数](../assets/world/reviews/market-ground-a09-nm-lighting.README.md)。暖光明显将石材推橘褐；此独立样板未模拟整场景天空/雾/调色。

独立QA见 [摘要](../assets/world/ground/market-ground-a09-nm.qa.md) 与 [机器报告](../assets/world/ground/market-ground-a09-nm.qa.json)。主线程已同步到最新 `fecef9e` 基线执行 `npm run typecheck && npm test`，全过（退出码0；68个测试文件、1,019个测试），日志 `.tmp-nm/tests-latest.log`；三素材hash与制作/拍摄时一致。批后按最新队列继续码头木栈板等主题素材，有返修先返修。

## A 类旧赛博队列与历史

旧方向曾按 A07 → A08 → A09 → A10推进。已通过素材与已提交批次如下；未开始的旧计划仅留历史，不作为当前场景任务。A08 #98现已通过并接入，旧A09 #100 / 污渍#103 / 裂缝#106待审。提前招牌的顺序最初见 [#90 审核评论](https://github.com/acaozixu123456/myRepository/pull/90#issuecomment-6110089599)。

| 批次 | 类别 | 规格 / 数量 | 状态 | 已通过 |
| --- | --- | --- | --- | --- |
| A01 | 外墙 · 脏污金属板 | 1024²，无缝，3～4 张变体 | 通过（本批 3 张） | 3 |
| A02 | 外墙 · 老旧瓷砖 | 1024²，无缝，3～4 张变体 | 通过（本批 3 张） | 3 |
| A06 | 招牌 / 广告 | 横版 1024×256；竖版 256×1024；全息 512×1024 | 通过（本批 6 张） | 6 |
| A07 | 远景天际线 | 2048×1024，上方透明或渐变深紫，1 张 | 通过 | 1 |
| A08 | 地面 · 湿沥青 | 1024²，无缝，1 张 | 已通过并接入 | 1 |
| 旧 A09 | 地面 · 地砖 / 排水沟盖 | 1024²，无缝，2张 | #100已提交待审 | 0 |
| 旧 A10 | 污渍 / 裂缝贴花 | 512²透明，污渍10张 / 裂缝10张；其余旧类暂停 | #103 / #106已提交待审 | 0 |
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

第 1 轮 **通过**，已通过数量为 1；[PR #98](https://github.com/acaozixu123456/myRepository/pull/98)已合并接入路面底图、保留中线。两张初稿与一张 AI 接缝修订候选归本轮内部筛选，最终选第 2 张原稿：原生 1254²，等比 Lanczos 降采样为 1024² RGB / sRGB ICC WebP（质量 90），没有裁切、补边、调色、锐化或手绘接缝，无上采样。未选第 3 修订稿的颗粒更圆、更粗；三张候选原图、完整提示词、工具参数和位移参考保存在出处文件。

独立复核原图及最终编码成品的 2×2 / 4×4 平铺、左右 / 上下直接拼接条带与四角交会，未见贯穿硬直缝、边框或四块分割。细碎沥青颗粒、浅水膜、克制的冷灰 / 青反光、紫褐油膜和两处稀疏黄白残标可辨；未见统一投影、全局亮度坡度或整块明显单向霓虹长亮带。此为本次实际显示尺度的视觉检查。

审核图：[原图 / 2×2 / 4×4 平铺](../assets/world/reviews/wet-asphalt-a08.webp)（2048×1024，349,356 B）、[白光 / 青品红光材质样板](../assets/world/reviews/wet-asphalt-a08-lighting.webp)（2048×1024，137,066 B）、[成品 1:1 左右边缘局部](../assets/world/reviews/wet-asphalt-a08-native-lr.png)（256²，168,566 B）、[成品 1:1 上下边缘局部](../assets/world/reviews/wet-asphalt-a08-native-tb.png)（256²，167,458 B）。样板为独立 Three.js 地面预览，贴图实际加载成功，页面错误为 0。两种光照使用同一源图和材质参数；水膜高光来自原图。1:1 局部仅覆盖所列边界区域，裁拼像素与成品解码数组一致；取景、源图哈希及方法见 [预览说明](../assets/world/reviews/wet-asphalt-a08.README.md)。

本批 `npm run typecheck && npm test` 已通过（退出码 0；58 个测试文件、926 个测试）。

2026-10-12 · 原 [PR #98](https://github.com/acaozixu123456/myRepository/pull/98) 同步到 `00a2ad25` 基线后，再次执行 `npm run typecheck && npm test` 全部通过（退出码 0；59 个测试文件、935 个测试）。Claude 已在主分支钉住经济审计测试的真实时钟，解决跨日后 `1.73` 文字断言失配。图片与出处保持不变，该次提交时待审，第1轮现已通过；此前失败及双时钟复现保留在 PR 记录中。

最不满意：4×4 平铺可辨认油膜和水洼的大形周期重复，近看细颗粒湿面高光偏密，Claude已通过并接入。旧A09 / 地面贴花已另PR提交，现改为上方主题素材新方向。

## B 类旧队列（历史）

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
