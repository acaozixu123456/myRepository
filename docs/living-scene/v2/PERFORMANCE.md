# V2 性能与画质对照

同一台 MacBookPro14,3 / Radeon Pro 555 2 GB，Chrome 152.0.7977.82，实际 ANGLE Metal。没有更换 GPU，没有降低 V1 的约207万渲染像素预算。

## 实现 A/B

固定 1920 × 1080、DPR 1，同一 V2 主图、语义动画、相机路径。每个 case 先完成截图与预热，然后约15秒连续鼠标路径采样。下表 CPU 与 GPU 数据只取测量区间；GPU 为 EXT_disjoint_timer_query_webgl2 的异步查询，丢弃 disjoint 结果。每30帧一次查询，尾百分位样本量有限。

| 管线 / 叶片 | 绘制调用 | 平均 FPS | 帧 P95 ms | CPU P50/P95 ms | GPU P50/P95 ms | GPU 查询数 |
| --- | --- | --- | --- | --- | --- | --- |
| half / mesh | 51 | 60.00 | 17.40 | 1.10 / 1.60 | 5.73 / 5.94 | 31 |
| byte / mesh | 51 | 60.00 | 17.40 | 1.10 / 1.70 | 4.85 / 5.35 | 31 |
| byte / instanced | 21 | 60.00 | 17.60 | 0.60 / 1.20 | 4.65 / 5.25 | 32 |
| small / instanced | 13 | 60.00 | 17.20 | 0.60 / 1.00 | 4.72 / 5.76 | 31 |
| local / instanced | 5 | 60.00 | 17.50 | 0.40 / 0.80 | 3.56 / 7.77 | 31 |

half：HalfFloat composer + 8级 Bloom；byte：RGBA8 composer + 8级 Bloom；small：RGBA8 + 4级 Bloom；local：RGBA8 + 原图局部预计算光晕。mesh 为18个独立叶片物体，instanced 为一份实例化叶片批次；双面透明渲染可能为一次物体产生多个绘制调用。

选择 local + instanced：中位 GPU 工作量和 CPU 提交成本明显降低，整个画面仅5次绘制。**GPU P95 并未单调改善，不能据此宣称所有尾延迟已解决。** 完整原始帧、CPU/GPU查询在 `evidence/ab-performance.json`。

## 静态画质

同一停止时刻与相机，各管线截图在 `evidence/ab-*.png`。RGBA8使用库的 sRGB 颜色缓冲配置。局部光晕与HalfFloat/全局Bloom的画面平均通道差约0.15/255，99百分位约2/255；实际检查未见明显细节损失或色带。统计是图像差值，不等于美术验收，最终仍由Sol确认。见 `evidence/ab-image-difference.json`。

## V1 / V2 交替复测

相同有界面Chrome，顺序 A→B→B→A，每次约30秒鼠标移动，期间点击推近并返回；另测一次V2高DPI。各次预热5秒。此阶段没有录屏，也没有开启GPU查询。

| 版本 | 渲染尺寸 | 平均 FPS | P95 / P99 ms | >33.34ms慢帧 | 样本数 |
| --- | --- | --- | --- | --- | --- |
| v1-A | 1920×1080 | 60.00 | 18.20 / 18.60 | 0 | 1983 |
| v2-B | 1920×1080 | 60.00 | 18.40 / 18.70 | 0 | 1918 |
| v2-B-repeat | 1920×1080 | 60.00 | 17.40 / 17.70 | 0 | 1918 |
| v1-A-repeat | 1920×1080 | 60.00 | 17.50 / 17.70 | 0 | 1918 |
| v2-retina | 1821×1138 | 60.00 | 17.60 / 17.70 | 0 | 1982 |

**这次 V1 也约60 FPS，之前48–51 FPS的情形未复现。** 因而本轮结论是“降低确定的绘制成本、获得更多余量”，不是“已证明修复历史掉帧”。历史48–51 FPS数据仍保留在V1报告中，没有替换或删除。长期热状态、其他应用GPU竞争和跨设备情况仍需复测。

## 功能与录屏

- chromeFades: PASS
- keyboardReveal: PASS
- edgeReveal: PASS
- focus: PASS
- noScroll: PASS
- escape: PASS
- pause: PASS
- fullscreen: PASS
- reducedMotion: PASS
- mobileNoOverflow: PASS
- fallback: PASS
- 页面/资源错误：0。

实际网页录制 21.42 秒，动画推进 21.67 秒，paused=false。CDP真实视口包含HTML字幕，时间戳保留，编码15fps不代表网页实时帧率。录屏独立于所有性能采样。

静态回退通过显式模拟WebGL不可用测试，仅证明回退路径；不作为硬件性能证据。尚未验证Safari、WindowsGPU、真实手机和长时间热稳定性。
