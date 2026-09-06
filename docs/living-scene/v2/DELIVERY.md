> 后续 V3 候选交付见 `../v3/DELIVERY.md`；本文件保留 V2 审核记录。

# Rainy Living Scene V2 — P0 审核候选

按 `docs/living-scene/SOL_REVIEW_20260906.md` 继续推进。独立分支 `nihongo-living-scene-v2-local-20260906`，基于 Sol 审核后的 `b94d9542224aa93f3d4726beadd9852f63c26b52`。没有开展第二张晴天场景。

**本轮并未完成全部 P0：高分辨率母图仍不达标。** 其余四项已实现并提交实际浏览器与性能证据，等待 Sol 复审。

## 先看

- 本机 V2 构建预览：`http://127.0.0.1:8770/`，开发预览：`http://127.0.0.1:8769/`。
- `evidence/hero-clean.png`：默认状态，文字淡出后的实际网页。
- `evidence/subtitle.png` / `controls-revealed.png`：日语交互与主动唤出 UI。
- `evidence/browser-tour.mp4`：实际网页录屏；`verification.json` 记录动画时间推进。
- `evidence/semantic-mattes.png`：六个精修对象区域。
- `PERFORMANCE.md`：同尺寸实现对照、V1/V2 交替复测、截图差异与原始数据路径。

## P0 对应交付

| Sol 要求 | 本轮状态与证据 |
| --- | --- |
| 真正 2560–3840 px 高分辨率母图 | **未达标。** 已向内置图像工具明确请求原生 3840 × 2160 / 至少 2560 px 宽，但实际输出仍为 1672 × 941。未放大或宣称 4K，保留已审 V1 原图。完整请求、原始失败候选与实际尺寸记录可查。 |
| 语义蒙版精修 | 已由深度区间工作层推进为：枫枝/叶片、橱窗、灯笼、湿路暖反光、远雾、店内暖空气六类。手工指定对象多边形，树叶以颜色与边缘细化。附全尺寸蒙版、前景 RGBA、修补边缘带及处理脚本。仍需美术复审细枝边缘。 |
| 局部生命感 | 枫叶采用约 1 px 以内的小幅风动，移动前景下有局部修补；窗/灯与湿路反光共享慢速亮度节律，反光细纹小幅扰动，店内轻微暖空气扰动、远雾缓慢漂移。全球视差 X/Y 仍为 0.006 / 0.003 UV。 |
| UI 更克制 | 进入后标题/标识/控件自动淡出。鼠标到屏幕边缘或键盘 Tab 可唤出；热点平时无圆环/标签，靠近店铺时通过光照响应及短标签提示。保留电影式字幕与暂停/全屏。 |
| 同画质性能 A/B | 测试 HalfFloat / RGBA8、18 个独立叶片 / InstancedMesh、8 级 / 4 级 Bloom、局部离线光晕五种组合。最终选择 RGBA8 + 实例化叶片 + 局部光晕；仍使用 postprocessing 输出处理与暗角。细节见性能记录。 |

## 可编辑源与运行时

- `art-source/living-scene/v2/semantic-regions.json`：归一化对象边界，可进一步人工修改。
- `matte-*.png`、`foliage-rgba.png`、`repair-collar.png`、`semantic-manifest.json`：全分辨率工作文件。
- `rejected-master-native.png` / `MASTER_ATTEMPT_PROMPT.txt`：未达到分辨率要求的原始生成输出与提示词；未用于原型主图。
- `prototypes/living-scene/tools/prepare_semantic.py`：可重复制作流程。
- `public/scene/semantic-a.png` / `semantic-b.png`：两张 RGB 蒙版图集。
- `public/scene/foliage-back.webp`：边缘带修补后的背景。
- `public/scene/local-glow.webp`：同一 LDR 原图的高光提取与模糊结果。
- `src/scene.frag.glsl`：可读的局部动态与重投影 shader。

## 限制与下一步

1. **高分辨率母图是当前明确缺口。** 当前内置工具这次没有兑现请求的原生尺寸；应取得可验证的高分辨率原画/重绘输出后重跑深度与语义蒙版，并由 Sol 比较纹理与构图。不要以文件尺寸或简单插值放大代替这项验收。
2. 语义蒙版为针对本图的人工区域 + 色彩细化，尚未达到逐根枝条人工描边精度。背景只修补前景内缘约 4 px 宽的区域（Telea 半径 3 px），只允许当前约 1 px 的局部风动。
3. 局部光晕适合固定 LDR 插画；若以后出现大型动态发光对象，应重新评估实时 Bloom，而不是直接沿用这份静态光晕。
4. 交互与粒子仍没有完整三维遮挡。暖空气是局部折射感，没有虚构明显的白色蒸汽来源。
5. 没有进行真实 4K 主图验收、跨 GPU/Safari/手机验证或长期热稳定性认证。
6. 第二张晴天场景仍冻结，等雨景 V2 的视觉与技术验收通过后再制作。

本轮仅涉及 Living Scene 原型、素材源、制作脚本与证据目录；没有修改旧游戏/NHK/根配置/后端，没有运行 NHK 回归，没有部署或合并生产分支。来源与许可证延续 V1，新增处理与生成尝试见 `art-source/living-scene/v2/PROVENANCE.md`。

## 最新优先级

用户随后明确：不要持续花时间追逐细小性能差距。现有优化与记录保留，后续优先原画、局部美术与视觉验收，不再扩大性能测试。
