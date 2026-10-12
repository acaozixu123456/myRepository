# A09-FR · 真实Three清晨材质样板

[样板](forest-ground-a09-fr-lighting.webp) 为实际浏览器Three.js r169渲染，2048×1024 RGB sRGB ICC WebP，quality85 / method6，405,744 B。每行依次青绿稀叶 / 苔绿暖叶 / 浅鲜小叶；左中性白光，右仅使用 `ATMOS.forest` 清晨光色。未接入引擎，也未用生成图代替渲染。

左右共享同一纹理和白MeshStandardMaterial，roughness0.95 / metalness0.02，与 `common.ts` 中groundPlane默认一致。纹理为SRGBColorSpace、RepeatWrapping、repeat[3,1]、anisotropy4；平面18×6，绕X转−π/2，每周期6×6，不拉伸。画布1024×288，每周期横向约307px。

OrthographicCamera左右−10 / 10、上下±2.8125、near0.1 / far50、位置[0,12,0]、up[0,0,−1]、lookAt[0,0,0]。平面纵向上下各0.1875单位在视野外，样板不覆盖完整上下边；1:1全边由无损PNG另查。

双方hemisphere强度1.15、directional强度2.7、方向光位置[34,62,26]一致。左半球sky#ffffff / ground#777777、白方向光；右半球sky#daf4ff / ground#3a5a40、方向#fff0c0。曝光1.0、ACESFilmicToneMapping、SRGB输出、antialias与DPR1相同。关闭阴影 / bloom / 雾，不加入天空、环境贴图、全场景调色、光束或额外点光；这是灯色比较，不是完整清晨场景。

Chromium `/usr/bin/chromium` 使用ANGLE SwiftShader，初次加载后实际reload；HTTP缓存首次加载前关闭。最终3/3素材加载、HTTP200×3，pageerror / consoleerror / failedrequest均0，6renderer各1drawcall。三源图SHA在拍前 / 拍后恒定。

原始无损PNG三行左右可见材质区RGB MAE为11.071 / 10.494 / 11.458，区域左x[52,972)、右x[1076,1996)、每行y=row×336+48至+288。清晨灯色使草更黄绿暖亮，落叶仍清楚；没有为抵消灯色而程序调基色。MAE证明两光色产生实际变化，不替代无缝检查。

临时HTML `.tmp-forest-ground/preview.html`、对应快照、capture-lighting.mjs、原PNG、lighting-report.json、export-lighting.py / lighting-export.json保留在 `/workspace/forest-ground-raw/`；确切实参和文件SHA见 [出处](../ground/forest-ground-a09-fr.provenance.json)。PNG→WebP常规编码复用最终源图ICC。样板有损再编码，源图精确通道用 [原尺度PNG](forest-ground-a09-fr.README.md) 验证。
