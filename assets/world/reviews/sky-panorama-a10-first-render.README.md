# A10 天空实际 Three.js 无光照圆柱环视

[正式图](sky-panorama-a10-first-render.webp)：2048 × 1024 RGB sRGB，66,554 B，WebP quality 85 / method 6；原始截图 PNG 留在工作空间，出处保存 SHA。三行素材依次为 Kenney CC0 直接适配、AI 赤云 fallback 三次参考编辑、PH CC0 原雾标准 SDR 直接适配，标签明确混合来源。

每行左列看 U0 / U1 周期接边（yaw 0），右列看对侧（yaw 180），均 pitch 0。同一成品、同一白色 MeshBasic 材质、相机与参数，真实 GPU 渲染；没有平面假合成或产品引擎接入。

| 项目 | 实际设置 |
| --- | --- |
| Three | r169；Chromium `/usr/bin/chromium` / ANGLE SwiftShader |
| 几何 | CylinderGeometry，半径 64，高 `2π×64/4 = 100.530965`，径向分段 128、高度段 1、openEnded true |
| 正尺度 / UV | scale `[1,1,1]`、世界矩阵 determinant 1；默认圆柱 UV，接边在 +Z，没有 UV 编辑、负尺度反转或镜像 |
| 材质 | 白色 MeshBasicMaterial、BackSide、toneMapped false、transparent false；无灯光 |
| 纹理 | sRGB、repeat `[1,1]`，S RepeatWrapping、T ClampToEdgeWrapping，anisotropy 4，mipmap + LinearMipmapLinearFilter / LinearFilter |
| 相机 | PerspectiveCamera，fov 30，aspect `1024/288`，near 0.1，far 1000，中心 `[0,0,0]`，up +Y |
| 方向 | `lookAt(sin(yaw)cos(pitch), sin(pitch), cos(yaw)cos(pitch))` |
| 渲染 | 每面板 1024 × 288，DPR 1，抗锯齿、preserveDrawingBuffer，输出 sRGB、NoToneMapping、exposure 1 |
| 未使用 | fog、bloom、调色、阴影、场景物体、太阳光盘、sky dome caps |

实际初次加载与 reload 各下载三图：6 个 HTTP 200，body SHA-256 均与最终成品吻合，源文件拍前/拍后 SHA 恒定，page errors / console errors / failed requests 均 0。每次加载，三张材质各做 24 个 yaw（0..345，步长15）×3 个 pitch（-20 / 0 / 20）=216 次环视 probe，然后 6 个正式视图；两次共 432 probe + 12 featured = 444 次实际渲染，每帧 draw call 1。RGBA FNV1a 为诊断记录，不充当加密哈希。

临时 HTML、实际捕获脚本、完整逐帧 / HTTP / 材质报告、原 PNG 以及编码说明在作者工作空间；仓库[出处](../skies/sky-panorama-a10-first.provenance.json)包含全部路径、哈希与实际报告。不是仅声明 sweep 参数而未运行。精确 GPU 比较使用原 PNG RGBA，正式 WebP 有损不能声称与其逐像素相同。

样板是开口圆柱，没有上下天空封顶；正式视图只显示部分天空高度，原生 512 高 LR PNG 覆盖全部行。当前视角黄昏多为桃粉雾；赤云仍有细微颜色相位差，4 倍重复存在低频周期；现用原晨雾是浅灰蓝，绿色 / 云体不足，未强造色调。本批仅提供不透明天空纹理，不提供 HDR 环境照明、深度或动画。第 1 轮待审，Claude 通过 0。[独立 QA](../skies/sky-panorama-a10-first.qa.md)。
