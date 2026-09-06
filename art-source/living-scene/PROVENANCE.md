# 素材来源与使用记录

## 主视觉

- 文件：`hero-original.png`，1672 × 941 PNG。
- 2026-09-06，用户明确选择“允许内置图像生成”后，以 Codex 内置 imagegen 单次生成。
- 未使用参考照片、第三方图库作品或真实人物；没有外部付费 API、素材购买。
- 完整生成提示词保留在 `PROMPT.txt`。这是虚构的日式街景，未宣称为日本某条真实街道。
- 此 AI 生成输出不是附带 CC0/MIT 等开源许可证的图库素材；其使用与再分发依生成账户适用条款。未声称具备独占版权、人工绘制或未经核实的第三方授权。
- 用户批准的内置生成之外，后续均为本机非生成性深度分析、格式转换、分区与蒙版制作。

## 派生素材

- `hero.webp`：原图的质量 94 WebP 交付版；没有扩大像素尺寸或伪称 4K 原画。
- `depth-raw.npy`：官方 Depth Anything V2 Small 原始相对深度浮点输出。
- `depth-16bit.png`：1%–99% 归一化原始深度。
- `depth-refined-16bit.png` / runtime `depth.png`：对前景枫叶实施颜色与位置约束的修正。
- `layer-far/mid/near.png`：原图像素与羽化深度分区组合的 RGBA 工作层；不是精细语义抠图，不含遮挡后背景修复。
- `mask-far/mid/near.png`：三层 8-bit 蒙版，工作层可在常规图像编辑软件继续加工。
- `motion-masks.png`：R 枫叶轻风、G 远处薄雾、B 店铺暖光。
- 粒子：尘埃纹理在本机 Canvas 中绘制，落叶轮廓为本原型原创小型网格；没有使用外部纹理。

## 字体与模型

- 字体：[Google Fonts / Noto Sans JP](https://github.com/google/fonts/tree/main/ofl/notosansjp)，SIL OFL 1.1。交付的 `noto-jp-subset.woff2` 是为页面文字缩减字符范围的子集。原始字体 SHA-256：`c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f`。许可全文在 `docs/living-scene/licenses/NotoSansJP-OFL.txt`；字体未单独销售。
- Depth Anything V2 Small：Apache-2.0；模型来源、权重哈希及固定代码版本见 `docs/living-scene/RESEARCH.md` 与 `manifest.json`。大型非商业权重没有采用。
- Three.js / postprocessing / three.quarks 的声明原文在 `docs/living-scene/licenses/`。开源库不赋予任何第三方图片或 splat 素材的许可，本项目未引入此类素材。
