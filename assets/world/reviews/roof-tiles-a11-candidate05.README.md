# A11 最终瓦面审图

[总览](roof-tiles-a11-candidate05-overview.webp)和[白光/宫阙午后独立材质样板](roof-tiles-a11-candidate05-lighting.webp)，均2048×1024，小于500000B。真实捕获08:42:28.871/08:42:36.651 UTC，三最终成品各3/3加载；元件未改。[完整捕获方法与限制](../roof/preview/README.md)、[配置](../roof/preview/capture-config.json)、[原料说明](../roof/roof-tiles-a11.README.md)。

Three0.169.0，sRGB/RepeatWrapping/anisotropy4；Plane8×8、repeat2×2、roughness.65/metal0，两组相机及亮度相同，仅白光/宮阙灯色不同。无雾、阴影或bloom。实际源上下文为e0af快照，不是f4实机接入截图；原宫檐64²程序纹理repeat5×4/roughness.55/metal.12/圆台屋面与独立平面不同。当前贴图未接入引擎。

原总览PNG中三块原512²共786432RGB像素全等；q92 WebP只供视觉审图，不声称无损。这里的九张native-lr/tb/corners PNG从最终512²解码作整数裁切拼贴，无融合/美化。它们对应[有限独立QA](../roof/roof-tiles-a11.qa.md)，不能据此称严格数学无缝或无烘焙光照。
