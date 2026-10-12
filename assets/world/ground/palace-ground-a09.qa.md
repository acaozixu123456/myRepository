# A09-PAL 宫阙汉白玉三款：独立 QA 完成，可送 Claude 审核

本结论是内部送审准备，尚无 Claude 的通过/返修裁决。本 agent 只读源图、导出与出处，所有派生审图/统计只在本 scratch 目录；未生成艺术图、修边、绘制、调色或写生产文件/进度/PR。

| 素材 | 来源 | 最终 WebP 字节数 | 最终 SHA-256 |
| --- | --- | ---: | --- |
| ground_palace_white_marble_03 | 继承真实AI原稿，白玉淡金纹 | 124046 | 388fa1cbb36e80608690734dddb54825f91eeec2c9cf3696dc92488b7a03bd12 |
| ground_palace_cloud_marble_04 | 本轮真实参考变体，云灰纹 | 107562 | 7e6fef1f33037a9e3ed98a406d77900c11054dcbe5c736c42576fdb4aefa7511 |
| ground_palace_gold_thread_05 | 本轮真实参考变体，金丝纹 | 106010 | ba86b27e037a5f338e9e32165f1cc09da128a94fea42804e9a0d863d2b8585dc |

三款实测1024×1024/RGB，按RGBA读取Alpha恒255，同一588B sRGB ICC（SHA36abda2da8f1fbed2f2feee67997812f7ebb1b62b26da313d30de11cdaf35c28），均<500000B。原稿均实际1254²RGB；全画布等比Lanczos缩小至1024²、q90/method6，无裁切/上采样。用确切冻结ICC独立重导出，3/3逐字节相等。

03的原稿与最终解码RGB分别为c887452c1ddf3af0140a9d8033845922e61a5da9fb2fbfee7d8afbc89cdf755b与bae5b9078047156d85c61ac45a1171c77dfea39a3a50420608c5493bb42638ce，与归档中已完成的完整原稿/重复/原尺寸四边四角检查完全相同，所以复用既有视觉证据，不将其称为本轮新增生成。本轮仍确认其现文件哈希/规格/重导出，并在新的三宫阙材质样板中实际显示。04/05的原稿与码后全图、2×2/4×4、原尺寸LR/TB/四角均本轮完整实看。

实际三款都是完整4×4石板格。04/05原生与正式码后相接为正常窄灰缝，四角延续、没有多余半行、双厚缝或额外外框；未见跨tile共同亮度断带或明显整图烘焙方向光。不同石板的矿物/金线可自然在物理灰缝停止，不能单凭边缘像素差要求它们跨不同石板完全相连。边缘统计仅作定位，不设MAE=0新规则，不宣称严格数学逐像素无缝。

需要如实保留的局限：04云灰纹仍有较明显斜向灰矿物带，不能写成已经完全去掉斜纹或prompt全部实现；05稍暖且细金脉较显，仍是低对比矿物色线。三款在4×4重复能辨纹簇周期，细金纹在白光/午后金光及小视图偏弱，三款之间差异也变细微。这些是实看结果，不以prompt要求代替。

已实际查看新的`preview-final/palace-ground-a09.webp`（2048×1024/253880B）及`palace-ground-a09-lighting.webp`（90946B），对应上表三源，未借用旧夜市/港口拼图。白光与午后金光样板明亮、石板格可辨，金光使整体稍暖；未见新增框或集体亮度拼缝。全部采用r169白色MeshStandard，roughness.5/metalness.05，sRGB/Repeat2×2，RoomEnvironment PMREM(.04)/env.3、ACES曝光.9；两行的材质、相机、灯强和方向一致。无World导入、阴影、bloom、法线/位移/粗糙度图或后期调色，属于独立材质样板，不是游戏集成验收。

九张新抓的256² LR/TB/四角PNG已由本QA按元数据整数窗口忠实重组，9/9逐RGB全等，哈希/字节/预算吻合；两张WebP审图同样核对。原始全页无损PNG留scratch且超预算，不作为可提交审图。浏览器3/3加载、page/request/console为空属于preview agent实际捕获记录，本QA没有重复跑浏览器/测试。采样参数e6与提交基线4b658b79921838d91f9bde8907df00ba80b9a2fe的19份依赖已由本QA实际读Git字节，全部相同。

出处核对区分1份继承的真实原稿与2份本轮新参考变体。保存的全prompt/实参、原图/归档字节、参考anchor、实际尺寸/哈希、selection及provenance复制字段一致；原稿保留外部路径，不放入Git大文件。远端imagegen调用本身是root工具证据，本QA独立验证保存记录与实际文件。艺术变化没有从Python派生审图写回素材。

证据：`format-reexport-and-source-check.json`、`initial-new-variants-seam-metrics.json`、`preview-provenance-check.json`、`var1-reuse-and-qa-plan.json`、`qa-method-notes.json`、`qa-summary.json`。旧三主题包仍为未提交归档，本结论只针对宫阙03/04/05。
