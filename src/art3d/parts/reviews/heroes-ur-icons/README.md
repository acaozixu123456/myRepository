# UR 专属首批：低冕、双剑、吴冠、双月牙戟、骨齿棒、环珠杖

本批六位正式 UR，每位覆盖一个部件组。正式图固定在主线 `29f6a8bbe66bbcf4ea1c0119675cac65f8c4e00a` 和以下四份冻结专属源码；十四张图全部重新捕获，包含已合并的六件衣服、八种毛色、表情嘴骨、约 12% 战斗模型放大，以及最新 armed 右臂 / 右肘姿态。旧 aa9 / fece / 153 图已归档至 scratch，不沿用。源码只新增三个 UR helper 和六条 `HERO_PARTS` 映射，使用真实 `lookOf(id)`、阵营色板与正常 bake。

## 六位英雄、参考与预算

已实看 [ART_PROMPTS](../../../../../docs/ART_PROMPTS.md)、下列六张 JPG，以及认可的 [曹喵德 full.webp](../../../../art/illust/wei_caomiaode.full.webp) / [刘喵备 full.webp](../../../../art/illust/shu_liumiaobei.full.webp)。取低扁冕板与多列珠帘、双股剑金卷护手、低红吴冠、开口双月牙、圆钝骨齿木棒及实托青珠金环的识别形。

| 正式 ID / 英雄 | 本批组与识别形 | 逻辑网格 / 含描边实际 Mesh | 最大分段 | 实看 JPG |
| --- | --- | ---: | ---: | --- |
| `wei_caomiaode` 曹喵德 | headgear：低漆冕板、七列三珠帘、前宽后窄耳侧收腰 | 12 / 23 | 20 | [曹](../../../../../assets/heroes/ref/wei_caomiaode.jpg) |
| `shu_liumiaobei` 刘喵备 | weapon：两柄外展直剑、镂空金卷护手 | 16 / 30，主副各 8 | 12 | [刘](../../../../../assets/heroes/ref/shu_liumiaobei.jpg) |
| `wu_zhoumiaoyu` 周喵瑜 | headgear：低红束发冠、横金带、额前金牌红珠 | 10 / 20 | 20 | [周](../../../../../assets/heroes/ref/wu_zhoumiaoyu.jpg) |
| `qun_lvbuding` 吕布丁 | weapon：中央矛刃、对称双月牙开口、紫短系带、连续外斜木颈 | 13 / 24 | 12 | [吕](../../../../../assets/heroes/ref/qun_lvbuding.jpg) |
| `man_mengmiaohuo` 孟喵获 | weapon：短卵形木棒头、双骨箍、七颗短圆骨齿、连续弯木颈 | 17 / 33 | 16 | [孟](../../../../../assets/heroes/ref/man_mengmiaohuo.jpg) |
| `xian_zuoci` 左慈喵 | weapon：镂空金环、实体托座青珠、短侧珠与青穗、连续外斜木颈 | 17 / 30 | 20 | [左慈](../../../../../assets/heroes/ref/xian_zuoci.jpg) |

描边与本体按一个逻辑网格计；刘两手合计 16，`userData.offhand` 由引擎挂到 `handL`。各 builder 根为零位移、零旋转、单位缩放；使用缓存 toon / outline，同色几何仅在构建时合并，没有每帧分配。吕的刀头、上箍与紫系带一起绕局部杆上 y=.50 向外倾 .80 rad，下杆只截短肩以上部分、保留原锥度，以连续曲木颈接回刀座；根、掌心握段、低箍与底珠仍保留原位。曹冠顶 `y=.259`（描边 `.266`），周冠 `.205`（描边 `.218`）。孟七齿内端均埋入木体，实际缩放后的齿轴最小外露 `.08742184`，七齿均不少于 `.08`。

孟获掌心杆、握环、握位与 root 保持原值；木卵、两骨箍、七齿及木纹亮片组成局部棒头组，整体向杆外侧 `x=-.30`、纵向压至 `.80`。底端维持 `.55`，以埋入两端的弯木颈接回原杆；Tube 与圆接头合成一个同色网格。低举 / 受击 / 垂头时以这一整体空间余量避开猫头。棒头几何最高 `y=1.1908`，保持圆钝短齿造型。

## 冻结源码与实际依赖

全部正式捕获前后，以下四份专属源码 SHA256 完全相同：

```text
src/art3d/heroes.ts
  a52905509eda8750b950c54826b678686842a861ae920a79bd1bcd0c807b711e
src/art3d/parts/hero-ur-regalia.ts
  c092409c3e60b8c09f9d7e3f55ea8cd7b9bb0668b56fd2d75cb23e7c9425dbb9
src/art3d/parts/hero-ur-liu-swords.ts
  7e55df1b9525db50367fa8c4b9d9b9a4b13ccae0c41286e6e5913517eea91e38
src/art3d/parts/hero-ur-weapons.ts
  e5df9c239a404dd40fa9eee3de70de49da1a5b195e54cab94a1fa333aaabcde2
```

按上述顺序直接串接四文件字节的 SHA256：`75b79a46c1fabae8ac82a057931013a01cc60a0330ceafa073f38aa9fa0a58ea`。十猫回放和双剑细节也验证同一哈希；截图不触发源码写入或 HMR。

这一次实际拍摄使用的依赖 SHA256（捕获前后完全一致）：

```text
src/art3d/cat3d.ts
  39b82bcb153baf7a1c0131fc39b1b42dccddce44d69a1724ccbcd04535a62aa4
src/art3d/pose.ts
  3abe84b540c541d2637a36e7291c599d9b5a52318d4524662f122ce803e6431c
src/art3d/toon.ts
  bcb0fcfb3a9011e43d4720e5f2ec6b87f6a931fd7ad31be72c277520968bb837
src/art3d/renderer.ts
  ae998f612ae070288c81c8cf2c03bf605407718b7d2c89f5b042d169eb8bc3db
src/art3d/parts/weapons.ts
  513389ac1938782b32361ad2f2f8fcf673b04c8209145a4cdd9110564e66015a
src/art3d/parts/headgear.ts
  80b57c864f0a276b4809fd6a1cadd6b1e774674025a9c2cc8a5ac93ada89c885
src/art3d/patterns.ts
  bc941057c14b0b339c07898e660390ab6e87601a96dd60ea28a733f0ff281346
src/art3d/parts/body.ts
  36552abd5d042fa806302e2072164e059cbbe1d63ec8daf95d4e3952f88116ca
src/art3d/parts/body-robes.ts
  0deacc5ee8a1c8e766f9e7e9aa803a24ce0c37ce52ef3f23db5f70b15bb24cfd
src/art3d/parts/back.ts
  6736da261b571ae7c9314d42882aba004edaaaf9f251b7e9486896a7f3e340f0
src/fx/actor.ts
  268bc636c0ea4271432c0b0428105e66c204cb6fb5c3739ccb7c0aabb38f238f
src/fx/player.ts
  cd8327161fc99bc207175a53ab88a91f76e3b407a8cba6c7b8426ca8d025da0f
src/data/heroes.ts
  d0be352c7c179c93cb9fa74e45a5cb087df2048078e068a618405b972c06b800
```

当前 `head.scale=1.14*headK`、嘴骨、真实 `POSES.face`、armed 姿态均来自该主线；六位 UR 的 headK 均为 1。本批未修改猫骨架、renderer、Toon、引擎、契约、姿势、英雄数据、毛色或通用部件。

## 官方三姿势、角度与耳峰

`poses.png / poses-small.png / poses-tiny.png` 六行依次为曹、刘、周、吕、孟、左慈，三列为 idle / windup / strike，保持真实主线眯眼 / 张嘴参数。使用官方 cat3d 调试页、正常 bake、phase=0、t=.4、yaw=32°；单格原生 Canvas 分别 290×254、250×219、190×166。250 宽画布中的角色接近约 190px 的战斗阅读尺度，190 小图也由原生 Canvas 渲染，没有缩小大图。

`front-0.png / front-32.png / front-minus32.png / back-148.png` 使用同组六行、idle、250×219 原生单格。`liubei-hands.png / liubei-hands-side.png` 是真实刘备整猫 idle / strike，两格各 450×394，分别 yaw=0° / 32°。`liubei-detail.png` 在原生 550×334 Canvas 单独展示实际主、副剑 builder，不带躯干，不作为整猫姿势或可见度证明；金护手与握段仍保持正式几何与色板。

`ear-peak.png` 两行为曹、周，四列 yaw=0° / 32° / -32° / 148°，真实 `applyPose` 取 phase=0、t=π/1.4≈2.243995，使耳抖达峰；每格 250×219。`inherited-poses.png` 四行为曹、吕、孟、左慈，三列 slump / victory / dash，保留实际正常 bake 姿态和取景限制。十四张最终图均已实际查看。

工作目录 `/workspace/heroes-ur-icons`，Vite 5179 关闭 HMR 并忽略 `.shots` / review 输出；Chromium `/usr/bin/chromium`、SwiftShader、deviceScaleFactor=1、neutral 灯光。FRAME x=[-2.2,2.2]、y=[-.25,3.6]，取景与灯光不改。实际官方命令：

```sh
PORT=5179 CHROME=/usr/bin/chromium npm run shots3d -- .shots/ur-icons/formal-poses.png 'ids=wei_caomiaode,shu_liumiaobei,wu_zhoumiaoyu,qun_lvbuding,man_mengmiaohuo,xian_zuoci&poses=idle,windup,strike&w=290&yaw=32'
PORT=5179 CHROME=/usr/bin/chromium npm run shots3d -- .shots/ur-icons/formal-poses-small.png 'ids=wei_caomiaode,shu_liumiaobei,wu_zhoumiaoyu,qun_lvbuding,man_mengmiaohuo,xian_zuoci&poses=idle,windup,strike&w=250&yaw=32'
PORT=5179 CHROME=/usr/bin/chromium npm run shots3d -- .shots/ur-icons/formal-poses-tiny.png 'ids=wei_caomiaode,shu_liumiaobei,wu_zhoumiaoyu,qun_lvbuding,man_mengmiaohuo,xian_zuoci&poses=idle,windup,strike&w=190&yaw=32'
PORT=5179 CHROME=/usr/bin/chromium npm run shots3d -- .shots/ur-icons/formal-front-0.png 'ids=wei_caomiaode,shu_liumiaobei,wu_zhoumiaoyu,qun_lvbuding,man_mengmiaohuo,xian_zuoci&poses=idle&w=250&yaw=0'
PORT=5179 CHROME=/usr/bin/chromium npm run shots3d -- .shots/ur-icons/formal-front-32.png 'ids=wei_caomiaode,shu_liumiaobei,wu_zhoumiaoyu,qun_lvbuding,man_mengmiaohuo,xian_zuoci&poses=idle&w=250&yaw=32'
PORT=5179 CHROME=/usr/bin/chromium npm run shots3d -- .shots/ur-icons/formal-front-minus32.png 'ids=wei_caomiaode,shu_liumiaobei,wu_zhoumiaoyu,qun_lvbuding,man_mengmiaohuo,xian_zuoci&poses=idle&w=250&yaw=-32'
PORT=5179 CHROME=/usr/bin/chromium npm run shots3d -- .shots/ur-icons/formal-back-148.png 'ids=wei_caomiaode,shu_liumiaobei,wu_zhoumiaoyu,qun_lvbuding,man_mengmiaohuo,xian_zuoci&poses=idle&w=250&yaw=148'
PORT=5179 CHROME=/usr/bin/chromium npm run shots3d -- .shots/ur-icons/formal-liubei-hands.png 'ids=shu_liumiaobei&poses=idle,strike&w=450&yaw=0'
PORT=5179 CHROME=/usr/bin/chromium npm run shots3d -- .shots/ur-icons/formal-liubei-hands-side.png 'ids=shu_liumiaobei&poses=idle,strike&w=450&yaw=32'
PORT=5179 CHROME=/usr/bin/chromium npm run shots3d -- .shots/ur-icons/formal-inherited-poses.png 'ids=wei_caomiaode,qun_lvbuding,man_mengmiaohuo,xian_zuoci&poses=slump,victory,dash&w=250&yaw=32'
```

临时批量脚本 `.shots/ur-icons/formal-capture.mjs` 逐条执行以上命令并核对源和依赖 SHA。耳峰使用 `node .shots/ur-icons/ear-peak.mjs`；细节使用 `node .shots/ur-icons/liu-detail.mjs`，独立相机 x=[-1.45,1.45]、y=[-.41,1.35]、沿 +z 看主副剑，展示容器 x=±.35，builder 根仍为 identity。这些脚本仅输出 scratch，没有修改生产源码。

## 真实十猫战斗与注册命中

实际使用 `battle.html?test=1&r3d=1`、`Player.setup`、场景 HUD 与正常 bake。A 队曹、刘、周、吕、孟；B 队左慈、曹、刘、吕、孟，共十猫、六种正式 ID。临时响应探针在 setup 前包装这六个 `HERO_PARTS` builder，只记录原函数返回值，不改变几何、姿态或返回对象。

```sh
node .shots/ur-icons/formal-battle.mjs
```

显式 query：

```text
test=1&r3d=1&a=wei_caomiaode,shu_liumiaobei,wu_zhoumiaoyu,qun_lvbuding,man_mengmiaohuo&b=xian_zuoci,wei_caomiaode,shu_liumiaobei,qun_lvbuding,man_mengmiaohuo&theme=meadow&seed=2
```

十个 actor 的 `rig.cat3d` 全部存在，具有正常 bake 的 SkinnedMesh；曹 / 刘 / 周 / 吕 / 孟 / 左的专属构建次数为 2 / 2 / 1 / 2 / 2 / 1，十次全部命中。两只刘备都具有 `ur.liumiaobei.dualSwords.main` 和 `.offhand` 左右手组，其余冠 / 武器组名与各映射一致。原生战斗 Canvas 948×593，viewport=980×620；从 0 秒开始每 .5 秒步进，十二帧 nominal t=.5…6.0，每帧十猫均 alive 且有 cat3d。

`battle.webp` 为编号 00（.5 秒），`battle-action.webp` 为 09（5 秒）；完整十二帧保留 `.shots/ur-icons/formal-battle_00.png…11.png`。page errors 为 0；Google Fonts 外部请求被环境网络阻止，中文使用系统 CJK 回退。随机 phase 和技能白闪等视觉效果保持引擎行为；raw→final 像素相同不表示不同回放之间逐像素相同。

## 无损导出

PNG 使用 Pillow optimize / level9，战斗 PNG 转 lossless WebP；保留原生完整尺寸，不裁图、不重采样、不补画。逐一比较 raw / final 的 RGBA 解码字节与每通道差值，十四文件全部字节相同、最大差 0，均严格小于 500000 字节。

| 文件 | 完整图尺寸 | raw 字节 → final 字节 | RGBA 最大差 |
| --- | --- | ---: | ---: |
| [poses.png](poses.png) | 1000×1570 | 500495 → 495646 | 0 |
| [poses-small.png](poses-small.png) | 1000×1360 | 407539 → 404184 | 0 |
| [poses-tiny.png](poses-tiny.png) | 1000×1042 | 276195 → 273822 | 0 |
| [front-0.png](front-0.png) | 1000×1360 | 159536 → 157862 | 0 |
| [front-32.png](front-32.png) | 1000×1360 | 160153 → 158372 | 0 |
| [front-minus32.png](front-minus32.png) | 1000×1360 | 156279 → 154320 | 0 |
| [back-148.png](back-148.png) | 1000×1360 | 115756 → 114410 | 0 |
| [liubei-hands.png](liubei-hands.png) | 1000×700 | 116654 → 113880 | 0 |
| [liubei-hands-side.png](liubei-hands-side.png) | 1000×700 | 114915 → 112501 | 0 |
| [inherited-poses.png](inherited-poses.png) | 1000×914 | 257838 → 254955 | 0 |
| [ear-peak.png](ear-peak.png) | 1030×500 | 156787 → 155752 | 0 |
| [liubei-detail.png](liubei-detail.png) | 566×396 | 34364 → 35212 | 0 |
| [battle.webp](battle.webp) | 948×593 | 577481 → 418764 | 0 |
| [battle-action.webp](battle-action.webp) | 948×593 | 558357 → 403630 | 0 |

`.shots/ur-icons/formal-export-report.json` 记录逐图对照；`formal-capture-report.json` 和 `formal-battle-report.json` 记录 source、依赖、query、注册命中与帧数。

## 验证、继承限制与最不满意

最终刘备 / 左慈修订后，当前 29f 工作树实际执行 `npm run typecheck && npm test` 均退出 0，无 Date shim：68 个文件、1019 项全通过，日志 `.shots/ur-icons/tests-all-weapons-final-29.log`。主任务在修订前同版 native required 也通过，日志 `tests-main-29f6.log`。e777→29f 的 art3d / look / actor / player 代码字节差为 0，测试修复不影响取景。

保留日期失败的验证历史：e777 的 typecheck 通过；系统真实时间 2026-10-12 的 `npm test` 为 67 个文件 / 1018 项通过，1 项 `tests/explore.test.ts:59` 每日委托日期断言失败：测试固定 t0 为 10 月 11 日，但 killReward / openChest 默认 Date.now()，跨每日 5 点刷新使进度重置。干净 e777 baseline 单独运行同文件也得到相同失败（29 通过 / 1 失败）。临时 `/tmp` Date shim 把该测试进程时间固定在其 fixture 的 10 月 11 日中午，再运行全套得到 68 文件 / 1019 项全部通过；未改系统时钟、测试或业务源码。不能把此控制运行写成真实时钟的全绿结果。主线随后 `29f6a8b` 已修复该测试日期，已经同步，最终 required 的依据是上面的真实时钟原生结果。

作者使用当前 29f（美术依赖与 e777 相同）正常 bake 对 336 个 14 姿势 / 四 yaw 样本、24 个耳峰样本、216 个 idle / windup / strike 额外时点样本，共 576 例检查：坐标全有限，FRAME margin 无新增；71 个非目标整猫几何 / 材质 / 骨架签名及 77 个无 heroId 的 stock 输出与同版 baseline 相同。描边烘焙包含在边界检查内；根 identity、材质缓存、正 determinant、最高分段 20 均通过。刘原通用外展颈管的四个三角方向诊断旧新相同，保持其握段与刀座。

吕布丁最终实际源码对完整刀头 / 紫系带 / 上箍八个本体及合并曲木颈，另用真实 skull 28×21（1120 面）半空间裁剪：14 个实际 POSES × 14 个 distinct t（12 个 t=i×8/11，加 t=.4 和耳峰），共 196 例。本体→头本体、描边→头本体、描边→头描边全部 0。另有独立锁旧源码网格重组的只读候选 199 例，包含 17 个 dash 时点，三类接触全部 0；最终 source 的独立完整核查见 QA。月刃从后颅移到侧外，不靠隐藏或改姿势。

左慈最终实际源码对环 / 青珠 / 托座 / 短侧珠九个本体、青穗结 / 穗片 / 折纹三个本体及合并曲木颈，同样检查 196 个实际姿态时点，三类本体 / 描边接触全部 0。上段整体绕局部 y=.50 向外斜 .90 rad，下杆维持原锥度与掌心握段，短侧珠有实体细线连接，曲木颈连续接托座。独立只读候选另核 199 例三类均 0；最终 source 的独立结果见 QA。

刘备高举时新短穗尾尖曾比同版通用根更深入头部约 .0431 世界单位，约 190px 又几乎不能辨认，因此最终撤除两手 cord / knot / cloth / folds，保留双剑、金卷护手和既有掌心 / 外展刀座。每手 8 个逻辑网格，双手合计 16。刀刃长宽 / 挂装匹配同版通用双剑；护孔内壁 / 曲面细分使三角表面积不能直接解释为占据体积增加。实际 blade-mount 的最深接触与通用部件仍有约 .00007 / .00059 世界单位级别差异，需按独立有限样本记录，不能宣称握段 / 剑刃所有姿态接触为零。

孟获最终实际源码另用真实 skull 28×21（1120 面）的半空间裁剪：14 个实际 POSES × 每姿势 12 个 t=i×8/11，加 t=.4 和耳峰 t=π/1.4，共 196 例，phase=0；dash 取 moving=true，其余姿势取 moving=false。棒头 11 个本体网格及连续木颈逐三角检查；本体→头本体、描边→头本体、描边→头描边均 0。七齿实际缩放后的外露均≥.08。这是实际面裁剪的有限采样结果，不能外推为全部连续动画证明；旧角度试验与旧接触数字仅留 scratch，不作为最终版范围上限。

独立最终复核锁定完整 src 339 文件，29 个运行导入均来自不可变快照，四美术源与 18 依赖前后 SHA 一致。300 例（六位 ×14 姿势 t=.4，再 idle / windup / strike ×12 时间点）有效眼核点 66521、单眼最少 50，新增 eye-core sample ID 与五固定鼻口 ID 均为 0；另对真实活跃嘴骨三角取三个代表质心，210 张口 / 90 微笑例新增 ID 0。这些是有限几何采样，不是全部像素或连续时间证明。主审保留所选部件原网格以单独采样，五官其余网格真实 bake；正常 bake 的 FRAME 与原生实图另行复核。

300 例新增裁切 / margin / 非有限均 0，仍有 60 例基线已有的整猫裁切（baseline 61），曹低冠消除 castUp 的一个原有裁切。构建检查覆盖 77 位英雄 / 杂兵与 12 PET，共 89 个实际单位；71 非目标、77 无 heroId 的通用输出与另查 12 PET 的属性 / 索引按 Uint8Array 原字节相同。三杆完整新增上部 / 饰物 / 真颈各 199 个不同实际形位，三件合计 597 例（14×14，加 dash .2/.8/1.2；dash 共17时间）严格实际 skull / shell ConvexHull 逐三角裁剪，三种本体 / 描边组合均 0；吕 16、孟 23、左 22 个物理网格分别覆盖，不能把此结果扩大到所有握段或全部连续动画。

独立耳峰检查曹三冠板对耳本体 / 描边相交 0，冠帽耳根接合在实际颅骨内；周最小描边间隙 `.00852802` 世界单位，仍偏紧。最终六 UR 的正常 bake 原生218×190三姿势四yaw、耳峰、三杆关键姿态、刘高举样本均已独立实际查看。完整有限范围、继承接触和同版 baseline / 最终 candidate 图见 [QA 摘要](qa-summary.md)、[机器报告](qa-summary.json)、[before-after.png](before-after.png)；作者不覆盖这三个文件。

继承姿态接触仍存在：原长杆沿掌心 +y，在部分动作进入头側或后下部；旧通用孟获灰棒头在低举 / 受击 / 垂头也有实际三角接触，不能把所有旧问题都叫握段接触。吕 castFwd / thrust 的通用旧长杆也有实际三角接触，不能把原端点计数 0 当成整个长面的无交证明，也不能以候选握环顶点数量判断月刃是否穿头；最终月刃 / 紫带 / 上箍 / 弯木颈已单独对实际颅骨重验。继承取景外溢包括曹长披风下沿、吕雉尾上沿及部分下沿、左慈 victory 冠饰上沿；最终 576 例旧新 margin 未增加。

最不满意：双剑高举时仍继承通用掌心 / 护手的头部接触；本批保留原挂装，无法用单独部件图代表所有整猫姿态。吕双月牙和左慈金环在 strike 偏侧视变窄，长杆头部亦可能被头挡住；左慈金环对浅色猫 / 明亮背景对比较弱。孟短棒头让开头部后，内侧短齿仍有正常遮挡，需以整猫与战斗图判断识别，不靠纯部件细节夸大效果。

## 周瑜古琴待契约

周喵瑜本批只完成低吴冠，古琴仍是已有通用 `qin` 单手部件。横跨双掌抱琴 / 演奏需要 torso 挂点和琴专用姿势，或明确 gripR / gripL 配合 FK / IK；当前 PartCtx 无关节回调，两手分别运动，`offhand` 只挂第二个独立物体。完整 [琴挂点 / 姿态合同请求](qin-contract-request.md) 是主任务随本批交 Claude 审阅的提案，本批没有更改契约、引擎或姿势，也没有把双琴或分开的两半记为已完成横抱琴。
