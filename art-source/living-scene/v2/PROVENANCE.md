# V2 来源与处理记录

沿用 V1 经 Sol 视觉审核的原图。没有购买素材或接入外部付费生成服务。

## 高分辨率母图尝试：未通过

用户已批准内置图像生成。本轮一次 imagegen 编辑请求保留构图、重新绘制细节，并明确要求原生 3840 × 2160 / 最低 2560 px 宽。实际工具输出仍为 1672 × 941。原始输出 `rejected-master-native.png`、完整请求 `MASTER_ATTEMPT_PROMPT.txt`、尺寸/哈希记录 `docs/living-scene/v2/evidence/master-attempt.json` 均保留。

该输出没有放大，也未替换已审主图。它未满足 Sol 的高分辨率母图 P0，本轮不能声称完成 4K 美术交付。

## 语义蒙版与局部修补

`semantic-regions.json` 为针对当前图像人工指定的对象多边形；树叶/枝干进一步通过颜色、暗部和边缘过滤得到透明度。窗户、灯笼、道路暖反光、远处雾口、店内暖空气都各有独立蒙版。

这些对象区域没有用远中近深度阈值代替。`prepare_semantic.py` 可复现全部处理。原图像素未进行生成性修改；局部背景填补使用 OpenCV Telea，仅把结果应用于可能被约 1 px 风动露出的前景内边缘带，不构建整个隐藏背景。

- `matte-*.png`：全分辨率语义蒙版。
- `foliage-rgba.png`：可编辑前景工作层。
- `repair-collar.png`：背景修补的边缘带。
- 运行时 `semantic-a.png` / `semantic-b.png`：RGB 打包蒙版。
- 运行时 `foliage-back.webp`：仅在边缘带合入修补结果的背景。
- 运行时 `local-glow.webp`：从同一 LDR 原图离线提取高光并模糊，供后处理对照；不是新的背景美术。

沿用 V1 图像、字体、Depth Anything Small 和渲染库的来源与许可记录。没有新增第三方视觉素材。背景修补、色彩遮罩与离线光晕都是技术处理，其局限见 V2 交付清单。
