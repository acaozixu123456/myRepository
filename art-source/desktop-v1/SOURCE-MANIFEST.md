# 可编辑源文件

- `yorimichi-shop.blend`：原始店铺对象和造型修改器；贴图链接为相对此文件的 `../../public/explore/assets/desktop-v1/textures/`。屋顶、室内和立面可以在源文件中分拆。
- `yorimichi-keeper.blend`：角色分件与显式蒙皮，18 个命名骨骼，三个独立 NLA 轨道（idle、greet、talk）；源文件保存为静止姿态，逐条解除静音以编辑动作。
- `signs.json`：此次导出的日文文字记录。当前重绘入口为 `tools/art/desktop-v1/make_textures.py`，其中正文与各标签图集宽度可编辑。
- 完整重建与编辑后再导出命令：`tools/art/desktop-v1/README.md`。源文件仅需要 Blender 官方 glTF 导出器，不需要购买插件。
- 原始模型与贴图来源、字体许可：`docs/art/desktop-v1/PROVENANCE.md`。工具库与字体文件不以大型 vendor 归档提交。

坐标特别说明：源场景的 Blender X 预先反向，Blender Z 为竖直，Blender −Y 为店内；对应 GLB 的 +Y 向上、−Z 正面。这是为当前 Babylon 左手导入自动反射而做的准备，实际定位证据见交付清单。不要未经核实再次左右镜像。
