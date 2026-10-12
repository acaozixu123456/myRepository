# A09-MR · 真实Three材质光照样板

[样板](marble-ground-a09-mr-lighting.webp) 为真实浏览器Three.js r169渲染，2048×1024 RGB sRGB ICC WebP，quality85 / method6，75,716 B。每行依次奶白细晶 / 浅金矿纹 / 象牙云脉；左中性白光，右仅使用 `ATMOS.palace` 午后金光颜色。无生成图片替代渲染、引擎接入或源材质修改。

左右共享同一已加载纹理和白色MeshStandardMaterial，roughness0.55、metalness0。map设置SRGBColorSpace、RepeatWrapping、repeat[3,1]、anisotropy4。平面18×6，绕X转−π/2，每周期6×6，尺度无拉伸；画布1024×288，每周期横向约307px。

OrthographicCamera左右−10 / 10，上下±2.8125，near0.1 / far50，位置[0,12,0]，up[0,0,−1]，lookAt[0,0,0]。平面沿纵轴上下各0.1875单位在视野外，故样板不是完整上下边验证，原尺度四边由无损PNG另查。

双方hemisphere强度0.62、directional强度1.5、方向光位置[42,55,32]均一致。左半球sky#ffffff / ground#777777、方向白光；右半球sky#fff0dc / ground#8a5a4a、方向#ffe8b0。曝光0.9、ACESFilmicToneMapping、SRGB输出、antialias与DPR1固定。关闭阴影 / bloom / 雾，不加入天空、全场景调色或额外点光。这里比较灯色变化对基色的影响，不代表完整宫阙氛围。

Chromium `/usr/bin/chromium` 使用ANGLE SwiftShader，初次加载后真实reload；HTTP缓存在首次加载前关闭。最终3/3素材加载、HTTP200×3，pageerror / consoleerror / failedrequest均0；6个renderer各1drawcall。拍前、拍后及当前三源图SHA恒定。

原始无损PNG三行左右可见材质区RGB MAE分别17.012 / 17.009 / 17.096。区域为左x[52,972)、右x[1076,1996)、每行y=row×336+48至+288。它验证两组光色实际产生变化，不代替无缝检验。

临时HTML为 `.tmp-marble-ground/preview.html`，对应快照、capture-lighting.mjs、原PNG、lighting-report.json与export-lighting.py / lighting-export.json留在 `/workspace/marble-ground-raw/`；确切参数与文件SHA见 [出处](../ground/marble-ground-a09-mr.provenance.json)。PNG→WebP常规编码复用成品ICC；样板是有损再编码，精确源通道使用 [原尺度PNG](marble-ground-a09-mr.README.md)。
