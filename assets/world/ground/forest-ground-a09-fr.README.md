# A09-FR · 光之森草地与落叶三变体

按最新 [固定队列](../../../docs/CODEX_QUEUE.md) 与 [WORLD3D 场景主题](../../../docs/WORLD3D.md) 制作，清晨森林的鲜绿草地 / 暖落叶，第1轮待审，通过数量0。分支 `codex/3d-world-forest-ground`，制作基线 `29f6a8bbe66bbcf4ea1c0119675cac65f8c4e00a`；提交基线已正常快进到 `a7a41e9ebaf4083f5cf3c0904f3850a9c81f7a07`，森林材质 / common地面 / 氛围与queue文件hash不变，WORLD3D仅新增探索玩法。

| 素材 | 草地与落叶结构 | 规格 / 字节 |
| --- | --- | --- |
| [ground_forest_grass_sparse_01.webp](ground_forest_grass_sparse_01.webp) | 青绿细短草，稀疏细长暖褐叶 | 1024² RGB sRGB ICC；495,756 B |
| [ground_forest_moss_leaves_02.webp](ground_forest_moss_leaves_02.webp) | 苔绿短草 / 小圆叶丛，较多褐金落叶 | 1024² RGB sRGB ICC；402,274 B |
| [ground_forest_grass_light_03.webp](ground_forest_grass_light_03.webp) | 较浅鲜绿短草，细小暖叶碎片 | 1024² RGB sRGB ICC；367,326 B |

色板参考 `forest.ts` 草地 #58a24a / 苔绿 #5aa44a。草地为主底，落叶点缀，没有石路、裸土条带、中心物件或大叶海报。清晨照明由游戏控制，素材提供连续地面基色。

## 真实生成与筛选

**3次独立 image_gen 生成，5次真实 image_gen 编辑**，三种结构各来自独立原稿，没有复制 / 旋转 / 程序换色变体。稀叶采用候选2，苔绿与浅鲜草采用候选3。每次编辑直接引用该图此前真实原稿，引用路径 / SHA与完整提示词、工具实参、输出标识见 [出处](forest-ground-a09-fr.provenance.json)。

第1原稿草丝过密，q90完整降采样导出分别591,866 / 583,740 / 585,396 B，均超单文件500,000 B。真实AI编辑简化高频草丝，稀叶候选2通过；另两图候选2仍525,524 / 522,450 B并较密，再由AI编辑简化后采用候选3。原图8张与试导出保留工作空间，未以程序模糊或调色来降低复杂度。

8张原图均1254² RGB PNG，实际3,271,586～4,633,629 B，保留在原 `/workspace/generated_images/` 路径。最终三图用选中原稿完整画布等比Lanczos降到1024²，Pillow12.3.0 / libwebp1.6.0，WebP quality90 / method6、RGB sRGB ICC；总1,265,356 B，单文件≤500,000 B。

没有裁切、上采样、程序补草叶 / 修缝、融合、调色、锐化或Alpha处理。ICC含原生创建时间戳；字节一致复现使用最终嵌入的原始ICC payload，试导出保留各自ICC和原SHA。

## 审图与限制

[总览](../reviews/forest-ground-a09-fr.webp)、6张2×2 / 4×4直接平铺、9张原尺度无损四边 / 四角PNG见 [方法](../reviews/forest-ground-a09-fr.README.md)。原尺度PNG复制最终解码RGB像素，无缩放和有损再编码。

自查未见额外粗暗线、外框或大块跳色；草丝 / 小圆叶和落叶端点有细小相位差，个别边沿叶片不能逐像素续接。苔绿图的小圆叶丛比提示词所需单纯苔粒更可辨。4×4仍能识别叶位 / 草簇周期，MAE非零，不构成数学无缝证明。

最不满意：稀叶草丝仍偏密，另外两图AI简化后部分草斑趋平；小足迹下草纤维会被过滤，暖落叶先可辨。当前Three样板一周期约307px，实际UV / 地面观看距离由接入方控制。

[真实 Three 白光 / 清晨灯色样板](../reviews/forest-ground-a09-fr-lighting.webp) 使用最终三源图，白MeshStandardMaterial roughness0.95 / metalness0.02，与 `common.ts` 的森林groundPlane默认相符，repeat[3,1]；左右仅换白光与 `ATMOS.forest` 灯色，强度 / 位置 / 相机 / 曝光一致，无bloom / 雾 / 阴影 / 全场景调色。[实际参数](../reviews/forest-ground-a09-fr-lighting.README.md)。

本批仅基色，未接入引擎，不含法线、深度、粗糙度、位移或自发光。独立QA见 [摘要](forest-ground-a09-fr.qa.md) / [机器报告](forest-ground-a09-fr.qa.json)。本FR worktree在29f6实际执行 `npm run typecheck && npm test` 全过（整体退出0；68个文件、1,019个测试），完整test日志 `/workspace/forest-ground-raw/tests-latest.log`，typecheck正常输出由工具捕获。同步a7a主线后再实际执行同检查，整体退出0；68文件 / 1,021测试全过，完整test日志 `/workspace/forest-ground-raw/tests-a7a41e9.log`，两次记录均留出处；第1轮待审，未由Claude通过。
