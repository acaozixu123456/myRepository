# A09-HB · 真实 Three 港口晚霞样板

`harbor-ground-a09-hb-lighting.webp` 为2048×1024、RGB sRGB ICC WebP，quality85 / method6，144,650 B。三行宽旧褐板 / 漂洗板 / 窄板，左白光、右 `ATMOS.redcliff` 晚霞光色；同白材质 / 相机 / 强度 / 位置 / 曝光，仅变灯色。独立临时HTML，没有引擎接入。

Three.js r169，每canvas1024×288。最终源图以TextureLoader真实加载，map用SRGBColorSpace、RepeatWrapping、repeat[3,1]、anisotropy4；plane18×6，旋转X−π/2，每个周期6×6地面单位。白色MeshStandardMaterial roughness0.9 / metalness0，不透明。

正交camera left/right±10、top/bottom±2.8125、near/far.1/50、position[0,12,0]、up[0,0,−1]、lookAt[0,0,0]；顶部 / 底部各裁切平面0.1875地面单位。renderer SRGBColorSpace、ACESFilmicToneMapping、exposure1.1、antialias=true、DPR1，没有bloom / 阴影。

两列Hemi intensity0.95、directional intensity2.3、sun position[10,20,−52]。左列sky/sun白#ffffff、ground#777777；右列sky#ffa080 / ground#40242c / sun#ff7a3a，实际读取 `src/world/atmos.ts` 的redcliff设置。未模拟天空穹顶、雾、额外灯笼点光、后处理调色。

晚霞样板会明显把木材推向橘红，尤其暖褐板；浅漂洗仍较亮。这个光色影响保留，没有修改 / 预调源图颜色。材质区域白 / 暖RGB MAE为45.523 / 62.825 / 50.989（按行顺序），是灯色变化记录，不是物理准确度证明。

捕获URL `http://127.0.0.1:5195/.tmp-harbor-ground/preview.html`，Chromium `/usr/bin/chromium`，ANGLE SwiftShader，viewport2048×1024/DPR1。空favicon，CDP禁HTTP缓存后先加载、再真实reload，等三个map与六renderer完成后截图。最终loaded3/3、HTTP200×3、page/console errors0、failed0，六renderer各1drawcall，三源图拍前后SHA相同。

HTML快照、capture-lighting.mjs、rawPNG、lighting-report.json、export-lighting.py/lighting-export.json保留在 `/workspace/harbor-ground-raw/`，确切哈希与运行实参见 [出处](../ground/harbor-ground-a09-hb.provenance.json)。WebP常规q85m6编码复用交付嵌ICC数据；GPU样板有损再编码，精确源通道验证用 [原尺度PNG](harbor-ground-a09-hb.README.md)。

