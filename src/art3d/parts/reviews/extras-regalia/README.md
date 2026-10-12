# 配饰第 1 批：羊胡须、铃铛、耳环

本批只替换 `EXTRA.beardGoat / bell / earring`，新几何集中在 `parts/extras-regalia.ts`。羊须用三束圆钝毛束和小绑环；铃铛有颈带、挂环、开槽铃壳、内衬与铃舌；耳环从侧耳根小耳钉连到细金圈和圆润小垂饰。三个部件都挂在真实 `head` 插槽，根 position/rotation 为零、scale 为 1。其余九个配饰注册行与基线字节一致。

基线固定为 `a7a41e9ebaf4083f5cf3c0904f3850a9c81f7a07`。对比、审计、官图都使用同一基线的完整 `src` 快照及正常 BAKE；本批只替换配饰，不替换骨架、姿势、毛色、专属造型、衣服或宠物数据。临时快照仅追加未使用的 SHA 导出；数值审计另以不参与场景遍历的属性保存原始颅骨、鼻、口鼻垫及 smile/mouthO 几何。

## 真实使用者

枚举当前 41 英雄、36 杂兵、12 宠物的实际 `CatLook`，三项共命中 20 位。表中就是官图各组从上到下的顺序，每行从左到右为 idle / windup / strike。

| 图组 | 使用者 |
| --- | --- |
| beards-1 | `wei_caomiaode` 曹喵德 UR；`shu_huangzhong` 黄忠忠 SR；`wu_huanggai` 黄盖盖 SR；`qun_dongzhuo` 董桌 SR |
| beards-2 | `qun_huatuo` 华佗喵 SSR；`xian_shuijing` 水镜喵 SSR；`xian_yuji` 于吉吉 SSR；`wei_simamiyi` 司马喵懿 SP |
| bells-heroes-mob | `wu_sunxiangxiang` 孙香香 SSR；`wu_ganning` 甘宁宁 SR；`xian_changmiao` 嫦喵 SP；`mob_xian_assassin` 幻影拾铃喵 |
| bells-pets | `pet_tuanzi` 团子 R；`pet_xueqiu` 雪球 SR；`pet_huihui` 灰灰 SR；`pet_xingxing` 星星 SSR |
| earrings-heroes-pet | `wu_zhoumiaoyu` 周喵瑜 UR；`qun_lvbuding` 吕布丁 UR；`shu_pangmiaotong` 庞喵统 SP；`pet_jiuwei` 九尾 SSR |

原进度表只列英雄/杂兵，本次实际映射补查到四只铃铛宠物和一只耳环宠物；宠物的 body 仍全为 none，数据未改。

## 参考与配色

已逐张查看以上 14 位英雄的 `assets/heroes/ref/<id>.jpg`，对应 `ART_PROMPTS.md`、lore，以及曹喵德、司马喵懿、庞喵统、嫦喵的已通过立绘。JPG 路径及 SHA 全列在 [capture-records.json](capture-records.json)。五只宠物用原始 `catSvg(PETS.look)` 查看 2D 造型，并核对 `PETS.md`。

羊须颜色取实际 `look.coat.light`，对齐旧 2D 的浅毛胡须；绑环取 `pal.trim`。铃带取 `pal.sub`，挂环取 `pal.trim`，铃壳保留底版金色 `#ffd24a`；槽内深金与微小亮面表现开口。耳钉、链、圈取 `pal.trim`，圆钝垂饰取 `pal.sub`，小亮点取浅毛色。阵营主色及角色配色数据保持原值。

## 网格与挂接预算

| 部件 | logical 网格（描边子壳合计为一个） | 含子描边实际网格 | 最大分段 |
| --- | ---: | ---: | ---: |
| beardGoat | 5 | 10 | 24 |
| bell | 8 | 12 | 24 |
| earring | 6 | 11 | 24 |

均为缓存 toon/outline，重复构建材质对象相同；所有节点正 scale、正行列式，构建和动作中无非有限值。铃壳自建周向 24 个间隔，真实底部前槽；没有新增材质、纹理或逐帧逻辑。

贴饰只有以下局部允许皮肤接触，其他 mesh 与描边仍逐三角检查。接触多边形的头部局部范围及每个三角 ID 见 [author-qa.json](author-qa.json) 的 `physicalContacts`，按 owner 名及具体接触区域分类，不忽略整个部件。

| 接触网格 | 实际相交三角（实体 / 描边） | 实际接触范围，head-local |
| --- | ---: | --- |
| goat-muzzle-contact | 47 / 47，与真实 560 三角口鼻垫 | x ±0.058725；y [-0.299505,-0.284920]；z [0.504425,0.550329] |
| bell-collar-contact | 38 / 88，与真实 1120 三角颅骨 | x ±0.374135；y [-0.374291,-0.352000]；z [-0.381246,0.381246] |
| earring-stud-contact | 10 / 16，与真实 1120 三角颅骨 | x [0.642368,0.653997]；y [0.371775,0.392112]；z [0.086194,0.107896] |

羊须根垫接触口鼻垫下沿，三束须与绑环均无颅骨/口鼻垫穿入；铃壳、挂环、铃舌均在颈带外；耳环链、金圈与垂饰均在皮肤外。耳钉挂在固定侧耳根皮肤上，耳尖的抖动与折耳不承担挂接。

## 动作与源身份

作者自检 20 位 ×（14 poses × 4 yaw + idle/windup/strike × 12 个 t=i×8/11）= 1,840 样本；phase=0，静态 t=.4，yaw 0/32/-32/148。眼部取正常蒙皮实际眼核投影的 12×12 格点，比较遮挡 ID 集合；鼻、口鼻垫、嘴取实际动态 smile/mouthO 表面深度。眼格点最少静态 50、动画 70；张嘴样本 1,360 个。

新增挡眼 ID 0、新增动态鼻嘴 ID 0、眼格点数不一致 0；自有部件 FRAME 越界 0，整猫新增越界与新增 margin 0；有限值错误 0。反朝向 yaw148 的铃铛在 windupLow/slump 中仍有 16 个原已存在的嘴/口鼻投影遮挡样本，新增 ID 为 0；此检查只比较本批配饰对面部表面的投影，不代表背面能看到五官。整猫既有 FRAME 越界 253 个（静态 156、动画 97），新旧数量及超出幅度一致，记录保留。

实际颅骨 1,120 个三角形成凸体半空间，每个自有实体及法线膨胀描边三角都严格裁入该体积；同样检查 560 三角口鼻垫。没有以名义椭球、仅顶点在内部或旧网格无顶点命中代替三角相交。声明挂接区外的颅骨/口鼻垫相交为 0。89 个实际造型均正常构建；69 个非使用者的所有几何 TypedArray attributes/index 字节及属性规格完全一致，20 个使用者各命中目标 builder 一次。

`npm run typecheck && npm test`：68 文件 / 1,021 测试通过。完整 1,840 逐样本原始报告留在工作目录 `.shots/extras-regalia/report-1791784114262-172207.json`；其 SHA、完整枚举与接触 ID 归档在 author-qa.json。321 个原有源文件在作者采样前后保持同一 SHA；官图的 23 个源依赖也前后一致。

| 源 | SHA-256 |
| --- | --- |
| extras.ts | `d74a720eef4820d61e3baf83fcc8aeb8f966997317b31cbf95b5d81d77014e07` |
| extras-regalia.ts | `e5a09e559cfedc522f39f8834d172c3fbb2cce9404d3d2f42cf2219ee09db9a2` |
| cat3d.ts | `39b82bcb153baf7a1c0131fc39b1b42dccddce44d69a1724ccbcd04535a62aa4` |
| pose.ts | `3abe84b540c541d2637a36e7291c599d9b5a52318d4524662f122ce803e6431c` |
| actor.ts | `268bc636c0ea4271432c0b0428105e66c204cb6fb5c3739ccb7c0aabb38f238f` |

## 官图

28 张 PNG 直接从未改的 `cat3d.html` / `src/dev/cat3d.ts` 参数入口捕获。五组全员都有 yaw32 的 w290 / w250，以及 yaw0/-32/148 的 w250，均含三姿势；w250 是小尺寸识别检查，宠物按实际 look 比例。另附三组 w420 细节。所有画布、脸和原图边缘完整，PNG 只做无损压缩；逐通道完整 RGBA 数组相等，changedPixels=0。单图最大 332,821 B。

| 全员图组 | yaw32 w290 | yaw32 w250 | yaw0 w250 | yaw-32 w250 | yaw148 w250 |
| --- | --- | --- | --- | --- | --- |
| 羊须 1 | [大图](beards-1-32-large.png) | [小尺寸](beards-1-32-native.png) | [正面](beards-1-front.png) | [反向](beards-1-reverse.png) | [背面](beards-1-back.png) |
| 羊须 2 | [大图](beards-2-32-large.png) | [小尺寸](beards-2-32-native.png) | [正面](beards-2-front.png) | [反向](beards-2-reverse.png) | [背面](beards-2-back.png) |
| 铃：英雄/杂兵 | [大图](bells-heroes-mob-32-large.png) | [小尺寸](bells-heroes-mob-32-native.png) | [正面](bells-heroes-mob-front.png) | [反向](bells-heroes-mob-reverse.png) | [背面](bells-heroes-mob-back.png) |
| 铃：宠物 | [大图](bells-pets-32-large.png) | [小尺寸](bells-pets-32-native.png) | [正面](bells-pets-front.png) | [反向](bells-pets-reverse.png) | [背面](bells-pets-back.png) |
| 耳环：英雄/宠物 | [大图](earrings-heroes-pet-32-large.png) | [小尺寸](earrings-heroes-pet-32-native.png) | [正面](earrings-heroes-pet-front.png) | [反向](earrings-heroes-pet-reverse.png) | [背面](earrings-heroes-pet-back.png) |

[胡须根部/张嘴细节](goat-root-mouth-detail.png) · [颈带/铃壳细节](bell-shell-neck-detail.png) · [耳钉/金圈细节](earring-mount-hoop-detail.png)

最不满意的是浅口鼻毛角色在小尺寸下，羊须三分束的深度分层仍偏弱；当前保留钝圆轮廓和动态嘴的间隙。

## 真十猫战斗

[battle.webp](battle.webp) 是完整 948×592 的真实战斗画布，保留昵称、血条、状态及场景。原始 12 帧按 60Hz 的 scene.step 推进，t=3.25…6 秒；选第 5 帧，实际 scene.time=4.499999999999989。10 个实际 actor 全部有 rig.cat3d，且分别找到 `regalia-goat-beard / regalia-collar-bell / regalia-ear-base-hoop`，12 帧全员 alive。spriteMode.cat3d=true 使用正常 3D 渲染与蒙皮，未用 2D 缓存替换。

我方：曹喵德、周喵瑜、孙香香、庞喵统、嫦喵；敌方：司马喵懿、华佗喵、甘宁宁、吕布丁、幻影拾铃喵。三类配饰都在实际使用者上命中。

输出为整张 lossless WebP，完整 RGBA changedPixels=0；原始帧、捕获矩形、精确时间、角色命中和 SHA 均见 capture-records.json。战斗 pageErrors=0；唯一失败是 Google Fonts `Noto Sans SC / ZCOOL KuaiLe` 请求 `net::ERR_TUNNEL_CONNECTION_FAILED`，按浏览器回退字体绘制，未篡改字体请求或画面。

## 独立复核与当前交付

独立复核文件：[QA 摘要](qa-summary.md)、[机器报告](qa-summary.json)、[正常旧 / 新对照](before-after.png)。使用以上冻结 `extras.ts / extras-regalia.ts` 与基线 `a7a41e9ebaf4083f5cf3c0904f3850a9c81f7a07`，完整运行时快照 321 个原有源 / 依赖文件在采样前后 SHA 不变。全 89 个显式造型中 20 个真实使用者（14 英雄、1 杂兵、5 宠物）旧 / 新各命中一次；69 个非目标正常 baked 几何属性、索引及规格逐字节相同，九项未改注册行逐字一致。

独立范围为 1,840 主状态：20×〔14 姿势×yaw 0/32/-32/148 + idle/windup/strike×12 个 t=i×8/11〕，phase=0，静态 t=.4，动画 yaw32。实际 baked 眼核心 12×12、动态鼻口五点及实际活跃嘴骨表面 3×3 的新增遮挡 ID 均 0，活跃嘴有效 ID 不一致 0；自配饰出框、新增整猫出框 / 裁幅增加、非有限值均 0。旧 / 新整猫既有 253 例裁切保持相同（静态 156、动画 97），未声称所有既有冠耳或披挂完整入框。

追加 120 个耳检查：20 使用者×idle/windup/strike×t=.2 与 phase0 精确耳峰 π/(2×.7)=2.243994752564138。主状态和追加状态对真实左右耳实体内部、实体表面及正常展开描边的逐三角检查均 0，包含九尾大耳、五只宠物 head=1.12 和折耳；耳钉只接固定侧耳根皮肤。

独立复核保留三个具体佩戴触点的非零值：`goat-muzzle-contact` 对口鼻垫实体 / 描边 47 / 47，`bell-collar-contact` 对颅骨 38 / 88，`earring-stud-contact` 对侧耳根颅骨 10 / 16。其余须束 / 绑环、铃挂环 / 壳 / 内衬 / 舌 / 底沿 / 高光、耳链 / 圈 / 钩 / 垂饰 / 高光逐网格对颅骨与口鼻垫均为 0，精确局部边界和三角 ID 在机器报告；没有排除整个配饰后宣称零交叉。这些计数不等于穿插体积或像素面积。

yaw148 的铃铛 windupLow/slump 保留 16 个保守鼻口命中状态，新增 ID 为 0；独立深度分类确认当前被测 32 点在配饰前已被真实颅骨遮住，因此不计为新增可见脸遮挡。活跃嘴 3×3 也保留后向保守命中，新 ID 0。有限采样与几何深度比较不证明全部连续时刻或每个最终可见像素。

正常对照由三类各两位英雄 / 宠物组成：曹喵德 / 司马喵懿、甘宁宁 / 团子、庞喵统 / 九尾；左旧右新、idle/t=.4/phase0/yaw32，每格 250×219，整图 1050×850，未缩放、裁切或换材质。PNG 无损重存的完整 RGB 字节差 0，166,781 B；与本目录官图分别保留，不将作者自检代替独立记录。

当前 [battle.webp](battle.webp) 实际文件为 397,966 B，SHA256 `ad428b26f82b2fc95600fe5d84eb7a2507c399b25e458ea02365cc8e088f1d81`，与 capture-records.json 的最终记录一致。整张 948×592 的 lossless WebP 完整 RGBA changedPixels=0，10 个真实 actor / 三类配饰、12 帧正常 3D 战斗接入见上述捕获记录；本目录所有交付单文件 <500000 B。

作者原生 `npm run typecheck && npm test` 通过 68 文件 / 1,021 项，已读取 `.shots/extras-regalia/tests-final.log`。此处引用作者实测，独立复核没有重复运行产品测试。状态为第 1 轮待审，未记录 Claude 已通过；浅毛羊须分层、铃舌和耳链在小尺寸仍是本批可见限制。
