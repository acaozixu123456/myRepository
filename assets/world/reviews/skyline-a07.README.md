# WORLD A07 天际线审图

源文件 [`skyline_catcity_01.webp`](../skyline/skyline_catcity_01.webp)：2048×1024、RGB、sRGB、131512 B。

源 SHA256：`dcb985c1c4be090e90a79bf171456b22724a6f47fd0b43b73ab57686ac5bcc32`。

原生 AI 输出 1774×887，经约 1.15445× 等比 Lanczos 上采样到规定的 2048×1024；provenance 记约 15.44% 上采样，不称为原生 2048 输出。二张初稿与 offset 后 AI 接缝修复的 C3 选择过程见 [`skyline-a07.provenance.json`](../skyline/skyline-a07.provenance.json)。本次预览没有改动生产图像。

## 审图

- [`skyline-a07.webp`](skyline-a07.webp)：2048×1024，164908 B，POT。完整原图、左右边缘直接拼接、上下原像素、三张独立柱面视角。
- [`skyline-a07-native-edge.png`](skyline-a07-native-edge.png)：512×1024，221531 B，POT。成品右端 256 列接左端 256 列，保留 1:1 源像素，没有缩放、接缝遮罩、融合带或重着色；接缝在 x=256。

原图保持 2:1 完整构图。源图为 RGB，不含透明通道，顶端靠深紫渐变过渡，底端建筑剪影淡入暗紫雾。

实际观察：在 0° 柱面样板、缩略边缘拼接与 1:1 边缘局部中，没有看到贯穿天空及楼体的明显硬竖线，所见桥段没有明显中断。这是上述文件和取景尺度下的视觉观察，不声称严格像素完全无缝。

## 独立柱面设置

Three.js r169，Chromium `/usr/bin/chromium`，ANGLE/SwiftShader，独立 Vite 5180。未使用 WorldView 或游戏场景引擎，审图注明「非游戏截图」。

- 贴图 `SRGBColorSpace`，横向 RepeatWrapping / 纵向 ClampToEdgeWrapping，repeat=(1,1)，anisotropy 最多 8。
- 白色 `MeshBasicMaterial`、BackSide、toneMapped=false。RGB 文件实际全不透明；材质保留 transparent 标志以支持背景预览。
- 仅在柱面几何中令 u=1-u，抵消从内壁观察的方向反转，保证源图左右阅读顺序；源文件像素没有改变。
- 半径 10，高度 31.41593，径向 128 段，开口圆柱。展开周长与高度之比为源图的 2:1。
- PerspectiveCamera FOV=60°，位置 (0,-6.91150,0)，yaw=0°/+120°/−120°；0° 正对 UV 接缝。右下两个画布长宽比不同，因此水平视野不同，垂直 FOV 和相机高度相同。
- 深紫背景 #160d2a；无灯光、无 bloom、NoToneMapping、sRGB 输出。没有二次压暗或后期调色。

左右边缘区使用同一最终 WebP 的 CSS background-repeat（980×490 显示尺度），中线为右端接左端。上下边缘区同样显示最终文件的顶端和底端，未另加渐变或填色。独立 Three 只导入 three 模块。

## 实际执行与核对

```bash
# 工作目录 /workspace/world-worktrees/skyline
npm run dev -- --host 127.0.0.1 --port 5180 --strictPort
node /workspace/world-review/skyline/skyline-preview.mjs assets/world/skyline/skyline_catcity_01.webp --sha=dcb985c1c4be090e90a79bf171456b22724a6f47fd0b43b73ab57686ac5bcc32
```

源图实际加载 2048×1024 成功，pageErrors=[]，拍摄前后源哈希一致。最终审图为浏览器截图，经 8 位输出及 q90 / method6 WebP 技术压缩。参数与运行记录见 scratch `/workspace/world-review/skyline/skyline-a07.json`。
