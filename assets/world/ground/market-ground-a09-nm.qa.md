# A09-NM3 夜市地面独立 QA

结果：交付格式、原图到成品的导出复现、边缘审图和真实材质加载核查通过，保留下面的视觉限制。本批仍是第 1 轮待审，不表示 Claude 已批准。审核以最新 `CODEX_QUEUE.md` 和 `WORLD3D.md` 的明亮暖色黄昏夜市为准；旧赛博工作单仅作历史。

| 成品 | WebP 字节 | 冻结 SHA256 |
| --- | ---: | --- |
| `ground_market_terracotta_01.webp` | 252,934 | `d9c54fe6ead0aa39f56c3faa88309ec5081c7f1f69a59623133f3ba5d0ace223` |
| `ground_market_slate_02.webp` | 322,152 | `4dc2e085b9e5a4cb0f27ef3519171cefdfaae8662f82f56754f8521620b31d3d` |
| `ground_market_sandstone_weave_03.webp` | 213,164 | `43e1ac50275ed427aa612b25b1c9c61bae968c7cc427000bb2cdbc51018974a1` |

三张皆 1024×1024、RGB、全不透明，嵌入 588 B sRGB ICC；RIFF 为 VP8X / ICCP / VP8，无 ALPH。ICC 除创建时间字段外与当前 LittleCMS 标准 sRGB profile 完全相同。全部文件小于 500,000 B。

## 出处与重导出

独立读取 [出处](market-ground-a09-nm.provenance.json)、保存的 5 份完整 `image_gen.imagegen` 调用实参/提示词/返回路径，以及实际原图文件。3 次独立生成、2 次陶砖编辑，每份记录的原图 SHA、字节、1254² RGB 尺寸与当前文件相符；5 份提示词和实参与出处逐项相符。原图留在 `/workspace/generated_images/`，没有删除或覆盖。

陶砖选择 candidate 3；candidate 1、2 留作弃选记录。第二次编辑输入确是 candidate 1 双轴各 627 px 的循环位移：独立 `np.roll` 重建与参考 PNG 的 RGB 差异通道数为 0。这一操作只作为真实 AI 编辑的参考。最终直接使用第三次输出，没有回移。

独立从三个所选原图完整 1254² 画布经 Lanczos 降采样至 1024²、quality 90 / method 6、复用交付内嵌 ICC 重导出，**3/3 WebP 文件逐字节相同、解码 RGB 差异均为 0**。没有裁切、上采样、程序画缝、混合遮罩、调色、锐化或补画。复用 ICC 是为固定原生 profile 的时间戳，不改变图像编码方法；这不是原图与有损 WebP 的像素相等声明。40 项离线断言无失败。未重放收费生成调用；来源核查依据保存的原始返回记录和对应原图，而非仅看文件名。

## 接缝与实看

实际查看三张所选原始 PNG、三张最终 WebP、六张独立 2×2 / 4×4 平铺、九张原尺度 RGB 边条/四角图，以及总览和白/暖光图。边条覆盖完整 1024 px 边界：LR 为 right64｜left64，TB 为 bottom64 / top64；四角为 BR128｜BL128 / TR128｜TL128。独立重建的 **9/9 无损 PNG 与最终解码 RGB 差异为 0**，因此直接复用这些精确证据，没有另造重复图。

六张平铺图由成品解码后降为每格 512 或 256 px，再直接重复并以 quality 85 / method 6 导出；独立重建 6/6 文件字节相同。这些平铺 WebP 是有损审图，不用于宣称原生像素一致。

| 材质 | LR 边缘 RGB MAE | TB 边缘 RGB MAE | 原尺度观察 |
| --- | ---: | ---: | --- |
| 陶砖 | 6.631 | 6.064 | 拼接后维持普通一条砂褐砖缝，交错砖端能接续，少量行高变化仍在。 |
| 浅青灰石板 | 10.305 | 40.484 | TB 边缘穿过有明暗变化的正常石缝；完整边条及四角未见额外双缝或宽外框。 |
| 砂岩篮织 | 11.465 | 8.758 | 两轴维持普通砖缝，水平/垂直双砖块交替可辨，区别于前两张半错缝。 |

MAE 是直接比较最终解码的最外一列/行 RGB 通道，范围 0–255；不等于视觉接缝评分。各图边缘像素均不完全相等，最大单通道差与 P95 见 [机器报告](market-ground-a09-nm.qa.json)。此有限尺度审图未见额外粗直线、明显硬断面或大块边界色跳，不能称数学上逐像素无缝。

需要保留的观察：陶砖行高略有差异；初始提示中的 8 行/4×4 块精确计数未全部实现，篮织实际约 6×6 块，最终陶砖编辑提示允许改变行数。4×4 中可辨材料色块与矿物颗粒的低频重复，尤其大石板；应由接入者按真实铺地面积控制 UV。细孔和砖缘的少量浅色磨损可见，没有大面积单方向投影或霓虹色，但不是完全没有任何边缘明暗的理想实验室 albedo。暖光会把青灰石推向橘褐色，材料结构仍能区分。

## 真实 Three.js 材质核查

独立使用 Chromium/SwiftShader 加载临时样板，读取实际 render 时的 Mesh、Material、Texture、Lights 和 Renderer，而非只相信声明参数。唯一查询串与 CDP 禁用缓存下先加载再真实 reload：**每次加载 3 张贴图，两个光照面板共享同一贴图；共 6 次实际纹理下载、12 次实际面板渲染**。6 个 HTTP 响应均 200，响应 body SHA 与上表冻结成品一致；不是 12 次纹理下载。page error / console error / failed request 全为 0，三个成品在离线核查与浏览器前后 SHA 均不变。

实测为 Three.js r169、白色 `MeshStandardMaterial`、roughness 0.85、metalness 0、opacity 1；map 使用 `SRGBColorSpace`、双轴 `RepeatWrapping`、repeat (3,1)、offset (0,0)、rotation 0、anisotropy 4。18×6 平面每个 tile 对应 6×6 单位，顶视正交相机；DPR 1、sRGB 输出、ACESFilmic、exposure 1.1，每个面板 1 draw call。

左右仅换光色：白光 hemi `#ffffff / #777777`、sun `#ffffff`；暖光来自实际 `ATMOS.market` 的 hemi `#ffc0a0 / #5a3a48`、sun `#ffb070`。两侧 hemi intensity 1、sun intensity 2.1、sun position (-50,26,-34) 完全相同。无后加调色、泛光、阴影或材质染色。独立正常截图与作者最终原始 GPU PNG 的 RGB 差异为 0；交付 [光照图](../reviews/market-ground-a09-nm-lighting.webp) 从该截图 quality 85 / method 6 重导出也逐字节相同，但图像本身是有损编码。

这是独立材质样板。已查看当前主线夜市截图作为配色参考，该场景仍使用既有程序地面；本批没有接入游戏。天空、雾、灯笼点光、后处理和实际场景 UV/遮挡尚不在此核查范围。类型与单元测试由主线程另行记录，本 QA 不把它们记作独立运行结果。旧 #98 审核成果与待审历史未被本 QA 修改。
