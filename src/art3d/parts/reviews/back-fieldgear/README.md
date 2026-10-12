# BACK 随身披挂第 2 批（第 1 轮待审）

短披风现在有贴肩叠层、柔弧下摆与中央尾口；葫芦连成清楚的双腹壶身，以腰结和吊带固定；毛披肩采用短厚皮片与大块圆钝毛边。交付 `cape / gourd / furCloak` 三项及独立 helper，全部按现有 back 插槽装配。

基线固定 `29f6a8bbe66bbcf4ea1c0119675cac65f8c4e00a`，分支 `codex/3d-back-fieldgear`。衣服、武器与正常蒙皮使用该主线实现。此批共有 **11 英雄 + 2 杂兵 + 3 宠物 = 16** 位实际使用者；每位都以 `buildCat3D(lookOf(id),id)` 真实命中 BACK 注册函数。

| 部件 | 实际使用者 | 逻辑 / 含描边 Mesh | 最大分段 |
| --- | --- | ---: | ---: |
| `cape` | `shu_liumiaobei`, `wei_xiahoudun`, `shu_guanyunmiao`, `shu_zhangmiaofei`, `shu_machao`, `wu_sunxiaoba`, `pet_meiqiu`, `pet_xueqiu`, `pet_shouhu` | 12 / 24 | 20 |
| `gourd` | `wei_guojia`, `xian_zuoci`, `mob_wei_healer`, `mob_man_healer` | 10 / 20 | 20 |
| `furCloak` | `qun_dongzhuo`, `man_mengmiaohuo`, `man_mulu` | 16 / 32 | 20 |

描边合计为原件一个逻辑网格。三次装配产生不同根对象并复用缓存 Toon/outline 材质，根位置/旋转为 0、尺度为 1，子节点尺度均为正。几何只在装配时生成，没有每帧更新回调或分配。既有其他 BACK 条目沿用基线。

## 实际参考与配色

已实际查看以下十一张原 JPG，以及 [刘喵备批准立绘](../../../../art/illust/shu_liumiaobei.full.webp)，并阅读 [ART_PROMPTS](../../../../../docs/ART_PROMPTS.md) 与角色 lore。

- 披风：[shu_liumiaobei](../../../../../assets/heroes/ref/shu_liumiaobei.jpg)、[wei_xiahoudun](../../../../../assets/heroes/ref/wei_xiahoudun.jpg)、[shu_guanyunmiao](../../../../../assets/heroes/ref/shu_guanyunmiao.jpg)、[shu_zhangmiaofei](../../../../../assets/heroes/ref/shu_zhangmiaofei.jpg)、[shu_machao](../../../../../assets/heroes/ref/shu_machao.jpg)、[wu_sunxiaoba](../../../../../assets/heroes/ref/wu_sunxiaoba.jpg)。
- 葫芦：[wei_guojia](../../../../../assets/heroes/ref/wei_guojia.jpg)、[xian_zuoci](../../../../../assets/heroes/ref/xian_zuoci.jpg)。
- 兽皮：[qun_dongzhuo](../../../../../assets/heroes/ref/qun_dongzhuo.jpg)、[man_mengmiaohuo](../../../../../assets/heroes/ref/man_mengmiaohuo.jpg)、[man_mulu](../../../../../assets/heroes/ref/man_mulu.jpg)。

刘备立绘的宽布叠层、连续金边用于短披风的肩折与弧形分摆；将军图保留各自阵营主辅色。郭嘉 lore 的酒葫芦里装猫薄荷奶，原图与左慈图都是腰后小壶，因此采用一体双腹、木塞、收腰束绳及实际接到背扣的吊带。孟获、木鹿图的厚皮肩覆用于毛披肩；董桌保留原紫色袍，背面仍采用原有暖棕兽皮设定。三只披风宠物和两只医喵杂兵的现有原生三姿势也已实际看过，宠物设置见 [PETS](../../../../../docs/PETS.md)。

- 披风：肩折 `pal.main`、主布 `pal.sub`、滚边/扣 `pal.trim`；小体型的几何 X 宽度按 `look.build < .8` 收窄，三个宠物均为 .7，根和槽位保持单位。
- 葫芦：沿用旧壶 `#c98a3a`，木塞 `#775134`，吊带 `pal.sub`，束绳 `pal.trim`。壶体中心为 back 局部 `(-.49,-.31,-.23)`，背扣 `(.40,.025,-.10)`；吊带连至收腰结，木塞与颈圈贴在壶口，束绳环贴合壶腰。
- 毛披肩：主皮 `#9f784e`、肩覆 `#a8845a`、大块毛边 `#c9ad80 / #bda071`，皮束与扣来自 `pal.sub / trim`；体宽按 `1 + (build-1)*.5` 适配，董桌 build1.3 对应1.15，中央尾口保持开放。

## 源码与拍摄版本

- `src/art3d/parts/back.ts`：`50171fc70ea9b9a2d74f544cc86bcdcdbaa068311031d517543606946034f162`。
- `src/art3d/parts/back-fieldgear.ts`：`87a4a0b05b51cf180ff64d1a2ba52f62282f128322432832dffa1f712326c3aa`。
- `src/art3d/cat3d.ts`：`39b82bcb153baf7a1c0131fc39b1b42dccddce44d69a1724ccbcd04535a62aa4`。
- `src/art3d/pose.ts`：`3abe84b540c541d2637a36e7291c599d9b5a52318d4524662f122ce803e6431c`。
- `src/art3d/parts/body.ts`：`36552abd5d042fa806302e2072164e059cbbe1d63ec8daf95d4e3952f88116ca`。
- `src/art3d/patterns.ts`：`bc941057c14b0b339c07898e660390ab6e87601a96dd60ea28a733f0ff281346`。
- `src/fx/actor.ts`：`268bc636c0ea4271432c0b0428105e66c204cb6fb5c3739ccb7c0aabb38f238f`。

全部二十三张作者交付图都拍于最终 **50171 / 87a4** 源码与上述引擎，原生普通 bake；没有保留旧候选图。初始 5a95 毛披肩候选、作者早期 3200 样本和未冻结截图只保留临时记录，不作为最终交付。稳定 Vite 为 5186，关闭 HMR 并忽略 `.shots/**` 与 `parts/reviews/**`；正式姿势批次自动记录上述源文件拍摄前后 SHA，全部一致。完整逐图 query/raw 路径、源哈希、原始 PNG 与交付图哈希见临时 `.shots/back-fieldgear/capture-manifest.json` / `final-figure-manifest.json`，真实战斗与宠物逐帧记录也在该临时目录。

## 原生三姿势

每行从左到右 idle / windup / strike，phase=0、t=.4，普通 Toon/outline 与正常蒙皮。`poses.png` 单格290×254；其余单格250×219，角色约190px。每个使用者都有 0 / +32 / -32 / 148° 四朝向。按行分块保留原像素尺寸，未缩小或重排图像。

| 图组 | 从上到下 | +32° | 0° | -32° | 148° |
| --- | --- | --- | --- | --- | --- |
| 披风 A | 刘备、夏侯墩、关羽 | [小尺寸](cape-a-190px.png) | [正面](cape-a-front.png) | [反向](cape-a-reverse.png) | [背视](cape-a-back.png) |
| 披风 B | 张飞、马超、孙策 | [小尺寸](cape-b-190px.png) | [正面](cape-b-front.png) | [反向](cape-b-reverse.png) | [背视](cape-b-back.png) |
| 葫芦 | 郭嘉、左慈、温奶医喵、山草医喵 | [小尺寸](gourd-190px.png) | [正面](gourd-front.png) | [反向](gourd-reverse.png) | [背视](gourd-back.png) |
| 毛披肩 | 董桌、孟获、木鹿 | [小尺寸](fur-190px.png) | [正面](fur-front.png) | [反向](fur-reverse.png) | [背视](fur-back.png) |
| 宠物披风 | 煤球、雪球、守护喵 | [小尺寸](pets-190px.png) | [正面](pets-front.png) | [反向](pets-reverse.png) | [背视](pets-back.png) |

[290px 代表图](poses.png) 为刘备、左慈、孟获。实际截图命令使用 `PORT=5186 CHROME=/usr/bin/chromium node tools/cat3d-shots.mjs <raw.png> '<query>'`；正式 batch 等价地复用一个 Chromium 逐页拍摄，二十一条 query 如下。

```text
poses.png  ids=shu_liumiaobei%2Cxian_zuoci%2Cman_mengmiaohuo&poses=idle%2Cwindup%2Cstrike&yaw=32&w=290
cape-a-190px.png  ids=shu_liumiaobei%2Cwei_xiahoudun%2Cshu_guanyunmiao&poses=idle%2Cwindup%2Cstrike&yaw=32&w=250
cape-a-front.png  ids=shu_liumiaobei%2Cwei_xiahoudun%2Cshu_guanyunmiao&poses=idle%2Cwindup%2Cstrike&yaw=0&w=250
cape-a-reverse.png  ids=shu_liumiaobei%2Cwei_xiahoudun%2Cshu_guanyunmiao&poses=idle%2Cwindup%2Cstrike&yaw=-32&w=250
cape-a-back.png  ids=shu_liumiaobei%2Cwei_xiahoudun%2Cshu_guanyunmiao&poses=idle%2Cwindup%2Cstrike&yaw=148&w=250
cape-b-190px.png  ids=shu_zhangmiaofei%2Cshu_machao%2Cwu_sunxiaoba&poses=idle%2Cwindup%2Cstrike&yaw=32&w=250
cape-b-front.png  ids=shu_zhangmiaofei%2Cshu_machao%2Cwu_sunxiaoba&poses=idle%2Cwindup%2Cstrike&yaw=0&w=250
cape-b-reverse.png  ids=shu_zhangmiaofei%2Cshu_machao%2Cwu_sunxiaoba&poses=idle%2Cwindup%2Cstrike&yaw=-32&w=250
cape-b-back.png  ids=shu_zhangmiaofei%2Cshu_machao%2Cwu_sunxiaoba&poses=idle%2Cwindup%2Cstrike&yaw=148&w=250
gourd-190px.png  ids=wei_guojia%2Cxian_zuoci%2Cmob_wei_healer%2Cmob_man_healer&poses=idle%2Cwindup%2Cstrike&yaw=32&w=250
gourd-front.png  ids=wei_guojia%2Cxian_zuoci%2Cmob_wei_healer%2Cmob_man_healer&poses=idle%2Cwindup%2Cstrike&yaw=0&w=250
gourd-reverse.png  ids=wei_guojia%2Cxian_zuoci%2Cmob_wei_healer%2Cmob_man_healer&poses=idle%2Cwindup%2Cstrike&yaw=-32&w=250
gourd-back.png  ids=wei_guojia%2Cxian_zuoci%2Cmob_wei_healer%2Cmob_man_healer&poses=idle%2Cwindup%2Cstrike&yaw=148&w=250
fur-190px.png  ids=qun_dongzhuo%2Cman_mengmiaohuo%2Cman_mulu&poses=idle%2Cwindup%2Cstrike&yaw=32&w=250
fur-front.png  ids=qun_dongzhuo%2Cman_mengmiaohuo%2Cman_mulu&poses=idle%2Cwindup%2Cstrike&yaw=0&w=250
fur-reverse.png  ids=qun_dongzhuo%2Cman_mengmiaohuo%2Cman_mulu&poses=idle%2Cwindup%2Cstrike&yaw=-32&w=250
fur-back.png  ids=qun_dongzhuo%2Cman_mengmiaohuo%2Cman_mulu&poses=idle%2Cwindup%2Cstrike&yaw=148&w=250
pets-190px.png  ids=pet_meiqiu%2Cpet_xueqiu%2Cpet_shouhu&poses=idle%2Cwindup%2Cstrike&yaw=32&w=250
pets-front.png  ids=pet_meiqiu%2Cpet_xueqiu%2Cpet_shouhu&poses=idle%2Cwindup%2Cstrike&yaw=0&w=250
pets-reverse.png  ids=pet_meiqiu%2Cpet_xueqiu%2Cpet_shouhu&poses=idle%2Cwindup%2Cstrike&yaw=-32&w=250
pets-back.png  ids=pet_meiqiu%2Cpet_xueqiu%2Cpet_shouhu&poses=idle%2Cwindup%2Cstrike&yaw=148&w=250
```

## 真实十猫与宠物事件

[十猫战斗](battle.webp) 名义3.25s，十二帧记录为3.25～6s，步长.25。A：刘备、夏侯墩、关羽、孟获、左慈；B：张飞、马超、孙策、董桌、木鹿。只读查验真实 `player.actors` 为 **10/10 cat3d、10/10 本批背饰组**，不是另外生成展示用猫。参数为 `r3d=1&seed=2&theme=meadow` 加以上 A/B 列表，正常场景、镜头与演员站位。

[煤球真实宠物技](pet-battle.webp) 对应 `pet=pet_meiqiu`，真实 `doPet → petActors` 首次 alpha>.85 的名义时间为16s；图为16.05s，十二帧16.05～16.6s。主演员仍十只，宠物单独记录，真实 BACK 装配命中1，十二帧 alpha 均1。雪球、守护喵也分别以 `pet=pet_xueqiu / pet_shouhu` 进入同真实事件，各自旧/新十二帧；它们的临时首帧 PNG 与精确 JSON 用于舞台核验，不冒称三宠物在同一战斗同时出场。

以实际 cat.back 世界矩阵、演员 x/y getter、root旋转/尺度、舞台缩放及镜头变换投影本体和正常外扩描边，分别检查四个舞台边缘。旧版使用 `git show 29f6a8b:src/art3d/parts/back.ts` 的真实 stock cape，仅临时替换该宠物 builder；主演员保持候选、其余引擎和 gameplay seed 相同。呼吸/尾巴 phase 随真实运行生成，表中直接记录各次实际值。

| 宠物 | 新版最小边缘空隙，逻辑px | 旧版最小空隙 | 新/旧裁切帧 | 新版扣共享震屏5后 |
| --- | ---: | ---: | ---: | ---: |
| `pet_meiqiu` | 27.640211 | 12.696637 | 0 / 0 | 22.640211 |
| `pet_xueqiu` | 27.649643 | 12.744888 | 0 / 0 | 22.649643 |
| `pet_shouhu` | 27.683553 | 12.912643 | 0 / 0 | 22.683553 |

煤球扑击十二帧实际最大 `cam.shakeMag=5`，雪球/守护帧中接近0；对三者统一扣5为这组采样的保守值，最小仍22.64>5。舞台为960×600逻辑px，截图948×593；这项只报告本批部件舞台边界，不声称整个宠物或未来所有镜头无裁切。六组实际装配 hit1、10/10 main cat3d、alpha1，root / 舞台 / 镜头未为修复而移动。

姿势图 PNG 用原图拷贝后无损优化；战斗转无损 WebP。二十三张完整 RGBA 与对应浏览器原始 PNG 逐字节一致，尺寸相同，差异0，单图均<500000B。各图文件尺寸与字节为：

| 文件 | 原像素尺寸 | 字节 |
| --- | ---: | ---: |
| [poses.png](poses.png) | 1000×796 | 260003 |
| [cape-a-190px.png](cape-a-190px.png) | 1000×700 | 210330 |
| [cape-a-front.png](cape-a-front.png) | 1000×700 | 204533 |
| [cape-a-reverse.png](cape-a-reverse.png) | 1000×700 | 208195 |
| [cape-a-back.png](cape-a-back.png) | 1000×700 | 172794 |
| [cape-b-190px.png](cape-b-190px.png) | 1000×700 | 212379 |
| [cape-b-front.png](cape-b-front.png) | 1000×700 | 205736 |
| [cape-b-reverse.png](cape-b-reverse.png) | 1000×700 | 211452 |
| [cape-b-back.png](cape-b-back.png) | 1000×700 | 201390 |
| [gourd-190px.png](gourd-190px.png) | 1000×914 | 241456 |
| [gourd-front.png](gourd-front.png) | 1000×914 | 230248 |
| [gourd-reverse.png](gourd-reverse.png) | 1000×914 | 230191 |
| [gourd-back.png](gourd-back.png) | 1000×914 | 202861 |
| [fur-190px.png](fur-190px.png) | 1000×700 | 218004 |
| [fur-front.png](fur-front.png) | 1000×700 | 218449 |
| [fur-reverse.png](fur-reverse.png) | 1000×700 | 216674 |
| [fur-back.png](fur-back.png) | 1000×700 | 191593 |
| [pets-190px.png](pets-190px.png) | 1000×700 | 181129 |
| [pets-front.png](pets-front.png) | 1000×700 | 168656 |
| [pets-reverse.png](pets-reverse.png) | 1000×700 | 177327 |
| [pets-back.png](pets-back.png) | 1000×700 | 144975 |
| [battle.webp](battle.webp) | 948×593 | 404172 |
| [pet-battle.webp](pet-battle.webp) | 948×593 | 427482 |

战斗页面运行错误0；一次外部字体请求 `ERR_TUNNEL_CONNECTION_FAILED` 使用了正常字体回退，中文仍可读。几何检查页记录的运行错误0。

## 作者自检与有限观测范围

`npm run typecheck && npm test` 在最终87a4通过：68文件、1019测试，退出0。类型/单元测试中的英雄/杂兵构建没有逐个传入 heroId，不能以它代替真实注册命中；下列临时浏览器夹具明确传入全部89个look/id。

作者临时自查在完整236个src源文件的只读副本上运行，唯一模块和候选/基线/cat/pose/actor SHA哨兵，运行前后与副本源码全部一致。实际旧版读取固定29f6主线；本体只在临时夹具标记noBake，其他猫网格仍正常bake；另建普通全猫bake用于取景检查。临时只在bake前保存真实skull/鼻子/口鼻/笑嘴/张嘴原几何与局部矩阵引用，没有改变引擎形状或材质。

- 3200新/旧配对：16使用者 ×〔14姿势×4yaw + idle/windup/strike×12时刻×4yaw〕；静态t=.4，动画t=i×8/11含0和8，yaw=0/-32/32/148，dash使用真实moving:true，phase0。
- 两眼用实际core三角投影12×12格点，逐sample ID差集；最少有效点50，新增眼ID0。五个鼻口点随真实smile/mouthO几何，新增可见鼻口遮挡0。保守raw新增mouthR共2个：董桌、孟获slump/.4/148，均先被实际paw骨表面遮住；没有把raw计数写成0。
- 800独立相对形位（每人50）：真实1120非退化skull三角平面凸壳，对本体与外扩描边的完整三角裁剪，候选内部顶点0/内部三角0。共同刚体yaw复用这个物理关系，眼鼻与FRAME仍逐yaw采样。
- 本批自身FRAME出框0、整猫新增或四侧裁幅增大0、非有限坐标0；原始整猫720→720出框，都是同条件继承的headTop或paw，见下表。三个部件最小自身worldY约披风.361792、葫芦.620523、毛披肩.366765。
- 89真实显式ID，16新/旧实际注册命中，73非目标所有geometry attribute/layout/index的Uint8字节完全相同；三次缓存、绕序/正尺度/root、mesh及分段检查通过。

| 使用者 | 200样本中既有整猫出框 | 骨归属 |
| --- | ---: | --- |
| `shu_guanyunmiao` | 8 | paw |
| `shu_zhangmiaofei` | 156 | headTop |
| `shu_machao` | 120 | headTop |
| `wu_sunxiaoba` | 156 | headTop |
| `qun_dongzhuo` | 4 | headTop |
| `man_mulu` | 92 | headTop |
| `xian_zuoci` | 4 | headTop |
| `pet_shouhu` | 180 | headTop |

其余八位整猫样本出框0。尾根可读通过普通背视观察；中心至最近主体三角的距离只是辅助标量，不代替整条摆尾的碰撞求解。颅骨壳不含耳朵、绒毛、口鼻；眼鼻口有限投影点不代替逐像素全面遮挡证明。武器、衣服的既有手掌姿势与头饰取景保持基线，本批没有全面验收它们。

作者完整原始报告为临时 `/tmp/back-fieldgear-preflight/full-87a4a0b05b51-report.json`，源依赖哈希与各样本完整精度统计均保留；独立QA另行报告，不将作者自查冒称独立验收。

## 独立 QA

[独立摘要](qa-summary.md)、[完整机器记录](qa-summary.json)、[正常 bake 旧新对照](before-after.png) 对应同一冻结的 50171 / 87a4、基线29f6。独立夹具复制完整236个src文件，以唯一模块与实际SHA哨兵核验真实BACK注册和当前cat/pose/actor；覆盖全部89个显式look/id（含12宠物），16目标实际命中、73非目标attribute/layout/index字节一致，以及3200组眼/五官/FRAME样本、800组实际1120颅壳面完整三角裁剪。新增眼ID0、最少有效点50；2个新增raw嘴点保留为已被实际paw先遮住的保守命中，未作为新增可见嘴遮挡。整猫720组继承出框与裁幅逐组不变，披挂自身均在FRAME内。

独立QA实际查看本页23张最终图、11张JPG及刘备full参考，并逐图核验与原始截图完整RGBA差0；独立正常对照为11英雄idle/t=.4/yaw148、原生530×2948，316654B，原始截图字节相同。三PET的作者真实出场72条新旧记录由独立QA复核：四边owned裁切0、actor/root/cam轨迹相同，最大实测shake5扣除后最小余量22.6402逻辑px；不冒称另外捕获三PET战斗，也不将部件边界推广为整演员/VFX或任意镜头。煤球真实技能会移动，轨迹一致不表示每帧x固定62。

独立JSON保存全部3200组样本键、眼/鼻口ID、mouth mode、精确margin与完整物理统计，采用无损字典并往返核验，完整raw仍留临时目录且记录SHA。葫芦Lathe轴心退化封口的最近点诊断仅在QA临时夹具以端点/线段补测200组相对样本，两版其他物理字段与原始检查完全相同；没有改产品几何。有限phase0/离散pose/time/角度、真实颅壳不含耳/绒毛/口鼻及有限PET出场窗口均在摘要说明。`npm run typecheck && npm test` 的68文件/1019测试结果归作者实际运行，独立QA没有另跑或替换本页源/图/参考证据。

最不满意：毛边仍主要读成圆块，背视是两片短皮；其余方向更容易识别短厚肩背，但毛边层次仍弱于立绘。短披风的内折在190px正面偏弱，葫芦的蝴蝶结需要偏侧角度才清楚，-32° 时壶身多被躯干盖住，+32° 与背视双腹可读。已有冠顶/手掌出框与有限观察范围如实保留；当前第1轮待Claude评审。
