# A12 公开透明云源比较

本批在第一次生成前下载并实际对照 **12 个 PNG**：Kenney Particle Pack 的 smoke01～03、WickedInsignia 的 CloudAlpha01～06（05取另一镜像）、bonecandy 的3款云。另2个README/许可证文件不算图候选。全部通过 HTTP200 与固定提交 Gitblob / size 校验；完整URL、原稿SHA、尺寸、alpha见 [机器审计](cloud-sprites-a12.source-search.json)。[正式候选对照](../reviews/cloud-sprites-a12-public-candidates.webp)由实际PNG解码、普通alpha合成及缩略生成，没有改变原稿。

Kenney原生512² indexedPNG含真实tRNS透明，软边但灰烟与泡状团块；不能因P模式无直接A通道就说不透明。作者官网 [Particle Pack](https://kenney.nl/assets/particle-pack)与固定 Calinou 镜像独立LICENSE明确CC0，许可文件SHA `7edd59126c258e602e69905a0517cf51bedea489b1a69eb06a77edee1769e81e`。

WickedInsignia原生2048² RGBA/LA有真实alpha。01/02/04十分淡灰，03/05/06较灰暗；05多云群适合参考，直接正常叠明亮底偏灰。02/04边沿alpha最大4，其余选用参考01/05边沿0。作者 [Clouds with Transparency](https://opengameart.org/content/clouds-with-transparency)及 [01](https://opengameart.org/content/clouds-with-transparency-fxcloudalpha01png)、[04](https://opengameart.org/content/clouds-with-transparency-fxcloudalpha04png)、[05](https://opengameart.org/content/clouds-with-transparency-fxcloudalpha05png)页面明确CC0。固定NoahOppy镜像有原basename/尺寸/近似原页字节数，05与另一个Yuri镜像Gitblob完全相同，Yuri README明确逐项署名WickedInsignia / CC0。官方PNG经当前代理CONNECT403，未与官方生产PNG逐字节比较；没有借用镜像游戏代码根LICENSE。镜像较小的Generic-Wizard CloudAlpha04/05在目录里字节重复，不下载也不计独立候选。

bonecandy原生2388×1668 RGBA，透明、白青云体，但深紫硬描边与像素轮廓不满足本批柔边。作者 [Clouds](https://opengameart.org/content/clouds-9)逐文件声明CC0；固定Alexakamm镜像3个UUID名称与原页大小一致，下载字节通过Gitblob校验；没有声称官方字节等同。

最终以实际01/04/05原稿作三次真实 `image_gen.imagegen`参考编辑：明亮白/极浅蓝、每atlas四个独立云组、`transparent_background:true`。最终文件是AI改编作品，**不是官方原件**。原图未程序染色、抹halo、抠背景或补云；完整调用、参考SHA与原生1254² RGBA记录在 [出处](cloud-sprites-a12.provenance.json) / [调用原文](cloud-sprites-a12.calls.json)。12原稿及许可材料均保留在 `/tmp/cloud-sprites-public`，生成原稿保留 `/workspace/generated_images`；这些工作路径是出处证据，不是仓库内失效的Markdown链接。
