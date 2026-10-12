## A10 天空首批：第 1 轮待审（2026-10-12）

本线程交付前三天空：黄昏橘粉、晚霞赤红带云、清晨灰蓝薄雾（目标蓝绿，现用原雾绿色不足），分支 `codex/3d-world-sky-first`，同一 [PR #116](https://github.com/acaozixu123456/myRepository/pull/116)。三图均 2048 × 512 RGB sRGB WebP，横向循环，只天空与云，未接入游戏；第 1 轮待审，通过数量 0。

| 素材 | 最终来源 | 状态 | 轮次 |
| --- | --- | --- | --- |
| [sky_dusk_peach_01](../assets/world/skies/sky_dusk_peach_01.webp) | Kenney CC0 现成天空带，等比缩小 | 待审 | 1 |
| [sky_sunset_redcloud_02](../assets/world/skies/sky_sunset_redcloud_02.webp) | 真实公开素材比较后的 AI fallback，经三次真实参考编辑，采用候选4 | 待审 | 1 |
| [sky_dawn_tealmist_03](../assets/world/skies/sky_dawn_tealmist_03.webp) | PH CC0 原雾晨 HDR → 标准 SDR 全宽上512带直接编码，无AI编辑 | 待审 | 1 |

新规则后实际取得 / 比较 33 件公开原素材（Kenney 5 / OGA 25 / PH HDR 3），均 HTTP 200、固定 blob/长度吻合；PH 原 HDR 另核官方 API MD5。现成红云有褐暗色和太阳焦点，PH 原雾晨适合雾分布但蓝绿不足；赤云采用原生成方向经真实参考修订，晨雾两张蓝绿编辑在实际圆柱视觉失败而unused，最终直接适配灰蓝原雾；没有因 2:1、摄影或受阻下载预设拒选。原三次生成在新规则之前，补查与五次参考编辑在之后，不声称先搜后生成。两件 CC0 来源已登记 [CREDITS](CREDITS.md)。原稿和中间编辑完整留存。

Kenney 原生4096 ×2048，完整360°宽裁框 `[0,640,4096,1664]` →4096 ×1024 →等比0.5缩小。只有最终AI赤云候选4原生2172 ×724（3:1）完整向下缩至2048 ×512（4:1），云形纵横比例压扁25%。PH现用原HDR2048 ×1024经标准Reinhard曝光2 /sRGB8bit，完整360°上512带原生2048 ×512直接编码，不缩放 / 不改变比例，没有AI编辑。此限制不误套其他两件CC0。三图共134,878 B，每件≤500,000 B，q90/m6/sRGB588B；未程序绘云、补缝、艺术调色、上采样或移缝隐藏。PH官方MD5只验证原HDR，标准SDR/WebP是披露的常规转换。

[素材说明](../assets/world/skies/sky-panorama-a10-first.README.md)、[完整出处](../assets/world/skies/sky-panorama-a10-first.provenance.json)、[公开来源审计](../assets/world/skies/sky-panorama-a10-first.resource-audit.md)、[总览与完整重复 / 1:1 边角](../assets/world/reviews/sky-panorama-a10-first.README.md)、[实际无光照圆柱环视](../assets/world/reviews/sky-panorama-a10-first-render.webp)与[参数](../assets/world/reviews/sky-panorama-a10-first-render.README.md)。正式审图 14 张：13 离线 + 1 GPU。原生 PNG 保留成品精确 RGB；WebP 审图为有损再编码，不冒充逐像素原件。

实际圆柱MeshBasic /BackSide /正尺度 /RepeatS /ClampT；最终三图两次fresh加载6HTTP200bodySHA匹配，432全yaw/三pitchprobe＋12正式帧＝444实际渲染，page/console errors与failedrequests0，sourceSHA前后恒定。最终LR MAE0.339 /1.954 /0.206，非数学无缝；4倍低频周期仍可见。赤云前两编辑有硬云枝或实际圆柱稳定竖色阶而弃；最终第三编辑两端约15%低细节同色，下降指标不单独等于视觉通过。两张淡蓝绿晨雾AI编辑虽机器检查过，实际圆柱仍有稳定青竖带，失败且unused，旧7298与8call失败阶段完整留存。现用PH原雾最不满意是浅灰蓝较素、没有明显绿色 / 云体弱，与原蓝绿请求存在差异，诚实交审；没有强造绿色。当前桃粉样板云偏上。

授权固定主线 `60bc06577f5d5dd2966a661d2278802bb3e3fcee`；合并 HEAD `274c7f2ce267d613b530878312b7f496f8465a44`：实际 `npm run typecheck && npm test` 退出 0，69 个测试文件 / 1,035 测试通过，日志在工作空间 `tests-fixed60.log`、哈希见出处。独立 QA 另见 [摘要](../assets/world/skies/sky-panorama-a10-first.qa.md)与[机器报告](../assets/world/skies/sky-panorama-a10-first.qa.json)，Claude 通过仍为 0。

协作：森林已在 #115 通过 / 接入，云岛由 #114、宫阙由 #109；正午 / 午后天空属于 #117，不在本次范围。下方固定主线 WORLD 历史原文完整保留，只有本天空认领段转为本批待审。

# 世界美术进度

## 主题素材 · A09-FR 光之森草地与落叶

当前主题批次：**A09-FR**，分支 `codex/3d-world-forest-ground`，清晨森林草地 / 落叶三变体，**第1轮待审，通过数量0**。依据最新 [固定队列](CODEX_QUEUE.md) 与 [WORLD3D 场景主题](WORLD3D.md)，明亮清爽主题优先于旧暗紫赛博计划；既有素材保留，各批独立提交，有返修先返修，不等待Claude审核开下一批。

| 批次 | 场景地面 | 规格 / 数量 | 状态 | 已通过 |
| --- | --- | --- | --- | --- |
| A09-NM | 夜市暖砖 / 青石 / 篮织砂石 | 1024²，无缝，3张 | 已交付，另批待审 | 0 |
| A09-HB | 赤壁港旧褐 / 漂洗 / 窄木板 | 1024²，无缝，3张 | 已交付，另批待审 | 0 |
| A09-MR | 宫阙奶白细晶 / 浅金矿纹 / 象牙云脉 | 1024²，无缝，3张 | 已交付，另批待审 | 0 |
| A09-FR | 光之森青绿稀叶 / 苔绿暖叶 / 浅鲜小叶 | 1024²，无缝，3张 | 第1轮待审 | 0 |
| A09-CL | 云岛粉绿草地 / 小花 | 1024²，无缝，3变体 | 未开始 | 0 |

旧批审核现状以queue / 主线为准：A08 #98已通过 / 接入；A09 #100、A10污渍 #103与裂缝 #106已通过 / 合并，29f6主线已有Claude贴花接入文件。下方旧基线文字保留，不覆盖新方向或这一审核现状。后续天空全景、瓦面、透明云朵按queue顺序；旧涂鸦批次不继续。

| 名称 / ID | 素材 | 状态 / 轮次 | 审图 | 字节 |
| --- | --- | --- | --- | ---: |
| 青绿稀叶 `ground_forest_grass_sparse_01` | [WebP](../assets/world/ground/ground_forest_grass_sparse_01.webp) | 待审 / 1 | [2×2](../assets/world/reviews/ground_forest_grass_sparse_01-2x2.webp) / [4×4](../assets/world/reviews/ground_forest_grass_sparse_01-4x4.webp) | 495,756 |
| 苔绿暖叶 `ground_forest_moss_leaves_02` | [WebP](../assets/world/ground/ground_forest_moss_leaves_02.webp) | 待审 / 1 | [2×2](../assets/world/reviews/ground_forest_moss_leaves_02-2x2.webp) / [4×4](../assets/world/reviews/ground_forest_moss_leaves_02-4x4.webp) | 402,274 |
| 浅鲜小叶 `ground_forest_grass_light_03` | [WebP](../assets/world/ground/ground_forest_grass_light_03.webp) | 待审 / 1 | [2×2](../assets/world/reviews/ground_forest_grass_light_03-2x2.webp) / [4×4](../assets/world/reviews/ground_forest_grass_light_03-4x4.webp) | 367,326 |

2026-10-12 · 制作基线 `29f6a8b`，提交基线正常快进至 `a7a41e9`，森林材质 / common地面 / 氛围与queue文件不变，WORLD3D仅新增探索玩法。开工fetch并实读当前queue / forest.ts / common.ts / atmos.ts，实看既有第4章清晨森林，只读色板参考，不改引擎 / 注册表。3次独立真实image_gen生成＋5次真实编辑，各原稿链独立。首稿草丝太密，q90导出均超500,000 B；AI简化后稀叶采用候选2，苔绿 / 浅鲜草候选2仍超限，进一步AI编辑采用候选3。8张原1254² RGB PNG（3,271,586～4,633,629 B）和试导出全保留工作空间。[完整候选出处](../assets/world/ground/forest-ground-a09-fr.provenance.json)。

最终3张完整画布等比Lanczos降到1024² RGB sRGB ICC WebP，quality90 / method6，总1,265,356 B，单文件≤500,000 B。没有裁切 / 上采样 / 程序修缝、补纹、融合、模糊、调色或Alpha处理；[素材说明](../assets/world/ground/forest-ground-a09-fr.README.md)。

[总览](../assets/world/reviews/forest-ground-a09-fr.webp)（2048×1024，356,302 B），6张2×2 / 4×4、9张无损原尺度全边 / 四角PNG；[方法](../assets/world/reviews/forest-ground-a09-fr.README.md)。无明显粗暗框或大跳色；仍有边沿叶端 / 草丝相位差，4×4叶位 / 草簇重复可辨，MAE非零，不声称数学无缝。最不满意：稀叶草丝仍较密，简化后的局部草斑趋平，小足迹下暖叶先于草纤维可辨。

[真实Three白光 / 清晨灯色样板](../assets/world/reviews/forest-ground-a09-fr-lighting.webp)（2048×1024，405,744 B），白MeshStandardMaterial roughness0.95 / metalness0.02与森林groundPlane默认一致、repeat[3,1]。仅换白↔ATMOS.forest灯色，其余相机 / 材质 / 强度 / 位置 / 曝光相同，无bloom / 雾 / 阴影或完整场景调色；3/3加载、HTTP200×3、page / console errors0、failed0、6renderer各1drawcall，三sourceSHA拍前后相同；[参数](../assets/world/reviews/forest-ground-a09-fr-lighting.README.md)。

独立QA见 [摘要](../assets/world/ground/forest-ground-a09-fr.qa.md) / [机器报告](../assets/world/ground/forest-ground-a09-fr.qa.json)。本FR worktree在29f6实际执行 `npm run typecheck && npm test` 全过（整体退出0；68个测试文件、1,019个测试），完整test日志 `/workspace/forest-ground-raw/tests-latest.log`，typecheck输出由工具捕获。正常同步a7a主线后实际重跑全过（整体退出0；68文件 / 1,021测试），完整test日志 `/workspace/forest-ground-raw/tests-a7a41e9.log`，两次实际记录保留；当前第1轮待审，通过0。

## 旧方向基线文字与历史（保留）

以下旧基线计划 / 批次原文未被本批重写，真实审核现状与优先级以上方最新queue / 主线记录为准。

以 [CODEX_WORLD_BRIEF.md](CODEX_WORLD_BRIEF.md) 为准。先完成 A 类 AI 贴图，再制作 B 类程序化道具；每批独立 PR，等待 Claude 给出「通过 / 返修 / 换思路」。状态：未开始 / 制作中 / 待审 / 返修 / 通过；另以「已由 Claude 实现（跳过）」标记固定队列要求跳过的已有道具。

当前批次：**WORLD-A10 · 裂缝透明贴花首批**，分支 `codex/3d-world-crack-decals`，交付 512² RGBA 十张，第 1 轮待审。A08 [#98](https://github.com/acaozixu123456/myRepository/pull/98) 已通过 / 接入；A09 地砖 [#100](https://github.com/acaozixu123456/myRepository/pull/100) 与 A10 污渍 [#103](https://github.com/acaozixu123456/myRepository/pull/103) 已提交待审，继续推进 A10 裂缝。

## A 类队列

按 [固定队列](CODEX_QUEUE.md) 的最新审核意见：A08 已通过并接入；A09 地砖和 A10 污渍已提交，继续 A10 裂缝等地面贴花，其余类别保留。与 3D 部件交替推进，完成一批就继续下批，有返修先返修。提前招牌的顺序最初见 [#90 审核评论](https://github.com/acaozixu123456/myRepository/pull/90#issuecomment-6110089599)。

| 批次 | 类别 | 规格 / 数量 | 状态 | 已通过 |
| --- | --- | --- | --- | --- |
| A01 | 外墙 · 脏污金属板 | 1024²，无缝，3～4 张变体 | 通过（本批 3 张） | 3 |
| A02 | 外墙 · 老旧瓷砖 | 1024²，无缝，3～4 张变体 | 通过（本批 3 张） | 3 |
| A06 | 招牌 / 广告 | 横版 1024×256；竖版 256×1024；全息 512×1024 | 通过（本批 6 张） | 6 |
| A07 | 远景天际线 | 2048×1024，上方透明或渐变深紫，1 张 | 通过 | 1 |
| A08 | 地面 · 湿沥青 | 1024²，无缝，1 张 | 已通过并接入 | 1 |
| A09 | 地面 · 地砖 / 排水沟盖 | 1024²，无缝 | 待审（#100） | 0 |
| A10 | 贴花（地面贴花优先） | 512² 透明；污渍 / 裂缝各10张，其他三类仍各 ≥10 张 | 待审（污渍#103 / 本批裂缝） | 0 |
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
| 湿沥青 `ground_asphalt_wet_01` | [WebP](../assets/world/ground/ground_asphalt_wet_01.webp) | 通过 | 1 | [本批审图](../assets/world/reviews/wet-asphalt-a08.webp) | 1024²；RGB / sRGB ICC；质量 90；491,514 B；#98 已接入路面底图并保留中线 |

用途与材质建议见 [地面素材说明](../assets/world/ground/README.md)，完整生成与导出记录见 [A08 出处文件](../assets/world/ground/wet-asphalt-a08.provenance.json)。独立检查见 [QA 摘要](../assets/world/ground/wet-asphalt-a08.qa.md) 和 [机器报告](../assets/world/ground/wet-asphalt-a08.qa.json)。

## A08 制作与审核记录

2026-10-12 · 第 1 轮 **通过**，已通过数量为 1：[PR #98](https://github.com/acaozixu123456/myRepository/pull/98) 已合并并接入路面底图，保留中线，按固定队列同步。两张初稿与一张 AI 接缝修订候选归本轮内部筛选，最终选第 2 张原稿：原生 1254²，等比 Lanczos 降采样为 1024² RGB / sRGB ICC WebP（质量 90），没有裁切、补边、调色、锐化或手绘接缝，无上采样。未选第 3 修订稿的颗粒更圆、更粗；三张候选原图、完整提示词、工具参数和位移参考保存在出处文件。

独立复核原图及最终编码成品的 2×2 / 4×4 平铺、左右 / 上下直接拼接条带与四角交会，未见贯穿硬直缝、边框或四块分割。细碎沥青颗粒、浅水膜、克制的冷灰 / 青反光、紫褐油膜和两处稀疏黄白残标可辨；未见统一投影、全局亮度坡度或整块明显单向霓虹长亮带。此为本次实际显示尺度的视觉检查。

审核图：[原图 / 2×2 / 4×4 平铺](../assets/world/reviews/wet-asphalt-a08.webp)（2048×1024，349,356 B）、[白光 / 青品红光材质样板](../assets/world/reviews/wet-asphalt-a08-lighting.webp)（2048×1024，137,066 B）、[成品 1:1 左右边缘局部](../assets/world/reviews/wet-asphalt-a08-native-lr.png)（256²，168,566 B）、[成品 1:1 上下边缘局部](../assets/world/reviews/wet-asphalt-a08-native-tb.png)（256²，167,458 B）。样板为独立 Three.js 地面预览，贴图实际加载成功，页面错误为 0。两种光照使用同一源图和材质参数；水膜高光来自原图。1:1 局部仅覆盖所列边界区域，裁拼像素与成品解码数组一致；取景、源图哈希及方法见 [预览说明](../assets/world/reviews/wet-asphalt-a08.README.md)。

本批 `npm run typecheck && npm test` 已通过（退出码 0；58 个测试文件、926 个测试）。

2026-10-12 · 原 [PR #98](https://github.com/acaozixu123456/myRepository/pull/98) 同步到 `00a2ad25` 基线后，再次执行 `npm run typecheck && npm test` 全部通过（退出码 0；59 个测试文件、935 个测试）。Claude 已在主分支钉住经济审计测试的真实时钟，解决跨日后 `1.73` 文字断言失配。图片与出处保持不变；该次提交时待审，第 1 轮现已通过。此前失败及双时钟复现保留在 PR 记录中。

保留限制：4×4 平铺可辨认油膜和水洼的大形周期重复，近看细颗粒湿面高光偏密。Claude 已确认颗粒与水膜符合场景，湿面反光交给游戏里的光。A09 已提交 #100 待审，继续 A10 地面贴花。


## A10 明细 · 裂缝贴花首批

此前「污渍」10 张已提交 [PR #103](https://github.com/acaozixu123456/myRepository/pull/103)，第 1 轮待审；本批是另 10 张独立裂缝，未带入 #103 素材。

| 名称 / ID | 素材 | 状态 | 审核轮次 | 截图 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 细分叉裂 `decal_crack_branch_fine_01` | [WebP](../assets/world/decals/decal_crack_branch_fine_01.webp) | 待审 | 1 | [1:1 审图](../assets/world/reviews/decal_crack_branch_fine_01-native-alpha.webp) | 512² RGBA；18,416 B；原生 1254² |
| 浅横断裂 `decal_crack_transverse_02` | [WebP](../assets/world/decals/decal_crack_transverse_02.webp) | 待审 | 1 | [1:1 审图](../assets/world/reviews/decal_crack_transverse_02-native-alpha.webp) | 512² RGBA；8,084 B；原生 1254² |
| 旧修补口边裂 `decal_crack_repair_edge_03` | [WebP](../assets/world/decals/decal_crack_repair_edge_03.webp) | 待审 | 1 | [1:1 审图](../assets/world/reviews/decal_crack_repair_edge_03-native-alpha.webp) | 512² RGBA；26,260 B；原生 1254² |
| 石材短斜裂 `decal_crack_stone_diagonal_04` | [WebP](../assets/world/decals/decal_crack_stone_diagonal_04.webp) | 待审 | 1 | [1:1 审图](../assets/world/reviews/decal_crack_stone_diagonal_04-native-alpha.webp) | 512² RGBA；8,362 B；原生 1254² |
| 网状细龟裂 `decal_crack_crazing_05` | [WebP](../assets/world/decals/decal_crack_crazing_05.webp) | 待审 | 1 | [1:1 审图](../assets/world/reviews/decal_crack_crazing_05-native-alpha.webp) | 512² RGBA；34,734 B；原生 1254² |
| 坑缘碎裂 `decal_crack_pit_rim_06` | [WebP](../assets/world/decals/decal_crack_pit_rim_06.webp) | 待审 | 1 | [1:1 审图](../assets/world/reviews/decal_crack_pit_rim_06-native-alpha.webp) | 512² RGBA；27,918 B；原生 1254² |
| 伸缩缝端枝裂 `decal_crack_joint_ends_07` | [WebP](../assets/world/decals/decal_crack_joint_ends_07.webp) | 待审 | 1 | [1:1 审图](../assets/world/reviews/decal_crack_joint_ends_07-native-alpha.webp) | 512² RGBA；18,652 B；原生 1254² |
| 砖缝发丝裂 `decal_crack_grout_hair_08` | [WebP](../assets/world/decals/decal_crack_grout_hair_08.webp) | 待审 | 1 | [1:1 审图](../assets/world/reviews/decal_crack_grout_hair_08-native-alpha.webp) | 512² RGBA；13,530 B；原生 1254² |
| 沥青长走向裂 `decal_crack_asphalt_long_09` | [WebP](../assets/world/decals/decal_crack_asphalt_long_09.webp) | 待审 | 1 | [1:1 审图](../assets/world/reviews/decal_crack_asphalt_long_09-native-alpha.webp) | 512² RGBA；16,332 B；原生 1254² |
| 三叉断裂 `decal_crack_threeway_10` | [WebP](../assets/world/decals/decal_crack_threeway_10.webp) | 待审 | 1 | [1:1 审图](../assets/world/reviews/decal_crack_threeway_10-native-alpha.webp) | 512² RGBA；15,462 B；原生 1254² |

### A10 裂缝制作与审核记录

2026-10-12 · 裂缝首批 10 张，第 1 轮待审，通过数量为 0。分别调用 `image_gen` 且 `transparent_background: true`，生成无底板的独立细裂线；未引用地面背景，未复制旋转或修图。原生 1254² RGBA（119,088～389,612 B）保留在工作空间，非 2 的幂尺寸未提交为成品。完整画布等比 Lanczos 降采样到 512²，RGBA sRGB ICC WebP（quality 90 / method 6 / alpha_quality 100 / exact true）。没有上采样、程序描线、抠底、阈值 Alpha 清理或手绘遮罩。

成品四边 Alpha 全部为 0，透明区域约 91.8%～98.2%，Alpha 与对应原图降采样逐字节一致。十图造型包含分叉、横断、L形修补边、短斜、网裂、坑缘、缝端、灰缝、长裂、三叉；没有铺满黑洞或完整地面底板。灰砖上清楚，深色粗颗粒湿沥青上较低对比；07 / 09 等纵向裂线空边距小于提示词8%要求，但均未触到 / 截断至画布边界。保留这些细节按实际视距评估，不用白框或烘光强提反差。本批仅基色 + Alpha，未接入游戏，不含法线、深度、位移、粗糙度或自发光。

[素材说明](../assets/world/decals/crack-decals-a10.README.md)、[出处与哈希](../assets/world/decals/crack-decals-a10.provenance.json)、[总览](../assets/world/reviews/crack-decals-a10.webp)（2048×1024，202,578 B）、[四面板方法](../assets/world/reviews/crack-decals-a10.README.md)。每张原尺度审图含棋盘 / 灰度 Alpha / 灰砖 / 湿沥青四个 512² 面板，整张 2048×1024、RGB sRGB ICC，均 ≤500,000 B；源背景只读用于审图。

主线程在 `aa9afd3` 基线执行 `npm run typecheck && npm test` 全过（退出码 0，66 个测试文件 / 987 个测试）；日志 `/workspace/scratch/world-cracks-aa9-tests.log`。

A10 污渍和裂缝各 10 张已交付 / 待审，涂鸦、海报、告示仍各 ≥10 张另排批；完成本批后继续队列，有返修先返修。

另附 [实际 Three.js 透明叠加样板](../assets/world/reviews/crack-decals-a10-overlay.webp)（2048×1024，435,688 B），两种地面在同一材质 / 白光 / 相机下，左右只增青 / 品红点光。normal transparent、alphaTest 0.01、depthWrite false、roughness 0.8 / metalness 0，无 bloom；12/12 加载、十二 HTTP 200、page / console errors 0、failed requests 0，各 renderer 11 draw calls，十 source SHA256 前后相同。[捕获参数](../assets/world/reviews/crack-decals-a10-overlay.README.md)；深沥青缩略大多很难辨认裂线，此限制保留源色不作强调。

独立 QA 见 [摘要](../assets/world/decals/crack-decals-a10.qa.md) 和 [机器报告](../assets/world/decals/crack-decals-a10.qa.json)，离线视觉 / Alpha / 出处复核已完成，可交 Claude 审核，当前未审核通过。

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
