# 披挂首批：长披风 / 双飘带 / 分层羽翼

本批替换 `BACK.capeLong / ribbons / wings` 三项，造型函数放在 `back-sp-regalia.ts`。长披风由短披肩、起伏布折、圆弧金边和中央尾根开口组成；双飘带有封口厚度、布面扭转、浅内衬及露出的自由端；羽翼有五片外羽、四片内羽和根部束环。全部保持 back 根 position / rotation 为零、scale 为一，使用缓存 Toon 材质。

## 实际使用者与参考

| 部件 | 英雄 | 宠物 |
| --- | --- | --- |
| capeLong | 司马喵懿 `wei_simamiyi`、曹喵德 `wei_caomiaode`、吕布丁 `qun_lvbuding` | 金金 `pet_jinjin` |
| ribbons | 嫦喵 `xian_changmiao`、孙香香 `wu_sunxiangxiang`、貂蝉喵 `qun_diaochan` | 点点 `pet_diandian`、九尾 `pet_jiuwei` |
| wings | 庞喵统 `shu_pangmiaotong` | 小龙猫 `pet_longmao`、星星 `pet_xingxing` |

共 **12 位：7 英雄 + 5 宠物**，没有杂兵。原进度表仅列英雄；新宠物共用现有注册项，未改 `pets.ts` 或任一 look / Palette。

以下参考均已实看，并核对 [ART_PROMPTS](../../../../../docs/ART_PROMPTS.md)、英雄 lore 和 [宠物设定](../../../../../docs/PETS.md)：

| 英雄 | 原 JPG | 批准立绘 |
| --- | --- | --- |
| 司马喵懿 | [ref](../../../../../assets/heroes/ref/wei_simamiyi.jpg) | [full](../../../../art/illust/wei_simamiyi.full.webp) |
| 嫦喵 | [ref](../../../../../assets/heroes/ref/xian_changmiao.jpg) | [full](../../../../art/illust/xian_changmiao.full.webp) |
| 庞喵统 | [ref](../../../../../assets/heroes/ref/shu_pangmiaotong.jpg) | [full](../../../../art/illust/shu_pangmiaotong.full.webp) |
| 曹喵德 | [ref](../../../../../assets/heroes/ref/wei_caomiaode.jpg) | [full](../../../../art/illust/wei_caomiaode.full.webp) |
| 吕布丁 | [ref](../../../../../assets/heroes/ref/qun_lvbuding.jpg) | — |
| 孙香香 | [ref](../../../../../assets/heroes/ref/wu_sunxiangxiang.jpg) | — |
| 貂蝉喵 | [ref](../../../../../assets/heroes/ref/qun_diaochan.jpg) | — |

长披风采用批准立绘的叠折、金边下摆；嫦喵采用宽布弧线和浅色内衬；庞统采用红外羽、浅色内羽的凤翼层次，羽尖圆钝。披风布面取 `pal.sub`、短披肩取 `pal.main`；飘带取 `pal.sub / cloth ?? main`；外羽取 `pal.main`、内羽取 `pal.cloth ?? trim`、翼根取 `pal.sub`；金边、扣和束环均取 `pal.trim`。宠物没有单独批准立绘，造型和颜色继承现有 look / tagline。

翼幅只在 `look.build < .8` 时按 `clamp(build, .7, 1)` 收窄内部左右翼组的正 X scale；根保持单位 scale，羽长、厚度、尖形与 y/z 位置保持原造型。目前只有两位翼类宠物的 build=.7 命中；庞统 build=.92 和所有正常体型使用者保持同一几何输出。没有按英雄 ID、姿势或透明度隐藏饰物。

## 固定基线与交付图

最终基线 `e777d58f3b0e9965f7af25ded73948a84e68d219`，使用其新衣服、全部毛色花纹、纯白嫦喵、手臂前举和表情。取景、引擎、数据、姿势与通用材质均未在本批修改。

| 文件 | SHA-256 |
| --- | --- |
| back.ts | `1f7074104ea1861ff1e8f1c0b359a81bd9b3dace5d0119fca1b778ecac0709eb` |
| back-sp-regalia.ts | `b356c5152e9608eec6a43337c0d4e56bcc09614e8026eb8ecbe57360d60b45e7` |
| cat3d.ts | `39b82bcb153baf7a1c0131fc39b1b42dccddce44d69a1724ccbcd04535a62aa4` |
| pose.ts | `3abe84b540c541d2637a36e7291c599d9b5a52318d4524662f122ce803e6431c` |
| body.ts | `36552abd5d042fa806302e2072164e059cbbe1d63ec8daf95d4e3952f88116ca` |
| patterns.ts | `bc941057c14b0b339c07898e660390ab6e87601a96dd60ea28a733f0ff281346` |

静态截图实际使用 `buildCat3D(lookOf(id), id)` 和正常产品 bake / outline，phase=0、t=.4；每行左到右 `idle / windup / strike`。`poses.png` 为三 SP、yaw32°、w290；其余单格 w250（250×219，常规角色约190px），方向由后缀表示：`190px=32° / front=0° / reverse=-32° / back=148°`。

三组固定行序：`sp` 为司马 / 嫦喵 / 庞统；`heroes` 为曹 / 吕 / 孙香香 / 貂蝉；`pets` 为金金 / 点点 / 九尾 / 小龙猫 / 星星。按原生行组分文件，没有缩放或裁切截图。

| 文件 | 原生尺寸 | 字节数 |
| --- | --- | --- |
| [poses.png](poses.png) | 1000×796 | 254973 |
| [sp-190px.png](sp-190px.png) | 1000×700 | 206940 |
| [heroes-190px.png](heroes-190px.png) | 1000×914 | 278070 |
| [pets-190px.png](pets-190px.png) | 1000×1137 | 354410 |
| [sp-front.png](sp-front.png) | 1000×700 | 211258 |
| [heroes-front.png](heroes-front.png) | 1000×914 | 271334 |
| [pets-front.png](pets-front.png) | 1000×1137 | 342460 |
| [sp-reverse.png](sp-reverse.png) | 1000×700 | 210894 |
| [heroes-reverse.png](heroes-reverse.png) | 1000×914 | 274649 |
| [pets-reverse.png](pets-reverse.png) | 1000×1137 | 351893 |
| [sp-back.png](sp-back.png) | 1000×700 | 184649 |
| [heroes-back.png](heroes-back.png) | 1000×914 | 242612 |
| [pets-back.png](pets-back.png) | 1000×1137 | 299158 |
| [battle.webp](battle.webp) | 948×593 | 408296 |
| [pet-battle.webp](pet-battle.webp) | 948×593 | 430292 |

全部 PNG 使用 `optimize=True, compress_level=9` 无损编码，两张战斗 PNG 使用 `lossless=True, quality=100, method=6` 转 WebP；编码前后完整解码 RGBA 字节相同，全部 <500000 字节。

小体型收翼后四张宠物块和宠物战斗重拍。其余九张英雄图与十猫战斗保留同一 e777 引擎的原图：逐个显式 id 构建全部 89 单位后，只有两位翼类宠物的几何改变，其余 **87 位完整属性 / 索引 / 骨绑定签名逐字节相同**；保留 PNG 文件 SHA 也与拍摄版本相同。记录在未提交的 `.shots/back-sp-regalia/narrow-geometry-identity.json` 和 `final-figure-manifest.json`，没有把保留图的实际拍摄源 hash 改成新 hash。旧引擎图、较宽翼候选图均留在 `.shots` 历史目录，不作为交付。

## 真实十猫与宠物登场

`battle.webp` 为 frame00、名义 step 时间3.25s。A：司马 / 嫦喵 / 庞统 / 曹 / 吕；B：孙香香 / 貂蝉 / 刘备 / 华佗 / 诸葛。读取真实 `player.actors`：**10/10 个主 actor 有 cat3d，7/7 目标有实际注册部件组**；其余3位是对照用户，没有这三种组。共录十二帧，页面运行异常0。

`pet-battle.webp` 使用同阵容加 `pet=pet_xingxing`，通过现有 `__demo.advance(.5)` 让回放实际进入宠物技。名义17s时 `player.petActors` 中 A 侧星星 alpha=1、cat3d=true，真实 wing builder 命中1次；主 `actors` 仍单独为10，不把宠物混算主演员。随后十二次 `.05` advance 记录出场动作，第00帧为名义17.05s；这些是推进参数，非帧率或连续运行耗时。

另用相同 e777 引擎和真实 doPet 流程，对该宠物装配旧 `BACK.wings` 作比较，主阵容的部件保持候选。当前十二帧含实际描边的 owned 顶点，按实际 actor / camera 投影到960×600舞台，左侧最小余量 **10.64逻辑px**；即使统一扣除本次最大 shake=4，仍有6.64px（约6.56截图px）。旧翼比较也在内。这个舞台检查与模型 FRAME 检查分别记录，不能从 FRAME=0 自动推出舞台不裁切。

证据为未提交的 `.shots/back-sp-regalia/battle-audit.json`、`pet-battle-audit.json`、`pet-baseline-audit.json` 和各自十二帧 raw PNG。战斗外部 Google Fonts 有一次网络失败，系统中文字体回退后标签正常显示；没有产品运行异常。没有移动模型根、演员位置或镜头，没有替换产品材质。

## 独立检查

独立 [qa-summary.md](qa-summary.md) 与 [qa-summary.json](qa-summary.json) 覆盖同一最终基线、全部12位和2400个样本；[before-after.png](before-after.png) 是七位英雄的正常背向旧新对照。新增眼点ID、可见鼻口遮挡、取景增幅均为0；600个不同相对姿态中，部件本体及描边与实际1120三角颅骨凸壳的内部顶点 / 三角均为0。

保守深度采样还有48个新增鼻口点，全部属于148°背视，46点先被头壳遮住、2点先被肩遮住；它们没有造成新增可见面部遮挡。最终保留62个旧眼深度ID、17个case，不能把这些数值写成所有raw遮挡均为0。完整采样ID、深度分类与方法边界见独立报告。

## 作者自查与边界

`npm run typecheck && npm test` 退出0：**68 文件 / 1019 测试**；`git diff --check` 通过。测试和 Chromium 在当前环境带附加网络权限运行。

维护者在交付时另同步主线 `29f6a8bbe66bbcf4ea1c0119675cac65f8c4e00a`（含每日委托测试日期修复），实际再次运行相同命令，退出0、68文件/1019测试全部通过，日志 `.shots/back-sp-regalia/tests-main-29f6.log`。e777→29f6 的 art3d、英雄/杂兵/宠物 look、actor/player 文件没有变化；本批两份源文件及十九个审图文件字节不变，正式图和独立报告的 e777 拍摄基线仍准确。

| 部件 | 逻辑 Mesh | 描边子 Mesh | 实际 Mesh | 最大分段 |
| --- | ---: | ---: | ---: | --- |
| capeLong | 12 | 12 | 24 | cloth16×6 / Tube20×6 / sphere12×9 |
| ribbons | 10 | 8 | 18 | cloth20×2 / Tube20×6 / sphere12×9 |
| wings | 22 | 22 | 44 | Extrude curve6 / bevel2 / Tube20×6 / sphere12×9 |

按 BRIEF 描边随父 Mesh 算1个。每个使用者直接构建三次，root独立，根变换为零 / 一；材质身份复用、负行列式和反绕序三角均通过。没有新增依赖或独立动画，部件只在装配时生成，每帧不分配对象。

作者 CPU 比较12位 ×（14静态姿势 ×4方向 +3姿势 ×12时刻 ×4方向），旧新各 **2400例**，方向0/-32/32/148，动画 t=0～8s。整猫用正常 bake 真实蒙皮顶点；owned 部件额外计入描边法线外扩。坐标有限，披挂自身越框0、整猫新增裁切幅度0；四位长披风使用者的旧 owned 底部256例全部消除，整猫有裁切的样本760→568。89个真实 id 中77个非目标单位签名全部相同。

保留的旧整猫 top 越框：曹4、吕108、嫦喵4、金金200、小龙猫64、九尾188例。金金的高冠在普通图也可见原有顶部裁切；本批不改头饰或 FRAME。作者尾骨原点到 owned 三角的中心距与背向图只辅助核对尾根空隙，不替代完整表面交叉或可见遮挡检查。普通 art3d 测试不传 heroId，也不覆盖所有宠物和这些动作，因此以上显式装配、采样与实际战斗另做。

最不满意：飘带左右弧线仍较对称，远处金边和内衬细节减弱；羽翼背面浅内羽部分被红外羽覆盖，正面分层更清楚。小宠物收翼后保持轮廓，但在战斗里单片羽纹仍较小。

## 复现截图参数

临时稳定 Vite 端口5180，关闭HMR，忽略 `.shots/**` 和 `parts/reviews/**`。下面是实际使用的产品 `shots3d` 参数；临时脚本不提交。

```bash
CHROME=/usr/bin/chromium PORT=5180 npm run shots3d -- src/art3d/parts/reviews/back-sp-regalia/poses.png 'ids=wei_simamiyi,xian_changmiao,shu_pangmiaotong&poses=idle,windup,strike&yaw=32&w=290'
CHROME=/usr/bin/chromium PORT=5180 npm run shots3d -- src/art3d/parts/reviews/back-sp-regalia/sp-190px.png 'ids=wei_simamiyi,xian_changmiao,shu_pangmiaotong&poses=idle,windup,strike&yaw=32&w=250'
CHROME=/usr/bin/chromium PORT=5180 npm run shots3d -- src/art3d/parts/reviews/back-sp-regalia/heroes-190px.png 'ids=wei_caomiaode,qun_lvbuding,wu_sunxiangxiang,qun_diaochan&poses=idle,windup,strike&yaw=32&w=250'
CHROME=/usr/bin/chromium PORT=5180 npm run shots3d -- src/art3d/parts/reviews/back-sp-regalia/pets-190px.png 'ids=pet_jinjin,pet_diandian,pet_jiuwei,pet_longmao,pet_xingxing&poses=idle,windup,strike&yaw=32&w=250'
CHROME=/usr/bin/chromium PORT=5180 npm run shots3d -- src/art3d/parts/reviews/back-sp-regalia/sp-front.png 'ids=wei_simamiyi,xian_changmiao,shu_pangmiaotong&poses=idle,windup,strike&yaw=0&w=250'
CHROME=/usr/bin/chromium PORT=5180 npm run shots3d -- src/art3d/parts/reviews/back-sp-regalia/heroes-front.png 'ids=wei_caomiaode,qun_lvbuding,wu_sunxiangxiang,qun_diaochan&poses=idle,windup,strike&yaw=0&w=250'
CHROME=/usr/bin/chromium PORT=5180 npm run shots3d -- src/art3d/parts/reviews/back-sp-regalia/pets-front.png 'ids=pet_jinjin,pet_diandian,pet_jiuwei,pet_longmao,pet_xingxing&poses=idle,windup,strike&yaw=0&w=250'
CHROME=/usr/bin/chromium PORT=5180 npm run shots3d -- src/art3d/parts/reviews/back-sp-regalia/sp-reverse.png 'ids=wei_simamiyi,xian_changmiao,shu_pangmiaotong&poses=idle,windup,strike&yaw=-32&w=250'
CHROME=/usr/bin/chromium PORT=5180 npm run shots3d -- src/art3d/parts/reviews/back-sp-regalia/heroes-reverse.png 'ids=wei_caomiaode,qun_lvbuding,wu_sunxiangxiang,qun_diaochan&poses=idle,windup,strike&yaw=-32&w=250'
CHROME=/usr/bin/chromium PORT=5180 npm run shots3d -- src/art3d/parts/reviews/back-sp-regalia/pets-reverse.png 'ids=pet_jinjin,pet_diandian,pet_jiuwei,pet_longmao,pet_xingxing&poses=idle,windup,strike&yaw=-32&w=250'
CHROME=/usr/bin/chromium PORT=5180 npm run shots3d -- src/art3d/parts/reviews/back-sp-regalia/sp-back.png 'ids=wei_simamiyi,xian_changmiao,shu_pangmiaotong&poses=idle,windup,strike&yaw=148&w=250'
CHROME=/usr/bin/chromium PORT=5180 npm run shots3d -- src/art3d/parts/reviews/back-sp-regalia/heroes-back.png 'ids=wei_caomiaode,qun_lvbuding,wu_sunxiangxiang,qun_diaochan&poses=idle,windup,strike&yaw=148&w=250'
CHROME=/usr/bin/chromium PORT=5180 npm run shots3d -- src/art3d/parts/reviews/back-sp-regalia/pets-back.png 'ids=pet_jinjin,pet_diandian,pet_jiuwei,pet_longmao,pet_xingxing&poses=idle,windup,strike&yaw=148&w=250'
```

十猫拍摄沿用现有逐帧工具（Chromium `/usr/bin/chromium`、端口5180），参数 `r3d=1&seed=2&theme=meadow`，步长 `.25`、12帧、startAt=3；宠物另加 `pet=pet_xingxing`，通过上述 advance 钩子实际召出，读取 `petActors` 并记录十二帧。
