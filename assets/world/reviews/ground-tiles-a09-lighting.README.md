# A09 独立材质灯光样板

`ground-tiles-a09-lighting.webp` 为 **2048×1024、RGB、sRGB ICC WebP**，质量 90、method 6，476,746 B。上行为青灰方砖，下行为连续沟盖；左列白光，右列保持相同白光并加入青色 / 品红局部点光。本样板实际通过 Three.js r169 渲染最终交付贴图，不是游戏接入截图。

## 固定参数

左右使用同一 `MeshStandardMaterial` 实例：白色 `#ffffff`，roughness **0.65**，metalness **0**。两张贴图设为 `SRGBColorSpace`、`RepeatWrapping`，实际 `map.repeat=[2,2]`，anisotropy=4；12×12 平面沿 x 轴旋转 −π/2，贴图未改写。

每个面板 canvas 为 1024×448、devicePixelRatio=1。左右及两行共用相同正交相机参数：left/right=−7/+7，top/bottom=±3.0625，near=0.1，far=50，位置 [0,9,7]，看向 [0,0,0]。输出为 sRGB，ACESFilmicToneMapping，exposure=1，抗锯齿开启；没有 bloom 或阴影贴图。

| 光源 | 参数 | 适用列 |
| --- | --- | --- |
| 半球光 | sky=#ffffff、ground=#777777，intensity=0.65 | 左右相同 |
| 白色平行光 | color=#ffffff、intensity=2，位置 [−1,10,4] | 左右相同 |
| 青色点光 | color=#20d9ff、intensity=45、distance=25、decay=2，位置 [−3,3,1] | 仅右列 |
| 品红点光 | color=#ef42be、intensity=45、distance=25、decay=2，位置 [3,3,−1] | 仅右列 |

## 加载与截图证据

临时 HTML 使用独立 Vite 5184、Chromium `/usr/bin/chromium`、ANGLE/SwiftShader，以 2048×1024 viewport / deviceScaleFactor=1 截图。加载 **2/2**；两次 WebP 请求 HTTP **200**，尺寸均为 1024²；page errors **0**，failed requests **0**。四个 renderer 各实际 draw call 为 1。截图 PNG 经 RGB 转换和 WebP 编码，没有后期着色。

对原始截图中同一画面的左右可见区域比较：方砖 RGB 平均绝对差为 **31.702**，沟盖为 **31.052**；局部光使两行产生可测颜色响应。两张成品拍摄前后 SHA256 保持一致：

| 成品 | 拍摄前 = 拍摄后 SHA256 |
| --- | --- |
| `ground_tile_slate_01.webp` | `db807e9d4c40667f6ab6610460be95de7d29658ed1df544b59e3f990968ac526` |
| `ground_drain_slate_02.webp` | `adc52519818bbb996547fabe9c103d6cb89df456d2936cf2b395531439ee9418` |

灯光审图 SHA256：`2fb6bb008f42da844276f8d79bed76e2935f750edecb4dc1d9d275bfd66727ba`。完整实际参数、请求结果、renderer 信息和前后哈希记录在 [A09 出处](../ground/ground-tiles-a09.provenance.json) 的 `previews` 中；临时 HTML、截图 PNG 和采集脚本保留在工作空间 `/workspace/a09-raw/`。

样板用于观察灰色贴图在中性与局部彩光下的可读性，不证明游戏接入后的整体观感。沟盖金属度本次按统一 **0** 比较，实际接入材质由 Claude 确定。
