# A10 天空首批独立 QA：最终直接 PH 版本

可以交 Claude 第 1 轮审核，阻塞问题为空；Claude 通过数量仍为 0。范围是三张当前素材及 14 张审图，全部使用 `view_image` 实际查看，另看独立无损原生接边与 GPU ROI。结论绑定[最终出处](sky-panorama-a10-first.provenance.json) SHA `2363f40946fb5e01a0f9ac13d0af96c56710036a3b3f51a397729d6e73ee9b2a`，固定主线 `60bc06577f5d5dd2966a661d2278802bb3e3fcee` / 作者合并 HEAD `274c7f2ce267d613b530878312b7f496f8465a44`。[机器报告](sky-panorama-a10-first.qa.json)保留完整当前哈希、逐项复现、来源与采样范围。

| 当前素材 | 出处 / 成品大小 | 独立视觉判断 |
| --- | --- | --- |
| [橘粉黄昏](sky_dusk_peach_01.webp) | Kenney CC0 直接适配；13,834 B；SHA `09ba14a55b6bb71376446ba5b7fd3dad9021d0b1117cb35abde86d6ac8c94db3` | 桃粉雾明亮柔和，云体主要在上侧；所查原生接边、角和普通圆柱视图可接受。 |
| [赤云晚霞](sky_sunset_redcloud_02.webp) | AI 原稿三次真实参考编辑后候选 4；114,444 B；SHA `1e344cc99267542423425b09dda4acda4acf72a1b8646f900d3a788fa0ddbce7` | 橙红层云辨识明确；原生边缘有细色差 / 云纹相位差，但所查普通 GPU 接口未见此前稳定竖阶，接受并披露周期。 |
| [灰蓝晨雾](sky_dawn_tealmist_03.webp) | Greg Zaal / PH CC0 原 HDR 标准 SDR 直接适配；6,600 B；SHA `3f34fde2ce9085aab8d4ea88b47d83d7981685d88c59aa44ad9a9324b0d47fb4` | 雾层平缓，所查原生接边与普通 GPU 已不见旧 AI 版本青色竖带；颜色偏灰蓝、绿色不足是明确保留的不足。 |

本轮再次看三张成品、六张完整 2 / 4 次横向重复、六张原生 LR / 角 PNG、总览及[当前无光照圆柱图](../reviews/sky-panorama-a10-first-render.webp)。独立再拼每张成品解码 RGB 的右 512 列与左 512 列，保留 1024 × 512 原生尺度。官方 LR 为右 128｜左 128，覆盖全部 512 行；角图为上行 TR｜TL、下行 BR｜BL，各块 128²。角图不代表上下循环。六张原生 PNG 与成品解码 RGB 比较全通道完全一致。

关键 GPU 原图坐标：赤云 ROI `[480,384,544,672]`、晨雾 ROI `[480,720,544,1008]`，均零起点、右下边界不含。把当前无损原 PNG 与有损 WebP 的两个 ROI 分别原生并排实看，未再观察到旧晨雾在 x≈512、y≈755–890 的稳定青色竖带。当前 GPU WebP SHA 为 `368ffbc6f8ecdf8ad6af49d342849d2c1923fdf2cf2bc57cabb0c172e13764ad`，66,554 B；原 PNG SHA 为 `6beb7a1500dcb2f6f2bbd4fb18fbbf43558d84271774347741cb7af51d22139f`。旧 `f323…` 青晨雾、`057e…` GPU 与 `7298…` 出处只保留失败历史，不作为最终通过证据。

独立启动 Chromium 读取冻结后的同一 Three r169 审图 HTML，禁用缓存，实际初次加载与 reload 各加载 3 / 3 成品，共 6 个 HTTP 200；响应 body SHA 全部与当前三图一致。两次各执行 3 图 ×24 yaw（0..345、步长15）×3 pitch（−20 /0 /20）=216 probe，以及 6 个 seam / opposite featured，共 432＋12＝444 帧，每帧 draw call 1。page / console errors、failed requests 均为 0，拍前 / 后三图 SHA 一致；逐帧诊断与作者当前 444 帧相同，独立全图原始截图与作者当前原 PNG 完整 RGBA 差为 0。

已读并核材质 / 几何代码：白色 MeshBasic、BackSide、正常正尺度、默认圆柱 UV、Repeat S / Clamp T、输出 sRGB、NoToneMapping；没有灯光、雾、bloom、调色、负尺度或移 UV 接缝。圆柱半径64、高100.530965、径向128段、开口，每格1024 ×288，相机fov30。本样板是素材审图，未接入游戏引擎。浏览器 / 完整逐帧报告、独立截图与 ROI 留在 `/tmp/sky-independent-final`，路径和 SHA 见机器报告。

三个实际导出都以原 ICC payload 重编码，文件逐字节复现成功；六张重复图也由成品解码 RGB 直接复制后 q85 / method6 编码，逐字节复现成功，没有复制前缩放或补缝。三件成品均2048 ×512 RGB、无 Alpha、q90 / method6、588 B sRGB ICC，合计134,878 B。全部17件图片均RGB、POT尺寸、sRGB ICC且≤500,000 B；最大312,986 B。作者25件冻结交付文件及35件工作记录哈希全部核对，35项产品 / 输入 / 捕获依赖监测前后未变；加入本 QA 两文件后交付27件。审图 WebP 为有损，不宣称与输入原生 RGB 或 GPU 原 PNG 逐像素相同。

独立从真实原 HDR 重新运行 RGBELoader FloatType 解码，原 HDR 2,958,072 B，SHA `a59683cd08861fb18d69ee8f3938f50ec81c6feda5381e8b8576f340d5a25bb1`，实算 MD5 `b99e0bb066a0d8134729b9712495d68b` 与官方 receipt 相同；解码 Float RGBA SHA `ce705391fcf1ed19f5e183079930efb2b7c3a03723abea8e160ddd7a6c19428b`。重新计算逐通道 Reinhard exposure2、IEC sRGB、nearest uint8，并取完整360°宽上512带 `[0,0,2048,512]`，与实际标准 SDR 输入 `98f79edbe5edb51ee3ae344b0296568800195840fc797a4b715aed684865fc5b` 全部 RGB 字节一致。现用 PH 的 2048 ×512 输入直接编码，未缩放 / 改比例 / AI 编辑 / 艺术染色 / blend。其有损成品对标准 SDR 的 RGB MAE 为0.4863 /255，最大通道差3。

Kenney 原4096 ×2048调色板PNG转RGB，完整360°宽裁 `[0,640,4096,1664]` 得4096 ×1024，再等比0.5 Lanczos。仅赤云实际 AI 画布2172 ×724（3:1）完整下采到2048 ×512（4:1）：横缩0.942910、纵缩0.707182，纵横相对比例压扁25%；没有把它称为等比或原生4:1，也没有把此限制套到直接 PH。

出处保留真实3 generate＋5 edit＝8次调用：逐条核提示词 / 实参、实际 output hint、原稿与参考文件 SHA，红云仅选候选4，两次 PH 淡蓝绿 AI 编辑均未选用。最终只有赤云是 AI 衍生，不能称整批 CC0 或现用晨雾 AI。来源审计原有33件原素材的长度 / Git blob SHA1 / SHA256全部独立重核：Kenney5、OGA25、PH3，其中 PH3另核官方MD5。33件实际视觉比较归来源审计员，不冒称本 QA 重看所有33原图；本轮未重新执行公开搜索 / 下载。原作者资产许可、公开比较与新规则前3次生成的时间关系详见[来源审计](sky-panorama-a10-first.resource-audit.md)。Kenney官方ZIP未取得 / 字节比对，镜像根Castle Kit LICENSE不适用于这套Skyboxes；PH官方MD5只验证原HDR，非标准SDR / WebP衍生文件。7298阶段及8-call失败阶段归档文件逐项SHA保持一致。

最不满意的是晨雾颜色较素、绿色不足与薄云不明显；赤云四次重复能认出低频云块周期，细边缘仍有色差 / 相位差，云形还受25%压扁限制。黄昏pitch0偏桃粉雾，上部云体价值更大。实算LR MAE0.339 /1.954 /0.206用于诊断，视觉结论没有按数值阈值裁决；本 QA 不证明数学无缝、全部像素不可见接边或连续所有视角。天空只要求横向循环，不要求上下匹配；开口圆柱不是封顶天空盒，也不提供HDR环境照明、深度或动画。

产品检查引用作者固定60的真实 `npm run typecheck && npm test` 退出0，69测试文件 /1035测试通过；已独立读 `tests-fixed60.log` 且核SHA `073639dcf23adcf7e52b421da03d41f20cba788f2b5ec72775e35be9548a511a`。typecheck stdout由原工具返回，只有test被重定向；不虚构独立typecheck日志，也不冒称本审图员另跑整库测试。后续变更只有图片与metadata，没有产品源码变化。本 QA 只新增两份审查文件，未改成品、作者审图 / 捕获、文档、出处、源代码，未commit / push。
