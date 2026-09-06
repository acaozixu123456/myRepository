# 实际浏览器性能与验收

Chrome 152.0.7977.82，macOS / Radeon Pro 555 2 GB。实际 Metal renderer，未使用 SwiftShader。以下为构建产物在本机 127.0.0.1:8768 的实测。

| CSS 视口 | 请求 DPR → 实际 DPR | 渲染像素 | 采样时长 / 帧数 | 平均 FPS | P50 / P95 / P99 ms | >33.34 ms 帧数 |
| --- | --- | --- | --- | --- | --- | --- |
| 1920 × 1080 | 1 → 1.000 | 1920 × 1080 | 32.92 s / 1585 | 48.15 | 16.70 / 49.70 / 50.60 | 181 |
| 1440 × 900 | 2 → 1.265 | 1821 × 1138 | 32.17 s / 1645 | 51.14 | 16.70 / 33.80 / 50.50 | 132 |

每个样本先预热，再约 30 秒持续鼠标路径、一次镜头推近和返回。表中帧时间由 requestAnimationFrame 实测；包括交互和主线程等待，不等于 GPU 专用计时。没有剔除区间内慢帧。采样期间未录屏。完整每帧原始数据、分辨率、draw call 与粒子计数在 `evidence/browser-report.json`。

这台较老的 Intel Mac 通常以约 16.7 ms 显示帧，但存在明显慢帧；不能称为稳定 60 FPS。自动像素预算约 207 万，限制高 DPI 下的工作量，仍未消除 CPU / 浏览器调度造成的抖动。尚未做长时间热稳定性、Safari 或其他 GPU 验证。

## 功能检查

- noScrollOnFocus: PASS
- focus: PASS
- escape: PASS
- pause: PASS
- fullscreen: PASS
- reducedMotion: PASS
- mobileNoOverflow: PASS
- staticFallback: PASS
- 实际页面脚本/控制台错误：0；HTTP 错误：0。

静态回退检查使用明确标记的 WebGL 不可用注入，仅用于验证错误路径；它不用于 GPU 或 FPS 结论。首次检查发现点击导致隐藏溢出容器偏移，已改为 overflow: clip 并在最终运行中验证零滚动。减少动态偏好在前台实际浏览器中重新验证通过；后台标签页的媒体变化事件不应当作为前台交互结论。

## 录屏

Chrome CDP 捕获整个网页实际视口，包括标题、控件、日语字幕；按时间戳取最近实际帧，使用 Blender 自带 FFmpeg 编码 H.264 MP4，输出 1600 × 900 / 15 fps。没有重建界面或生成中间帧。捕获开销明显，录屏不参与上面的性能计算。

最终捕获 300 帧，时间跨度 23.51 秒；动画时间实际推进 23.45 秒，暂停状态为 false。时间戳记录 `evidence/capture-timestamps.json`，编码日志 `evidence/video-encode.txt`。
