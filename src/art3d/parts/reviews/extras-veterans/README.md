# 配饰：武圣长须、独眼眼罩与红脸（第1轮待审）

关云喵的长须改为深色三绺美髯，红脸是绕开双眼和口鼻的连续暖红贴肤色片；夏侯墩的眼罩有缝边、两颗圆钝铆钉、斜接带及实际连上的整圈头带。仅替换 EXTRA.beardLong / eyepatch / redFace 与新增 helper，不改角色数据、骨架、姿势、材质框架或镜头。沿用真实头部插槽和 normal bake。

实际两名用户：`shu_guanyunmiao`（SSR，长须+红脸）与 `wei_xiahoudun`（SSR，眼罩）。全89显式真实 look/id 为41英雄、36杂兵、12宠物；87非目标几何 attribute 类型、布局、index 和原始 Uint8 字节同。没有给宠物加新配饰；12只宠物的 body 仍为 none。两个目标的三项注册在实际构建中各命中一次。

| 配饰 | 逻辑网格 / 含描边实际Mesh | 最大分段 |
| --- | ---: | ---: |
| beardLong | 7 / 14 | 24 |
| eyepatch | 7 / 14 | 24 |
| redFace | 1 / 1 | 自定义贴肤三角，不另建Sphere |

根位置/旋转为0、scale1，子节点正尺度；复用缓存 Toon/outline，只在构建时生成几何，无逐帧分配。红脸只缓存实际头面数值（不共享会被 disposeCat3D 释放的 GPU geometry），按 detail.k 的实际 host LOD 建贴层。

## 参考与来源

实际查看 [关云喵JPG](../../../../../assets/heroes/ref/shu_guanyunmiao.jpg) 和 [夏侯墩JPG](../../../../../assets/heroes/ref/wei_xiahoudun.jpg)，阅读 [ART_PROMPTS](../../../../../docs/ART_PROMPTS.md) 与 [实际hero lore](../../../../data/heroes.ts)。关云喵黑猫、红脸、美髯、绿纶巾和青龙鱼骨刀相互呼应；夏侯墩保持灰虎斑、玄甲盔和独眼设定，没有血腥细节。两位不在已有五张批准立绘的专属名单，未把其他角色造型直接搬入。

最终选源前补查公开目录和仓库，不声称在本次程序原型实现前已搜索。GitHub实际仓库查询 `eyepatch CC0` / `beard CC0 model` 各0结果；随后读固定 [Kenney镜像Mini Characters目录](https://github.com/shorepine/kenney/tree/3694c6879e487c108f55677be7dd2ca75b07cc3b/3d/mini-characters) 的26个模型和 [Pirate目录](https://github.com/shorepine/kenney/tree/3694c6879e487c108f55677be7dd2ca75b07cc3b/3d/pirate) 的72个模型。前者含 aid-glasses / aid-mask / aid-sunglasses 和整个人形角色，后者是船只、旗帜与环境道具；限定目录未提供当前猫骨架的长须、单眼罩或真实host贴脸色片。只读目录/README、未下载或逐GLB审图，不能说所有公开资源都不合适。镜像README称Kenney系列CC0，但根LICENSE实际为Castle Kit，不拿它独自证明另两包的许可。最终保留本项目 palette/Toon/PartBuilder 程序几何，不引入外部模型、贴图或图标，不新增CREDITS条目；[具体检索范围](public-source-audit.json)。

长须深色由实际 fur 与 #211c22 混合，侧绺沿用毛色；三条细发线由 light/fur 派生。眼罩 leather #2a2230，缝边少量混 pal.sub，圆铆钉 pal.trim。红脸以 #b34f4b 混实际 fur 12%，避免另写不同阵营主色。

## 冻结源码与基线

独立和正式拍摄固定 `60bc06577f5d5dd2966a661d2278802bb3e3fcee`：

| 文件 | SHA256 |
| --- | --- |
| parts/extras.ts | 76596c1368f2219e384b083cf1c857713a11fc19689f6107b9720eb3f8e5a107 |
| parts/extras-veterans.ts | 1834799bcb2a4315e6eb7802c99e3fe0a178b3532ff50de3671fa43dae7e3550 |
| cat3d.ts | e5dd83cb7077e4f5dd5516880bb6b9ea60df0dcbb6069294b1bb18979988f8e0 |
| pose.ts | 3abe84b540c541d2637a36e7291c599d9b5a52318d4524662f122ce803e6431c |
| renderer.ts | ccc15c4a584e0f44c91bf7faa35beb15afe6e1d509890003a3d0b7a47120ac05 |
| fx/actor.ts | 268bc636c0ea4271432c0b0428105e66c204cb6fb5c3739ccb7c0aabb38f238f |
| fx/player.ts | 9e2e99c304514e8509dc1dcbfec5df1e488cf7f9321659c0c9a2a99bfd3a147d |

当前注册除这三项和helper import之外，其余九项注册及已合羊须/铃铛/耳环函数保持主线原字节；移除仅原目标函数使用的未用sphere import；未移根、隐藏其它配饰、改相机FRAME或用姿势特例回避遮挡。旧的分析球面浮层、无效孔洞拓扑、悬空眼罩连接、source5/6旧图仅留忽略目录历史，不混入1834最终照片。

## 正常审图

每行关云喵 / 夏侯墩，三列idle / windup / strike，phase0/t=.4。真实 `buildCat3D(lookOf(id), id)`，大图290×254单格，其余250×219，约190px角色高；默认 normal bake、Toon/outline、真实骨架。

| +32大图 | 0° | +32原生190px | −32° | 148背视 |
| --- | --- | --- | --- | --- |
| [大图](veterans-32-large.png) | [正面](veterans-front.png) | [小尺寸](veterans-32-native.png) | [反侧](veterans-reverse.png) | [背面](veterans-back.png) |

[长须与红脸细节](chin-beard-red-face-detail.png)、[覆盖眼中心与开放眼](covered-open-eye-detail.png) 为420单格。等价参数 `PORT=5190 CHROME=/usr/bin/chromium node tools/cat3d-shots.mjs <raw.png> 'ids=shu_guanyunmiao,wei_xiahoudun&poses=idle,windup,strike&yaw=<0/32/-32/148>&w=250'`，只大图w290/detail单角色w420；唯一全SRC副本、未使用SHA导出核对真实cat/extras/helper/pose/actor身份，capture的19个关键依赖前后相同。后验另对正常捕获private副本259个运行时源去除五个未使用sentinel导出，与当时当前源逐字节比对全部同；不倒推说479份含审图文件全做了捕获前后guard。[采集记录](capture-records.json) 保存源、参数、raw路径/字节/哈希、delivery无损验证与真实战斗。

## 实际十猫战斗

[完整HUD战斗](battle.webp)：`r3d=1&seed=2&theme=meadow`，A=关云喵/夏侯墩/曹喵德/刘喵备/张喵飞，B=吕布丁/孟喵获/左慈喵/赵喵云/孙小香。正常demo → Player → Scene → Actor流程，10/10真实cat3d；2目标演员共三组实际配饰名称存在，startup beardLong/redFace/eyepatch各命中1次。十二帧按真实60Hz推进3.25～6s，交付完整948×592第05帧t≈4.5s；没有插入合成演员或假技能。其它演员和武器会遮挡部分细节，不能以命中次数宣称一直可见。

页面脚本错误0，保留一次外部Google字体 ERR_TUNNEL_CONNECTION_FAILED 和对应console记录，采用正常系统字体回退。没有将外部字体失败说成全部网络错误0。

## 作者有限范围自检

最终1834实际 `npm run typecheck && npm test` 退出0，69文件 /1035测试。作者400配对为两位各〔14姿势×4yaw，静态t=.4；idle/windup/strike×12时刻×4yaw，t=i×8/11〕，yaw0/±32/148，phase0、dash moving=true。保存 normal bake 真实眼/五点鼻口/取框，完整三角物理检查在临时副本保留owned归属；作者原始约19.75MB报告留忽略目录，SHA和概要见 [作者记录](author-validation.json)。

新增raw open-eye ID496不能写成0；独立逐具体ID核实496/496已被原始真实头壳先遮，新可见开放眼被测点0。正常idle/windup/strike中遮住的是夏侯墩−x眼（eyes index1）的瞳孔中心，不豁免另一只眼或整个脸。不承诺全部200姿势的瞳孔都盖住。短罩仍有少量眼核投影格点露出：独立200个夏侯姿势中73例共1083个可见但未被罩覆盖的眼核投影格点，idle/.4/+32为21点（不能直接等同白眼像素或虹膜中心）；不得宣称整只左眼或全部白眼被盖满。当前保留盖瞳孔中心、口鼻清楚的样式，而不扩下沿再次挡嘴。

源码6曾在slump/.4/+32实际可见muzzleL上新增遮挡，具体旧口鼻点/新增缝边三角与深度由独立审计定位；最终1834缩短罩与缝边下沿并保留上沿，旧精确点已无新triangle命中。作者五点新增0；独立还检查实际活跃笑嘴/mouthO表面3×3和额外口鼻bbox表面，不能只用作者五点证明全部嘴面。

所有owned FRAME/finite/新增与增大whole裁幅0，整猫保留双方相同8例关云喵 paw 裁切，来自castFwd/guard×四yaw、t=.4，不是配饰越界；FRAME仍x[-2.2,2.2]/y[-.25,3.6]。200个候选headCross包含登记的头带描边触点，不写全raw头相交0。长须只有命名muzzle-root接触区，非整部件豁免；发绺/发线与实体头壳、口鼻分开记录。

## 无损交付与限制

7张PNG无损优化，战斗完整转lossless WebP；每张与raw完整RGBA逐字节差0，没有剪脸、缩放、重排或改材质。8张图全部<500000 B。旧source5图和对应captureraw留 `.shots/extras-veterans-official/history-*`，不列为当前证据。

最不满意：眼罩外侧仍有一条很细的白眼边，长须细发线在190px变弱；红脸的边界随有限三角和避眼窗口略有锯齿。有限离散phase/姿势/时刻、采样格和特定FRAME不能证明全部连续动画、全像素可见性或未来骨架/镜头。


## 独立审核与提交前主线同步

[独立结论](qa-summary.md)、[400+48完整记录](qa-summary.json)、[正常旧新九组](before-after.png)固定source7/main60。新可见开放眼/鼻口点0，保留raw496及有意眼罩owner记录；新slump遮嘴点已消，87非目标同、耳48双版本0。实际红脸在默认host6632/world5094输出三角，逐实际host面核+z.001、头本体/口鼻0；展开头描边壳表层分别6613/5082三角进入，余19/12未计为交叠，不能说全部壳交0或所有输出面都交。纯数值faces缓存，无共享GPU geometry；没有手机FPS测量。

当前已同步主线4d6fb66，保留其它已合批次和SP三位武器，注册表76596/helper1834与cat/pose/renderer/actor/player及两目标look不变。正式8图、独立400+48保留其原main60源快照，不重标作main4d重拍。当前作者重新复制整SRC，实际89/400复核87非目标原始Uint8同、raw open496/五点0/owned FRAME0/旧新整猫8/意外交叉0与前次同；原生typecheck+test退出0，78文件/1086测试。[当前作者验证](author-validation.json)、[正常捕获259源副本后验](capture-runtime-copy-validation.json)。两目标和正式十猫团队均无这次新增的三SP；其它模组的主线改变不混写为本批改动。有限样本和原始/可见遮挡分类分别说明，不宣称所有白眼被盖满。


提交前另同步主线已通过的BACK3与海湾玩法至68e3f1d；两目标及其十猫团队没有背卷/旌旗配置、核心与本两源不变。当前实际全89/87非目标Uint8同、两目标idle smoke通过，原生80文件/1102测试退出0；此增补范围见author-validation.postApprovedBackSync，不冒称独立400或原正式图是在68重拍。
