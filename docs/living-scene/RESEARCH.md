# Living Scene 开源方案核查 — 2026-09-06

结论：采用 Three.js + pmndrs/postprocessing + three.quarks 做浏览器渲染，Depth Anything V2 Small 仅用于离线素材处理。固定视点的绘画场景只需有限视差；本轮不需要重建可行走的三维街道。

| 方案 | 用途 | 许可证 | 适配度与本轮验证 |
| --- | --- | --- | --- |
| [Three.js](https://github.com/mrdoob/three.js) | WebGL 画面、深度重投影、轻推镜头、粒子几何 | MIT，保留声明 | 高。实际使用 0.183.2，真实 Chrome / AMD Metal 渲染、构建验证。没有引入自由移动控制器。 |
| [Depth Anything V2](https://github.com/DepthAnything/Depth-Anything-V2) | 从原创主图离线估算相对深度 | 官方代码 Apache-2.0；**Small 权重 Apache-2.0**；Base/Large/Giant 权重 **CC-BY-NC-4.0** | 高，但必须修正细枝与叶片。已用官方 Small / vits 权重在本机 CPU 真实推理。模型与 PyTorch 不进入网页包。白近黑远，非米制深度。 |
| [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) | EffectComposer、低强度 Bloom、暗角 | **Zlib**，保留来源与许可，修改版本需标明 | 高。实际使用 6.38.3。它要求 Three >=0.157.0、<0.184.0，与本轮 0.183.2 匹配。浏览器实际运行。避免过量景深模糊损失绘画细节。 |
| [three.quarks](https://github.com/Alchemist0823/three.quarks) | 批量尘埃粒子、生命周期与发射器 | MIT | 高。实际使用 0.17.1 / quarks.core 0.17.1；要求 Three >=0.182.0。真实运行约 50 个微尘粒子。保留库自带的控制台来源声明。落叶用原创小型叶片网格，与尘埃共同工作。 |
| [GaussianSplats3D](https://github.com/mkkellogg/GaussianSplats3D) | 已有 Gaussian splat 资产的 Three.js 渲染 | MIT（Mark Kellogg） | 备选，中低。核对官方功能与许可，**没有安装或运行 splat 场景**。单张插画本身不是 splat 资产，仍需另外训练/重建与素材许可；会增加显存、排序及资产体积成本。 |
| [Spark](https://github.com/sparkjsdev/spark) | 面向 Three.js 的 Gaussian splat 渲染 | MIT（World Labs） | 备选，中。核对官方仓库与许可，**没有在本机进行 splat 性能验证**。后续已有高质量、许可清晰的 splat 街景时再测；不为微视差强行引入。 |
| [DepthFlow](https://github.com/BrokenSource/DepthFlow) | 图片 + 深度生成视差视频的参考流程 | **AGPL-3.0** | 概念参考，非产品依赖。仅查阅官方介绍与许可，未安装、未执行、未复制其 shader/实现。产品的短程 UV 重投影独立编写。 |

## 可复现性与范围

- 固定版本与依赖图见 `prototypes/living-scene/package.json`、`pnpm-lock.yaml`。不是追逐“最新版本”；优先满足所有 peer 范围。
- Depth Anything 官方代码 commit：`a561b849ebae10a6f5ef49e26c83cbbcd36c71bf`。
- [官方 Small 权重](https://huggingface.co/depth-anything/Depth-Anything-V2-Small) `depth_anything_v2_vits.pth`，SHA-256 `715fade13be8f229f8a70cc02066f656f2423a59effd0579197bbf57860e1378`。
- 实际推理尺寸 518，原图 1672 × 941；CPU 4 threads，最终一次 6.04 秒（当时另有构建任务），不是 GPU 推理性能或稳定基准。
- 模型原始结果保留；前景枫叶的颜色/位置约束用于深度修正。相对深度不能识别真实距离，也不能恢复遮挡物背后的内容。
- 已集成库的本地许可全文见本目录 `licenses/`。备用方案尚未集成，未来采用时需随实际版本打包许可。
- 来源核查基于上方官方仓库、官方模型页与实际安装包；适配度是本原型需求与本机资源下的工程判断。
