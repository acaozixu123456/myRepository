# A09-PAL · 宫阙汉白玉地面

三款明亮汉白玉基色贴图，用于九重宫阙的午后金光广场。第 1 轮待 Claude 审核；当前仅交付素材与审图，尚未接入游戏。

| ID | 成品 | 字节 | 特征 |
| --- | --- | ---: | --- |
| `ground_palace_white_marble_03` | [WebP](ground_palace_white_marble_03.webp) | 124046 | 白玉底、细淡金矿脉 |
| `ground_palace_cloud_marble_04` | [WebP](ground_palace_cloud_marble_04.webp) | 107562 | 冷灰云纹与斜向矿物带 |
| `ground_palace_gold_thread_05` | [WebP](ground_palace_gold_thread_05.webp) | 106010 | 稍暖白玉、分枝细金丝 |

均为 1024×1024 RGB WebP、sRGB ICC、quality 90 / method 6，低于 500000 B。四边周期检查已完成；有限视觉检查未见多余外框、双厚缝或整幅明暗断带，不宣称严格逐像素无缝。

## 原图出处与导出

第一款保留此前真实 `image_gen` 宫阙原稿；另两款分别真实调用同一图片工具，引用第一款原生 PNG 生成变体。共有三份真实生成来源，其中两次为本轮新调用。完整实际提示词、实参、原图路径、参考图和原稿 / 成品 SHA256 均见 [出处记录](palace-ground-a09.provenance.json)。

三份原稿均为 1254×1254 RGB。完整画布等比 Lanczos 降采样到 1024²，无裁切或上采样。除技术性缩放、ICC 标记与编码外未作修图。原生 PNG 保存在出处所列工作空间路径，单张超过文件预算，因此不提交到 Git。

独立 QA 以同一冻结的 588 B sRGB ICC 重导出，三件编码字节全部相同。ICC SHA256 为 `36abda2da8f1fbed2f2feee67997812f7ebb1b62b26da313d30de11cdaf35c28`；可从任一成品读取该确切 ICC。重新创建 ICC 会改变其时间戳，不应用这种差异判断源像素变化。

[导出时选择记录](palace-ground-a09.selection-at-export.json) 保留原始时间点，里面的 pending 字段是当时状态；后续完成状态以 [独立 QA 摘要](palace-ground-a09.qa.md) 和 [机器记录](palace-ground-a09.qa.json) 为准。第一款 decoded RGB 与先前完整检查的原稿相同，因此复用相同像素的视觉证据；另两款原稿与编码成品均在本轮完整复核。

## 审图与检查

- [单张 / 2×2 / 4×4 / 原生边缘总览](../reviews/palace-ground-a09.webp)
- [实际 Three 白光 / 午后金光材质样板](../reviews/palace-ground-a09-lighting.webp)
- [预览参数、实际命令与 9 张 1:1 接合局部](../reviews/palace-ground-a09.README.md)
- [检查方法](palace-ground-a09.qa.method.json)、[原图 / 重导出实测](palace-ground-a09.qa.format.json)、[预览 / 出处核对](palace-ground-a09.qa.preview.json)、[接缝诊断](palace-ground-a09.qa.seams.json)

根线程在基线 `4b658b79921838d91f9bde8907df00ba80b9a2fe` 实际执行 `npm run typecheck && npm test`，退出码 0；68 个测试文件 / 1019 个测试通过。完整日志保存在 `/workspace/world-review/palace-ground/required-checks-4b.log`。本批生产变更仅含 `assets/world/**` 与 `docs/WORLD_PROGRESS.md`。

## 材质建议与保留限制

样板采用 palace 的 roughness 0.5 / metalness 0.05、环境强度 0.3，与午后金光。贴图只提供基色，不含法线、粗糙度、位移或自发光；游戏 UV 尺度由 Claude 接入时确定。样板 repeat 2×2 仅供评估，不代表游戏实际铺地密度。

最不满意：细金纹和三款差异在强光与小图下偏弱。04 的斜向灰矿物带仍明显，4×4 能辨识矿物纹簇的周期重复。这些为实际画面限制，未通过调色或加亮金属效果强化。
