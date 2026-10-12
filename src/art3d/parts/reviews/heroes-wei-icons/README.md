# SSR 魏族三件专属武器 · 第1轮待审

本批只新增夏侯长矛、许虎骨棒、张辽真实双持银刀三函数及三位英雄 weapon 覆盖。第1轮待 Claude 审核，通过0；内部 C5 为制作候选编号。

| 英雄 | 逻辑网格 | 含描边 Mesh | 最大球/圆柱分段 |
| --- | ---: | ---: | ---: |
| wei_xiahoudun | 14 | 26 | 12 |
| wei_xuhuchi | 16 | 32 | 16 |
| wei_zhangliao | 20（10+10） | 36 | 12 |

采用原 PartCtx/toon/solid 插槽与缓存。三 SP / 六 UR 九项覆盖全部保留，夏侯新眼罩保留；通用部件、引擎、五官和武器类型不变。参考三张真实 JPG 及文字设定，详见 [参考记录](reference-audit.md)；该参考审计是07:12的913历史基线，不伪装最新f4。张辽仍戴文字设定的将军盔红缨，不称羽冠。

本次测试、独立 QA 及实际照片均在最终两源上进行：heroes.ts SHA256 d685ca31ef7a35a51c82965cce0640d8d3409b80b48b34dffb215ef831dfb428；hero-wei-weapons.ts SHA256 105b8faa0b6012bc7c372cf4341d62e82af4b5f41231f7b6fe92d5d49ae76cb0。明确主线 f4b3c0c9907dc5b0f5a7315a1c8578de7567a057 已 apply；实际拍摄/测试 HEAD 尚为 a9261dc，源冻结后本次只增交付证据。[源冻结](source-freeze.json)。

根实际 npm run typecheck && npm test 退出0；83文件 /1118测试，11:47:53 UTC开始、Vitest11:48:02、66.99秒。[日志](required-checks-final-candidate05-f4.log)。

## 真实图与方法

[三姿势](after-poses.png)、[190画布](after-190px.png)、[背面](after-rear.png)、[新f4前后对照](before-after-190px.png)、[正常十猫战斗](battle.webp)。均小于500000B。四次官方 shots3d 真实退出0；190是217×190原画布，角色高度更低。对照18格共742140 RGB像素与原画布全等；battle是原quiet00的无损编码，562164 RGB像素全等。私有 baseline 从242个明确f4 Git blobs新导出，前后未变；63输入源冻结。完整 [捕获说明](capture/README.md)、[捕获记录](capture/capture-report.json)、[逐图来源](capture/official-capture-images.json)、[战斗记录](capture/battle-capture-report.json)。捕获说明原目录中的图片对应本目录同名文件，原始私有大图/脚本只作工作空间历史。

实际最后 live 窗口11:49:31.688 UTC。战斗10/10正常演员和rig命中，未手摆角色或改镜头；长枪/骨棒有自然队友遮挡。pageErrors为空，但Googlefonts隧道失败和favicon404保留，不声称全部浏览器零错误。

## 有限 QA 与保留问题

[独立摘要](qa/qa-summary.md)、[机器摘要](qa/qa-summary.json)、[方法](qa/qa-method.json)、[有限数值](qa/finite-metrics.json)、[配对模型](qa/paired-model-smoke.json)、[下握段源检查](qa/named-lower-source-check.json)。89模型有限、86非目标原始指纹完全相等。13配对姿势/26案例，20116有效投影点武器遮挡0。夏侯C4新增下杆/握段/尾饰见证已消除；许虎上部木头/两箍/七骨齿与接颈主壳/描边无头壳接触。保留张辽既有后颅根部接触以及8个严格边界见证（1e-17～5e-16，诊断阈值1e-7），没有删原始数值。

张辽红缨旧上沿裁切 idle .08513648 / windup .09527238 与 stock 一致，未改框掩盖。有限检查不证明全动画无穿模、所有配饰不挡脸或布尔体积相同。最不满意是张辽蓝柄/银护口190下细节弱。

原 frozen QA 摘要中一句“126背卷/旗帜”是历史PR名称笔误：背卷/旗帜为 #123，#126为配饰；保留原报告字节，在此更正。冻结清单列完整私有证据，公开交付只包含上述精选文件，未声称大geometry bundles全已入仓库。

交付文本删除多余文件末尾空行，参考审计 Markdown 另修复三张仓库 JPG 的公开链接并明确私有历史模板路径；冻结私有原稿、全部图像、出处和独立QA字节保留；原/目标哈希差异另见 [复制验证](submission-copy-validation.json)。
