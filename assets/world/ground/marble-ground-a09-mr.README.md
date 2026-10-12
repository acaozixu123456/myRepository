# A09-MR · 宫阙汉白玉三变体

按最新 [固定队列](../../../docs/CODEX_QUEUE.md) 与 [WORLD3D 场景主题](../../../docs/WORLD3D.md) 制作，午后金光宫阙的明亮浅白石材，第1轮待审，通过数量0。分支 `codex/3d-world-marble-ground`，制作基线 `e777d58f3b0e9965f7af25ded73948a84e68d219`；提交基线已正常快进到 `29f6a8bbe66bbcf4ea1c0119675cac65f8c4e00a`，宫阙材质与氛围参考文件hash不变。

| 素材 | 矿物结构 | 规格 / 字节 |
| --- | --- | --- |
| [ground_palace_marble_milk_01.webp](ground_palace_marble_milk_01.webp) | 淡奶白均匀细晶，微小暖灰米矿点 | 1024² RGB sRGB ICC；142,528 B |
| [ground_palace_marble_gold_02.webp](ground_palace_marble_gold_02.webp) | 柔浅香槟金细枝矿纹 | 1024² RGB sRGB ICC；65,828 B |
| [ground_palace_marble_cloud_03.webp](ground_palace_marble_cloud_03.webp) | 浅暖象牙柔云脉 | 1024² RGB sRGB ICC；76,952 B |

材质色参考 `palace.ts` 的汉白玉 #f2ede2、淡金 #c8a050。纹理是连续石材基色，无板缝网格、徽章或中心装饰；宫阙铺装几何和 UV 尺度由接入方控制。

## 真实出处与导出

**3次独立 image_gen 生成**，无引用图、无后续编辑、无复制旋转变体。每种结构采用各自第1原稿，无额外弃选稿。完整原文提示词、确切工具实参、output_hint、原图路径 / 标识 / SHA256 与采用理由见 [出处](marble-ground-a09-mr.provenance.json)。

三原图均为 **1254² RGB PNG**，实际1,984,169～2,290,360 B，保留在原 `/workspace/generated_images/` 路径。使用完整画布等比 Lanczos 降到1024²，Pillow12.3.0 / libwebp1.6.0，RGB WebP quality90 / method6，嵌sRGB ICC；三图合计285,308 B，单图≤500,000 B。

没有裁切、上采样、调色、锐化、Alpha 抠底、程序修缝或补矿纹。ICC含原生创建时间戳；精确复现编码使用成品已嵌入的原始ICC payload，其哈希见出处。

## 审图与限制

[总览](../reviews/marble-ground-a09-mr.webp)、各图2×2 / 4×4直接平铺、9张原尺度无损四边 / 四角PNG见 [方法](../reviews/marble-ground-a09-mr.README.md)。边角图复制最终WebP解码RGB像素，没有空间缩放或有损再编码。

自查未见明显粗暗带、外框、黑金大裂或全局亮度跳变。边界MAE非零，浅金矿纹端点与云脉形状有细小相位差；金纹比提示词所需短小枝更连贯，云脉4×4可辨低频色块周期。未以低MAE声称数学无缝。

最不满意：浅矿纹在小足迹下会趋于均匀浅白，云脉重复比另外两图明显。当前Three样板一个周期约307px，实际地面观看距离 / UV尺度由接入方评估。本批只交基色，不含法线、深度、粗糙度、位移或自发光。

[真实 Three 白光 / 宫阙暖金光对照](../reviews/marble-ground-a09-mr-lighting.webp) 读取最终三源图，左右只换白光与 `ATMOS.palace` 灯色，材质为白MeshStandardMaterial roughness0.55 / metalness0，repeat[3,1]，同相机 / 光强 / 位置 / 曝光，无bloom / 雾 / 阴影或全场景调色。暖光使浅白石偏金米色，保持基色原样。[实际参数](../reviews/marble-ground-a09-mr-lighting.README.md)。

独立QA见 [摘要](marble-ground-a09-mr.qa.md) / [机器报告](marble-ground-a09-mr.qa.json)。本MR worktree在e777实际typecheck退出0；npm test退出1（67/68文件、1018/1019测试通过），唯一每日委托测试固定日期与当前日期不一致。最后失败输出节选保留在 `/workspace/marble-ground-raw/tests-e777-captured-tail.txt`，不是完整日志；正常快进到29f6主线修复后，本MR worktree实际执行 `npm run typecheck && npm test` 全过（退出0；68个文件、1,019个测试），完整测试日志 `/workspace/marble-ground-raw/tests-latest.log`，typecheck输出由工具捕获。第1轮待审，未由Claude通过。
