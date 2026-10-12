# SKY 前三张公开素材补充审计

这是 06:46 来源选型阶段的历史审计。最终使用 Kenney 现成桃粉天空带、AI 赤云候选4（三次真实参考编辑）、PH 原雾晨标准 SDR 上512带直接编码。共3次初始生成＋5次真实编辑均保留；两张淡蓝绿晨雾 AI 编辑在正常圆柱呈稳定青竖缝，失败且未用于最终。灰蓝晨雾无绿色 / 云体弱，是实际取舍。[最终出处](sky-panorama-a10-first.provenance.json)记录全部选弃、哈希与最终参数。以下原始选型段曾计划晨雾AI改编，代表当时阶段，不是最终来源。工作空间路径用于追溯原稿，可用生产URL在各来源段与[审计JSON](sky-panorama-a10-first.resource-audit.json)。

现成素材确实可用。最终方向已由 root 选择：**首张直接复用 Kenney morning；第二张保留历史红云生成稿并做一次真实参考编辑修 U0 接缝；第三张采用官方原字节的 Poly Haven 雾晨 HDR，标准 SDR 全宽带 exposure 2，再经真实参考编辑改为淡蓝绿，保留雾布局。** 作者负责后续编辑、导出与最终审图。没有把访问失败、2:1 比例、文件名或摄影来源当成“找不到合适素材”的证据。

审计数据：[审计 JSON](sky-panorama-a10-first.resource-audit.json)。实际取得 **33 个原素材文件**：Kenney 5 张、OpenGameArt Cloudy 25 张、Poly Haven 3 个原始 HDR。全部生产 GET 为 HTTP 200，文件长度及 Git blob SHA1 精确匹配固定提交；3 个 Poly Haven HDR 的长度与 MD5 还精确匹配官方 `files` API。全部已用真实像素评估，原文件未改。此处完成来源审计，不代替最终导出后的横向接缝与正常 GPU 审图。

## 时间关系与规则

主线 `6fdb7eefe166877b9cb874cb3a8c27f821206519` 于 **2026-10-12 06:12:57 UTC** 增加 CODEX_QUEUE 规则 0：优先公开资源，找不到适合的再生成/绘制，用到的第三方素材登记 `docs/CREDITS.md`，PR 说明搜索来源和不合适原因。

这三张历史生成稿是在新规则之前发生的，原始 `calls.json` 和历史稿保留。**本次是新规则之后补充的公开资源审计**，云端 HTTP 探测始于 06:19:16 UTC；不声称“生成前已经搜过”。审计员没有追加生成或程序艺术调色。root 随后选择的第二/三张真实参考编辑是新的、发生于补查之后的步骤，由作者记录实际调用和文件身份，不能混入历史生成时间。

## 当前可复用的真实候选

| 目标 | 实际素材与像素 | 建议和已知差异 |
| --- | --- | --- |
| 黄昏橘粉 | [Kenney morning 原图](https://raw.githubusercontent.com/shorepine/kenney/3694c6879e487c108f55677be7dd2ca75b07cc3b/2d/Skyboxes/Skyboxes/skybox-morning.png)：4096 × 2048，明亮桃粉底、珊瑚粉云，右上小白太阳 | **优先复用，作者已换源。** 保留全 360° 宽度，选 4096 × 1024 纬度带等比缩到 2048 × 512，作者选择避开太阳。文件名 morning 不影响实际黄昏色适用性。 |
| 晚霞赤红带云 | [OGA cloudy_red](https://raw.githubusercontent.com/optimuspryne/open-tabletop/2a62a0c9a8ec2f0ab609e62d2c24fd7d8fc24a6f/public/static_assets/sky/equirect/cloudy_red.png)：2048 × 1024，真实红/粉云和褐红天空；[cloudy_sunset](https://raw.githubusercontent.com/optimuspryne/open-tabletop/2a62a0c9a8ec2f0ab609e62d2c24fd7d8fc24a6f/public/static_assets/sky/equirect/cloudy_sunset.png) 是橙红云和金色太阳 | 确有红云现成来源。原图下半较暗且有镜像光盘；作者指出常规全宽 512 高带会保留至少一枚光盘。明亮度、太阳焦点和云质感是具体差异。CC0 允许适配；root 实际比较后选择历史明亮红云生成稿并参考编辑修独立 U0 边。拒选 native 红云的依据是实际褐暗色、光盘和整体风格，不是比例或访问失败。 |
| 清晨蓝绿薄雾 | [PH Kloofendal misty 原 HDR](https://raw.githubusercontent.com/2600th/web-ocean-3d/6496c77d37c12e803108c8f932680a7710a62c1c/public/hdris/kloofendal_misty_morning_puresky_2k.hdr)：2048 × 1024，低对比淡灰蓝雾、没有突出大太阳；[OGA cloudy_mist](https://raw.githubusercontent.com/optimuspryne/open-tabletop/2a62a0c9a8ec2f0ab609e62d2c24fd7d8fc24a6f/public/static_assets/sky/equirect/cloudy_mist.png) 灰蓝雾有大漫射白光；[cloudy_light_green](https://raw.githubusercontent.com/optimuspryne/open-tabletop/2a62a0c9a8ec2f0ab609e62d2c24fd7d8fc24a6f/public/static_assets/sky/equirect/cloudy_light_green.png) 实际是灰蓝绿密云 | PH 是合适的纯雾天空基底，但 native 绿色很淡。OGA 不是凭名字想象的清爽亮绿。root 选择 PH 原 HDR 作基础：标准 SDR 全宽带 exposure 2，再用真实 image_gen 参考编辑为淡蓝绿并保留雾布局。原素材 CC0；最终 AI 改编不能称为官方原件或官方 MD5 一致输出。 |
| 第三张补充比较 | OGA cloudy_obscured_sun（工作空间记录：`/workspace/sky-first-raw/public-candidates/oga-cloudy/cloudy_obscured_sun.png`）：柔和浅蓝灰、白云、淡金地平线及小白光点 | 新增实际柔和冷色候选；原色没有明显绿雾。其余 dark_blue 是深蓝大白云、dusk 粉紫密云、moody 灰紫；没有发现另一个直接满足蓝绿薄雾的 native 版本。 |

Kenney day 真实是浅蓝白云，适合后续正午候选，已留给 **#117**，本批只作参考。alien 真实为紫粉色且大白太阳焦点；night 为深蓝夜云/星点；space 为暗蓝紫星空。后面三张的 native 视觉不匹配本批三时段，判断来自真实像素。

OGA 镜像真实有 25 文件，全部已下载和实看，23 个独立 blob；`cloudy_red_at_night.png` 与 `cloudy_dawn.png` 字节相同，`cloudy_stormy.png` 与 `cloudy_light_green.png` 字节相同。没有 `teal` / `cyan` / `cloudy_blue` 名称，但检查了实际的 dark_blue、obscured_sun 等冷色版本。完整每张观察见 JSON，未用文件名代替视觉判断。

## 可复制的来源、许可和取得路径

**Kenney Skyboxes**

- 原作者：[Kenney 官方包](https://kenney.nl/assets/skyboxes)，[作者同名 OGA 页](https://opengameart.org/content/skyboxes-1)，两页明确 CC0，5 张球面全景；署名可写 Kenney / Kenney.nl。
- [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) 允许商业使用、修改和再分发；本仓库仍要求登记 CREDITS。
- 官方 ZIP：[Kenney 下载](https://kenney.nl/media/pages/assets/skyboxes/6736ff5c10-1784123473/kenney_skyboxes.zip)，[OGA 作者下载](https://opengameart.org/sites/default/files/kenney_skyboxes.zip)。Web 连接器报告不支持 application/zip；没有取得官方 ZIP。
- 生产镜像：[shorepine/kenney 固定提交](https://github.com/shorepine/kenney/tree/3694c6879e487c108f55677be7dd2ca75b07cc3b/2d/Skyboxes/Skyboxes)，[mirror README](https://github.com/shorepine/kenney/blob/3694c6879e487c108f55677be7dd2ca75b07cc3b/README.md) 说明 Kenney CC0 库来源。
- 实际首张原文件 URL：[skybox-morning.png](https://raw.githubusercontent.com/shorepine/kenney/3694c6879e487c108f55677be7dd2ca75b07cc3b/2d/Skyboxes/Skyboxes/skybox-morning.png)，899710 bytes，SHA256 `7b445e959e7e65c2aad962028826434fda90d7b21f00f451767344970efa9e1e`，Git blob `356211662ac9020e2e59166bff0c7babb7d2c529`。
- 镜像根 LICENSE.txt 写 Castle Kit 2.0，不能把它当成本 Skyboxes 的专属许可。来源链是官方包 CC0、作者 OGA CC0、mirror README、固定文件；只验证镜像 blob，**未与官方 ZIP 逐字节比较**。

**OpenGameArt Cloudy Skyboxes**

- 原作者：[Screaming Brain Studios 官方 OGA 包](https://opengameart.org/content/cloudy-skyboxes-0)，明确 CC0-1.0、2048 × 1024 全景、晴天/日出/日落/夜空。网页内容清单写 25 全景，但正文另有“32 per pack”；没有据矛盾正文虚构 ZIP 清单。
- 官方全景 ZIP：[sbs_-_cloudy_skyboxes_-_panorama_0.zip](https://opengameart.org/sites/default/files/sbs_-_cloudy_skyboxes_-_panorama_0.zip)。Web 不支持 ZIP，云端 GET 在到达网站之前被代理 CONNECT 拒绝。
- 实际取得：[optimuspryne/open-tabletop 固定目录](https://github.com/optimuspryne/open-tabletop/tree/2a62a0c9a8ec2f0ab609e62d2c24fd7d8fc24a6f/public/static_assets/sky/equirect)，[目录专属 ASSET_CREDITS](https://github.com/optimuspryne/open-tabletop/blob/2a62a0c9a8ec2f0ab609e62d2c24fd7d8fc24a6f/docs/ASSET_CREDITS.md) 明确此目录是 Screaming Brain Studios / 官方 OGA / CC0，不套用软件仓库的总许可证。
- 可复制实际红云 URL：[cloudy_red.png](https://raw.githubusercontent.com/optimuspryne/open-tabletop/2a62a0c9a8ec2f0ab609e62d2c24fd7d8fc24a6f/public/static_assets/sky/equirect/cloudy_red.png)；雾图：[cloudy_mist.png](https://raw.githubusercontent.com/optimuspryne/open-tabletop/2a62a0c9a8ec2f0ab609e62d2c24fd7d8fc24a6f/public/static_assets/sky/equirect/cloudy_mist.png)。全部 25 文件的 raw URL、byte、SHA256 和 blob SHA1 见 JSON。
- 所有 raw GET 为 200、2048 × 1024，blob 精确。**没有比对受阻的官方 ZIP**，因此只报告许可来源链和固定镜像身份。

**Poly Haven Pure Skies**

[官方许可证](https://polyhaven.com/license) 明确 HDRI/贴图/模型为 CC0，可修改、商用、再分发。网站素材示例渲染、用户图、网站文案等不在这项 CC0 资产授权内；本次取得的是实际原 HDR，没有把网站缩略图当成生产素材。

| 原资产 / 作者 | 官方生产文件与 API 校验 | 实际取得的固定镜像 |
| --- | --- | --- |
| [Industrial Sunset Pure Sky](https://polyhaven.com/a/industrial_sunset_puresky)；Jarod Guest 编辑、Sergej Majboroda 原作 | [2K HDR](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/industrial_sunset_puresky_2k.hdr)，4344656 bytes；MD5 `54457ed6fc7e0dcd7fcdcd0603892a7d`；[API](https://api.polyhaven.com/files/industrial_sunset_puresky) | [raw 固定文件](https://raw.githubusercontent.com/2600th/web-ocean-3d/6496c77d37c12e803108c8f932680a7710a62c1c/public/hdris/industrial_sunset_puresky_2k.hdr)，200、原 byte/MD5 完全一致 |
| [Kloofendal Misty Morning Pure Sky](https://polyhaven.com/a/kloofendal_misty_morning_puresky)；Greg Zaal | [2K HDR](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloofendal_misty_morning_puresky_2k.hdr)，2958072 bytes；MD5 `b99e0bb066a0d8134729b9712495d68b`；[API](https://api.polyhaven.com/files/kloofendal_misty_morning_puresky) | [raw 固定文件](https://raw.githubusercontent.com/2600th/web-ocean-3d/6496c77d37c12e803108c8f932680a7710a62c1c/public/hdris/kloofendal_misty_morning_puresky_2k.hdr)，200、原 byte/MD5 完全一致 |
| [Belfast Sunset Pure Sky](https://polyhaven.com/a/belfast_sunset_puresky)；Dimitrios Savva 摄影、Greg Zaal 处理、Jarod Guest 编辑 | [2K HDR](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/belfast_sunset_puresky_2k.hdr)，4563204 bytes；MD5 `4bb56d6163ef1c7ec762e4a7ef8ede81`；[API](https://api.polyhaven.com/files/belfast_sunset_puresky) | [raw 固定文件](https://raw.githubusercontent.com/victorbstan/PanoramaMaker/bbcdd6665b6533f05f0477244483f5dd442e7f2f/assets/hdri/belfast_sunset_puresky_2k.hdr)，200、原 byte/MD5 完全一致 |

前两张另有 [mirror ASSET_LICENSES 专属 CC0 记录](https://github.com/2600th/web-ocean-3d/blob/6496c77d37c12e803108c8f932680a7710a62c1c/ASSET_LICENSES.md)，写明未修改原文件。Belfast 是官方 MD5/长度对应的原始文件，采用原作者官方 CC0 许可，不把镜像软件的 MIT 冒充艺术资产来源。

三图实际皆 2048 × 1024，无原生尺寸不足问题。Industrial 真实主要浅蓝灰云和低金色天际光；Belfast 真实淡紫蓝灰及金白地平线；不因 industrial 名称推断有城市，也不因官方文案提过水面推断 Pure Sky 编辑版有地形。

另外实际读到 [Qwantani Dawn Pure Sky](https://polyhaven.com/a/qwantani_dawn_puresky) 的官方 CC0 页和 [files API](https://api.polyhaven.com/files/qwantani_dawn_puresky)，有 2K 原 HDR 与 8K tonemapped JPG。这个候选本阶段未取得生产像素，仍为合法候选，不能宣称已实看或确定不适合。其全套生产 URL / size / MD5 与前三图 API JSON 同存审计。

**ambientCG**

- [官方许可](https://docs.ambientcg.com/license/) 实读，资产文件及材质预览渲染均 CC0-1.0。
- [HDRI 搜索](https://ambientcg.com/list?type=HDRI)、[实际 v3 API 文档](https://docs.ambientcg.com/api/v3/assets/) 已查。文档明确 `type=hdri`、地平线清除全景和程序全景技术，适合继续寻找纯天空；未预设摄影 HDRI 必有地形。
- 搜到 `DaySkyHDRI001A` 的二级信息；[原资产页](https://ambientcg.com/a/DaySkyHDRI001A) 和具体 v3 API 当前未可取，未用二级尺寸/标签冒充原页实核。它是**访问尚未解决的候选**，不是“ambientCG 没有合适素材”。
- 已取得 Kenney/OGA/PH 的真实可复用源，因此无需靠上述访问失败说明生成是唯一选择。

## 真实视觉与网络证据

OGA 首 11 张对照（工作空间记录：`/tmp/sky-resource-audit/oga-production-comparison.png`）、其余 14 张对照（工作空间记录：`/tmp/sky-resource-audit/oga-remaining-production-comparison.png`） 是取得的真实原 PNG 的缩略排版；没有改原稿或调色。

PH 实际 HDR 三档曝光（工作空间记录：`/tmp/sky-resource-audit/ph-production-exposures.png`）、Belfast 实际 HDR 显示（工作空间记录：`/tmp/sky-resource-audit/belfast_sunset_puresky-reinhard-exp1.png`） 使用已安装 Three.js `RGBELoader` 的 `FloatType` 解码，然后明确应用 Reinhard 与标准 sRGB 显示；参数和 PNG 哈希见 JSON。它们不是官方 tonemapped JPG，也没有宣称 byte 相同。

云端原站请求的错误为 **Tunnel connection failed: 403 Forbidden**，发生在代理 CONNECT，原网站 HTTP status 未取得、记为 null。通过附加网络权限执行公开读取，并保留已有代理；没有直连、删代理变量、映射域名或绕过主机政策。raw.githubusercontent.com 是允许的公开镜像路径，取得目的是真实生产选源和复用。

Web 工具能读官方 HTML/API，但图像点击只返文字 `<<ImageDisplayed>>`，没有真实像素块；不能把它称为“实看”。ZIP 类型不支持及大 JPG 的大小限制是工具限制，也不称为网站 404/403。

查到另一个 3DStreet 雾晨 SDR JPEG 镜像，但其 README 默认 CC BY-SA 并混入 Non-Commercial 条文，未发现资产单独例外；重编码 JPEG 未比官方 byte。本审计采用随后找到的**官方 MD5 精确一致、CC0 来源明确的原 HDR**，没有把这个衍生 JPG 的来源链省略。

原始探测和生产 GET receipts 均合并在 JSON；中间记录保留于 `/tmp/sky-resource-audit/`。原素材及大型显示文件在 raw/tmp，未提交入产品或评审目录。

## 交给作者与 root 的落实项

1. 将实际使用的第三方源登记 `docs/CREDITS.md`：原作者、原页、CC0、固定镜像 URL、文件 SHA256、最终产品文件、实际纬度带/缩放以及任何后续调色或 HDR 显示转换。
2. Kenney / OGA 说明镜像 blob 已核、官方 ZIP 未下载未比较；PH 则可明确原始 HDR 与官方 API 长度/MD5 精确一致。
3. 第二张 PR 说明已真实比较的 OGA/PH 原稿为何未直接采用，分别记录历史生成与新 U0 参考编辑；第三张登记 PH 原作者、原 HDR 身份、标准 SDR exposure 2 全宽参考，再说明真实淡蓝绿 image_gen 改编。**官方 MD5 精确一致仅适用于输入原 HDR，不适用于 AI 改编最终文件。** 最终输出 hash、实际调用与 GPU 审图由作者补齐。
4. 作者导出最终 2048 × 512 后再做全宽接缝、平铺、内圆柱正常 MeshBasic/GPU 视图，独立 patterns_qa 复核最终选源。本审计未跑应用 typecheck/tests，也不虚称完成最终 in-engine 检查。

`Kenney Background Elements` / `Remastered` 的 CC0 组件也已查，可供组合；已有完整 Skyboxes 更直接。OGA _Creature_ 的 Clear/Cloudy Panoramic EXR 原宽为 1024，若作 2048 需上采样，优先现有 2K/4K 原图；这是真实分辨率差异，未用 2:1 比例拒绝它们。
