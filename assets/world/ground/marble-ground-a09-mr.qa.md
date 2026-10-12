# WORLD A09-MR 独立 QA

三张汉白玉素材通过独立导出、边缘和材质加载检查；本次未发现需要图像返修的明显接缝粗带或异色方框。边缘不逐像素相等，金纹端点与云纹重复周期的限制见下文。正式提交基线 `29f6a8b` 的作者检查已通过；独立检查在 `e777d58` 观察到的日期测试失败完整保留，未把它改写为通过。

## 冻结范围与生成记录

制作与独立测试基线为 `e777d58f3b0e9965f7af25ded73948a84e68d219`；作者随后正常快进到 `29f6a8bbe66bbcf4ea1c0119675cac65f8c4e00a`。三素材、17张正式图及 `palace.ts`、`atmos.ts`、QUEUE、WORLD3D 在本次素材检查期间保持一致。最终 provenance SHA256 为 `264fc7761d86b627515c3330a37a972cee5cb7b8013f5911406df51a53867d8a`。

逐项核对归档的3次 `image_gen.imagegen` 生成记录、完整 prompt、tool arguments、输出路径与原稿 SHA/尺寸/字节；均为 candidate1，`transparent_background:false`，没有参考图、编辑调用或弃选。返回路径下的三张原稿均真实存在，RGB、1254²。三张生产图只取原稿全幅 `[0,0,1254,1254]`，Lanczos 比例缩小到1024²，再用 WebP q90/method6 编码；未裁切、放大、回移、画缝、混合遮罩或调色。独立使用最终 ICC payload 重导出，三文件字节完全一致，解码 RGB 差0。ICC 与本机 lcms sRGB 除创建时间字段外完全一致。

生产素材均为 RGB、1024²、sRGB、alpha255，没有 ALPH chunk；源 SHA 从离线开始、浏览器两次加载到最终写报告均不变：

- `ground_palace_marble_milk_01`: `4036032957926521ec13ba12d182c7991a32fb543421a8e7ffdd576d48882d33`
- `ground_palace_marble_gold_02`: `8c5a6821a7dfa69c05239ee655584c1b103db7bcbead45044fed4abe87daf56d`
- `ground_palace_marble_cloud_03`: `8f1412af763ae5f7da916f62621537fcab51acedc47da0d0c44f4ab0f60631ff`

## 平铺与原生边缘

已实际查看3张原稿、3张成品、全部17张正式图：1总览、6张2×2/4×4、9张原生边/角 PNG、1张真实 Three 灯光图。另看独立 GPU 原始截图与现有宫阙参考图。六张 repeat 由最终解码图缩到512/256后直接平铺，独立 q85/m6 重编码与正式文件字节一致。九张 PNG 与最终解码 RGB 的预期拼接逐通道差0：LR 为右64|左64，TB 为下64/上64；四角为 BR128|BL128 / TR128|TL128，保持1:1。

以下是最终图最外一列/行的有限诊断；0–255 RGB，每方向3072通道。此数字衡量对边差异，不能单独证明视觉无缝，也没有设定零误差要求。

| 素材 | 文件字节 | LR / TB RGB MAE | LR / TB最大单通道差 |
| --- | ---: | ---: | ---: |
| `milk_01` | 142528 | 6.183 / 5.959 | 73 / 53 |
| `gold_02` | 65828 | 2.137 / 3.009 | 39 / 39 |
| `cloud_03` | 76952 | 2.893 / 4.070 | 23 / 44 |

- `milk_01`：浅奶白细晶均匀，原生边角有细颗粒变化；检查尺度未见突出的直线暗带或外围框。
- `gold_02`：淡香槟金矿物细支；个别支线在接边终止或错相，不能说所有金线精确连成一条曲线。检查尺度没有形成明显粗暗网格；较小的纹理足迹会削弱淡金细节。
- `cloud_03`：浅暖象牙云脉，4×4中可辨重复斜向矿物簇；低频周期保留。检查的原生接边与平铺/GPU图未见突出的粗直边或异色阶跃。

## 实际 GPU 加载

独立 Chromium/Three r169 实例观察，唯一素材 SHA query + CDP 禁用缓存；实际初次加载及 reload 共6个素材 HTTP响应，全部200且 response body SHA与三源文件匹配。每页3个共享纹理、6次 renderer.render，两页总12次；不是12次纹理下载。page error、console error、failed request均0，源与相关模块前后 SHA一致。ANGLE SwiftShader 为本次实际渲染器，不代表移动端性能。

实际观察到白色 `MeshStandardMaterial`、roughness **0.55**、metalness0、opacity1、无透明；贴图 sRGB、RepeatWrapping、repeat `[3,1]`、offset `[0,0]`、rotation0、anisotropy4。白光/宫阙列共用材质与贴图、同正交相机、18×6平面、1024×288画布、DPR1、ACES、exposure **0.9**。只灯色不同：白光 hemi白/灰、sun白；宫阙 hemi `#fff0dc/#8a5a4a`、sun `#ffe8b0`；两列 hemi强度0.62、sun强度1.5及位置 `[42,55,32]`相同。没有雾、天空、bloom、色彩分级或游戏接入。

独立截图与作者 raw PNG完整 RGBA差0。正式GPU WebP与总览均可独立按q85/m6重编码得字节相同；这两张 WebP为有损预览，不声称与原始PNG像素相同。材质区域白/暖光 RGB MAE为17.012 /17.009 /17.096，区域每行 y=`row*336+48..row*336+336`，左右 x=`52..972` /`1076..1996`，均为半开区间；该差异来自实际光色变化。

## 检查结果与边界

独立 `npm run typecheck` exit0。独立 `npm test`（2026-10-12 05:15:19 UTC，e777）exit1：67/68文件、1018/1019测试通过，唯一 `tests/explore.test.ts:59:53` 每日委托收到 `[false,false,false]`，预期 `[true,true,false]`。该未改测试使用固定10月11日 t0，而奖励调用使用当前日期；QA没有改测试、业务代码或系统日期。

作者在 `29f6a8b` 接收上游 `Date.now()` 修复后实际执行 `npm run typecheck && npm test`，session72264整体exit0：68/68文件、1019/1019测试通过（05:20:06 UTC，19.32s）。QA读取完成的实际日志并核验其SHA；这次运行明确归作者，独立失败作为attempt1保留，作者成功为attempt2。

三生产图＋17正式图共20张，最大148920字节；QA md/json也各低于500000字节。制作基线已有115个 world资产文件逐字节保留。只新增本QA的两个文件，完整数值/调用绑定/HTTP记录/图像清单见 [JSON](marble-ground-a09-mr.qa.json)，可视证据见 [总览](../reviews/marble-ground-a09-mr.webp) 与 [灯光](../reviews/marble-ground-a09-mr-lighting.webp)。这是有限素材审核，不是数学无缝证明、实际场景接入验收或真机帧率测试。
