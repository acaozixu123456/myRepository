# 来源、许可与再分发记录

本批次是为“日本散步日记”原创制作的候选游戏素材。没有采购、付费生成、人物扫描、现实人物肖像、Google 街景贴图或第三方商店模型。店名沿用交接分支的虚构“よりみち弁当”。本文件不改变整个仓库的许可证，也不主张 AI 输出具备排他版权。

| 内容 | 精确来源 / 制作方法 | 修改、交付与再分发说明 |
|---|---|---|
| 店铺、室内、道具模型 | 本目录对应 `tools/art/desktop-v1/build_shop.py`、`common.py`；参数化原创建模，包括瓦片曲面、木作倒角、布料网格、器皿截面、植物叶片与陈列 | 没有引入第三方基础模型，无外部模型许可负担；由项目所有者决定最终发布许可 |
| 店员、衣物、头发、皮肤与动作 | `build_keeper.py` 原创环状拓扑、服装网格与显式蒙皮权重；18 个骨骼；作者未使用真人照片 | 没有第三方角色资产；不是扫描或现实人物的形象。未采用未经确认可再分发的基础角色 |
| 木材、灰泥、布料、屋瓦 PNG | `make_textures.py` 使用固定随机种子、数学表面和 Pillow/numpy 生成 | 原创中性表面；没有照片素材，无烘焙硬太阳阴影；normal 与 ORM 语义见交付说明 |
| 日文招牌字形 | Google Fonts 的 Noto Sans JP，下载于 2026-09-06：[字体文件](https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf)；SHA-256 `c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f` | SIL OFL 1.1。字体许可原文保存为 `FONT-LICENSE.txt`。本批交付栅格化文字贴图，未将字体二进制嵌入 GLB 或提交仓库。原文件的版权声明为 Copyright 2014–2021 Adobe，Reserved Font Name “Source” |
| Blender | [官方 4.5.9 macOS Intel DMG](https://download.blender.org/release/Blender4.5/blender-4.5.9-macos-x64.dmg)，[官方校验文件](https://download.blender.org/release/Blender4.5/blender-4.5.9.sha256) | 免费官方制作工具，GPL；工具本体未进入素材仓库。工具许可证不自动转为原创模型的许可证。安装包 SHA-256 `00c8a433504291374bfa045c0c2d708a779f8abc8400b4718fdd11c117486fa4`，已验证 |
| Babylon.js 预览器依赖 | `babylonjs@9.25.0` 与 `babylonjs-loaders@9.25.0`，由 jsDelivr 提供对应 npm 原包文件 | Apache-2.0，未复制 vendor 库进本次仓库；预览服务器从独立工具目录提供这两个固定版本文件 |
| GLB 验证 | npm 官方包 `gltf-validator@2.0.0-dev.3.10` | Khronos 验证工具，仅用于测试；未作为素材内容分发 |

字体许可原文下载地址：[Google Fonts OFL.txt](https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/OFL.txt)。GLB 内的材质颜色与几何均可编辑；源文件不会要求购买额外插件或联网生成。
