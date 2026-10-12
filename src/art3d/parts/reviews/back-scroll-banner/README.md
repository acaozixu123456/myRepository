# BACK 背卷 / 旌旗（第 1 轮待审）

背卷现在有双木轴端、卷纸端圈与螺旋、纸面搭接、束结及实际接到背部的短吊带；旌旗有圆顶旗杆、封口厚布、柔弧金边和贴合后向布面的猫爪浅浮雕。仅替换 `BACK.scrollBack / banner` 与独立 helper，沿用现有 back 插槽。

固定基线 `60bc06577f5d5dd2966a661d2278802bb3e3fcee`，分支 `codex/3d-back-scroll-banner`。全部 89 个实际 look/id（41 英雄、36 杂兵、12 宠物）逐个查实：**scrollBack 实际 2 位，banner 实际 0 位**。没有给英雄、杂兵或宠物新增旌旗配置。

| 部件 | 实际使用者 | 逻辑 / 含描边 Mesh | 最大分段 |
| --- | --- | ---: | ---: |
| `scrollBack` | 张爪 SSR `xian_zhangzhua`、羽扇书童 `mob_shu_strategist` | 15 / 30 | 20 |
| `banner` | 0；下文配色和体型图全部为合成 factory 样例 | 16 / 31 | 20 |

描边与原件合算一个逻辑网格。三次装配产生不同根并复用缓存 Toon/outline 材质，根位置/旋转为0、尺度为1，子节点尺度均为正。几何只在装配时生成，没有每帧回调或分配；其余六种 BACK 沿用实际基线。

## 实际参考与几何接点

已实际查看 [张爪原 JPG](../../../../../assets/heroes/ref/xian_zhangzhua.jpg)，阅读 [ART_PROMPTS 的张爪设定](../../../../../docs/ART_PROMPTS.md)、[英雄 lore](../../../../data/heroes.ts) 与 [羽扇书童设定](../../../../content/mobs.ts)。张爪提示词明确“背后背卷轴”，lore 保留黄巾、黄符、符水的轻松设定；原 JPG 背饰大部分被身体挡住，采用短背卷而非凭空放大符箓。羽扇书童是替军师展开并压住地图的奶油狸花猫，现有米白绿边长袍、小书冠和羽扇保留。现有五张批准立绘没有这两位的专属卷包或旌旗参考，因此未将其他英雄的标志附加给它们。

- 背卷纸色沿用旧版 `#f1e6c8`；木轴、束绳、纸缘及吊带取 `pal.sub`，轴梢/束结/纸端螺旋取 `pal.trim`。张爪配色为 `#2fa6a1 / #1d6370 / #f1d98a / #f3f7f2`；书童为 `#5f9068 / #496149 / #bb998a / #eee9d7`（main/sub/trim/cloth）。
- 卷包局部中心 `(-.23,-.08,-.20)`，内部绕 z 倾斜 .70rad；卷纸长 .78、轴长1.00，双轴梢 y=±.495。吊带从 back 局部 `(.26*build,-.05,.45-.34*build)` 的实际袍身表面连到倾斜卷包收腰结，卷包与描边不借移动模型根、镜头或插槽避让。尾根下方保持开放。
- 旌旗没有实际使用者及专属原图，只基于现有通用旗种类和阵营 palette 做 factory 样例。旗杆侧距 `x=.86*(look.head??1)+.12`、z=-.28，按头宽留耳侧空间；杆环仍在 y=.055/-.25；身体端分别接 torso y=.57/.43、x=.18*build 的实际后腰表面，并按 build 对应椭球后表面选点，经真实正常bake三角复验。旗布取 `pal.main`、上沿及绑带取 `pal.sub`、金边/杆梢/猫爪取 `pal.trim`，木杆沿用旧色 `#6a4a30`。
- 旌旗猫爪为五个实际浅浮雕网格，朝 -z，并随同一曲布面变形贴合。前向布面保持无爪图案，未使用文字纹理、悬浮 FX、透明度或姿势条件隐藏。

## 公开来源检查

同步60bc后的队列规则0要求先找公开素材。已尝试 [Kenney Pirate Kit](https://kenney.nl/assets/pirate-kit)、[Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit) 和 OpenGameArt 的 [scroll](https://opengameart.org/art-search-advanced?keys=scroll) / [flag](https://opengameart.org/art-search-advanced?keys=flag) 检索入口；当前受限代理对这四个URL返回CONNECT 403，未核验其完整模型内容。按云环境运行说明确认目的地不在已执行的允许列表，保留代理设置。

随后经允许的GitHub读取 [Kenney公开目录 README](https://github.com/shorepine/kenney/blob/main/README.md)、[49套3D目录](https://github.com/shorepine/kenney/blob/main/3d/kits.tsv) 及 [许可文本](https://github.com/shorepine/kenney/blob/main/LICENSE.txt)：README记为CC0静态GLB与外部colormap纹理，目录含Pirate72/Fantasy Town167等；没有提供当前猫骨架的palette参数化PartBuilder。另读 [CC0 Medieval Fair 目录](https://github.com/ToxSam/open-source-3D-assets/blob/main/data/assets/pm-medieval-fair.json) 和 [项目许可](https://github.com/ToxSam/open-source-3D-assets/blob/main/data/projects.json)，其中 `Fair_Flags_Line` 是2033676B的节庆装饰旗串GLB，并非猫背单杆旌旗或双轴背卷。只检索目录/README/元数据，未逐模型检查，也未下载或引入这些模型/纹理；当前交付继续使用本项目的程序几何、缓存Toon与ctx配色，保持两部件的预算与接点。不新增第三方文件或CREDITS条目。检索响应与HTTP失败保留临时 `/tmp/back-scroll-banner-public-{sources,catalog}.json`。

## 冻结源码与拍摄身份

| 源码 | SHA256 |
| --- | --- |
| `src/art3d/parts/back.ts` | `2d5304b9263b3d7768251c55205cda732383fba4cdf8e2e107294509cd541961` |
| `src/art3d/parts/back-scroll-banner.ts` | `78b4a124dd58da56c6cc6302fbf1625f9443f2075f3c07b6d8bd04fbc530b5d9` |
| `src/art3d/cat3d.ts` | `e5dd83cb7077e4f5dd5516880bb6b9ea60df0dcbb6069294b1bb18979988f8e0` |
| `src/art3d/renderer.ts` | `ccc15c4a584e0f44c91bf7faa35beb15afe6e1d509890003a3d0b7a47120ac05` |
| `src/art3d/pose.ts` | `3abe84b540c541d2637a36e7291c599d9b5a52318d4524662f122ce803e6431c` |
| `src/art3d/parts/body.ts` | `deff4ede63cecfff2513149843d01dbb48c570689658a66a60413c64daae959a` |
| `src/art3d/patterns.ts` | `bc941057c14b0b339c07898e660390ab6e87601a96dd60ea28a733f0ff281346` |
| `src/fx/actor.ts` | `268bc636c0ea4271432c0b0428105e66c204cb6fb5c3739ccb7c0aabb38f238f` |

十一张作者交付图全部来自最终 **2d5304 / 78b4** 与上表引擎，正常 bake 和正常 Toon/outline。旧7ea/7f、连接候选7c以及移除未用import前的eef报告和图只留临时历史，不作为交付图。全部已合六种BACK及四种衣服使用最新60bc主线，没有回退已批准部件。正式 Vite 5188 关闭 HMR 并忽略 `.shots/** / parts/reviews/**`；每次拍摄前后全部259个src依赖 SHA相同。完整逐图参数、raw路径、原图/交付哈希及 sourceBefore/After 见临时 `.shots/back-scroll-banner/official/{capture-manifest,battle-audit,final-figure-manifest}.json`。

## 真实使用者三姿势

每行左至右 idle / windup / strike，上行张爪，下行羽扇书童；phase=0、t=.4。大图单格290×254，其余250×219，角色约190px。两位均通过 `buildCat3D(lookOf(id),id)` 真装配，捕获时各自真实 BACK builder 命中1。

| +32° 大尺寸 | 0° | +32° 原生小尺寸 | -32° | 背视148° |
| --- | --- | --- | --- | --- |
| [真实两位大图](real-large.png) | [正面](real-0.png) | [190px](real-32.png) | [反向](real-minus32.png) | [背卷与尾根](real-148.png) |

实际 `shots3d` 参数等价为 `PORT=5188 CHROME=/usr/bin/chromium node tools/cat3d-shots.mjs <raw.png> 'ids=xian_zhangzhua,mob_shu_strategist&poses=idle,windup,strike&yaw=<0/32/-32/148>&w=250'`；大图仅改 `yaw=32&w=290`。正式 batch 临时只读包装 BACK 统计命中，返回原 factory 对象，不改变姿势、几何或材质。

## 旌旗合成样例（实际用户0）

[合成正面](synthetic-0.png)、[合成+32°](synthetic-32.png)、[合成-32°](synthetic-minus32.png)、[合成背视148°](synthetic-148.png) 每格250×219、三姿势同上。八行从上到下：魏/蜀/吴/群/蛮/仙 palette 的 build1/head1，然后仙 build.7/head1.12、蛮 build1.3/head1。固定素色猫、尖耳、长尾，没有英雄头饰、武器、衣服；palette 取相应阵营现有颜色。合成 id 仅用于临时夹具，没有加入任何游戏数据，也不计入89真实使用者或战斗命中。

图上逐行明确标为合成样例。原始1000×1981截图仅裁去右侧纯空白至766×1981，crop矩形 `[0,0,766,1981]`，所有内容和250px格仍是原生像素；没有缩放或重排。

## 真实十猫十二帧

[真实战斗3.25s](battle.webp) 与 [真实战斗5s](battle-active.webp)。参数：

```text
r3d=1&seed=2&theme=meadow
&a=xian_zhangzhua,mob_shu_strategist,xian_zuoci,shu_liumiaobei,wei_guojia
&b=shu_zhangmiaofei,shu_machao,wu_sunxiaoba,qun_dongzhuo,man_mulu
```

真实 `player.actors` 为10/10 cat3d，其中张爪与书童的 `back-tied-paper-scroll` 各命中一次实际 startup BACK builder，十二帧两者 alpha均1。记录名义时间3.25～6s、步长.25；交付图分别对应第0/7帧，其余十帧保留临时 raw。没有在战斗中构造或计入旌旗合成演员。默认镜头、演员站位、原材质与描边保持真实流程；背卷在默认战斗方向大部分被身体挡住，装配命中不等于细节始终可见。页面运行错误0；一次外部字体请求 `ERR_TUNNEL_CONNECTION_FAILED` 使用正常字体回退，中文可读。

## 作者自检与观测范围

最终源码 `npm run typecheck && npm test` 通过，**69文件 / 1035测试**，退出0。现有 `tests/art3d.test.ts` 构建未逐个传 heroId，不能拿它代替实际注册和89用户逐个检查。以下为作者自查，独立 QA 的更密探针与合成边界另行报告。

- 真实两位400组新旧配对：每位〔14姿势×4yaw + idle/windup/strike×12t×4yaw〕，静态t=.4，动画t=i×8/11含0与8，yaw=0/-32/32/148，phase0，dash使用moving:true。基线来自固定60bc的真实 stock BACK，未拼接旧主线引擎。
- 作者两眼实际core投影12×12格、逐sample ID差集；最少有效点78，新增眼ID0。五个鼻口采样点随实际 smile/mouthO 几何，作者这些点的新增ID0；这只描述该有限点集，不是全部五官表面遮挡证明。旧25组保守眼命中共186个ID在这些同位置样本中消除。
- 真实100个相对形位：实际1120非退化skull三角的凸壳平面，完整裁剪 owned本体和正常外扩outline的每个三角；新版内部顶点/三角0，旧版100组存在交叠。共同刚体yaw复用物理关系，眼、脸和FRAME仍逐yaw测。
- 旌旗作者合成18context：六palette×build .7/1/1.3（.7使用head1.12，其余head1），共3600配对 / 900完整skull形位，新增眼/作者鼻口点/FRAME0、实际1120颅壳内部顶点与三角0。旧旗900形位均有颅壳交叠。这不代表18真实目标，也不覆盖全部可能 CatLook 组合。
- 两组自身FRAME出框0，整猫0→0、四边新增/裁幅增大0，finite/runtime0。自身最小世界Y：背卷.751694、合成旌旗.765298，高于-.25。尾根至最近主体三角的最小辅助距离分别.362291/.311634，背视尾根正常可读；不是连续摆尾碰撞的完整求解。
- 近身连接另用完整Tube本体/展开outline对实际正常bake剩余猫的所有三角做精确3D相交，并分离opaque BODY实体。两实际卷带实体分别与袍身相交7/5三角，身体端距实际表面.000148/.006196；18合成context的36条主绑带各5～9实体三角接触，端距.000271～.001928。旧7f的两种吊带实体/outline对全部剩余猫均交0，已局部修近身端与路径；不将outline-only当主体连接。卷纸/旗布/轴/杆与其余节点、材质、index和非绑带attribute对7f逐字节同，仅三条绑带及各自outline的几何attribute改变。上述接点实测idle/.4/yaw0，两面都由固定torso/back骨继承同一变换；报告为 `/tmp/back-scroll-banner-preflight/contacts-78b4a124dd58-report.json`，不推广为未知衣服或未来骨架的接点保证。
- 89实际显式look/id、2真实scroll注册命中，87非目标全部geometry attribute/layout/index的Uint8字节相同；banner真实使用者0。缓存、三次独立装配、绕序、正尺度、root、预算及分段检查通过。

完整作者 raw 报告留临时 `/tmp/back-scroll-banner-preflight/{real,synthetic}-full-78b4a124dd58-report.json`。唯一模块、候选/基线/cat/pose/actor SHA哨兵及全部259源依赖在运行前后与私有只读副本一致。仅临时副本在正常bake前保存真实颅骨/动态五官引用，owned标记noBake供归属测量；另建正常bake整猫测取景，没有改产品引擎。作者颅壳测不含耳朵/口鼻/脸毛，独立QA另补这些几何。phase0、离散时刻和角度不能证明所有连续动画或未来镜头。

## 无损交付

PNG无损优化；-32°合成图额外合并连续IDAT块，保持同一压缩数据与像素（499975B）；两张战斗图转lossless WebP。真实图与战斗完整RGBA对raw逐字节一致，合成图与上述raw crop逐字节一致，差异均0、没有像素重采样，十一图均<500000B。

| 文件 | 原像素尺寸 | 字节 |
| --- | ---: | ---: |
| [real-0.png](real-0.png) | 1000×700 | 123575 |
| [real-148.png](real-148.png) | 1000×700 | 105125 |
| [real-32.png](real-32.png) | 1000×700 | 129292 |
| [real-large.png](real-large.png) | 1000×700 | 157592 |
| [real-minus32.png](real-minus32.png) | 1000×700 | 126415 |
| [synthetic-0.png](synthetic-0.png) | 766×1981 | 464381 |
| [synthetic-148.png](synthetic-148.png) | 766×1981 | 461504 |
| [synthetic-32.png](synthetic-32.png) | 766×1981 | 458293 |
| [synthetic-minus32.png](synthetic-minus32.png) | 766×1981 | 499975 |
| [battle.webp](battle.webp) | 948×593 | 387404 |
| [battle-active.webp](battle-active.webp) | 948×593 | 402218 |

## 独立 QA

[独立摘要](qa-summary.md)、[完整机器记录](qa-summary.json)、[正常bake旧新对照](before-after.png) 对应固定60bc与同一2d5304 / 78b4、259源依赖SHA哨兵。独立全89显式look/id中的两位真实卷轴目标注册命中，87非目标attribute/layout/index原始Uint8字节相同；15/16逻辑网格、最大20分段、缓存/单位根/正尺度与构建后无再次builder调用均通过。

独立真实400状态与合成24context / 4800状态分别保留；合成为六palette×build .7/1/1.3、head1尖耳，另六palette的build1/head1.12大耳。它与作者18context / 3600范围不同，没有heroId或新增游戏数据。另加两真实使用者×三姿势×t=.2/实际耳峰2.243994752564138×四yaw，共48真实补充状态。实际颅骨1120面、正常展开头壳1120面、口鼻垫560面、耳实体/展开耳三角的完整裁剪或精确面交均新增0；两眼12×12及真实活跃嘴3×3新增ID0，最少有效眼点真实78、合成95，活跃嘴点4。

独立动态五点表面探针保留14个主状态及2个耳峰补充新增保守ID，全部为148°的muzzleL。16/16在背卷之前已被真实颅骨/剩余opaque猫面遮住，新增可见的被测鼻口点0；轴梢outline确实是这些点的最前投影，不将保守ID写成0。有限点、离散姿势/时刻/phase0的观测范围及具体坐标/深度见独立报告。

目标自身FRAME和新增/增加整猫裁幅0；真实整猫0→0。合成大耳边界共有264例继承裁切（96静态 / 168动画），旧新精确margin一致，不能推广为所有大头或宠物耳尖都入框。独立连接审计在idle/.4/yaw0区分主体与描边100条记录：两真实卷带7/5、24合成context的48条旗带每条5～9个实际OPAQUE BODY主面三角相交，所有50条主Tube确有实体接触。命中主面归属torso，与BACK继承共同正变换；没有把这一次接点检测冒写为每个连续时刻逐帧求交。

独立正常旧新图仅两真实角色，按每位先旧后新两行、三列idle/windup/strike，单格218×190、phase0/t=.4/yaw32，完整676×898、220669B，无损RGB差0。作者十一张官方图原始完整RGBA或明确crop对应区域差0、当前259源SHA、10真实演员/2实际startup builder hits/banner0及12帧target alpha1均经独立机器核对；独立实际看过七张官方图及额外正常诊断，作者十一张全实看。机器JSON451226B保存全部5200主状态、48耳补充具体采样ID、精确margin、碰撞/连接记录、源哈希及官图验证，不舍弃保守ID或截短浮点精度。独立结论为该有限范围可交Claude审核。

最不满意：背卷的端面螺旋与小结在190px偏弱，正面和-32°主要被躯干隐藏；背视才最清楚。旌旗布褶在190px仍接近平面轮廓，双绑带因保留头侧距离而偏长，猫爪只在后向可读；它没有实际角色/宠物出场验证。当前第1轮待Claude评审。
