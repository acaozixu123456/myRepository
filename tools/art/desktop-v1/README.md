# 独立美术制作与检查

所有命令从仓库根目录执行。只处理四个 `desktop-v1` 美术目录。不要使用游戏开发服务器、游戏构建配置、NHK 回归或部署命令。

## 工具准备

Blender 4.5.9 LTS Intel 已在本机 `/Users/xiaruonan/nihongo-art-work/toolchain/Blender.app` 验证；其他机器可用官方兼容版本。Python 需要 Pillow/numpy；纹理字体使用 PROVENANCE.md 记录的 Noto Sans JP 与校验值。

浏览器依赖请放在仓库外的工具目录。以下固定文件可通过正常 HTTPS 下载：

- `https://cdn.jsdelivr.net/npm/babylonjs@9.25.0/babylon.js`
- `https://cdn.jsdelivr.net/npm/babylonjs-loaders@9.25.0/babylonjs.loaders.min.js`

GLB 验证使用 `gltf-validator@2.0.0-dev.3.10`；浏览器验证使用 Playwright。不要为本次素材编辑主项目 package.json 或锁文件。完整依赖来源见 PROVENANCE.md。

## 从脚本重建

实际命令（替换为你的 Python、Blender、字体绝对路径）：

```sh
python tools/art/desktop-v1/make_textures.py --font /path/to/NotoSansJP.ttf
blender --background --factory-startup --python tools/art/desktop-v1/build_shop.py
blender --background --factory-startup --python tools/art/desktop-v1/build_keeper.py
python tools/art/desktop-v1/inspect_assets.py
```

这会覆盖本批次生成的 GLB 和 `.blend`；若已人工精修源文件，请使用“编辑后再导出”，而不是重建。

## 编辑后再导出

```sh
blender --background --python tools/art/desktop-v1/export_blend.py -- shop
blender --background --python tools/art/desktop-v1/export_blend.py -- keeper
python tools/art/desktop-v1/inspect_assets.py
```

`export_blend.py` 从交付 `.blend` 读取对象，保留源文件中的造型，导出时才转换与按材质合批。`optimize_glb.py` 自动移除不被材质引用的 UV/切线属性及未引用 payload；有法线贴图的材质始终保留切线。角色源文件保存的是静止姿态，三条 NLA 轨可在 Blender 中分别解除静音播放。

## 独立预览

```sh
python tools/art/desktop-v1/serve.py --vendor /path/to/viewer-vendor --port 8766
```

打开 `http://127.0.0.1:8766`。服务器仅绑定 loopback，只提供美术和预览路径，不提供整个仓库、账户数据或密钥。鼠标拖动旋转，滚轮缩放；底部选择视角、灯光或动画。

## 真实导出与浏览器检查

```sh
node tools/art/desktop-v1/validate.mjs
node tools/art/desktop-v1/capture.mjs
node tools/art/desktop-v1/benchmark.mjs
node tools/art/desktop-v1/blink-proof.mjs
```

如果依赖装在工具目录，设置 `GLTF_VALIDATOR_MODULE` 或 `PLAYWRIGHT_MODULE` 为相应模块入口的绝对路径。`CHROME_EXECUTABLE` 可指定本机 Chrome。浏览器必须能真正启用硬件加速；不要添加 SwiftShader 参数。`capture.mjs` 用 Chrome 内建 VP9 MediaRecorder 保存实际画布，无需 ffmpeg；`benchmark.mjs` 不录像，专门测持续帧时。两者顺序运行，避免相互争用 GPU。测量期间不要同时运行 Blender 离线渲染。

离线渲染是另一种证据，与浏览器测量分开运行：

```sh
blender --background --python tools/art/desktop-v1/render_still.py -- shop
```

所有截图/视频/日志在 `docs/art/desktop-v1/evidence`。资产验收与完整街道整合由 Sol 完成。运行这些工具不会执行 NHK 回归。
