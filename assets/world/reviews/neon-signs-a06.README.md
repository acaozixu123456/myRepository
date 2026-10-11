# WORLD A06 招牌审图方法

两张审图均为 2048×1024 的 2 的幂尺寸 WebP。`neon-signs-a06.webp` 为六张最终素材直接缩略，169006 字节；`neon-signs-a06-emissive.webp` 为独立 Three.js 平面材质样板，236356 字节。材质样板注明「非游戏截图」，未使用 WorldView 或游戏场景引擎。

## 缩略图

直接加载 `assets/world/signs/` 内的最终 WebP，用普通 HTML img 按原始比例缩略。Noto Sans CJK SC 标签仅核对名称、英文、尺寸和广告附句，与成品文字分开排版；没有重画或替换贴图字形、重着色或拉伸图片。

原始生成及导出由本批 provenance 记录：横版原图 1983×793；纵版和广告原图 1254×1254；交付版使用指定裁切、可选黑底 padding、统一 Lanczos 等比降采样、q90 WebP 输出。详情见 [`neon-signs-a06.provenance.json`](../signs/neon-signs-a06.provenance.json)，审图直接使用其最终导出文件。

## 独立自发光样板

- Three.js r169；Chromium `/usr/bin/chromium`；ANGLE/SwiftShader；独立 Vite 端口 5178。
- 每张正面正交平面保持交付宽高比，同一贴图分别用于 `map` 与 `emissiveMap`。
- 贴图 `SRGBColorSpace`、`ClampToEdgeWrapping`，repeat=(1,1)，无平铺；材质颜色和 emissive 都为白色，`emissiveIntensity=1.0`、`roughness=0.8`、`metalness=0`。
- 两侧使用相同低强度白光：ambient=0.12、正面 directional=0.35。无环境贴图或彩色点光；材质色不再压暗。
- HalfFloat RenderTarget；`RenderPass → 可选 UnrealBloomPass → OutputPass`；ACESFilmicToneMapping exposure=1.0，输出 sRGB。
- 左侧关闭 bloom，右侧开启 bloom，设置为 **strength=0.18 / radius=0.15 / threshold=0.65**。只改变 bloom pass 开关，材质、相机、光线和源贴图保持相同；字句在两侧都清晰。

bloom 对照对六张贴图都实际产生像素变化。以下为各 2D 样板 Canvas 的左右 RGB 比较，0–255 通道差值；仅用于确认 pass 生效，不用于修改或调色素材。

| 素材 | 变化像素 / 总像素 | 最大单通道差值 | 平均绝对通道差值 |
| --- | --- | --- | --- |
| `sign_ramen_horizontal_01` | 44577 / 45600 | 60 | 2.425 |
| `sign_pawn_horizontal_02` | 44234 / 45600 | 49 | 2.537 |
| `sign_pharmacy_horizontal_03` | 45167 / 45600 | 67 | 3.774 |
| `sign_netcafe_vertical_04` | 158322 / 158400 | 72 | 5.216 |
| `sign_bar_vertical_05` | 152520 / 158400 | 58 | 1.744 |
| `ad_ninelives_hologram_06` | 155217 / 158400 | 100 | 5.325 |

## 实际执行

```bash
# 工作目录 /workspace/world-worktrees/neon-signs
npm run dev -- --host 127.0.0.1 --port 5178 --strictPort
node /workspace/world-review/neon-signs/emissive-preview.mjs --probe
node /workspace/world-review/neon-signs/review-sheet.mjs
node /workspace/world-review/neon-signs/emissive-preview.mjs
```

独立探测、缩略图和材质样板均通过；最终两张审图各加载 6/6 张贴图，pageErrors=[]。完整参数与加载记录位于 scratch 的 `neon-signs-a06.json` / `neon-signs-a06-emissive.json`。2048×1024 浏览器截图用 8 位输出及 q90 / method6 WebP 编码做技术压缩。

## 最终素材 SHA256

以下哈希同时匹配最终文件、导出清单与本次预览读取，未修改生产素材。

| 文件 | 尺寸 | SHA256 |
| --- | --- | --- |
| `sign_ramen_horizontal_01.webp` | 1024×256 | `4446ef7399a1c78f6f8914a28b4863ea90e69f2ef22e547502c46c92b851719d` |
| `sign_pawn_horizontal_02.webp` | 1024×256 | `4c01ff70da2ae671916b7ae415dd0708c0d653fef4e246cbf3068cf0a7fba4fb` |
| `sign_pharmacy_horizontal_03.webp` | 1024×256 | `7cdbbad9634b1b1de8834ec0d2e99ab89d4808e15286f86b0326fe516c019a03` |
| `sign_netcafe_vertical_04.webp` | 256×1024 | `ce40590e9b4918fefa9501f29e4d9f78ff2db525d8e2e27943d65800a68d14a4` |
| `sign_bar_vertical_05.webp` | 256×1024 | `7b140856f707b4fe6abf19586fefe3451408b4555df9880cb00520f390c6a291` |
| `ad_ninelives_hologram_06.webp` | 512×1024 | `f9c0dfb07e5f0b33bc182b61529fbd97e1b8cf5fa32563f4bc196c7418cb7038` |
