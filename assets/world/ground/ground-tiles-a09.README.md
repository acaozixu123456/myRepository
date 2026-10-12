# WORLD-A09 · 地砖与连续排水沟盖

按 [世界工作单](../../../docs/CODEX_WORLD_BRIEF.md) 制作的两张雨夜街区基色贴图，第 1 轮待审，当前通过数量为 0。游戏接入由 Claude 审核后处理。

| ID | 用途 / 外观 | 规格 | 文件大小 |
| --- | --- | --- | --- |
| `ground_tile_slate_01` | 旧青灰方砖、低对比灰缝、细碎颗粒与替换砖色 | 1024×1024，RGB，sRGB ICC WebP | 413,568 B |
| `ground_drain_slate_02` | 砖地一体的竖向连续金属排水沟盖、少量锈点 | 1024×1024，RGB，sRGB ICC WebP | 318,762 B |

两张为 base color / albedo，采用均匀漫射的材料色，没有烘入霓虹方向或大幅照明梯度。湿润反射、粗糙度及沟盖金属度由接入时材质提供。排水沟沿图像上下方向贯穿；上下重复延长沟槽，左右重复形成平行沟槽。局部沟槽应使用独立地面带，按 UV 朝向控制沟槽方向。

## 来源与导出

每张真实调用一次 OpenAI `image_gen` 生成初稿，再以同一工具编辑自己的初稿，减弱砖缝亮唇、整理四边。完整提示词、实参、候选选弃、原始路径及 SHA256 见 [出处记录](ground-tiles-a09.provenance.json)。工具未返回模型版本或随机种子。

原始 PNG 均为 1254²，仍保存在出处记录的 `/workspace/generated_images/` 路径。原图均超过仓库单文件 500,000 B 限制，未提交。选中候选按外侧灰缝中心提取完整物理周期：方砖为 1234×1235，沟盖为 1228²；随后 Lanczos 降采样至 1024²，Pillow 12.3.0 / libwebp 1.6.0 以质量 90、method 6 导出并嵌入 sRGB ICC。没有上采样、接缝融合、程序补画或手绘材质细节。

## 审图与限制

[单张 / 直接 2×2 / 4×4 平铺审图](../reviews/ground-tiles-a09.webp) 为 2048×1024，使用最终编码 WebP 的真实重复。另附两张最终成品 1:1 四边与四角审图：[方砖](../reviews/ground_tile_slate_01-native-edges.webp)、[沟盖](../reviews/ground_drain_slate_02-native-edges.webp)，排布见 [预览说明](../reviews/ground-tiles-a09.README.md)。

[独立材质灯光样板](../reviews/ground-tiles-a09-lighting.webp) 为 2048×1024，实际 Three.js r169 渲染同一白色 MeshStandardMaterial（roughness 0.65 / metalness 0、map.repeat 2×2），左列白光、右列相同白光加青色 / 品红点光，无 bloom。加载 2/2，页面错误为 0，拍摄前后成品哈希保持不变；[参数与证据](../reviews/ground-tiles-a09-lighting.README.md)。独立 QA 记录见 [摘要](ground-tiles-a09.qa.md) 与 [机器报告](ground-tiles-a09.qa.json)。

内部自查在这些尺度未见额外边框或明显接缝条。近看细颗粒仍有浅微明暗；沟盖最后一段略短，沟盖左右砖宽有差异。这些保留的细节请结合游戏视距评估。当前仅交付素材与审图，没有游戏接入，也没有法线、位移、粗糙度或自发光贴图。内部候选筛选不代表 Claude 审核通过。

Three.js 接入时将颜色贴图设为 `SRGBColorSpace`，`wrapS / wrapT` 设为 `RepeatWrapping`，按地面尺度设置 `repeat`。首先检查纹理密度与沟槽朝向，再在雨夜局部霓虹灯下评估亮度及材质响应。
