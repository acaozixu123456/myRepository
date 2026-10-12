# A09-PAL · 宫阙三款实际审图

本批重新加载三张最终 WebP，实际捕获平铺审图、独立 Three 材质样板与 9 张原尺寸局部。没有使用旧三主题包的截图。第 1 轮待 Claude 审核；本页记录独立预览，不是游戏集成验收。

| 审图 | 尺寸 | 字节 |
| --- | --- | ---: |
| [单张 / 2×2 / 4×4 / 原生边缘](palace-ground-a09.webp) | 2048×1024 | 253880 |
| [中性白光 / 午后金光 Three 样板](palace-ground-a09-lighting.webp) | 2048×1024 | 90946 |

## 原生接合局部

以下均为 256² 无损 PNG。按整数窗口将最终 WebP 解码像素直接拼接，全部 589824 个 RGB 像素与源片全等；无画线、遮缝、修色或重绘。此等同性说明局部忠实于源片，不等于纹理四边逐像素完全无缝。

| 成品 | 左右 | 上下 | 四角 |
| --- | --- | --- | --- |
| 白玉淡金纹 03 | [LR](palace-ground-a09-ground_palace_white_marble_03-native-lr.png) | [TB](palace-ground-a09-ground_palace_white_marble_03-native-tb.png) | [四角](palace-ground-a09-ground_palace_white_marble_03-native-corners.png) |
| 云灰白玉 04 | [LR](palace-ground-a09-ground_palace_cloud_marble_04-native-lr.png) | [TB](palace-ground-a09-ground_palace_cloud_marble_04-native-tb.png) | [四角](palace-ground-a09-ground_palace_cloud_marble_04-native-corners.png) |
| 金丝白玉 05 | [LR](palace-ground-a09-ground_palace_gold_thread_05-native-lr.png) | [TB](palace-ground-a09-ground_palace_gold_thread_05-native-tb.png) | [四角](palace-ground-a09-ground_palace_gold_thread_05-native-corners.png) |

## 实际命令与环境

2026-10-12 04:50 UTC 实际执行下列两条命令，均 exit 0；每次三源加载 3/3，page errors / request failures / console error-warning 均为空。

```sh
CHROME=/usr/bin/chromium /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node /workspace/world-review/palace-ground/preview-final/capture-tools/material-preview.mjs --config /workspace/world-review/palace-ground/preview-final/palace-config.json
CHROME=/usr/bin/chromium /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node /workspace/world-review/palace-ground/preview-final/capture-tools/review-sheet.mjs --config /workspace/world-review/palace-ground/preview-final/palace-config.json
```

Three.js 0.169.0（REVISION 169），Chromium + ANGLE SwiftShader，viewport 2048×1024、deviceScaleFactor 1。完整命令、实际渲染参数、工具哈希与源哈希在 [总览捕获记录](palace-ground-a09.overview.json) / [灯光捕获记录](palace-ground-a09.lighting.json)。工具留在所列 scratch，未改仓库 tools。

三列统一为白色 MeshStandardMaterial，roughness 0.5 / metalness 0.05、sRGB、RepeatWrapping 2×2；PlaneGeometry 8×8 向上。相机 FOV 40°，位置 `[5.7,7.5,8.5]`，看原点；RoomEnvironment 经 PMREM sigma 0.04，环境强度 0.3；ACESFilmicToneMapping 曝光 0.9，sRGB 输出。

上排白光 hemisphere `ffffff / 777777`，下排宫阙金光 `fff0dc / 8a5a4a`，强度均 0.62；directional 分别 `ffffff / ffe8b0`，强度均 1.5，位置均 `[42,55,32]`。两排仅改灯色，相机、材质、灯强和方向一致。没有 world 引擎导入、雾、阴影、bloom、法线 / 位移或后期调色。样板的一轮贴图对应 4 世界单位，非游戏 UV 接入尺度。

参数来自 `e6e89a9be7f4d0dce972221cb538ab299cbabafc`，提交检查基线为 `4b658b79921838d91f9bde8907df00ba80b9a2fe`；两基线 19 个参数 / 依赖文件逐字节相同，见 [依赖核对](palace-ground-a09.dependencies.json)。拍摄前后源 SHA 不变，见 [源复核](palace-ground-a09.source-check.json)；全部 11 张审图的尺寸、字节与 SHA 见 [交付清单](palace-ground-a09.delivery.json)。原始全页无损 PNG 超过预算，仅留 scratch，交付总览和 lighting 采用 WebP q92 / method6。

实际检查位置的灰缝对齐，未见额外外框或统一亮度断带。04 灰斜矿带仍在；细金纹与变体间差异在固定白光 / 金光及小图下偏弱，纹簇的周期可辨。完整平铺与出处检查见 [独立 QA](../ground/palace-ground-a09.qa.md)。
