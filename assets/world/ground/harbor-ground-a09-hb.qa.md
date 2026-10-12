# A09-HB · 赤壁港木栈板独立 QA

独立复核三张源材质、出处、重复 / 原生边缘和实际 Three 材料样板，通过并保留以下视觉观察。本批第 1 轮待审，不表示 Claude 已批准；仅入库，没有接入游戏。

| 材质 | 字节 | 冻结 SHA256 |
| --- | ---: | --- |
| `ground_harbor_oldwood_01` | 226494 | `badd00fd601d098b54e49465408e34e41da1009ef480d7125b1f805718dfac8f` |
| `ground_harbor_washed_02` | 217848 | `783d4c8dea1425da841967b3fe415fbb42dee08e485c40a2ed16939c0f3fda6d` |
| `ground_harbor_narrowwood_03` | 236820 | `f1753733f9ac37d91bc1719e4aacf5ba4da3921d3f9af753ce685eccaa9d4b89` |

三图皆 1024²、RGB、全不透明，嵌入 588 B sRGB ICC、无 ALPH 通道，全部 <500000 B。核对 [出处](harbor-ground-a09-hb.provenance.json) 最终 SHA `e228b57570988feb5679e3c2ddb6655f854f27b430e3ea779c3aeb1b51fe63cf`；Pillow / WebP 版本与全部逐项记录见 [机器报告](harbor-ground-a09-hb.qa.json)。

## 来源与重建

独立读取保存的三份真实 `image_gen.imagegen` 调用记录及对应原图：实参、完整提示词、输出路径 / 标识、1254² RGB 尺寸、字节与 SHA 均和出处相同。三份各独立生成，transparent_background=false，没有编辑 / 引用图 / 复制旋转凑数。没有重放收费生成调用；验证依据原始调用返回与实际文件，而非文件名。三个原稿均已实看。

所选原稿完整画布等比 Lanczos 降为 1024²，按 quality90 / method6、复用交付嵌入 ICC 独立导出，3/3 WebP 逐字节相同、解码 RGB 差 0。复用 ICC 固定其原生创建时间戳；除该时间字段外，它与当前 LittleCMS 标准 sRGB profile 相同。没有裁切、上采样、程序绘木纹 / 接缝、混合遮罩、补画、调色、锐化或 Alpha 改写。这不声称原 PNG 与有损 WebP 像素相等。

独立重建 9 张原生 PNG：完整边界 right64｜left64、bottom64 / top64，以及 BR128｜BL128 / TR128｜TL128 四角；9/9 与最终 WebP 解码的 RGB 差 0。六张 2×2 / 4×4 审图按记录缩小单格后直接重复并编码，6/6 文件重建字节相同。合计 33 项离线断言，无失败。以上原生证据、六张平铺、总览与白 / 晚霞光图均实看。

| 材质 | LR 外列 RGB MAE | TB 外行 RGB MAE |
| --- | ---: | ---: |
| 暖旧褐宽板 | 22.175 | 8.272 |
| 浅漂洗板 | 36.938 | 10.194 |
| 暖窄板 | 10.307 | 8.287 |

这是最外一行 / 列的通道绝对差均值，范围 0–255；不等于视觉接缝评分。LR 拼接落在普通板缝上，灰缝与两边木色不同会产生非零值；TB 木纹继续纵向延伸。有限尺度未见额外宽边框、大块断面、横梁或明显双重接缝，不能称数学逐像素无缝。

最不满意：4×4 可辨单板色差周期；细木纹在小足迹趋平，GPU 样板每纹理投影约 307px、窄板约 26px。晚霞灯色明显把三材质推成橘红，原基色没有随之重调。接入方按真实地面面积控制 UV；不是完全无边缘明暗的理想实验室 albedo。

## 实际加载与材质

独立 Chromium / SwiftShader 对临时 HTML 做只读 render 观察，不修改几何、灯光或材质。禁用缓存并加唯一查询串，首次加载后实际 reload：每次三贴图供六白 / 晚霞光面板共享，共 6 次实际纹理下载、12 次面板渲染。六 HTTP200 响应 body SHA 全与上表对应源图相同；页面 / 控制台 / 请求错误 0，三源图审核前后哈希不变。

实际 Three r169、白色 MeshStandardMaterial、roughness0.9 / metalness0 / opacity1，SRGBColorSpace、双轴 RepeatWrapping、repeat[3,1]、offset0、rotation0、anisotropy4；每面板 1 draw call。18×6 地面正交顶视、DPR1、sRGB 输出、ACESFilmic、exposure1.1，无泛光 / 阴影。

两列仅换光色：白 hemi `#ffffff / #777777`、sun `#ffffff`；右列 ATMOS.redcliff 的 hemi `#ffa080 / #40242c`、sun `#ff7a3a`。两列 hemi 强度0.95、sun强度2.3、position[10,20,-52] 相同。[完整参数](../reviews/harbor-ground-a09-hb-lighting.README.md)。最初复用的夜市断言把粗糙度写死为0.85；检查 actual 与港口声明0.9一致后修正断言，复核通过，第一次记录留 /tmp，不是材质或页面失败。

独立正常截图与作者最终原始 GPU PNG 的 RGB 差 0；交付光照 WebP 按 quality85 / method6 与原 ICC 独立重导出，文件逐字节一致。该 GPU 审图本身有损，源通道精确证明来自独立导出与无损边条。该样板未模拟整场景天空、雾、后处理和遮挡；不声称游戏已使用本批纹理。最新 e777 主分支的 typecheck 与 68 文件 / 1019 测试由素材作者实际运行，另见出处，未算作本独立 QA 的运行结果。
