# A11 三色屋瓦 · 第1轮待审

最终三张512²不透明RGB/sRGB WebP：青瓦46868B、金琉璃50380B、朱红瓦40756B；统一q90/method6、588B sRGB ICC。第1轮待Claude审核，通过0，未接入游戏。

真实image_gen.imagegen六次（3初稿+3参考编辑），原始均1254²RGB；07:30:22～07:32:11与07:55:26～07:57:09 UTC。原路径、完整参数/提示词、参考图、时间、原稿/归档SHA及被弃历史全部保留于[出处](roof-tiles-a11.provenance.json)。原稿大于500KB，完整文件保留真实工作空间归档，未谎称提交原始1254²文件。最终原稿选择1/2/2；technical export05不算第七次调用。

青瓦C1原生框[307,205,1069,940]为762×735（4垄/5行），两轴Lanczos降到512²，scaleX=.6719160104986877，scaleY=.6965986394557823，纵横形状比例变化+3.673469%。这是非等比缩放；无上采样。金瓦C2未恢复相位原稿框[80,136,1147,1203]1067²、朱瓦C2框[160,199,1068,1107]908²，等比降512²。最终没有roll、绘制、补缝、融合或艺术调色。编辑调用前的半幅移位参考及历史恢复文件另留真实记录，没有误称最终采用源。[冻结选框](roof-tiles-a11.selection-at-export.json)。

首次生成前，实际07:01:10检索ambientCG/PolyHaven/Kenney/OpenGameArt六个CC0目录/许可，07:21:55决定fallback。Kenney整楼等距图块用途不同；其他五个真实存在，但有限访问未收到可验证原始像素三色瓦垄组，网页图片标記不是像素。不声称公开素材全部不存在/不适合。本批未采用第三方像素；[检索摘要](roof-tiles-a11.source-search.md)、[检索记录](roof-tiles-a11.source-search.json)、[决策](roof-tiles-a11.fallback-decision.json)。

[独立QA](roof-tiles-a11.qa.md)、[机器记录](roof-tiles-a11.qa.json)、[技术复验](roof-tiles-a11.final-technical.json)。青瓦原生源框RGB与原稿全等、重导出逐字节相同；金/朱最终与历史C3成品字节相同，复用已明确实际观察。两张最终2048×1024浏览器审图见[总览/灯光与方法](../reviews/roof-tiles-a11-candidate05.README.md)；九张原512边/角整数PNG保留983040 RGB像素全等。有限视觉未见旧尖V缺谷/双沿短行/贯穿硬断，但不能保证严格数学周期、所有屋顶UV或所有光照。青瓦比例变化、浅瓦帽/深谷/暗搭接沿、金瓦暖浅竖纹及完整贴片磨损重复均保留供Claude选择。

捕获08:42时为明确e0af源上下文，3/3加载，无页面/请求/HTTP/console错误；独立Plane样板不是游戏接入，原宫檐圆台及UV/PBR不同。元数据只记录真实时点；不重标签成f4截图。[捕获完整记录](preview/README.md)。

根在已apply最新f4b3c0c9907dc5b0f5a7315a1c8578de7567a057的工作树执行npm run typecheck && npm test，退出0，83文件/1118测试；11:47:53 UTC开始、Vitest11:48:03、69.67秒。[日志](roof-tiles-a11.required-checks-final-main-f4.log)。后续仅增加资产和说明，无源码改动。

出处与selection是导出时冻结历史，其中“await有限QA”等字段不是当前状态；当前源哈希/复制/有限QA/真实测试结论另存submission-validation.json，ClaudeDecision仍null。

交付文本仅删除多余文件末尾空行，冻结私有原稿、全部图像、出处和独立QA字节保留；原/目标哈希差异另见 [复制验证](submission-copy-validation.json)。
