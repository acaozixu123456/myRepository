# A09-NM · 实际 Three 地面光色样板

`market-ground-a09-nm-lighting.webp` 为 2048×1024、RGB、sRGB ICC WebP，quality 85 / method 6，171,564 B。三行对应陶砖 / 青石 / 篮织砂石；左列中性白光，右列夜市黄昏暖光。白色材质、相机、照明强度与位置、曝光均固定，左右只改变灯的颜色。这是独立临时 HTML 材料样板，没有接入游戏。

## 材料与相机

Three.js r169，每块画布 1024×288。三图以 `TextureLoader` 真正加载最终成品，map 设 `SRGBColorSpace`、RepeatWrapping、repeat=[3,1]、anisotropy=4。平面 18×6，绕 X −π/2，因此每个完整纹理周期覆盖 6×6 的地面，未改写源图。

白色 `MeshStandardMaterial`：roughness=0.85、metalness=0，不透明。正交相机 left/right=−10/+10、top/bottom=±2.8125、near/far=0.1/50，position=[0,12,0]、up=[0,0,−1]，lookAt=[0,0,0]；上下裁切平面边缘约 0.1875 地面单位，样板仍显示真实 repeat 的周期。

renderer：SRGBColorSpace、ACESFilmicToneMapping、exposure=1.1、antialias=true、devicePixelRatio=1，无 bloom / 阴影。

## 光色对照

参数读取只读 `src/world/atmos.ts` 的 `ATMOS.market`。两列 HemisphereLight intensity=1.0，DirectionalLight intensity=2.1、position=[−50,26,−34]。左列 sky/sun=#ffffff、ground=#777777；右列 sky=#ffc0a0、ground=#5a3a48、sun=#ffb070。

没有额外霓虹点光、天空穹顶、雾、灯笼点光、后处理调色或材质纹理色乘。暖光明显将青石与砂石推向橘褐，记录这个场景光色影响，不程序重调基色。

## 实际捕获

临时页面 `http://127.0.0.1:5194/.tmp-market-ground/preview.html`，HTML 快照与捕获脚本 / 报告保留在 `/workspace/nightmarket-ground-raw/`。浏览器 Chromium `/usr/bin/chromium`，ANGLE SwiftShader，viewport=2048×1024、DPR=1；关闭浏览器 HTTP 缓存后先加载，再实际 reload，等三纹理与六 renderer 完成后截图。六 renderer 各 1 draw call。最终加载3/3、三次HTTP200、page / console errors 0、failed requests 0、三源图拍前后SHA256相同。

第一捕获遇 favicon 404 和两条正常缓存 304，证据另留 `lighting-report-attempt1.json`；随后使用空 favicon、关闭缓存完整重拍，最终以新报告为准。源材质图保持冻结。PNG 常规 RGB WebP 导出 quality 85 / method 6，ICC 复用最终交付嵌入数据。

材料区域白/暖RGB差的均值为31.017 / 43.691 / 40.184（按三行顺序）；这是整体灯色差，不等同物理材质精度。最终加载 / HTTP 状态 / 错误数、原始截图 SHA、HTML / capture script SHA、三源图拍前后 SHA 与灯光区域像素差均见 [完整出处](../ground/market-ground-a09-nm.provenance.json)。平铺与精确源像素验证使用 [离线边角审图](market-ground-a09-nm.README.md)，GPU样板本身并非无损源通道证明。

