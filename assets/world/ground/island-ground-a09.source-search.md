# A09-IS 来源补查记录

已在ambientCG、Poly Haven、Kenney和OpenGameArt实际检索。存在可评估的CC0草地与天空候选；除当前主干Grass005外，候选文件尚未下载或本地实看，画风 / 格式转换 / 接缝适配尚未验证。不能把下载受限或格式不同写成‘没有合适现成素材’。本批三张AI图未采用或引用这些第三方文件。

## 真实时间

- 本批3次独立image_gen：2026-10-12 05:47:03→05:48:36UTC，见[实际出处](island-ground-a09.provenance.json)。
- 主干6f于06:12:57UTC加入规则0：现成素材优先。两张#117天空原稿06:09:36→06:10:19也早于该提交；后续修订另录真实来源，不包含在这两个原调用中。
- 本辅助第一次检索：2026-10-12T06:15:56.315Z；补查完成：2026-10-12T06:36:34.267Z。这是收到新规则后的补查，没有事先找现成再生成的记录，不改写为‘生成前已搜’。

## 草地候选

| 来源 / 候选 | 许可依据 | 已知适配范围 |
| --- | --- | --- |
| [ambientCG Grass005](https://ambientcg.com/view?id=Grass005) | [CC0许可](https://docs.ambientcg.com/license/) | 现主干已接入512²绿色短草坪；本辅助实看当前文件，未见小花。可用草底与游戏现有3D花配合，不因缺少烘入小花就认定不可用。 |
| [Poly Haven Sparse Grass](https://polyhaven.com/a/sparse_grass) | [CC0许可](https://polyhaven.com/license) | 官方描述为细草 / 根 / 裸露湿土；比纯净粉绿草地更偏自然土色，原图与花色效果待核。 |
| [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) | 页面列CC0，330个文件 | 有自然资源，但未下载文件，不默认包含可直接交付的1024²花草底图。 |
| [OGA surfacecurve草地](https://opengameart.org/content/grass-textureseamless-2d) | 单件页面列CC0 | 512²，作者注明草叶有固定竖向；旋转3D地面时需检查。未看原图，不宣称不合适。 |
| [OGA athile草地20包](https://opengameart.org/content/seamless-grass-textures-20-pack) | 单件页面列CC0 | 多款可平铺512²草底；目标1024²需如实记录转换，粉绿小花与画风尚待检查。 |

## 天空候补（后续来源比较）

| 候选 | 许可 / 真实页面资料 | 适配判断 |
| --- | --- | --- |
| [Kenney Skyboxes](https://kenney.nl/assets/skyboxes) / [同作者OGA说明](https://opengameart.org/content/skyboxes-1) | CC0，5款球面全景 | 真实现成候选。逐件区分白昼与space/stars版本，下载后核尺寸 / 云型 / 4:1条带转换；尚未拒绝。 |
| [Screaming Brain Studios Cloudy Skyboxes](https://opengameart.org/content/cloudy-skyboxes-0) | CC0，25款2048×1024全景及cubemap；说明含晴天 / 日落 | 值得优先比较的纯云天资源；2:1→4:1需明确映射或裁切，但比例不同不是弃选理由。 |
| [OGA clouds skybox1](https://opengameart.org/content/clouds-skybox-1) | CC0，白云蓝天、6面1024² BMP | 符合正午内容方向，需要转换和接缝 / 画风核对。 |
| [PH Qwantani Noon Pure Sky](https://polyhaven.com/a/qwantani_noon_puresky) | CC0，24K白昼纯天空HDRI | 可作为正午来源比较，需HDR→LDR / 色调 / 4:1范围 / 太阳盘处理；未核二进制与画风。 |
| [PH Drakensberg Pure Sky](https://polyhaven.com/a/drakensberg_solitary_mountain_puresky) | CC0，清朗午后纯天空HDRI | 午后候补；金光云型是否满足目标待实看，不能只凭名称排除。 |
| [PH Qwantani Sunset Pure Sky](https://polyhaven.com/a/qwantani_sunset_puresky) | CC0，温暖日落纯云天 | 日落时段与宫阙午后有差异，保留作比较；未做最终不适合结论。 |

OpenGameArt按每件页面确认许可，未把整个站都当成CC0。除当前主干Grass005外，这些候补未完整下载、转换、平铺或游戏预览；不凭metadata虚构Skyboxes被拒理由。

## 当前主干与原审图的范围

6f已在云岛 / 森林使用ambientCG Grass005，码头quay使用WoodFloor064，并由Claude登记CREDITS。云岛成功加载CC0时repeat4×4、每周期约14.6单位；程序grassTex回退为5×5、11.68单位。Circle半径29.2、roughness.95 / 默认metalness0和mist灯色未变。森林repeat9替12并叠e4f6c8色，quay木面repeat8×1替16×1.2。
114审图和独立QA仍是67基线的三张AI替代候选，Plane8×8/repeat2×2、每周期4单位，尚未游戏接入。16项旧输入中 3 项已变：docs/WORLD3D.md、docs/CODEX_QUEUE.md、src/world/themes/cloud.ts；另有assets/index及森林 / 港口源码更新，不能写16依赖仍全部相同。材质 / 灯色等未变不等于实际地图贴图和UV未变。原捕获 / QA保持真实67基线，不重标6f。

## 返回内容与限制

9份网页搜索 / 官方页open返回、查询UTC、URL、完整结果及GitHub6f证据保存在私有工作区`/workspace/world-review/source-policy-6f/`。10个公开catalog/API GET和一次curl HEAD受到当前restricted/enforced代理目标策略403拒绝，实际错误已记录；未改代理 / policy或绕过拒绝。后续使用网页工具取得官方页面，不把403当成不存在资产的证据。
本批没有采用第三方候选，不新增CREDITS项；现有CC0登记是Claude主干已经完成的工作。保留候选给Claude比较，未来素材按规则0先查现成。上述检索与许可证据不等于候选画风、文件格式或接缝已验证。完整结构化记录见[来源补查JSON](island-ground-a09.source-search.json)。
