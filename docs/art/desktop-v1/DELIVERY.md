# よりみち弁当 — 素材交付清单

**状态：可导入的美术候选，交给 Sol 审阅。没有标记为最终美术验收通过。**

分支：`nihongo-art-assets-local-20260906`。基于 Sol 美术分支的 `0f3a4c4289b314791e9b7aee15fd5fca28cd425f`。本批仅新增交接清单允许的素材、源文件、制作工具与证据目录。

## 已交付

| 项目 | 仓库路径 | 实际内容 |
|---|---|---|
| 便当店 GLB | `public/explore/assets/desktop-v1/yorimichi-shop.glb` | 外立面、灰瓦屋顶、木窗凹进、闭合山墙、斜向封檐、木作倒角、分片布帘、布篷、植物；小型室内、柜台、便当、餐具、备餐柜、洗手盆、水龙头与吊灯。130,842 三角形 / 155,966 导出顶点 / 19 材质与网格批次；18,068,128 bytes |
| 店员 GLB | `public/explore/assets/desktop-v1/yorimichi-keeper.glb` | 虚构成年店员，约 4.6 头身；简化五官、成形发束、卷袖、围裙、口袋、背带、手指、鞋。57,852 三角形 / 29,531 导出顶点 / 13 材质批次 / 18 关节；1,708,484 bytes |
| 独立纹理 | `public/explore/assets/desktop-v1/textures/` | 13 张 PNG。4 组 1024² 中性 PBR 表面与 1 张 2048² 日文招牌图集。店铺 GLB 已嵌入所需图像；独立 PNG 用于编辑与替换 |
| 可编辑源文件 | `art-source/desktop-v1/yorimichi-shop.blend`、`yorimichi-keeper.blend` | 店铺保留对象与造型修改器；角色保留分件、命名权重、18 骨骼和 3 条 NLA 动作轨。源文件使用相对贴图路径，需保持交付目录结构 |
| 招牌文字 | `art-source/desktop-v1/signs.json` | 当前字样记录；修改 `make_textures.py` 中对应文字后可重新生成图集。主招牌、菜单、价格、营业中等文字均非照片 |
| 制作与导出 | `tools/art/desktop-v1/` | 纹理生成、共享几何工具、店铺/角色制作、编辑后再导出、冗余数据清理、GLB 检查与实际 Chrome 验证脚本 |
| 可交互预览 | `tools/art/desktop-v1/viewer.html` | Babylon.js 9.25.0 左手坐标场景，实际加载上述 GLB；店铺/店员切换，正面/室内或面部/侧面/背面，中性/暖光，旋转，动画，报告下载 |
| 精确清单 | `docs/art/desktop-v1/asset-manifest.json` | 导出字节数、SHA-256、三角形、顶点、材质、纹理尺寸及动画长度 |
| 来源与环境 | `PROVENANCE.md`、`FONT-LICENSE.txt`、`ENVIRONMENT.md` | 原创模型与表面来源、OFL 字形使用记录、官方工具来源、硬件与遇到的错误 |
| 浏览器证据 | `evidence/shop-*-neutral.png`、`shop-front-warm.png`、`keeper-*-neutral.png`、`keeper-detail-warm.png`、`keeper-idle/greet/talk.png` | 实际 Chrome/AMD Metal 画面；图片内保留预览器版本与分辨率。没有使用概念图替代模型 |
| 运行录像 | `evidence/asset-browser-capture.webm` | Chrome 的实际 WebGL 画布录制；店铺旋转、向柜台移动、角色正侧背与三段动作。录像测量包含录制开销 |
| 验证记录 | `evidence/*-gltf-validation.json`、`browser-hardware.json`、`performance-no-recording.json` | Khronos 校验、实际导入/通路/骨骼矩阵变化，以及不录像时的独立持续性能测量 |
| 离线预览 | `evidence/shop-cycles-neutral.png`、`cycles-cpu.log` | Blender CPU Cycles 的中性检查图；与游戏运行证据明确分开 |

## 坐标与整合契约

- 单位为米，GLB 为 glTF 2.0、+Y 向上；建筑街道一面与角色正面朝 **−Z**。角色脚底接近 Y=0，造型整体比例约 1.64 m 高，源文件与 GLB 无人为厘米缩放。
- 为配合当前 Babylon 默认左手场景的导入 X 反射，制作工具将“游戏局部 X”预先反向写入 glTF X。**保留 loader 创建的 `__root__` 转换，不要再对 X 或 Y 旋转补偿。**实际浏览器读回：`ANCHOR_right=(1,0,0)`、`ANCHOR_interior=(0,0,5)`、`ANCHOR_counter≈(0,1.16,3.4)`、`ANCHOR_npc≈(0.4,0,4.25)`。原始右手 glTF 数据里的 `ANCHOR_right.x=-1` 是有意的预补偿。
- 门口原点 `(0,0,0)`，入口立柱内沿 X=±1.0 m；布帘最低点约 Y=2.63 m。中央入口至柜台通路保留；灯具已移至 Z=3.5 m 的柜台上方。浏览器几何射线检查在 X=−0.73/0/+0.73、Y=0.3/1.0/1.68/2.55 m 共 12 条路径上验证。这是网格净空检查，不是游戏碰撞回归。
- 墙体和地台目标约 8.55 × 5.70 m，主屋顶最高约 5.65 m。**超出原简化体积的装饰范围**：屋檐横向约 ±4.55 m、雨槽背面可到 Z≈6.18 m；布篷前缘 Z≈−1.15 m。临街植物也在原外墙之前。Sol 需审查与相邻建筑、道路的关系，不应把完整美术边界直接当碰撞盒。
- 地面顶部约 Y=0.044 m；既有游戏地台/碰撞代理的保留或替换由 Sol 决定。柜台顶部保持 Y=1.16 m，前沿约 Z=2.98 m。
- GLB 以材质合批供运行；`.blend` 仍保留分件，方便拆分屋顶、立面和室内。整合时不要把整个视觉 GLB 设为一块碰撞体。没有更改 `world.ts` 或其碰撞逻辑。
- 角色与店铺各自独立导出；在游戏中将整个角色容器（包括蒙皮与骨骼）放到店铺 NPC 锚点。当前项目只有 `@babylonjs/core`，**Sol 需在自己的整合工作中显式加入/注册 9.25.0 对应的 glTF loader**；本批没有改共享依赖配置。

## 材质语义与动画

- Base color 为 sRGB，中性无硬日落阴影。Normal 为 glTF 切线空间 +Y 格式、Non-Color；带法线贴图的网格已导出切线。
- `*_orm.png` 为线性通道：R=1（未遮蔽），G=roughness，B=0（金属度）。**R 全白不是真实 AO 烘焙**；没有承诺或交付间接光 lightmap。金属器具使用显式材质因子。
- 玻璃采用简化 alpha 混合，非完整折射；角色主要使用中性常量 PBR 色与真实几何。没有依赖 Blender-only 节点、几何节点或灯光才能显示的运行资产。
- `idle`、`greet`、`talk` 为真实骨骼动画组，约 4 s / 3 s / 4 s。眨眼为独立眼部骨骼缩放，合入各条动作。动作播放时的骨骼矩阵变化已实测；不声称口型同步。静止姿势与播放均可在预览器中查看。

## 仍需 Sol 审阅 / 未完成

1. **最终美术验收与街区整合未完成。**这是较完整的程序化原创候选；不能据此宣称达到已签收的高质量手工美术。仍需审阅木纹重复、屋瓦侧边、招牌远距离字重、角色发束轮廓、肩肘变形与服装细节。
2. 角色没有手绘皮肤/衣物贴图、口型目标、表情系统、手指独立动画、IK、走路或布料模拟。当前三段动作是可运行的审阅基线，尚未做动画师精修。角色脸型为简化风格，没有真人面孔。
3. 没有真实玻璃反射环境、店内烘焙间接光或夜间照明方案。所有预览灯仅属于隔离审阅器，未改游戏全局灯光。
4. 屋檐与外摆的超出范围、碰撞代理、入口高度、NPC 注视点及相邻建筑接缝，需要 Sol 在实际街道中审查。几何射线不替代真实玩家碰撞和控制测试。
5. 没有 LOD、KTX2、Draco/Meshopt 或纹理流式加载版本。店铺 GLB 仍约 18 MB；首次网络加载和全街区显存预算需要整合后评估。
6. 只测了这台 Intel Mac 的 Chrome / AMD Metal。没有 Safari、其他显卡、移动端或完整游戏 FPS 结论。不录像与录像的帧时分开保存，不能用静态 FPS 冒充持续硬件表现。
7. 未运行 NHK 回归、未修改 UI、游戏功能、数据或生产配置；未部署、未合并、未购买或调用付费生成服务。

## 复现与查看

验证摘要与实际性能表见 `VERIFICATION.md`；复现命令见 `tools/art/desktop-v1/README.md`。GLB/PNG、`.blend` 和脚本均直接放在分支内，无需外部源文件大压缩包。Sol 可先评审店铺，再决定是否采纳或继续精修角色。
