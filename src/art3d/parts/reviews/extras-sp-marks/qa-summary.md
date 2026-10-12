# EXTRA 第 2 批独立 QA

当前冻结源通过有限样本独立检查；安装触点、贴肤层和继承的旧取景限制在下文明确保留。适用 `glowEyes / tassel / warPaint`，基线为 `60bc06577f5d5dd2966a661d2278802bb3e3fcee`，两侧均使用 main60 同一套猫、姿势、Actor 和 Renderer。此前 6fdb 与 f92 候选的图、检查不作为当前结论。

- 注册表 SHA-256：`4c388b7e70cb5f596fd422f535a530e7d385db8177928ba8f67d13df7bec2b19`。
- 新 helper：`e9dcbe48bfc3ff908f0e66016a0b44174ce9627dbe5254ec3da44b834eaa7b9a`。
- 按注册表、helper 顺序直接连接原始 bytes：`a9600d2a1e164e8efec62f42f68ab8b22b51f8437002e9fcac89a99996ed22be`。

[机器报告](qa-summary.json)保存全部样本键、实际眼睛/动态嘴采样 ID 集合、每个接触 mesh 的三角形 ID 与统计、89 个实际用户的字节比较及冻结文件哈希。[前后对照](before-after.png)左侧为真实 main60 旧三项函数，右侧为当前函数，均正常 bake、原生单格 217×190；3 位代表各有 5 个姿势/角度。PNG 只作无损压缩，解码 RGBA 字节差为 0。

## 范围和真实使用者

| 配饰 | 实际目标 ID | logical / 含 outline physical | 实际最大 segments |
|---|---|---:|---:|
| glowEyes | wei_simamiyi、shu_pangmiaotong、xian_changmiao | 6 / 6 | 20 |
| tassel | shu_liumiaobei、shu_zhugemiaoliang、wu_ganning、mob_shu_vanguard、mob_qun_strategist、mob_qun_assassin、pet_huihui | 9 / 16 | 20 |
| warPaint | shu_zhangmiaofei、man_mengmiaohuo、man_zhurong、man_shamoke | 4 / 4 | 0（贴肤自定义三角形） |

每个目标均通过实际 `buildCat3D(look, heroId)` 命中对应 EXTRA 注册函数一次。89 个用户为 41 英雄、36 杂兵、12 宠物，战斗 detail=1 与世界 detail=.6 各独立检查一次；75 个非目标的全部几何 attribute 和 index 逐 Uint8 字节相同，包括 11 个非目标宠物。12 宠物的 body 都仍为 `none`。所有新节点 scale 为正、根位置/旋转为零且 scale 为 1，材质缓存复用，使用 toon/outline，segments 未超过 24。

相对真实 main60 注册表，只增加一个 helper import 和替换这三项映射。已批准的羊须、铃铛、耳环及其余九项注册函数/import 保持原字节；未修改数据、引擎、姿势、Actor、Renderer、现有其它艺术源或测试。

## 独立方法与样本

259 个完整运行时源码/数据文件复制到唯一冻结目录；所有运行时相对 import 规范化为同一目录的显式 `.ts` URL，防止 Vite 重复实例或热更新混源。猫、helper、注册表、pose、Actor、Renderer 都在浏览器核对源码 SHA sentinel，运行前后 259 文件哈希一致。几何审计只在临时副本保存 bake 前实际 primitive 引用，并让被检查的 EXTRA 保留独立 mesh；正常眼/嘴/FRAME/渲染检查另建正常 bake 的猫。注册表旧新切换均 `try/finally` 恢复，不改变源几何或姿势。

- 战斗与世界各 **2,800** 样本：14 个目标 ×（14 姿势 ×4 yaw +3 姿势 ×12 动画时刻 ×4 yaw）。yaw 为 0/+32/−32/148，静态 t=.4，动画 idle/windup/strike，t 从 0 到 8，phase=0。
- 两档各另加 **504** 眨眼峰值样本：3 位光弧用户 ×14 姿势 ×3 时刻 ×4 yaw，t=3.45、3.4142857142857146、7.05；包含受伤眯眼。完整白眼外围三角形质心也检查，不只取 iris/pupil 中央。
- 两档各另加 **84** 耳动峰值样本：14 目标 ×3 姿势 ×t=.2/2.243994752564138。包括灰灰整头 1.12 的实际耳外壳、内耳、耳簇和法线展开 outline。采用完整 TRI-TRI 表面交叉及实际三角形凸壳裁剪，不使用名义半径。
- **336** 原生正常 WebGL 渲染：14 目标 ×旧新 ×3 姿势 ×4 yaw；每例读取实际 GL 子矩形的 alpha、边缘像素和 skinned mesh，均有有效像素，无 2D fallback。

每例眼睛检查为实际 bake 后眼核心 12×12 有效/被挡 ID 集合；另取两眼所有正面白眼三角形质心。动态笑嘴或张嘴为当前实际可见面 3×3 ID 集合，再检查实际鼻、两口角及两口鼻边缘共 5 点。所有新增 ID 均为 0，有效 ID 集合与基线相同；动态嘴每例至少 4 个有效点。普通 2,800 样本最低眼有效数为静态 50、动画 69；眨眼峰值刻意闭眼，最低为战斗 28/世界 27，旧新相同，不伪称闭眼时仍有 50 点。

机器报告用普通字典、hex 位集保留所有 ID；仅 `exactCaseEvidence` 的逐例关联行与 state 表采用标准 zlib+base64 无损编码。解码说明和 SHA 在报告内，可恢复两档全量、眨眼、耳峰的全部样本键；不舍入浮点数。完整逐例世界/owned bounds、探针坐标与原始记录留在忽略目录的 178 MB raw，报告登记路径/bytes/SHA，不提交大文件。

## 接触必须逐 mesh 解释

使用真正头壳 **1120** 面及其实际法线展开 outline；世界 detail=.6 的 host 为 **17×13 /408** 面，单独重算贴肤而非沿用 28×21 表。口鼻为真正 **560** 面（低细节用实际拓扑）；眼/鼻/当前两条笑嘴或口腔和舌头都逐 primitive 核查。新可见光弧、结、带、布条、折线的意外头、口鼻、眼、嘴、耳接触均为 0。

| 命名 mesh | 明确允许的安装接触；战斗代表的完整交叉三角形数 |
|---|---|
| attachment-seat | 侧颅小安装座。头本体 solid54/outline68；头 outline 带 solid192/outline192。裁剪触点限定头局部 x[.698,.730]、y[.127,.193]、z[.039,.121]，不是豁免整条 tassel。 |
| attachment-cord | 仅近端第一段进入头 outline：solid3/outline5，头本体 0。触点限定 x[.726,.754]、y[.136,.178]、z[.060,.114] 且 source triangle≤36。世界低细节为 solid0/outline3。 |
| skin-paint.-1.0 / -1.1 / 1.0 / 1.1 | 4 薄贴肤层，头本体 0；允许其处在头 outline 带。战斗代表 shell 三角形 38/34/36/34，世界30/26/30/24。每个完整 paint 三角形独立投影裁剪到每个真实前侧头面，并逐 clipped polygon 点核对 +z .001；不是把整 part 从碰撞表排除。 |

实际贴肤偏置范围：战斗 `[0.0009998440009968135, 0.0010000927591476971]`；世界 `[0.0009998226763992951, 0.0010002303437099958]`，在 Float32 容差内且无本体穿入。JSON 保留每个 mesh 的完整源三角形、接触 bounds/意图区和每个 paint 三角形的覆盖面积/偏置；表中代表数不能替代其它用户记录。

两档各 2,800 样本中意外头本体/头 outline/口鼻/耳/眼和当前嘴接触、新眼和嘴 ID、owned FRAME、新增 whole 越界、旧新各方向 margin 增幅、非有限值均为 **0**。总 headCross 不是 0，因为包含上述已登记安装接触；不把 inside 点数当成无三角面交叉的证明。

## 保留旧取景限制

每档 whole FRAME 越界 **304**（104 静态、200 动态），与基线逐方向 margin 相同：张喵飞156、祝融92、嫦喵4为旧 `headTop`；蜀先锋8为旧 `paw`；灰灰44为旧大耳 `ear`。全样本 Y 范围 `[-0.29064419326895186, 3.7558569281236442]`。这是整个猫的旧取景限制；三项 owned geometry 都在 FRAME 内，无增幅。实际正常 GL 仍有旧冠饰/耳/爪在源框边缘的像素，未用它们宣称无裁切。

## 真实战斗、HUD 和灰灰

另用同一 frozen259src 的实际 demo → simulate → Player → Scene → Actor 跑 10 位目标英雄、12 帧每 .5 秒，加真实 `pet_huihui` 事件；没有插入假 Actor/事件、强设 alpha 或镜头震动。独立记录实际 11 次新 builder 命中、519 次 GL 渲染（均非空且 context 未 lost）、504 次舞台 drawImage 与15次 Actor 闪白离屏绘制、710 次实际 HUD 文本绘制。

每次 GL alpha bounds 都用实际 Canvas2D transform 映射到舞台；观测 50 个 Scene.draw，stage 四方向 crop 增幅均 0。真实 shakeMag 最高3，实际抽到的偏移绝对值最大 x=1.6678183521469805、y=2.439497042047549，未强设震动。灰灰由 `Player.petActors.get('A')` 持有的 uid−1 Actor 实际出场，alpha=.888888888888911、正常 skinned mesh4、head scale1.2768；出场及三次真实跳跃姿态的4次 GL/舞台绘制 crop0，最靠左 alpha bounds x=16.347826086956516。有限舞台样本不代表所有战斗效果/镜头组合。

## 视觉核查与验证

实际看过10位英雄 JPG、司马/庞/嫦3份已批准 full.webp、灰灰原2D宠物参考与 lore；看过当前官方14目标全部四yaw三姿势的190高正常图、三个大图 detail、独立旧新30格以及独立真实战斗/PET截图。光弧在外眼角留开白眼、眼神和受伤眯眼仍可读；战纹随真实头面贴肤；侧结和两条布穗有清楚的连接。细折线在190高变弱，嫦喵浅青光弧对白毛对比最弱，作为细节限制保留，不为此重做源码。

作者当前 e9 源的原生测试日志 `.shots/extras-sp-marks/tests-final-main60.log` 实际为 **69 文件 /1035 测试通过**；作者同时报告 required typecheck 退出0。此处没有声称独立再跑一轮单元测试。独立浏览器全程 pageErrors/failedRequests 为0，源前后哈希相同，无新增测试或依赖。
