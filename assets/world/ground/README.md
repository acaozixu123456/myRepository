# A08 · 湿沥青地面

按 [WORLD 工作单](../../../docs/CODEX_WORLD_BRIEF.md) 制作，分支 `codex/3d-world-wet-asphalt`，base 为 `claude/awesome-babbage-ygba4h`。制作与拍摄基线为 `83b8abd7ccb1592c6eb208ca27590f13c182ca5e`；提交基线已同步到 `00a2ad25e4cafe8c7dcf198e2643f33118560785`，带入 Claude 的经济测试时钟修复。交付素材、三次 AI 原图出处和审图像素保持不变，审核仍为第 1 轮。

| 素材 | 规格 | 字节数 |
| --- | --- | ---: |
| [ground_asphalt_wet_01.webp](ground_asphalt_wet_01.webp) | 1024×1024，RGB，sRGB ICC，WebP q90 / method 6 | 491,514 |

暗炭灰的细碎骨料、浅水膜与低饱和冷灰反光、紫褐色油膜，以及两处破碎的旧路标残影。画面为俯视材质，没有人物、文字、品牌、场景透视或完整街道倒影。

## 原图出处与导出

两张初稿真实调用 `image_gen.imagegen`，另制作了一张 AI 十字接缝修订候选。最终选第 2 张原稿：污水与油膜分布更散，磨损标线较碎；第 3 张把颗粒改得更圆、更粗，独立复核认为原稿更适合沥青底材。

三张实际原图均为 **1254×1254**。选中原图仅做等比 Lanczos 降采样至 1024² 并导出 sRGB WebP，没有裁切、补边、调色、锐化或手绘接缝。未选修订候选的输入为原稿双轴各 627 像素的精确循环移位；该技术步骤只移动像素坐标。完整生成提示词、工具参数、原图标识 / SHA256、原生尺寸和编辑参考见 [出处记录](wet-asphalt-a08.provenance.json)。原始生成文件保留在工作区，仓库保存出处记录和交付成品。

## 预览与复核

审核图为 [原图与 2×2 / 4×4 平铺缩略](../reviews/wet-asphalt-a08.webp)，并附独立 Three.js 地面材质样板。拍摄参数、源文件哈希和取景见 [预览说明](../reviews/wet-asphalt-a08.README.md)。

原生图和编码成品分别核对四边、四角、直接拼接条带与重复平铺。完整独立复核见 [QA 摘要](wet-asphalt-a08.qa.md) 和 [机器报告](wet-asphalt-a08.qa.json)。像素差统计用于辅助比较，须与水缘、颗粒和污渍的实际衔接一起判断。
