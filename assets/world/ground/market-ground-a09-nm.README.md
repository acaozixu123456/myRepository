# A09-NM · 喵洲夜市地面三变体

按最新 [固定队列](../../../docs/CODEX_QUEUE.md) 与 [场景主题](../../../docs/WORLD3D.md) 制作，第 1 轮待审，通过数量为 0。场景是黄昏庙会，暖奶油木楼、朱红灯笼与橘粉天空；以此方向优先于旧 WORLD 工作单的暗紫赛博街要求。分支 `codex/3d-world-nightmarket-ground`，制作基线 `e6e89a9be7f4d0dce972221cb538ab299cbabafc`；提交与检查基线已同步 `fecef9e4d3cb95a0751aedbba588fd7415b2df8d`，三素材/场景色板保持不变。

| 素材 | 结构 | 规格 / 字节 |
| --- | --- | --- |
| [ground_market_terracotta_01.webp](ground_market_terracotta_01.webp) | 暖陶砖，半错缝 | 1024² RGB sRGB ICC；252,934 B |
| [ground_market_slate_02.webp](ground_market_slate_02.webp) | 暖浅青灰大石板，半错缝 | 1024² RGB sRGB ICC；322,152 B |
| [ground_market_sandstone_weave_03.webp](ground_market_sandstone_weave_03.webp) | 浅暖砂石砖，双砖篮织 | 1024² RGB sRGB ICC；213,164 B |

三张独立生成，分别用陶褐、暖青灰与浅沙金材料色区分铺砌区域。没有人物、文字、中心图案或外围边框，不含霓虹反射和油污。局部细孔与少量浅色边磨损保留材料质感，照明由游戏另行提供。

## 真实出处与导出

共 **3 次独立生成 + 2 次陶砖 AI 编辑**，完整提示词、实参、原图路径 / 标识 / SHA256、引用与选弃见 [出处记录](market-ground-a09-nm.provenance.json)。原始五张均为 1254² RGB PNG，实际字节数逐张记录，留在 `/workspace/generated_images/`，本批提交符合交付尺寸的 WebP。

陶砖第 1 候选的末行不完整；第 2 候选未解决周期而弃选。第 3 候选参考第 1 候选双轴各 627 像素的精确循环位移，由 `image_gen` 修复移到画面中部的旧外缘问题；位移只移动像素坐标，没有程序画缝、混色或补造。最终直接采用第 3 候选的整张输出，没有回移或裁切。

三图均完整 1254² 画布等比 Lanczos 降采样至 1024²，Pillow 12.3.0 / libwebp 1.6.0，RGB WebP quality 90 / method 6，嵌入 sRGB ICC。没有上采样、调色、锐化、手绘补缝或程序光色融合。ICC 的原生创建时间戳可能随重新生成 profile 改变；逐字节重导出使用交付已嵌入的原始 ICC 数据，哈希在出处里。

## 审图与限制

[总览](../reviews/market-ground-a09-nm.webp)、每图独立 2×2 / 4×4 直接平铺以及原尺度四边 / 四角 PNG 见 [审图方法](../reviews/market-ground-a09-nm.README.md)。无损边条覆盖完整边界，严格保留最终 WebP 解码的 RGB 像素，不用模糊融合隐藏接缝。

内部与独立复核未见额外宽外框、双重接缝或大块断行。边界像素 MAE 非零，包含正常灰缝与石色变化，不能当作数学意义上逐像素相等。陶砖仍有轻微砖高差，篮织实物约 6×6 块周期；提示词的精确行 / 块数未全数满足，按最终图记录。4×4 可辨材料色差与矿物颗粒的低频重复，按实际 UV 尺度评估。

本批仅基色，未接入游戏，不含法线、深度、粗糙度、位移或自发光。建议在白色 `MeshStandardMaterial` 中使用 `SRGBColorSpace` map，roughness 约 0.85、metalness 0，按区域控制 repeat。

另附 [真实 Three 白光 / 夜市暖光对照](../reviews/market-ground-a09-nm-lighting.webp)，三图实际加载，左右仅换白光与 `ATMOS.market` 光色，材质 / 强度 / 位置 / 相机 / 曝光相同；[参数](../reviews/market-ground-a09-nm-lighting.README.md)。这是独立材料样板，没有模拟完整场景天空、雾、泛光或调色；暖光会明显将青灰石和砂石推向橘褐。

独立 QA 见 [摘要](market-ground-a09-nm.qa.md) 与 [机器报告](market-ground-a09-nm.qa.json)。主线程在最新 `fecef9e` 基线执行 `npm run typecheck && npm test` 全过（退出码0；68个测试文件、1,019个测试）；日志 `.tmp-nm/tests-latest.log`，未提交。当前第1轮待审，不等同于 Claude 审核通过。

