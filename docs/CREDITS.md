# 第三方素材与许可

| 内容 | 来源 | 许可 |
| --- | --- | --- |
| 界面图标（`src/ui/noto.ts`） | [Noto Emoji](https://github.com/googlefonts/noto-emoji)（Google），通过 [@iconify-json/noto](https://www.npmjs.com/package/@iconify-json/noto) 取得 SVG | Apache License 2.0 |
| 页面文字里的 emoji（`src/ui/emoji.ts` + `emojify.ts` 运行时替换为内嵌矢量图，所有设备长得一样） | 同上 Noto Emoji；emoji → 名称对照用 [unicode-emoji-json](https://www.npmjs.com/package/unicode-emoji-json)（MIT） | Apache-2.0 / MIT |
| 地面贴图（`assets/world/ground/cc0_*.webp`，已缩到 512²）：云岛草地 Grass005、沙漠风纹沙地 Ground080、雪岭雪地 Snow014、海湾沙滩 Ground093C 与湿沙滩涂 Ground054（森林草地、码头木栈板改用 Codex 的 AI 贴图，更贴合场景色调） | [ambientCG](https://ambientcg.com/)（Lance / Struffel Productions） | CC0（公有领域） |
| 3D 库 | [three.js](https://threejs.org/) | MIT |
| 橘粉黄昏天空（`assets/world/skies/sky_dusk_peach_01.webp`），原稿 `skybox-morning.png` | Kenney，[Skyboxes 官方页面](https://kenney.nl/assets/skyboxes)与[作者 OpenGameArt 页面](https://opengameart.org/content/skyboxes-1)；生产 PNG 取自[固定提交的公开镜像](https://raw.githubusercontent.com/shorepine/kenney/3694c6879e487c108f55677be7dd2ca75b07cc3b/2d/Skyboxes/Skyboxes/skybox-morning.png) | CC0（公有领域）；全 360° 宽度取天空纬度带后等比缩小 |
| 浅灰蓝清晨薄雾（`assets/world/skies/sky_dawn_tealmist_03.webp`）的生产原稿 `kloofendal_misty_morning_puresky_2k.hdr` | Greg Zaal，[Poly Haven 原资产](https://polyhaven.com/a/kloofendal_misty_morning_puresky)与[CC0 许可](https://polyhaven.com/license)；原 HDR 取自[固定提交的公开镜像](https://raw.githubusercontent.com/2600th/web-ocean-3d/6496c77d37c12e803108c8f932680a7710a62c1c/public/hdris/kloofendal_misty_morning_puresky_2k.hdr) | CC0；原 HDR → 标准 SDR 天空带 → WebP，最终没有使用 AI 编辑 |

按钮上的 ✕ / ✔ / ＋ / ⬆ 等功能符号为自绘。新增第三方素材请先确认许可（优先 CC0 / MIT / Apache 2.0），并在此登记。

Kenney 天空原稿为 4096 × 2048；采用零起点、右下边界不含在内的裁框 `[0, 640, 4096, 1664]`，得到 4096 × 1024 的完整环视天空带，再等比缩至 2048 × 512。上方太阳位于选区之外，未绘图去除。原 PNG SHA-256 为 `7b445e959e7e65c2aad962028826434fda90d7b21f00f451767344970efa9e1e`，固定镜像 Git blob SHA-1 为 `356211662ac9020e2e59166bff0c7babb7d2c529`。下载获得 HTTP 200 且与该固定提交的 blob 一致；没有与受工具限制的官方 ZIP 逐字节比较。许可依据作者两处 CC0 发布声明，不引用镜像根目录针对 Castle Kit 的 LICENSE。

Poly Haven 雾晨输入 HDR 为 2048 × 1024、2,958,072 B，SHA-256 `a59683cd08861fb18d69ee8f3938f50ec81c6feda5381e8b8576f340d5a25bb1`。其长度及 MD5 `b99e0bb066a0d8134729b9712495d68b` 与[官方 files API](https://api.polyhaven.com/files/kloofendal_misty_morning_puresky) 一致。使用 Three.js r169 RGBELoader FloatType 解码，Reinhard 曝光 2 与标准 sRGB 转换，取完整 360° 宽度上半天空带 `[0,0,2048,512]`，原生 2048 × 512，不缩放 / 不改变比例，直接编码 RGB sRGB WebP。最终使用浅灰蓝原雾，没有程序艺术调色或 AI 编辑；绿色不足、云体弱如实交审。两张淡蓝绿 AI 编辑因实际圆柱有稳定青色竖缝而失败且 unused，完整历史保留。官方 MD5 只验证输入 HDR，标准 SDR / WebP 是明确记录的常规转换，不是原 HDR 字节。全部转换参数、历史真实调用与输出哈希见 [SKY 出处](../assets/world/skies/sky-panorama-a10-first.provenance.json)。

## A12 柔边云朵 CC0 参考与 AI 改编

`assets/world/clouds/cloud_sprite_cumulus_atlas_01.webp`、`cloud_sprite_wisps_atlas_02.webp`、`cloud_sprite_scattered_atlas_03.webp`：真实AI参考编辑作品，输入为 WickedInsignia / OpenGameArt 的 [Clouds with Transparency](https://opengameart.org/content/clouds-with-transparency)，[FX_CloudAlpha01.png](https://opengameart.org/content/clouds-with-transparency-fxcloudalpha01png)、[04](https://opengameart.org/content/clouds-with-transparency-fxcloudalpha04png)、[05](https://opengameart.org/content/clouds-with-transparency-fxcloudalpha05png)，作者逐文件声明 [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/)。许可允许改编；最终512²生成改编文件不是官方原PNG，也没有将官方许可声明为工具新输出的原件证据。

生产输入来自固定镜像：01/04为 [NoahOppy/Castle-Conquest d7d8451](https://github.com/NoahOppy/Castle-Conquest/tree/d7d8451d8a30635c45322e908d69d5c4f59a59cf/Assets/fx_cloudalphas)，05为 [YuriNikolai/StrangeWinds 9b50080](https://github.com/YuriNikolai/StrangeWinds/blob/9b50080be41c66032909a7b51b9694298d00db89/gfx/fx/FX_CloudAlpha05.png)，其[README逐项署名CC0](https://github.com/YuriNikolai/StrangeWinds/blob/9b50080be41c66032909a7b51b9694298d00db89/README.md)。原PNG分别2048²，SHA256为 `53bbdc9d10cd37f4386f339aa2f846f96d5e152ea34a618b0d04ae52b918dde0` / `72b2fdc48f271aea089fa391867f0fb72158db2cbb28828149fdd64d614da489` / `5cae51b43d8d7dbb4b9d8e1f8830d4120ef1cd9f95690f4c5f58afb0c2b0f339`；固定Gitblob与下载size均吻合，05在两镜像字节同；没有用游戏代码根LICENSE冒套云源。官方PNG GET受CONNECT403而未比对官方原字节，身份链和限制如实记录。

仅用于来源比较审图、未用于最终改编的像素：Kenney Vleugels [Particle Pack](https://kenney.nl/assets/particle-pack) CC0，Calinou镜像 `ab7086639ee73be31abd87feb21bf1402d4e8144` 的 smoke01～03＋包独立LICENSE；bonecandy [Clouds](https://opengameart.org/content/clouds-9) CC0，Alexakamm/Dimensions镜像 `4ad38e34c3f9470cd571070b87e9acf36a4cdbd2` 的三UUID PNG；以及WickedInsignia 02/03/06。选源前12原稿真实GET/alpha/视觉取舍见 [源比较](../assets/world/clouds/cloud-sprites-a12.source-search.md)、[机器审计](../assets/world/clouds/cloud-sprites-a12.source-search.json)。原图没有程序染色/抠底/抹边；最终三次工具参数、引用链、原稿及成品hash见 [出处](../assets/world/clouds/cloud-sprites-a12.provenance.json)。
