# A12 透明云精灵：独立 QA

本批可以交 Claude 第 1 轮审核，阻塞为空；尚未得到 Claude 审核通过，已通过数量为0。仅新增本摘要与[机器报告](cloud-sprites-a12.qa.json)，未改图、出处、README、其他文档、代码或作者捕获文件，未commit / push。固定审图基线 `68e3f1d2c8af4337851eba52dca646c128eebc33`；[冻结出处](../clouds/cloud-sprites-a12.provenance.json) SHA `86bab7d28b02448e5781385179efa5c968f04bfd4e54f7573ded3014268f4dee`。后续主线同步与提交检查由root处理，不能把此基线的运行证据说成另一主线已实测。

| 成品 | 当前 SHA / 字节 | 视觉结论与不足 |
| --- | --- | --- |
| [圆云01](../clouds/cloud_sprite_cumulus_atlas_01.webp) | `2f0b4879739eb5d48c8fcb4dcd79df1e6601c23a159ad55b7cd2956bdb029729` /134604 B | 四组圆云读形清楚，柔边正常；列宽280 /232，必须按实际非等宽UV取样。 |
| [云丝02](../clouds/cloud_sprite_wisps_atlas_02.webp) | `98a2a04e7adc0925108ddb2d569661253cbeab968ba88e86abe86b68bc49ebdc` /152392 B | 丝带与弯卷剪影有区别；浅石底偏淡，48px细丝损失，弯卷偏幻想云气是最不满意处。 |
| [散云03](../clouds/cloud_sprite_scattered_atlas_03.webp) | `a636d8cf7c5b29cb6848e5038fb6db4d68e8aac9239f196d95bdfc9702efc48d` /174084 B | 云群与前两款不同，主体清楚；48px卫星小云易变小点，内部细节减弱。 |

实际使用 `view_image` 查看全部15件图片：三成品、[总览](cloud-sprites-a12-overview.webp)、[公开12候选](cloud-sprites-a12-public-candidates.webp)、[实际GPU Sprite](cloud-sprites-a12-render.webp)，及三套原生三底/alpha、无损alpha PNG和角/格边RGBA PNG。另实看三份1254²工具原稿、三份选用WickedInsignia参考原图、独立无损三底/alpha与新的48px GPU原生条带。浅石 `(235,235,223)`、天空蓝 `(124,191,230)`、深蓝 `(23,47,80)` 的实际合成与100px /48px Sprite未见明显黑边、矩形底板或切云线；深蓝opacity.25确实很淡，未做阈值清边。48px指整个UV cell高，实际云体占其一部分。

原生RGBA直接查看器会显示透明 /极低alpha处的RGB残值，边缘看起来可能有蓝白残色。独立真实A通道、普通透明合成与无阈值GPU里未见相同的强彩边；没有把RGB残值抹掉、key掉或把A强制归零。云丝细纹、散云小点和低opacity减弱如实保留。结论只覆盖所查正视billboard尺寸、背景与opacity，不保证任意缩放、旋转、背景、场景雾或大量层叠后的所有像素。

独立直接从保留的1254 ×1254 RGBA原稿全幅 Lanczos 等比缩为512 ×512（缩比0.4082934609），无裁切 /非等比 /上采样 /抠底 /alpha绘制。三份**512技术输入**与无损WebP解码完整RGBA最大差0、不同像素0；使用原588B ICC、lossless=True /quality100 /method6 /exact=True重新编码，三文件逐字节复现。这个零差不适用于1254原稿：RGBA与A都真实重采样，原稿与512成品分辨率不同。1254非POT原图且>500000 B，未混入仓库交付。

12个真实UV框逐一量到边界alpha最大1/255，不能称全零。每张最外边的逐边最大值如下（T /B /L /R）：圆云0 /1 /1 /1，云丝0 /1 /1 /1，散云0 /1 /1 /0。四个单像素角均0；各8²角块最大值圆云 `[0,0,0,0]`、云丝 `[0,1,0,1]`、散云 `[0,0,0,0]`。弱尾值在原有真实alpha中保留，材质alphaTest0没有通过discard掩盖它们。完整alpha直方图与12框逐边数值见机器报告。

01分界为x280（0.546875），y256（0.5），框来自源图左上半开像素坐标，texture.flipY=true；真实UV按底左计算 `offset=[x0/512,1-y1/512]`、`repeat=[(x1-x0)/512,(y1-y0)/512]`。

| 01框序 | 像素框 `[x0,y0,x1,y1]` | UV offset | UV repeat |
| --- | --- | --- | --- |
| 0 上左 | `[0,0,280,256]` | `[0,.5]` | `[.546875,.5]` |
| 1 上右 | `[280,0,512,256]` | `[.546875,.5]` | `[.453125,.5]` |
| 2 下左 | `[0,256,280,512]` | `[0,0]` | `[.546875,.5]` |
| 3 下右 | `[280,256,512,512]` | `[.546875,0]` | `[.453125,.5]` |

02与03均x256 /y256，按同序offset `[0,.5] /[.5,.5] /[0,0] /[.5,0]`，repeat均 `[.5,.5]`。本批是三atlas /12云组，不把一个云组的多个轮廓团块又算作额外UV组。独立实际Sprite正尺度保持01 cell aspect1.09375 /.90625、02/03 aspect1。

三alpha PNG的RGB通道逐像素完全等于成品实际A；三边界RGBA PNG的八个64²区域与成品对应角/格边直接裁拼全RGBA差0，透明padding仅在审图画布，未进入source。又独立生成每张三底＋alpha的2048 ×512无损图，每panel512²无缩放，并从其q85 /method6重编码逐字节复现三native WebP。官方native WebP本身有损，其A面板不能替代原生A的1/255证据。原生裁框、独立PNG路径与SHA均在机器报告。

独立执行现有冻结审图HTML的两次fresh page加载，各页禁缓存，关闭前页后再建下一页以释放12WebGL上下文；每页3 /3source、12panels、每panel8 Sprite，合计24panel /192 Sprite。6HTTP200的body SHA与三成品吻合；page /console errors /failed requests全部0，所有panel draw call8、contextLost=false，源图拍前 /后SHA一致。独立完整PNG与作者当前无损原PNG完整RGBA差0，逐panel GPU读回诊断也一致；官方GPU WebP为有损，不能说它与原PNG像素相同。

另从 `window.__cloudFixtures` 的实际scene /camera /renderer /sprite /material /map对象读取192实例，未仅采用作者报告：全部真实Sprite、white SpriteMaterial、NormalBlending、transparenttrue、alphaTest0、depthWritefalse、depthTesttrue、premultipliedAlphafalse、toneMappedfalse；所有缩放与世界行列式为正。map为sRGB、flipYtrue、ClampToEdge两轴、Linear两滤镜、noMipmaps，offset/repeat逐个对应真实12整数框，没有UV旋转或镜像。三底opacity1，第四底深蓝opacity.25；Orthographic[-3.2,3.2,1.8,-1.8]与512 ×288 /DPR1下实际cell高100或48px。NoToneMapping /exposure1、无灯光、fog、bloom、grade；没有用alpha阈值清边。此样板未接入游戏，不给出任意mipmap、混合密度、动画或产品性能保证。

独立核[公开源比较记录](../clouds/cloud-sprites-a12.source-search.json)中12 PNG实际长度、SHA256、固定Git blob SHA1与真实alpha；下载HTTP200事实与原作者主许可来自保留审计，不虚称本审图员另发公开请求。实际看12候选联系图及选用01 /04 /05三原图：Kenney三个P模式PNG有tRNS透明，灰烟 /泡团不因P无A通道被误称不透明；Wicked多款较灰暗或十分淡；bonecandy三云有深紫硬描边 /像素轮廓。已读Kenney专属CC0许可证与Yuri README逐项WickedInsignia /Clouds with Transparency /CC0声明，未套用镜像游戏代码根许可。

[调用原文](../clouds/cloud-sprites-a12.calls.json)与出处中的三次 `image_gen.imagegen`真实参考编辑均在12 PNG实际比较之后，`transparent_background:true`，参考01 /04 /05的路径 /SHA、完整prompt /实参、输出hint绑定和实际1254²原稿全部核对。最终三件是AI改编，不是官方CC0原像素、直接库存PNG或程序alpha抠底。官方PNG代理CONNECT403，只有固定镜像blob/长度等身份证据，不声明官方生产文件逐字节一致；[来源说明](../clouds/cloud-sprites-a12.source-search.md)保留这项限制。

冻结24作者文件全部SHA /大小核对；15图均POT、ICC588、单件<500000 B，source512² RGBA、alpha PNG为RGB、边界PNG为RGBA。source共461080 B，图片最大174084 B。加本QA两文件后26交付文件，QA本身也<500000 B。原68的CREDITS字节作为前缀保留，只追加来源；WORLD原正文完整作为后缀保留，仅前置作者本批A12认领段，未改无关正文。47项成品 /原稿 /参考 /文档 /运行与策略依赖监测前后字节未变，产品src /tests /package相对68无diff。

产品验证只引用root在固定68认领前的真实 `npm run typecheck && npm test`退出0，80测试文件 /1102测试；独立已读 `/workspace/cloud-sprites-baseline.log` 并核SHA `761c63da08361b55b3eb7790cf66e8d13db404b241923b768a6e2bb05eefeda0`。未冒称本审图员重跑，亦未将素材审图当成后续主线检查。独立脚本、两页报告、实际对象清单、重导出512技术输入、无损三底、原生48px条带和原始PNG均留在 `/tmp/cloud-a12-independent`，路径与SHA可追溯。Claude通过仍为0。
