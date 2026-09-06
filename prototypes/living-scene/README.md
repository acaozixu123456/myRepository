# V3 review candidate

Current preview ports: 8771 (development), 8772 (build). See `../../docs/living-scene/v3/DELIVERY.md` for the multi-tile source and five encounters. Prior V2 notes below are retained as history.

# 雨あがりの路地 · Living Scene V2

当前 V2 交付：`../../docs/living-scene/v2/DELIVERY.md`。高分辨率母图 P0 仍未通过；语义区域、局部动态、隐退 UI 与性能优化已交付审核。

独立、仅在本机验收的动态场景原型。入口是本目录的 `index.html`，不接入旧游戏、NHK、API、数据库或存储。

```sh
cd prototypes/living-scene
pnpm install --frozen-lockfile
pnpm dev
# http://127.0.0.1:8769/
pnpm build
pnpm preview --port 8770
```

验证环境使用 Node 24.19.0、pnpm 11.19.0；依赖版本已锁定。`pnpm-workspace.yaml` 仅允许 esbuild 的正常安装脚本。也可使用常规 Node + pnpm 环境。根目录依赖与配置没有修改。

- 移动鼠标：有上限、带缓动的深度视差。
- 悬停/点击店铺标记：暖光高亮、约 4.3% 镜头推近、日语字幕。
- “回到街景”或 Escape：回到原构图。
- 右下角：暂停动态、浏览器全屏。
- 系统“减少动态”：默认停止风与粒子，取消鼠标视差及渐进推近。
- WebGL 不可用时：保留主视觉与文字的静态页。

## 素材处理

`tools/prepare_scene.py` 使用 **官方 Depth Anything V2 Small** 离线推理，保留原始浮点深度，并输出修正深度、三层 RGBA、三张深度分区蒙版、局部动画蒙版。运行需要 Python 3.11 与 `docs/living-scene/evidence/depth-environment.txt` 中的版本。

```sh
python tools/prepare_scene.py --model-repo /path/to/Depth-Anything-V2 --weights /path/to/depth_anything_v2_vits.pth
python tools/subset_font.py /path/to/NotoSansJP.ttf
```

上游代码与 95 MB 权重保留在仓库外；具体版本、下载地址与 SHA-256 见调研记录。CPU 路径对上游自动选择 MPS 的行为进行了进程内覆盖，未修改上游模型代码。首次推理无需 xFormers。

## 浏览器证据

`tools/browser-evidence.mjs` 运行真实有界面的 Chrome。默认路径对应本机，其他机器可通过 `PLAYWRIGHT_MODULE`、`CHROME_PATH`、`CAPTURE_DIR`、`SCENE_URL` 覆盖。它只访问本原型，不运行 NHK 回归。

```sh
node tools/browser-evidence.mjs
blender -b --python tools/encode_capture.py -- /path/to/capture /path/to/browser-tour.mp4
```

录屏源是 Chrome 实际视口的 CDP 帧，含 HTML 字幕与控件；按照时间戳重采样编码为 15 fps。渲染性能在录制之前另行采样。

详细交付、许可、技术边界与待改进项见 `../../docs/living-scene/DELIVERY.md`。

## V2 验证与素材

- `python tools/prepare_semantic.py`：从已审母图和 `semantic-regions.json` 制作六类语义区域与有限边缘修补。
- `node tools/ab-performance.mjs`：固定1920×1080、五种渲染实现的GPU/CPU/帧时间对照。
- `node tools/verify-v2.mjs`：V1/V2交替复测、V2功能、窄屏与真实录屏。需要V1已审构建在8768、本V2构建在8770。
- `blender -b --python tools/encode_capture.py -- /path/to/capture /path/to/v2/evidence/browser-tour.mp4`。
- `EVIDENCE_DIR=/path/to/v2/evidence node tools/check-video.mjs`：验证编码后视频可解码播放。

开发A/B参数只在 `?qa=1` 时启用：`pipeline=half|byte|small|local`、`leaves=mesh|instanced`、`still=1`。正常页面使用 local + instanced；性能数据通过内存快照读取，不写用户存储。
