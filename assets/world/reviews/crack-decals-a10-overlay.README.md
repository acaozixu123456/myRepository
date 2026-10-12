# A10 裂缝实际透明材质样板

`crack-decals-a10-overlay.webp` 为 **2048×1024、RGB、sRGB ICC WebP**，quality=85 / method=6，**435,688 B**。独立 Three.js r169 实际渲染最终十张裂缝：上行灰砖、下行湿沥青；左列白光、右列相同白光只增加青 / 品红局部光。画面内上排 ID 01～05、下排 06～10。此样板没有接入游戏引擎。

## 固定材质与几何

背景为白色 `MeshStandardMaterial`（roughness=0.8、metalness=0），20×8.75 水平平面，背景 map 为 `RepeatWrapping`，repeat=[5,2]。

每张裂缝是 3.45² 水平透明平面，y=0.01、renderOrder=1。白色 `MeshStandardMaterial` 参数：roughness=0.8、metalness=0、transparent=true、opacity=1、alphaTest=0.01、depthWrite=false、depthTest=true、NormalBlending、premultipliedAlpha=false；polygonOffset=true，factor / units=−2 / −2。最终 RGBA map 设为 `SRGBColorSpace`、ClampToEdgeWrapping、anisotropy=4。Alpha Test 只丢弃预览渲染片元，没有改写源 Alpha；完整通道验证另由无阈值的离线 Alpha 复核提供。

左右相机、源贴图、材质实例、白光与曝光相同。每个 canvas 为 1024×448，devicePixelRatio=1；正交相机 left/right=−10/+10、top/bottom=±4.375、near=0.1 / far=40，位置 [0,10,0]，up=[0,0,−1]，lookAt=[0,0,0]。输出 sRGB、ACESFilmicToneMapping、exposure=1，抗锯齿开启；无 bloom / 阴影贴图。

| 光源 | 固定参数 | 适用列 |
| --- | --- | --- |
| 半球光 | sky=#ffffff、ground=#777777，intensity=0.65 | 左右相同 |
| 白色平行光 | intensity=2，位置 [−1,10,4] | 左右相同 |
| 青色点光 | #20d9ff，intensity=55、distance=35、decay=2，位置 [−5,4,0] | 仅右列 |
| 品红点光 | #ef42be，intensity=55、distance=35、decay=2，位置 [5,4,0] | 仅右列 |

## 捕获证据

使用独立 Vite **5192**、Chromium `/usr/bin/chromium`、ANGLE/SwiftShader；2048×1024 viewport / deviceScaleFactor=1 捕获 PNG，再只作 RGB 转换与 WebP 编码。

- 加载 **12/12**（十裂缝 + 两背景），十二 WebP 请求均 **HTTP 200**。
- page errors **0**、console errors **0**、failed requests **0**。
- 四个 renderer 各 **11 draw calls**（地面一张 + 裂缝十张）。
- 十裂缝 source SHA256 拍摄前后全部一致，清单见 [出处](../decals/crack-decals-a10.provenance.json) 对应 preview.evidence。
- 左右两种光照可见区域的 RGB 平均绝对差：灰砖 **20.856**、沥青 **14.339**。这反映整幅画面的实际局部彩光响应，并不单独量化裂线可读性。

审图 SHA256：`c6c9996d479d3fc3df96c5083f0a8b2474909a1bb35d78915b45ea57a1211b06`。完整参数、请求、renderer、源哈希和捕获路径记录在 [出处](../decals/crack-decals-a10.provenance.json)。临时 HTML、原始 PNG、Playwright 脚本及 report 保留在 `/workspace/a10-cracks-raw/`。

灰砖上十裂形可辨；湿沥青的碎粒和深色会掩盖裂线，大多数缩略区域很难辨认。此为真实显示限制，源图未用白框、调色或烘焙光提高反差。样板贴花经相机映射，不能替代 [512² 原尺度通道诊断](crack-decals-a10.README.md)。实际场景优先按铺地材质与观看距离选择尺度 / 区域。
