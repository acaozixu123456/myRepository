# A10 实际透明材质叠加样板

`stain-decals-a10-overlay.webp` 为 **2048×1024、RGB、sRGB ICC WebP**，quality=85 / method=6，**454,868 B**。实际 Three.js r169 渲染十张最终 RGBA 贴花：上行 A09 青灰砖，下行 A08 湿沥青；左列白光，右列保持相同白光并加入青色 / 品红点光。每个画面按上排 01～05、下排 06～10 放置贴花。样板独立运行，没有接入游戏引擎。

## 固定材质与几何

地面使用白色 `MeshStandardMaterial`，roughness=0.8 / metalness=0，20×8.75 水平平面，背景贴图 `RepeatWrapping`、实际 repeat=[5,2]。

每张贴花使用白色 `MeshStandardMaterial`：roughness=0.8、metalness=0、transparent=true、opacity=1、alphaTest=0.01、depthWrite=false、depthTest=true、NormalBlending、premultipliedAlpha=false；polygonOffset 开启，factor=−2 / units=−2。3.45² 水平平面位于 y=0.01，renderOrder=1。源贴图为最终 RGBA WebP，`SRGBColorSpace`、ClampToEdgeWrapping、anisotropy=4。Alpha Test 仅在预览渲染时丢弃低于阈值的片元，没有改写 PNG / WebP Alpha。

左右采用同一背景与贴花材质实例，相机、白光、曝光均相同。每个 canvas 为 1024×448、devicePixelRatio=1。正交相机 left/right=−10/+10，top/bottom=±4.375，near=0.1、far=40，位置 [0,10,0]，up=[0,0,−1]，lookAt=[0,0,0]。输出 sRGB，ACESFilmicToneMapping、exposure=1，抗锯齿开启；没有 bloom 或阴影贴图。

| 光源 | 固定参数 | 适用列 |
| --- | --- | --- |
| 半球光 | sky=#ffffff、ground=#777777，intensity=0.65 | 左右相同 |
| 白色平行光 | intensity=2，位置 [−1,10,4] | 左右相同 |
| 青色点光 | #20d9ff，intensity=55、distance=35、decay=2，位置 [−5,4,0] | 仅右列 |
| 品红点光 | #ef42be，intensity=55、distance=35、decay=2，位置 [5,4,0] | 仅右列 |

## 捕获证据

独立 Vite **5191**、Chromium `/usr/bin/chromium`、ANGLE/SwiftShader，以 2048×1024 viewport / deviceScaleFactor=1 捕获 PNG，再只作 RGB 转换和 WebP 编码。

- 加载 **12/12**：十贴花 + 两背景；十二 WebP 请求均 **HTTP 200**。
- page errors **0**、console errors **0**、failed requests **0**。
- 四个 renderer 各实际 **11 draw calls**：一张地面 + 十张透明贴花。
- 十张贴花拍摄前后 SHA256 全部一致，完整清单见 [出处](../decals/stain-decals-a10.provenance.json) 的对应 preview.evidence。
- 左右两种光照 RGB 平均绝对差：砖地 **20.723**，沥青 **14.607**，说明实际局部彩光产生可测响应。

审图 SHA256：`7b5ccdaf31db8725e50fdb6e8654c082e86f524c7d3967b1b7e448dd7bcd3218`。实际参数、加载尺寸、请求状态、renderer、源哈希和捕获路径均记录于 [出处](../decals/stain-decals-a10.provenance.json)。临时 HTML / 原截图 PNG / Playwright 脚本与采集报告保留在 `/workspace/a10-raw/`。

样板用于观察真实 GPU 透明边缘及中性 / 彩光下的可读性。面板内的贴花经过相机映射，不能代替逐张原尺度 Alpha 诊断；后者见 [四面板说明](stain-decals-a10.README.md)。矿物盐痕、雨洗积尘的浅色对比仍需按实际游戏视距控制。
