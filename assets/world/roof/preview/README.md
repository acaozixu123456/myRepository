# A11 三色屋瓦 · 导出候选05真实预览

这是三个冻结成品的两张新浏览器审图，供根、独立QA与Claude审阅。未改sources/原稿/production/Git/PR，旧候选完整保留；未声称Claude通过。

| 审图 | 尺寸 | 字节 | SHA256 |
| --- | --- | ---: | --- |
| roof-tiles-a11-candidate05-overview.webp | 2048×1024 | 378182 | dc1fe5af6cf10dae7321897fc25f59081b06ed0d48eb4a96e7736d048dd3c5c0 |
| roof-tiles-a11-candidate05-lighting.webp | 2048×1024 | 213360 | d86ac2cae26a12843926da1f8cc3f9a97891fbf714b82181fa525d56dc88bfe7 |

原始PNG、脚本、配置、log、捕获JSON均保留。审图WebP只是截图q92/method6编码；PNG三块512²原尺寸区786432个RGB像素与各成品解码RGB完全一致，来源矩形及前后哈希在sources-after.json。不能把有损审图WebP当逐像素证明。

## 新捕获和实际源

本目录执行以下命令，实际均exit0：

```sh
CHROME=/usr/bin/chromium node capture-tools/review-sheet.mjs --config capture-config.json
CHROME=/usr/bin/chromium node capture-tools/material-preview.mjs --config capture-config.json
```

报告时间2026-10-12T08:42:28.871Z /08:42:36.651Z，无旧日期复用。Chromium/usr/bin/chromium、ANGLE SwiftShader、2048×1024/DPR1；独立localhost自开并关闭，不使用游戏Vite。两capture实际3/3loads，pageerror/failedrequest/HTTP≥400/console error-warning数组全部为空，URL/type/location监测已启用，无外部字体网络请求。

actualAICallCount仍6（C1三原稿+C2三真实编辑）；selectedNative仍1,2,2，exportcandidate05不是第5轮新AI，也没有第7call。蓝从真实C1原稿正常内部选半开[307,205,1069,940]，762×735，四瓦垄/五瓦行。降512²是分别缩两轴：scaleX=512/762=.6719160104986877，scaleY=512/735=.6965986394557823。**这是非uniform缩放**；纵向相对横向比例=762/735=1.036734693877551，瓦帽相对变高3.673469%。两个轴都降采样，无上采样；crop像素不补画/roll/逆移位/颜色调整/融合。不能照搬前轮squarecrop等比描述。

金C2仍[80,136,1147,1203]1067²、朱C2[160,199,1068,1107]908²，等比降512²。金/朱source完整bytes/SHA与C3/C4同；这次仍加载它们与新蓝重新捕获两板。三图WebP q90/method6/RGB/同冻结588B sRGB ICC。蓝46868B SHA8ce52607f49d2664872ec18bcbd9705f9b892a217ab78feac9b3da371f513990；金50380B/335ba9f5a0101009a4e79ff620ea64abf55bdaec207210ba17441de388838b03；朱40756B/2413a9a5dd2c282a72c0faf80aa7803a78395033af6f9afe9bde1257007abb8e。上一级provenance/selection/exportfreeze和capture-config记录完整出处/真实args/时间/hash。

总览上方512²1:1，下方2×2/4×4直接同源repeat在256²视窗，每格128²/64²，无遮线、遮罩或人工缝。根/独立source-audit另有原生四边/四角/encoded8实看，本helper没有抢写这些证明或代其全面验收。

## Three独立样板

Three.js0.169.0，SRGBColorSpace/RepeatWrapping/actualanisotropy4、repeat2×2，水平Plane8×8。白色MeshStandardMaterial统一roughness.65/metalness0。两行同camera fov40/[5.7,7.5,8.5]/lookAt0，灯强hemi.62/sun1.5、sunPos[42,55,32]、ACES曝光.9、RoomEnvironment PMREM sigma.04/env.3均同，只变灯色。白光hemiSkyffffff/hemiGround777777/sunffffff；宫阙午后fff0dc/8a5a4a/ffe8b0。成对其余字段逐项确认相同，六面板各1draw/2三角。

无fog/shadow/bloom/normal/roughness/displacement map/调色/暗角；源贴图无额外压黑。图上瓦弧起伏来自底色烘焙，水平Plane没有真实瓦几何。

上下文从已真实GitHub exactref e0afc86e2c295b46dfed1e1c0df9f87543e84b9e九文件快照复制并验证哈希，不伪称新的GitHub读取。e0af相较848只atmos新增snow；其余8字节同，palace整块字节同。当前engine已采样skyBand，但没有导入本样板，雪景/另一批artback也未导入。实际eaveRoof仍程序64²repeat5×4/rough.55/metal.12及圆台屋面；本Plane2×2/.65/0并非实际游戏屋顶UV/PBR，AI瓦底图没有在本图接入游戏。

## 实看范围

已查看两张最终WebP，四瓦垄/五瓦行正常可辨，当前512单张、2×2/4×4和六材质面板中未见前轮尖V/内部直断或明显新硬直线。该观察限于已见视图；全面边角仍以独立QA为准，最终决定属Claude。

磨损/瓦缝及颜色周期可辨，金瓦等源图方向性高光仍在；不承诺数学像素完全无缝或零烘焙照明。白/午后差异较轻，符合只改灯色并共享Room环境的实际设置。没有用色改/遮挡掩盖余项。
