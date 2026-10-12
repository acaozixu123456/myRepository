# A12 审图与实际透明Sprite样板

本批15图：3个512² RGBA无损source，12个review（总览1、公开12候选联系图1、实际Sprite1、原生三底/alpha横图3、原生alpha无损PNG3、原生角/格边RGBA无损PNG3）。本说明不把有损review的像素等同于source。

[总览](cloud-sprites-a12-overview.webp)为2048×1024：前三列512px原生整图叠天空蓝/深蓝，末列为圆云01浅石与1:1 alpha；[公开候选](cloud-sprites-a12-public-candidates.webp)是实际12原PNG缩略叠天空蓝，不作成品；[实际Sprite](cloud-sprites-a12-render.webp)由真实Chromium截图编码。RGB WebP统一q85/method6/sRGB；lossy审图会改变通道值，不能用它证明原生alpha1边界。

各 `cloud-sprites-a12-*-native.webp` 是2048×512：三底分别浅石(235235223)、天空蓝(124191230)、深蓝(234780)与实际alpha，每面板512²无缩放；alpha面板同样有损。各 `*-alpha.png` 是512² RGB无损，三个RGB通道逐像素复制最终source实际A通道；各 `*-boundaries.png` 是512×256 RGBA无损，八个64²区域从source直接裁拼：四角＋真实列分界上下＋行分界左右。区域原坐标及目标位置((index%4)*128,(index//4)*128)在出处；未用画笔、抠图、阈值或alpha清理。未占位置仅是审图画布透明padding，不进入source。

实际样板临时HTML `.tmp-cloud-sprites/preview.html`，URL `http://127.0.0.1:5199/.tmp-cloud-sprites/preview.html`，仓库不提交临时HTML。准确hash、原始无损PNG、作者capture脚本路径及完整2load报告在 [出处](../clouds/cloud-sprites-a12.provenance.json)。两次cache-disabled新页加载，上一页先关闭以释放12WebGL上下文；加载完整3图，6HTTP200响应体与sourceSHA匹配。24实际panels、每个8Sprite共192绘制；每panel含4个100px高大组与4个48px高thumb，左右01非等宽与其他等宽UV均实际sample。样板camera为Orthographic[-3.2,3.2,1.8,-1.8]、position(0010)，canvas512×288，DPR1，SRGB output/noToneMap，无光雾/阴影/bloom，SpriteMaterial white/NormalBlending、alphaTest0、depthWritefalse、premultipliedAlphafalse；前三底opacity1，末底opacity.25。textureflipYtrue，ClampToEdge/Linear/noMipmap，UV按精确像素框，所有缩放正数。实际读回/context/各sprite参数报告保留。

source不是硬轮廓贴纸；在透明低alpha处仍有原生RGB残值，单独RGBA viewer可能展示颜色残边，应结合实际alpha及真实透明合成判断。四边/UV界alpha最多1未清理；不能保证数学全0。云丝弯卷、48px细节损失、.25opacity微弱都如实保留。独立QA尚待root安排；没有将runtime机械通过当Claude通过。
