# 第三方素材与许可

| 内容 | 来源 | 许可 |
| --- | --- | --- |
| 界面图标（`src/ui/noto.ts`） | [Noto Emoji](https://github.com/googlefonts/noto-emoji)（Google），通过 [@iconify-json/noto](https://www.npmjs.com/package/@iconify-json/noto) 取得 SVG | Apache License 2.0 |
| 页面文字里的 emoji（`src/ui/emoji.ts` + `emojify.ts` 运行时替换为内嵌矢量图，所有设备长得一样） | 同上 Noto Emoji；emoji → 名称对照用 [unicode-emoji-json](https://www.npmjs.com/package/unicode-emoji-json)（MIT） | Apache-2.0 / MIT |
| 地面贴图（`assets/world/ground/cc0_*.webp`，已缩到 512²）：云岛草地 Grass005、沙漠风纹沙地 Ground080（森林草地、码头木栈板改用 Codex 的 AI 贴图，更贴合场景色调） | [ambientCG](https://ambientcg.com/)（Lance / Struffel Productions） | CC0（公有领域） |
| 3D 库 | [three.js](https://threejs.org/) | MIT |
| 橘粉黄昏天空（`assets/world/skies/sky_dusk_peach_01.webp`），原稿 `skybox-morning.png` | Kenney，[Skyboxes 官方页面](https://kenney.nl/assets/skyboxes)与[作者 OpenGameArt 页面](https://opengameart.org/content/skyboxes-1)；生产 PNG 取自[固定提交的公开镜像](https://raw.githubusercontent.com/shorepine/kenney/3694c6879e487c108f55677be7dd2ca75b07cc3b/2d/Skyboxes/Skyboxes/skybox-morning.png) | CC0（公有领域）；全 360° 宽度取天空纬度带后等比缩小 |
| 浅灰蓝清晨薄雾（`assets/world/skies/sky_dawn_tealmist_03.webp`）的生产原稿 `kloofendal_misty_morning_puresky_2k.hdr` | Greg Zaal，[Poly Haven 原资产](https://polyhaven.com/a/kloofendal_misty_morning_puresky)与[CC0 许可](https://polyhaven.com/license)；原 HDR 取自[固定提交的公开镜像](https://raw.githubusercontent.com/2600th/web-ocean-3d/6496c77d37c12e803108c8f932680a7710a62c1c/public/hdris/kloofendal_misty_morning_puresky_2k.hdr) | CC0；原 HDR → 标准 SDR 天空带 → WebP，最终没有使用 AI 编辑 |

按钮上的 ✕ / ✔ / ＋ / ⬆ 等功能符号为自绘。新增第三方素材请先确认许可（优先 CC0 / MIT / Apache 2.0），并在此登记。

Kenney 天空原稿为 4096 × 2048；采用零起点、右下边界不含在内的裁框 `[0, 640, 4096, 1664]`，得到 4096 × 1024 的完整环视天空带，再等比缩至 2048 × 512。上方太阳位于选区之外，未绘图去除。原 PNG SHA-256 为 `7b445e959e7e65c2aad962028826434fda90d7b21f00f451767344970efa9e1e`，固定镜像 Git blob SHA-1 为 `356211662ac9020e2e59166bff0c7babb7d2c529`。下载获得 HTTP 200 且与该固定提交的 blob 一致；没有与受工具限制的官方 ZIP 逐字节比较。许可依据作者两处 CC0 发布声明，不引用镜像根目录针对 Castle Kit 的 LICENSE。

Poly Haven 雾晨输入 HDR 为 2048 × 1024、2,958,072 B，SHA-256 `a59683cd08861fb18d69ee8f3938f50ec81c6feda5381e8b8576f340d5a25bb1`。其长度及 MD5 `b99e0bb066a0d8134729b9712495d68b` 与[官方 files API](https://api.polyhaven.com/files/kloofendal_misty_morning_puresky) 一致。使用 Three.js r169 RGBELoader FloatType 解码，Reinhard 曝光 2 与标准 sRGB 转换，取完整 360° 宽度上半天空带 `[0,0,2048,512]`，原生 2048 × 512，不缩放 / 不改变比例，直接编码 RGB sRGB WebP。最终使用浅灰蓝原雾，没有程序艺术调色或 AI 编辑；绿色不足、云体弱如实交审。两张淡蓝绿 AI 编辑因实际圆柱有稳定青色竖缝而失败且 unused，完整历史保留。官方 MD5 只验证输入 HDR，标准 SDR / WebP 是明确记录的常规转换，不是原 HDR 字节。全部转换参数、历史真实调用与输出哈希见 [SKY 出处](../assets/world/skies/sky-panorama-a10-first.provenance.json)。
