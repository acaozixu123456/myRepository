# 本机环境与边界

2026-09-06，沿用并重新验证同一台本机工具链：

- macOS 13.7.6，MacBookPro14,3；Intel i7-7700HQ 2.8 GHz，4 核 / 8 线程，16 GB RAM。
- Radeon Pro 555 2 GB + Intel HD Graphics 630；物理屏幕 2880 × 1800。
- Chrome 152.0.7977.82，实际有界面浏览器；WebGL renderer：`ANGLE (AMD, ANGLE Metal Renderer: AMD Radeon Pro 555, Unspecified Version)`。不是 SwiftShader。
- Node 24.19.0、pnpm 11.19.0；仅原型子目录安装依赖，未修改系统 Node 或主游戏依赖。
- Blender 4.5.9 Intel 官方安装已在本机可用。本轮只使用其附带编码能力，把真实浏览器捕获帧编码为 MP4，没有继续制作旧游戏模型。
- Python 3.11 独立虚拟环境；Depth Anything V2 Small 使用 PyTorch 2.2.2 / torchvision 0.17.2 / NumPy 1.26.4 / OpenCV 4.10.0.84。完整版本见 `evidence/depth-environment.txt`。
- CPU 推理经过实际执行。没有声称 CUDA、Apple Silicon 或 Blender GPU 渲染支持。

新 worktree：`/Users/xiaruonan/nihongo-art-work/living-scene`。

新分支：`nihongo-living-scene-local-20260906`，基于指定读取分支中的 `0f3a4c4289b314791e9b7aee15fd5fca28cd425f`。既有素材分支 `nihongo-art-assets-local-20260906` 保留。

本轮用户明确改为独立 Living Scene 原型，因此创建新的 `prototypes/living-scene/`、`art-source/living-scene/`、`docs/living-scene/` 范围；不沿用旧 Babylon 素材交接的游戏整合方向。根 README、共享配置、旧源码、NHK、服务端、服务工作线程和数据均未改动，也没有运行 NHK 回归、部署或合并生产分支。

本机预览位于 127.0.0.1；仅本机可访问，不是公共部署地址。内置预览面板的打开请求返回 queued，不能据此声称用户已经看过。独立 Chrome 中的实际渲染与截图已验证。
