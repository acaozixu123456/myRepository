# WORLD A08 · 湿沥青独立审图

本批最终源图为 [`ground_asphalt_wet_01.webp`](../ground/ground_asphalt_wet_01.webp)：1024² RGB、sRGB ICC、WebP q90 / method6、491514 B，SHA256=`5cb849b916c76d86e80a195169316b6182c4bb3ea37c63aeb467194e2ea2b1f2`。原生C2为1254²，仅等比Lanczos降采样到1024²；三AI候选、未选的接缝修版及完整提示词见 [`wet-asphalt-a08.provenance.json`](../ground/wet-asphalt-a08.provenance.json)。本预览直接读取这张最终成品，拍前/拍后hash保持一致。

审图于2026-10-11T23:48:33.837Z与2026-10-11T23:48:34.370Z实际生成，host=http://127.0.0.1:5182；独立Three r169，Chromium154.0.8037.57 / Swiftshader。probe与两次实际页面截图均pageErrors=[]，每页成功加载1/1最终贴图。没有加载WorldView、游戏页面或修改src/world引擎。

## 直接平铺与原生局部

主审图2048×1024：单张512²缩略、2×2平铺（每格256²）、4×4平铺（每格128²），均直接CSS repeat成品WebP。没有覆盖接缝的边线、遮罩、调色或锐化。主审图PNG技术编码为WebP q84 / method6；仅审图采用该压缩，源图不变。

原生局部各256²，以整数坐标从最终WebP解码图裁拼，不缩放、不插值。LR左半=源图(x896,y384,w128,h256)，右半=(x0,y384,w128,h256)，拼边位于x128；TB上半=(x384,y896,w256,h128)，下半=(x384,y0,w256,h128)，拼边位于y128。两PNG逐RGB像素与对应源图解码数组比较，65536像素/张全部相同，最大RGB差=0。它们仅覆盖所列边界局部；完整边界判断由本批QA另行提供。

实看：2×2/4×4平铺与这两个原生局部未见连续贯穿的直线边界；粒子边缘仍有局部变化。4×4下固定水膜与断续标记的重复节奏明显，保留给reviewer评估。不宣称四边严格逐像素完全匹配。

## 独立地面材质样板

光照审图2048×1024，两栏使用同一源图、8×8水平PlaneGeometry、相机、2×2重复和白色MeshStandardMaterial。统一roughness=0.42、metalness=0是样板参数；游戏材质参数由Claude接入时选择。Map=SRGBColorSpace + RepeatWrapping，anisotropy=8。输出sRGB、NoToneMapping、exposure1；无环境贴图、法线、位移、粗糙度贴图、阴影或bloom。

两栏共同使用半球光（sky#ffffff / ground#777777、intensity1）和白色DirectionalLight（intensity1.1、position[1,8,5]）。右栏新增青PointLight #35c8df，position[-2,2.2,2]；品红PointLight #e064b9，position[2,2.2,-2]；两者均intensity8 / distance14 / decay2。相机Perspective fov40，position[6,8,9]、lookAt[0,0,0]。无灯光以外的左右变化。

实看青/品红光斑克制可见。排除标题/标签/页脚的相同渲染ROI，两栏最大RGB差=71，变化像素=249216，mean absolute RGB差=2.693456。成品水膜高光来自原图；样板没有额外水面几何或按水洼分区的粗糙度图。光照审图仅技术编码为WebP q84 / method6，没有后期调色。

## 交付尺寸与SHA256

| 文件 | 尺寸 | 字节 | SHA256 |
| --- | --- | --- | --- |
| [wet-asphalt-a08.webp](wet-asphalt-a08.webp) | 2048×1024 | 349356 | `48b33bba4d55fbe8f9f5959270baec24835242d66412a378a4360b6c0930215e` |
| [wet-asphalt-a08-lighting.webp](wet-asphalt-a08-lighting.webp) | 2048×1024 | 137066 | `1b1e33247ffb38a2d42ce4c1c78c396c9250a5708eb1a4944d99b34ece1914c2` |
| [wet-asphalt-a08-native-lr.png](wet-asphalt-a08-native-lr.png) | 256×256 | 168566 | `142ac8e2646daf44ee2ee8d6207ea41f81262d19f8cc8259b5f980c7a19c05b7` |
| [wet-asphalt-a08-native-tb.png](wet-asphalt-a08-native-tb.png) | 256×256 | 167458 | `8935d294263d9bde2642f074bd081d2a9c56d018bd83d3ecf85099f6fe0075c2` |

所有审图均2的幂尺寸，单文件≤500000 B。源图hash与两张审图的源图记录一致。

## 实际命令与证据

在 `/workspace/world-worktrees/wet-asphalt` 启动：

```bash
npm run dev -- --host 127.0.0.1 --port 5182 --strictPort
node /workspace/world-review/wet-asphalt/material-preview.mjs --probe
node /workspace/world-review/wet-asphalt/review-sheet.mjs
node /workspace/world-review/wet-asphalt/material-preview.mjs
```

脚本全部仅在scratch；没有新增依赖或修改生产工具。浏览器通过独立空HTML页面导入three.module.js；WebGL实际renderer=`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`。

scratch证据：probe.json、wet-asphalt-a08-review.json、wet-asphalt-a08-lighting.json、review-pixel-validation.json（原生局部像素与光照差异）、preview-delivery.json（提交文件字节/hash）。原始2048×1024 PNG保留scratch，不进入仓库预算。
