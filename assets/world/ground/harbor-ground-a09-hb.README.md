# A09-HB · 赤壁港纵纹旧木三变体

按最新 [固定队列](../../../docs/CODEX_QUEUE.md) 与 [WORLD3D 场景主题](../../../docs/WORLD3D.md) 制作，晴朗晚霞老海港的木栈板，第1轮待审，通过数量0。分支 `codex/3d-world-harbor-ground`，制作基线 `fecef9e4d3cb95a0751aedbba588fd7415b2df8d`；提交基线已同步最新 `e777d58f3b0e9965f7af25ded73948a84e68d219`，港口/氛围文件与三源图hash不变。本批与夜市地面独立，不带入未合并的其他批素材。

| 素材 | 结构 / 木色 | 规格 / 字节 |
| --- | --- | --- |
| [ground_harbor_oldwood_01.webp](ground_harbor_oldwood_01.webp) | 6列宽长板，暖旧褐 | 1024² RGB sRGB ICC；226,494 B |
| [ground_harbor_washed_02.webp](ground_harbor_washed_02.webp) | 8列长板，浅漂洗灰米 | 1024² RGB sRGB ICC；217,848 B |
| [ground_harbor_narrowwood_03.webp](ground_harbor_narrowwood_03.webp) | 12列窄长板，浅褐 | 1024² RGB sRGB ICC；236,820 B |

三图的板长和纤维都沿图像纵轴，适合栈桥 / 码头铺地。材质色参考现有 `harbor.ts` 的栈桥 #b08258 / 堤岸木 #a87850，另提供浅漂洗变体。没有大重复钉子、节疤、横向支梁或中心码头物件，不烘入晚霞方向灯。

## 真实出处与导出

分别 **3 次独立 image_gen 生成**，无引用图、无后续编辑、无复制旋转变体。完整原文提示词、实参、output_hint、原图路径 / 标识 / SHA256 与逐图采用理由见 [出处](harbor-ground-a09-hb.provenance.json)。

三原图均为 **1254² RGB PNG**，实际 2,653,085～2,777,991 B，留在原 `/workspace/generated_images/` 路径。交付使用完整画布等比 Lanczos 降到 1024²，Pillow 12.3.0 / libwebp 1.6.0，RGB WebP quality90 / method6，嵌 sRGB ICC；总681,162 B，单图≤500,000 B。

没有裁切、上采样、调色、锐化、Alpha 抠底或程序修缝 / 补木纹。ICC 含原生创建时间戳；精确复现编码使用成品已经嵌入的原始 ICC payload，哈希在出处中。

## 审图与限制

[总览](../reviews/harbor-ground-a09-hb.webp)、各图 2×2 / 4×4 直接平铺、9张原尺度无损四边 / 四角 PNG 见 [方法](../reviews/harbor-ground-a09-hb.README.md)。边角图严格复制最终 WebP 解码 RGB 像素，没有空间缩放或有损再编码。

自查未见额外粗横断带、外围宽边框或不正常双缝。正常纵向板缝在缩略图先于细纹可见，板宽 / 局部纤维相位有轻微变化；4×4 仍可辨每板色差和低频纹理重复。边界 MAE 非零，木纤维没有数学逐像素贯穿，按实际 UV / 观看距离评估。最不满意：细木纹在较小显示足迹会被缩小过滤，表面趋平；单板细色差会随材料周期重复。当前Three样板每完整周期约307px，窄板约26px宽，实际游戏尺度由接入方按地面UV控制。

本批只基色，未接入游戏，不含法线、粗糙度、深度、位移或自发光。建议 map 用 `SRGBColorSpace`，白色材质 roughness 约0.9、metalness0，按栈桥长宽正确设 repeat 和朝向。

[真实 Three 白光 / 晚霞对照](../reviews/harbor-ground-a09-hb-lighting.webp) 读取最终三源图，左右只换白光与 `ATMOS.redcliff` 灯色；同相机 / 强度 / 曝光 / 白材质，无 bloom / 雾 / 全场景调色。晚霞会把所有木色强烈推向橘红，浅漂洗板仍较亮；不程序重调基色抵消游戏光。[参数](../reviews/harbor-ground-a09-hb-lighting.README.md)。

独立 QA 见 [摘要](harbor-ground-a09-hb.qa.md) / [机器报告](harbor-ground-a09-hb.qa.json)。本HB worktree在最新 `e777d58` 执行 `npm run typecheck && npm test` 全过（退出码0；68个测试文件、1,019个测试），日志 `/workspace/harbor-ground-raw/tests-latest.log`。制作fece基线初次默认沙箱的真实CLI子进程被标记spawnSync EPERM，同基线开启工具网络权限以允许子进程IPC后完整通过；没有修改源码，首次失败日志另留出处。第1轮待审，未由 Claude 通过。

