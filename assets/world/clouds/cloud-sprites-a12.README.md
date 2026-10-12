# A12 柔边透明云朵 atlas

三张512² RGBA/sRGB无损WebP，各四个独立云组，共12个UV可采样组。尚未接入引擎；第1轮送审准备、通过0，独立QA由root安排。每文件<500000B。

| ID | 文件 | 字节 | 左 / 右列宽 |
| --- | --- | --- | --- |
| cloud_sprite_cumulus_atlas_01 | [cloud_sprite_cumulus_atlas_01.webp](cloud_sprite_cumulus_atlas_01.webp) | 134604 B | 280 / 232 px |
| cloud_sprite_wisps_atlas_02 | [cloud_sprite_wisps_atlas_02.webp](cloud_sprite_wisps_atlas_02.webp) | 152392 B | 256 / 256 px |
| cloud_sprite_scattered_atlas_03 | [cloud_sprite_scattered_atlas_03.webp](cloud_sprite_scattered_atlas_03.webp) | 174084 B | 256 / 256 px |

三次真实参考编辑发生在12张CC0原稿的实际比较之后，参考WickedInsignia CloudAlpha01/04/05。最终是AI改编，许可来源登记 [CREDITS](../../../docs/CREDITS.md)；原始来源与取舍见 [源比较](cloud-sprites-a12.source-search.md)、完整提示词/工具实参见 [调用](cloud-sprites-a12.calls.json)，原稿/参考/成品SHA与参数见 [出处](cloud-sprites-a12.provenance.json)。没有程序绘云、艺术改色、背景移除或alpha阈值修改。

工具请求2048²，实际三个原稿均1254² RGBA。保留全幅，Lanczos等比降采样512²，比例512/1254=0.408293460925；**RGBA和alpha都经过重采样**。无损WebP `lossless=true quality100 method6 exact=true` 与512技术输入全RGBA差0，不能延伸为与1254原生差0。1024试编码504766/573310/631132B超限，仅保留scratch；没有有损压源或去隐藏RGB来凑预算。原生PNG约1.0～1.2MB、非POT，保留workspace而不入库。

UV像素框为左上原点半开区间，上下分界y256。01实际列分界x280，另两张x256；01并非等宽2×2。对 `THREE.Texture.flipY=true`，`offset=(x0/512,1-y1/512)`、`repeat=((x1-x0)/512,(y1-y0)/512)`；sprite宽高按像素框比例保持，不能统一正方缩放01的宽/窄列。四框完整清单见出处，每框已经实际Sprite取样。不存在程序移云或剪云去伪造规则grid。

外四边和12框边沿alpha最大1，四角单像素均0；云丝02两处8²角范围含1，其余角块0。保留弱尾值，不能声称边沿全0或数学无截断。实际1:1三底及alpha图、正常无阈值Sprite未见明显硬截线/矩形底板/黑边。最不满意：云丝02上右卷弯较像幻想云气；232～280×256单框在48px远景会变平、散云细节丢失；这是billboard素材，并非随灯光重照的体积云。

实际Three169样板为白色SpriteMaterial，NormalBlending/transparent、alphaTest0、depthWritefalse、NoToneMapping，无光/雾/bloom；浅石/天空蓝/深蓝为opacity1，右侧同深蓝opacity.25。每panel4大组100px高＋4缩略48px高，两次真新页加载3/3，6HTTP200 bodySHA匹配，24panel/192sprite绘制，runtime错误0、拍前后sourceSHA不变。纹理ClampToEdge、LinearFilter、不生成mipmap，避免atlas邻格取样；准确相机/材质/offset/repeat及实际读回见出处。样板不接入产品。

主线代码固定68e3f1d，root认领前实际typecheck＋test退出0，80files/1102tests；作者已读保存日志。此次仅素材/文档改动，未重复整库测试或冒称自己的另一轮通过。正式审图共12张加3source=15张图片，细目与编码尺度见 [审图说明](../reviews/cloud-sprites-a12.README.md)。
