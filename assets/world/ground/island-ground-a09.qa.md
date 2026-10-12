# A09-IS 云岛草地三款：独立 QA

三款均可送 Claude 第 1 轮审核。内部 QA 不是 Claude 通过；素材尚未接入。对应 PR #114，最终主干基线 `67d7bef7b1ad8155b92420daf5f6083289bd97a8`，claim/merge HEAD `051c7d06ec72de337dabd3066bf64270bb4f40cb`。

| ID | 成品字节 | 实际观察 | 结论 |
| --- | ---: | --- | --- |
| `ground_island_mint_bloom_01` | 300178 | 浅绿草尖与乳白/淡粉五瓣小花，较轻盈 | 可送审 |
| `ground_island_pink_clover_02` | 479916 | 圆叶三叶草、粉白花球，局部叶片明暗与纹理更密 | 可送审，保留密度备注 |
| `ground_island_meadow_mix_03` | 297664 | 浅绿草甸，白/淡黄/淡蓝小花和少量淡紫花芽 | 可送审 |

3/3 为 1024² RGB、不透明、sRGB ICC 588 B、WebP q90/method6，均低于保守单文件 500000 B。三次真实生成的实际 native 均为1254² RGB；提示词请求2048²，但未把请求尺寸写成实际产物。完整画布 Lanczos 等比降采样，无裁切、补边、上采样、调色或接缝绘制。原始与归档字节/哈希一致，planned/completed/provenance 的全 prompt 与工具参数逐字相符；独立复用冻结 ICC 重导出3/3文件字节完全一致。

已实际查看 native及coded整图、2×2/4×4、完整LR/TB 1:1条带与四角，共36图。未见贯穿整块的硬直接缝、边框/共享亮暗带或中心光斑；局部草叶/花碎形仍有接合不完全连续，不能承诺严格逐像素周期无缝。草叶笔触有共同方向，三叶草叶片也有局部深浅；未观察到整幅统一投影、全局明暗坡度或宽烘焙光带。数值边差只作诊断，未按均值宣称无缝。

最不满意：第二款细叶/花球偏密，缩小或斜俯看时较碎；4×4仍可辨认重复草簇与花点。实际Three远尺度的花瓣成为小色点，乳白、粉、蓝、黄仍是草地上的细点缀。

真实审图总览、最终白光/正午光材质样板及9张原生PNG已实看。两板分别2048×1024、494536 B(q86) /216444 B(q92)，加9 PNG共11图，全部POT且<500000 B；9 PNG共589824 RGB像素与最终WebP对应裁拼逐像素全等。最终lighting实拍时间 `2026-10-12T05:58:49.813Z`，实际loaded anisotropy `[4,4,4]` 与cloud.mk一致；首次8版本只留历史。两版图片字节偶然相同，视觉复核以同hash的最终图和新版真实metadata为依据。

真实capture记录为3/3加载、WebGL成功、page/request/console错误为空，实际source3 SHA、模块/工具与主干参数依赖均独立核对。white/mist使用同白色MeshStandard、roughness.95/metalness0、ACES曝光.92/Room环境.3，只换灯色。样板Plane8/repeat2，每周期4单位；游戏Circle半径29.2/repeat5，约11.68单位/周期。没有雾、阴影、bloom、调色、法线/位移/粗糙度图，也没有游戏对象，因而不是接入后的游戏全景。完整preview37文件冻结SHA全部吻合，README已披露以上范围。

3408→67相关材质/UV/光照源码字节未变，已有图片视觉证据继续有效；explore更新宠物发现宝箱，不影响独立材质样板。本agent只写independent-qa，未生成AI图片、修改素材像素/生产文件、重开浏览器、跑全tests或改旧body/theme/palace记录。根线程的提交验证由根线程记录。

完整机器证据与每图哈希见 `island-ground-a09.qa.json`；方法和查看路径见 `island-ground-a09.qa-method.json`。原生大审图和未入库原稿留scratch，避免超预算文件进入交付。

交付范围为**14张正式图：3张1024²素材＋2张总览/灯光WebP＋9张256²原生PNG**，另有3张1254²原稿仅作工作空间出处证据。14图POT/文件预算逐张已核，588 B sRGB ICC明确属于3张素材；审图的实际ICC有无逐张记录，未把浏览器sRGB输出说成全部嵌入ICC。`readyForClaudeReview=true`、`ClaudeApproved=false`、已通过数量0。最新7ea6主干的文档/材质依赖不变由根线程fresh读取确认，NotoUI更新不进入独立材质样板；正式捕获和独立已核基线仍明确记录67，不混写成新图。
