# 本机环境与隔离记录

检查日期：2026-09-06（Asia/Tokyo）。不包含主机序列号、硬件 UUID、凭据或用户浏览记录。

- macOS 13.7.6，build 22H625；MacBookPro14,3，Intel Core i7 2.8 GHz，4 核 / 8 线程，16 GB RAM。
- GPU：AMD Radeon Pro 555，2 GB；另有 Intel HD Graphics 630，动态共享显存上限 1536 MB。系统报告 Metal 3。实际主面板为 2880 × 1800。
- 初始 PATH、系统与用户 Applications、Spotlight 搜索均未发现 Blender。随后从 Blender 官方下载并校验 4.5.9 LTS Intel 版，放入 `/Users/xiaruonan/nihongo-art-work/toolchain/Blender.app`；未替换系统应用、未绕过安全策略。
- Blender 4.5.9 LTS，build `8bf95cbd38d1`。Cycles 设备枚举只有 i7 CPU，未发现可用 GPU Cycles 设备。CPU Cycles 的实际渲染结果和日志单独保存，不能用于声称游戏帧率。
- Chrome 完整安装版本 152.0.7977.82。实际预览通过 headed Chrome + ANGLE Metal，报告 AMD Radeon Pro 555；不是 SwiftShader。Safari 已安装，本批未做 Safari 验收。
- 系统 Git 2.39.2；系统 Python 3.11 可用。Node、gh、agent-browser 未在 PATH 中发现。使用 Codex 自带 Node 24.19.0、Python（Pillow 12.3.0 / numpy 2.3.5）、Playwright。没有修改游戏 package.json、锁文件或构建配置。
- 可用磁盘初检约 35 GiB。浏览器测量的视口与渲染分辨率、DPR 和帧时分布见 `evidence/performance-no-recording.json`；录制时的记录另见 `browser-hardware.json`。DPR 2 是受控浏览器上下文设置，与 Retina 名义比例相同；OS 面板尺寸单独记录。

## Git 隔离

远程仓库 `acaozixu123456/myRepository`，读取分支 `nihongo-desktop-art-20260906`；基线 `0f3a4c4289b314791e9b7aee15fd5fca28cd425f`。已读取 README、LOCAL_CODEX_ASSET_BRIEF、world.ts、geo.ts。

独立 clone 管理目录：`/Users/xiaruonan/nihongo-art-work/repository`。
独立 worktree：`/Users/xiaruonan/nihongo-art-work/desktop-v1`。
工作分支：`nihongo-art-assets-local-20260906`。

仅新增四个允许目录中的文件。没有接触 Sol 的工作区、生产分支、NHK、UI、游戏主代码、全局光影或数据。没有运行 NHK 回归、全仓测试、部署或合并。

## 遇到的环境错误

- web 文本抓取器访问 Blender 索引返回错误，改用正常 HTTPS 下载官方索引和安装包成功，校验一致。
- 系统 Python urllib 的证书链未配置完整；下载辅助文件改用正常证书验证的 curl，没有关闭 TLS 验证。
- Playwright 的 ffmpeg 下载器报告不支持 macOS 13；最终视频改由 Chrome 原生 Canvas captureStream + MediaRecorder VP9 录制，未安装未知二进制。
- Blender 启动会提示 locale 回退到 C，不影响模型导出；日文实际由 Noto Sans JP 绘制并通过浏览器检查。
