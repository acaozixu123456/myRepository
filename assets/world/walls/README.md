# 世界外墙素材

赛博朋克雨夜街区的外立面颜色贴图，按 [世界美术工作单](../../../docs/CODEX_WORLD_BRIEF.md) 制作。审核状态以 [世界美术进度](../../../docs/WORLD_PROGRESS.md) 为准。

## WORLD-A01 · 脏污金属板外墙

本批为赛博朋克雨夜街区的外立面颜色贴图候选，按 [世界美术工作单](../../../docs/CODEX_WORLD_BRIEF.md) 制作。三张变体分别提供铆钉钢板、斑驳涂层与细肋板，供旧楼墙面重复铺设。

第 1 轮已由 Claude [审核通过](https://github.com/acaozixu123456/myRepository/pull/90#issuecomment-6110089599)，[PR #90](https://github.com/acaozixu123456/myRepository/pull/90) 已合并，并缩成 512² 接入游戏立面。

### 素材与预览

交付规格为每张 **1024×1024、sRGB、RGB 不透明 WebP，质量 90**。这组图片用于 base color / albedo，粗糙度与金属度由接入时的材质设置控制。

| ID | 外观 | 素材 | 文件大小 |
| --- | --- | --- | --- |
| `wall_metal_riveted_01` | 暗灰铆钉钢板，薄板缝、划痕与少量锈斑 | [WebP](wall_metal_riveted_01.webp) | 383,878 B |
| `wall_metal_painted_02` | 灰青旧涂层，细碎剥落、烟尘与锈点 | [WebP](wall_metal_painted_02.webp) | 310,354 B |
| `wall_metal_ribbed_03` | 窄竖肋金属板，横向搭接与分散污痕 | [WebP](wall_metal_ribbed_03.webp) | 120,440 B |

审核预览：[素材与平铺缩略图](../reviews/metal-walls-a01.webp)、[材质灯光样板](../reviews/metal-walls-a01-lighting.webp)，两张均为 2048×1024。

材质灯光样板在独立 Three.js 预览中对照中性白光与品红 / 青局部光，用于观察同一贴图的材质响应。游戏接入由 Claude 审核后处理。

### 导出说明

三张素材从 AI 候选中提取完整的物理板缝周期，再以 Lanczos 重采样为交付尺寸。

| ID | 原生可用周期 | 导出处理 |
| --- | --- | --- |
| `wall_metal_riveted_01` | 1247×1210，来自 1254×1254 候选 | 周期提取后规格化为 1024×1024 |
| `wall_metal_painted_02` | 626×629 | 周期提取后上采样为 1024×1024 |
| `wall_metal_ribbed_03` | 627×629，来自 1254×1254 候选 | 周期提取后上采样为 1024×1024 |

涂层墙与细肋板的原生可用周期分别为 626×629、627×629，上采样不增加细节。具体裁切坐标与导出参数见出处文件；其中审核字段保留提交时的记录，当前结论见进度表与 #90 评论。

## WORLD-A02 · 老旧瓷砖外墙

第 1 轮待审。三种变体均为 **1024×1024、sRGB、RGB 不透明 WebP，质量 90**，保留完整 8×8 砖域。灰绿提供旧楼浅冷墙面，暖白适合店铺外墙，深灰青提供较暗的底色与替换砖变化。

| ID | 外观 | 素材 | 原生周期 | 文件大小 |
| --- | --- | --- | --- | --- |
| `wall_tile_seafoam_01` | 灰绿旧釉、细开片与灰色替换砖 | [WebP](wall_tile_seafoam_01.webp) | 1250² | 265,528 B |
| `wall_tile_ivory_02` | 暖白陶瓷、烟尘与细碎缺釉 | [WebP](wall_tile_ivory_02.webp) | 1252² | 275,070 B |
| `wall_tile_slate_03` | 深灰青陶瓷、细裂纹与浅灰砖缝 | [WebP](wall_tile_slate_03.webp) | 1252² | 298,122 B |

审核预览：[单张与 2×2 平铺](../reviews/old-tiles-a02.webp)、[中性光与霓虹局部光样板](../reviews/old-tiles-a02-lighting.webp)。两张预览均为 2048×1024，使用最终编码后的素材。

每种变体制作两个 AI 候选，选用去除连续亮边、修正物理灰缝边界后的第 2 个。只在灰缝中心提取完整周期，再 Lanczos 降采样；没有上采样或人工接缝遮罩。原图和编码后的 2×2 / 4×4 平铺均作内部复核，Claude 的审核结论尚待补充。

深灰青的浅灰砖缝比另外两张醒目，近看仍有细微砖边明暗起伏；未见统一方向的强高光。请结合游戏墙面纹理密度评估格缝对比。此批颜色贴图不含法线、位移、粗糙度或自发光贴图。

完整提示词、两个候选的来源哈希、裁切坐标和导出参数见 [A02 出处记录](old-tiles-a02.provenance.json)。灯光样板为独立 Three.js 预览，参数为 roughness 0.78 / metalness 0 / ACES 1.05，接入时由 Claude 确定材质参数。

## 出处

图片由本会话的 OpenAI `image_gen` 图像生成工具制作。初稿未使用外部参考图片，修图只参考本批 AI 候选。接口未提供具体模型版本或随机种子。

A01 的提示词、候选选择、修图过程与导出记录保存在 [A01 出处文件](metal-walls-a01.provenance.json)，A02 的记录见 [A02 出处文件](old-tiles-a02.provenance.json)。

## 接入建议

在 Three.js 中将颜色贴图设为 `SRGBColorSpace`，将 `wrapS`、`wrapT` 设为 `RepeatWrapping`，按墙面实际尺寸设置 `repeat`。初次接入时检查纹理密度和面片接缝，再在 `/world.html` 的雨夜灯光下确认亮度。

A02 交付素材与审核记录，Claude 审核通过后负责接入游戏。
