# WORLD-A01 · 脏污金属板外墙

本批为赛博朋克雨夜街区的外立面颜色贴图候选，按 [世界美术工作单](../../../docs/CODEX_WORLD_BRIEF.md) 制作。三张变体分别提供铆钉钢板、斑驳涂层与细肋板，供旧楼墙面重复铺设。

当前为第 1 轮待审。已完成原图、2×2 与 4×4 平铺的内部检查，等待 Claude 审核。审核状态以 [世界美术进度](../../../docs/WORLD_PROGRESS.md) 为准。

## 素材与预览

交付规格为每张 **1024×1024、sRGB、RGB 不透明 WebP，质量 90**。这组图片用于 base color / albedo，粗糙度与金属度由接入时的材质设置控制。

| ID | 外观 | 素材 | 文件大小 |
| --- | --- | --- | --- |
| `wall_metal_riveted_01` | 暗灰铆钉钢板，薄板缝、划痕与少量锈斑 | [WebP](wall_metal_riveted_01.webp) | 383,878 B |
| `wall_metal_painted_02` | 灰青旧涂层，细碎剥落、烟尘与锈点 | [WebP](wall_metal_painted_02.webp) | 310,354 B |
| `wall_metal_ribbed_03` | 窄竖肋金属板，横向搭接与分散污痕 | [WebP](wall_metal_ribbed_03.webp) | 120,440 B |

审核预览：[素材与平铺缩略图](../reviews/metal-walls-a01.webp)、[材质灯光样板](../reviews/metal-walls-a01-lighting.webp)，两张均为 2048×1024。

材质灯光样板在独立 Three.js 预览中对照中性白光与品红 / 青局部光，用于观察同一贴图的材质响应。游戏接入由 Claude 审核后处理。

## 导出说明

三张素材从 AI 候选中提取完整的物理板缝周期，再以 Lanczos 重采样为交付尺寸。

| ID | 原生可用周期 | 导出处理 |
| --- | --- | --- |
| `wall_metal_riveted_01` | 1247×1210，来自 1254×1254 候选 | 周期提取后规格化为 1024×1024 |
| `wall_metal_painted_02` | 626×629 | 周期提取后上采样为 1024×1024 |
| `wall_metal_ribbed_03` | 627×629，来自 1254×1254 候选 | 周期提取后上采样为 1024×1024 |

涂层墙与细肋板的原生可用周期分别为 626×629、627×629，上采样不增加细节；Claude 审核时需结合近距离视角评估其清晰度。具体裁切坐标与导出参数见出处文件。

## 出处

图片由本会话的 OpenAI `image_gen` 图像生成工具制作。初稿未使用外部参考图片，修图只参考本批 AI 候选。接口未提供具体模型版本或随机种子。

每张素材的提示词、候选选择、修图过程与导出记录保存在 [本批出处文件](metal-walls-a01.provenance.json)。

## 接入建议

在 Three.js 中将颜色贴图设为 `SRGBColorSpace`，将 `wrapS`、`wrapT` 设为 `RepeatWrapping`，按墙面实际尺寸设置 `repeat`。初次接入时检查纹理密度和面片接缝，再在 `/world.html` 的雨夜灯光下确认亮度。

本批只交付素材与审核记录。Claude 审核通过后负责接入游戏。
