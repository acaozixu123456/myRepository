# A09-IS 云端雾岛花草：实际审图

本包重新读取三张真实 imagegen 成品，实际捕获同源平铺总览、白光 / 正午色光材质样板和9张原生边缘 PNG。源像素冻结候选01不表示 Claude 审核通过。辅助线程只写 scratch preview-final，root 负责生产复制与 PR #114。

## 来源与规格

root 生成3次 genuine imagegen，真实原稿1254×1254 RGB完整画布，Lanczos等比降至1024²，WebP q90/method6，嵌入588 B frozen-srgb.icc（SHA `36abda2da8f1fbed2f2feee67997812f7ebb1b62b26da313d30de11cdaf35c28`），没有裁切、上采样、人工补缝、重绘或调色。完整args/native路径由root保存在 `../raw/calls-completed.json`、`../island-ground-a09.provenance.json`、`../island-ground-a09.selection-at-export.json`。本辅助实际核对原稿/成品文件尺寸、mode、SHA/RGB/ICC；未重做AI调用或导出。捕获后3源仍完全吻合，见 `capture-source-after.json`。

| source ID | 字节 | SHA256 |
|---|---:|---|
| `ground_island_mint_bloom_01` | 300178 | `bbe226fb0c375e91d8527cb242f38c11022fa773f56b004a24faf1ec270eb040` |
| `ground_island_pink_clover_02` | 479916 | `94534b9fcbc09d21a52a0a9575c0e4d31b67934013101077835342d7c64a9c3e` |
| `ground_island_meadow_mix_03` | 297664 | `d194e553b897bff729e5ba7290d4df941e43be0ade857a2178c24d0cef38f5ca` |

## 基线依赖

基线和最终参数出处均 `67d7bef7b1ad8155b92420daf5f6083289bd97a8`；实际island工作树HEAD `051c7d06ec72de337dabd3066bf64270bb4f40cb`，只有WORLD_PROGRESS为root draft认领变更。与最初3408bbf读取对照，cloud/cloud.data/common/atmos/engine/tex/kit/index/package/lock等渲染参数依赖逐字节相同；WORLD3D与explore官方更新不被独立样板导入，levels在3408→67比较中相同。全部16输入blob及working差异见capture-base-67.json，拍后逐文件再核没有变化，见capture-dependencies-after.json。没有运行游戏、猫模型、引擎QA或重复游戏测试；root required检查另由root记录。

## 实际命令与运行结果

overview捕获 `2026-10-12T05:54:08.709Z`；最终lighting `2026-10-12T05:58:49.813Z`。下面两条最终命令均真实exit0：

```sh
CHROME=/usr/bin/chromium /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node /workspace/world-review/island-ground/preview-final/capture-tools/review-sheet.mjs --config /workspace/world-review/island-ground/preview-final/capture-config.json
CHROME=/usr/bin/chromium /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node /workspace/world-review/island-ground/preview-final/capture-tools/material-preview.mjs --config /workspace/world-review/island-ground/preview-final/capture-config.json
```

Three包0.169.0、运行REVISION169、WebGL成功；实际renderer `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`。Chromium `/usr/bin/chromium`，viewport2048×1024、deviceScaleFactor1，参数 `--no-sandbox --disable-dev-shm-usage --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`。本地字体与隔离HTTP服务，不请求远程字体。两个最终capture均加载3/3、pageErrors/requestFailures/console警告错误为空；真实模块/配置/工具SHA和请求数组在overview/lighting JSON。

首次lighting模板过滤为8，已把PNG/WebP/JSON/log完整留lighting-aniso8-history，改为当前cloud.mk的min(4,max)后实际重拍lighting。最终JSON实际anisotropy[4,4,4]，时间与工具SHA已更新；这次两版PNG/WebP字节偶然相同。overview和9native/source没有重拍或修改。

## 材质与光照

独立样板是PlaneGeometry8×8，X旋转−π/2，repeat2×2（每轮4单位）；不是游戏截图，不导入world引擎。当前游戏cloud用CircleGeometry29.2、repeat5×5（跨岛径58.4，约11.68单位/轮）、y=.3。source-derived材质MeshStandardMaterial白色、roughness.95、metalness0；cloud构造未设置metalness，默认0，common.groundPlane的.02不用于本图。

贴图SRGBColorSpace、RepeatWrapping、rotation0、flipYtrue、实际anisotropy4，renderer输出sRGB。RoomEnvironment PMREM sigma.04、env.3、ACESFilmicToneMapping曝光.92，相机FOV40/位置[5.7,7.5,8.5]/lookAt原点。

上排：中性hemisphere skyffffff / ground777777、强度.7，sunffffff、强度1.35、位置[-22,70,30]。下排：ATMOS.mist的sky eaf4ff / ground9ab0d8，同强度.7，sun fff8e8，同强度1.35、同位置。只有灯色变化，源图、相机、材质、灯强/方位、repeat、曝光和Room环境完全一致。

没有fog/shadow/bloom/grade/post/normal/displacement/roughness map；没有独立场景花朵或跟随光遮住source。游戏mist还有雾/调色/云等，本图仅表现受控材质样板，没有假装接入效果。

## 平铺与原生证据

overview2048×1024的每行：单张256²缩略、2×2每格128²、4×4每格64²，以及256²原生LR/TB/四角。纹理直接重复3个最终WebP，不绘接缝线/遮罩、不改色。native按整数坐标1:1：LR右[896,384,128,256]接左[0,384,128,256]；TB下[384,896,256,128]接上[384,0,256,128]；四角各128²中央交会，矩形完整记录在overview JSON。

9个PNG共589824 RGB像素与解码source原片逐像素全等。这是裁片忠实性证明，不是严格无缝证明。native最大181321 B。截图overview以q86/method6 WebP压到494536 B，lighting q92/method6为216444 B；仅压缩审图截图，source与9个native无损证据不被重编。

## 实看与限制

已实看3张完整source、overview、最终anisotropy4的lighting和9个native局部。检查位置没有贯穿的整条硬亮暗带；局部草/叶/花碎形仍有接合不完全连续的边界，不承诺严格逐像素周期无缝。独立全周期QA另在independent-qa记录。

薄荷与混合草甸的乳白/粉或蓝/黄小花保持点缀，苜蓿叶片更圆更密，source/overview中可区分；这个2×2斜俯平面远尺度中花瓣成为小色点，细节较弱。本图没有通过加深材质、修改源色/对比或曝光制造更强细节。

## 建议交付

全部11图为POT且<500000 B，root可按review-delivery.json路径/尺寸/字节/SHA复制；原始PNG、工具、日志和初次8过滤history仅留scratch。未复制生产、提交或批准。

| 文件 | 尺寸 | 字节 | SHA256 |
|---|---|---:|---|
| `island-ground-a09.webp` | 2048×1024 | 494536 | `690be078f29758fc955a97fb7320a884f5217fd31146ce7e47b078d093c8405d` |
| `island-ground-a09-lighting.webp` | 2048×1024 | 216444 | `b694f9ef093bb948f4c5f0bc7ec7987f8bb6002f6d92373e6deb34e03634507a` |
| `island-ground-a09-ground_island_mint_bloom_01-native-lr.png` | 256×256 | 154570 | `78c83b4bfc1650f6af0858f7b602b03ee6e6c06138484bab43e4f25321e4fa98` |
| `island-ground-a09-ground_island_mint_bloom_01-native-tb.png` | 256×256 | 152296 | `954d2d207b53dec0086032157c4ec5019b8e1d1e1008c3b01177cb10645e1446` |
| `island-ground-a09-ground_island_mint_bloom_01-native-corners.png` | 256×256 | 152452 | `b9bc761ea39df1fbf449f804207308af09d3c9be5e4bd9c39ec2ebdf7b237725` |
| `island-ground-a09-ground_island_pink_clover_02-native-lr.png` | 256×256 | 181321 | `f6fe7da874ea7baa8be010c734f6e3e53b40fda0333995146859189b1597aa62` |
| `island-ground-a09-ground_island_pink_clover_02-native-tb.png` | 256×256 | 180338 | `c01bd34d3b057ab6149a9c1f53c6ec438b590f65df2866a808559512020b4d58` |
| `island-ground-a09-ground_island_pink_clover_02-native-corners.png` | 256×256 | 179303 | `c93718bf8b14f61d338c791e7a93c6ebc3a84c55b7be543fc2ec3f4a72b1efa8` |
| `island-ground-a09-ground_island_meadow_mix_03-native-lr.png` | 256×256 | 149010 | `43c843fc452a87f7a1d0ad285f537bb90c77a099f57f2e72171db3eb09f31b79` |
| `island-ground-a09-ground_island_meadow_mix_03-native-tb.png` | 256×256 | 152397 | `9d81d446c95dec6a038bdf746d95f726ade135ada8341d2e718cdad4e3a7d6db` |
| `island-ground-a09-ground_island_meadow_mix_03-native-corners.png` | 256×256 | 153134 | `5e5b6202be430291e07bb964282babe3b13406e92042429ad6f7cddadad2a019` |

冻结库存见freeze-manifest.json。三张exports、raw、provenance、其他helper与旧body47文件没有被本辅助修改；若root改变源SHA，需要新的真实capture，而不是重标旧图。
