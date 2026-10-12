# A10 天空首批：橘粉黄昏 / 赤云晚霞 / 灰蓝晨雾

三张 2048 × 512 RGB sRGB 全景，第 1 轮待审，通过数量 0；同一 [PR #116](https://github.com/acaozixu123456/myRepository/pull/116)。只交天空与云，横向循环，未接入引擎。

| 素材 | 最终来源 | 成品大小 |
| --- | --- | --- |
| [橘粉黄昏](sky_dusk_peach_01.webp) | Kenney Skyboxes CC0 完整环视天空带，直接等比适配 | 13,834 B |
| [赤云晚霞](sky_sunset_redcloud_02.webp) | 真实公开素材比较后的 AI fallback；原稿经三次真实参考编辑，采用候选4 | 114,444 B |
| [灰蓝晨雾](sky_dawn_tealmist_03.webp) | Greg Zaal / PH CC0 雾晨原 HDR → 标准 SDR 全宽上512带，直接编码；没有 AI 编辑 | 6,600 B |

三图共 134,878 B，均 WebP quality 90 / method 6、嵌入 588 B sRGB ICC、无 Alpha、单文件 ≤500,000 B。[完整出处](sky-panorama-a10-first.provenance.json)保留八次真实调用（3初始生成＋5参考编辑）的完整提示词、实参、原稿/引用/选弃/导出与SHA。最终只有赤云是AI衍生素材，现成黄昏 / 晨雾为两件CC0适配。没有程序绘云、渐变补天、接缝混合、艺术调色、上采样或移缝隐藏。

新规则后实际取得 / 比较 33 件原素材：Kenney 5、OGA Cloudy 25、PH 原 HDR 3；全部生产 GET 200、固定 Git blob/长度核对，PH 三件原 HDR 另核官方API MD5/长度。[来源审计](sky-panorama-a10-first.resource-audit.md)与[机器记录](sky-panorama-a10-first.resource-audit.json)。OGA 现成红云实际偏褐暗且带明显太阳，PH 晚霞标准SDR实际蓝灰 / 淡紫与金色地平光，故赤云采用明亮无太阳的原生成方向；没有以比例、摄影或下载失败拒选。初始3生成在新规则之前，公开补查 / 5参考编辑在之后，不虚称先搜后生成。旧7298阶段与8call青晨雾失败阶段、全部原稿和中间图完整留存。

Kenney 原稿 4096 × 2048：完整360°宽裁框 `[0,640,4096,1664]`（零起点、右下边界不含）得到4096 ×1024，等比0.5 Lanczos到2048 ×512，太阳在选区外。只验证固定镜像blob，未取得 / 比较官方ZIP；许可依据作者两处CC0声明，不借用镜像Castle Kit LICENSE。

PH 原雾晨2048 ×1024 HDR：Three169 RGBELoader FloatType解码，逐通道Reinhard曝光2 → 标准sRGB → nearest8bit；完整360°宽上512带 `[0,0,2048,512]` 原生2048 ×512，不缩放 / 不改变比例，直接WebP编码。官方MD5只验证原HDR，最终标准SDR / WebP是常规转换而非原HDR字节。[CREDITS](../../../docs/CREDITS.md)登记真实现用来源，保留主线旧行。

晨雾最不满意的是浅灰蓝较素、没有明显绿色 / 云体弱，与原请求蓝绿存在差异。此前两次真实淡蓝绿AI编辑虽然机器检查通过、LR从3.930降到3.079，正常无光照圆柱仍见稳定青色竖阶，因此均失败且unused；最终采用真实现成雾，未强造绿色，也未把这些AI原稿说成现用官方素材。

仅最终赤云候选4的AI原生实际2172 ×724（3:1），未返回请求3072 ×768（4:1）。完整向下Lanczos到2048 ×512，横缩0.942910 / 纵缩0.707182，云形纵横比例压扁25%，不是等比或原生4:1。此限制不套用Kenney或直接PH。原生输出 / 标准SDR输入保留，实际路径 / SHA见出处。

[总览](../reviews/sky-panorama-a10-first.webp)、[完整横向重复及1:1边角](../reviews/sky-panorama-a10-first.README.md)、[真实无光照圆柱](../reviews/sky-panorama-a10-first-render.webp)与[捕获参数](../reviews/sky-panorama-a10-first-render.README.md)。共14正式图：13离线＋1GPU。原生PNG精确保存成品解码RGB，WebP审图有损重编码；GPU精确比较使用原捕获PNG RGBA。

最终LR MAE 0.339 /1.954 /0.206，非数学像素相同。赤云前两编辑8.195 /7.482有细枝停点或正常圆柱稳定竖色阶而弃；第三编辑两侧约15%低细节、同上下色调，指标下降不单独作为视觉通过依据。4倍重复可辨低频云块 / 雾色周期；黄昏云偏上，pitch0样板更多展示桃粉雾。最不满意还包括赤云低频周期与非等比云形。

固定主线 `60bc06577f5d5dd2966a661d2278802bb3e3fcee`，合并HEAD `274c7f2ce267d613b530878312b7f496f8465a44`：实际typecheck与test退出0，69测试文件 /1035测试通过；完整日志 `tests-fixed60.log`、SHA见出处。后续只改图与相关metadata，无sourcecode变化，不重复整库检查。最初7ea的68 /1024记录只留历史。

独立QA见[摘要](sky-panorama-a10-first.qa.md)与[机器报告](sky-panorama-a10-first.qa.json)；Claude通过仍为0。
