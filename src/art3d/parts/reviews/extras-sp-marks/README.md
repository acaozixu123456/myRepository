# 配饰第 2 批：灵瞳、结带、贴肤战纹

`glowEyes` 原来不出图，`tassel` 是后脑的小锥体，`warPaint` 是红色浮动方条。本批改为保留球眼轮廓的外眼角亮弧、侧边圆结与双布尾、按真实头面三角形切分的四色板战纹。只新增 `extra-sp-marks.ts`，并在 `extras.ts` 增加一条 import、替换这三项映射。

当前交付基线是 **bb73f1f95e91165fe1c38e3f07cf2b80b42d8392**。主线已合入三位 SP 的专属武器；本目录全部 21 张正常图、12 张真实十猫战斗图和 3 张真实灰灰宠物图均在该基线重拍。main60 旧图、完整作者源码和报告已移入忽略目录，不作为当前图。两条本批源码与 main60 冻结版逐字节相同；实际正常 bake 的 14 目标中，仅三位 SP 因主线专属武器改变，其余 11 位字节相同。

| 文件 | SHA-256 |
| --- | --- |
| [extras.ts](../../extras.ts) | `4c388b7e70cb5f596fd422f535a530e7d385db8177928ba8f67d13df7bec2b19` |
| [extra-sp-marks.ts](../../extra-sp-marks.ts) | `e9dcbe48bfc3ff908f0e66016a0b44174ce9627dbe5254ec3da44b834eaa7b9a` |
| 两文件直接字节串接，按上述顺序 | `a9600d2a1e164e8efec62f42f68ab8b22b51f8437002e9fcac89a99996ed22be` |

[author-report.json](author-report.json) 保存当前基线、28 条依赖 SHA、浏览器实际请求的 30 条源码哨兵、构建命中、正常 bake 字节、接触明细、截图参数、战斗演员和无损导出表。所有截图的源码与依赖在开始和结束时一致。当前 `cat3d/pose/toon/renderer` 均继承主线；其他九项 EXTRA 的原函数/import 保留主线字节。

实际使用者来自 `lookOf(id)`，共查 **41 英雄 + 36 杂兵 + 12 宠物 = 89**，其中 14 位使用本批部件；没有虚构用户或更改数据。

| 部件 | 实际使用者 | 逻辑 / 物理网格 | 造型与色板 |
| --- | --- | --- | --- |
| glowEyes | `wei_simamiyi`、`shu_pangmiaotong`、`xian_changmiao` | 6 / 6 | `look.eye.color` 派生亮弧及微量自发光；原球眼、虹膜、瞳孔和高光继续由引擎生成 |
| tassel | `shu_liumiaobei`、`shu_zhugemiaoliang`、`wu_ganning`、`mob_shu_vanguard`、`mob_qun_strategist`、`mob_qun_assassin`、`pet_huihui` | 9 / 16 | `pal.main/sub/trim`，圆结、中心束带、双短布尾；包含 wink 单眼杂兵、兜帽与灰灰大耳边界 |
| warPaint | `shu_zhangmiaofei`、`man_mengmiaohuo`、`man_zhurong`、`man_shamoke` | 4 / 4 | 张喵飞用蜀 `pal.sub` 绿条，蛮族用 `pal.sub` 棕条；四片圆端薄层 |

网格预算按本体含自有描边算一个；球 12 段、Tube 最多 20×6、Torus 16×6。所有构建根节点保持 position/rotation 零、scale 一，子节点正缩放；三次构建各返回新根，toon/outline 材质实例复用。没有每帧回调或每帧对象分配。战纹使用头面描述缓存，随 `detail.k` 切换：正常宿主 28×21 / 1120 面，实际世界 `.6` 宿主 17×13 / 408 面；这些是既有头面拓扑，不是新增高细分球。`.6→1` 恢复时战纹几何字节与原正常档一致。

已实看十位目标英雄的 [JPG 设定目录](../../../../../assets/heroes/ref)，并逐个读 `heroes.ts` 的 lore/quote 与 [ART_PROMPTS.md](../../../../../docs/ART_PROMPTS.md)。另实看获认可的 [司马喵懿](../../../../art/illust/wei_simamiyi.full.webp)、[庞喵统](../../../../art/illust/shu_pangmiaotong.full.webp)、[嫦喵](../../../../art/illust/xian_changmiao.full.webp) 插画。张喵飞参考图是绿战纹，蛮族是棕色；嫦喵实际毛色已经是 `shaded` 纯白，未沿用旧 prompt 的重点色记录。

按 QUEUE 的素材优先规则，实际查询过 [Poly Haven 许可页](https://polyhaven.com/license) 和 [Kenney 资源页](https://kenney.nl/assets)；网络授权后的 curl 返回 CONNECT 403 / exit56，目录内容不可用，未下载或声称审核任何外来许可。本批是直接接当前眼骨/头骨的程序化 mesh，需要匹配实际球眼及头面三角形；没有新增贴图、2D 贴花、音效或外部模型，也没有新的素材许可条目。

作者在 bb 主线实际执行 `npm run typecheck && npm test`，退出 0，**75 个测试文件、1068 项测试通过**，无 shim。日志 `.shots/extras-sp-marks/tests-main-bb.log`。SSR 与正常浏览器分别构建全部 89 位；当前主线 baseline 的 75 位非目标正常 bake 属性/index/skin/bind/材质/变换字节一致，14 位目标全部命中注册表：亮弧 3、结带 7、战纹 4。浏览器使用真实 canvas 毛色贴图；SSR 不具备 canvas，二者范围分别记录，不混作 RGBA 图像比较。

作者当前实际原始 mesh 与 shader-normal 描边检查覆盖 14 位 ×14 姿势 ×17 时刻 = **3332** 个姿态：12 个 `i*8/11` 时刻及 `.4`、`PI/1.4`、`3.45`、`3.45−1/28`、`7.05`，dash 使用 moving=true。三位 SP 另查全部 14 姿势、四个 yaw 的 117600 个实际前向白眼/虹膜/瞳孔三角重心射线；新增 owned 遮挡为 0。实际世界 `.6` 四位战纹用户另查 952 个姿态，完整三角贴肤偏置在 `[.000999822676399, .001000230343710]`，头本体及非目标五官接触为 0。全部动态嘴由现行 pose 正常驱动；独立审核另有活跃嘴代表点和白眼外围证据。有限时刻、射线与三角采样不能证明所有连续相位/每一像素。

接触允许范围逐 mesh 限定，未忽略整件部件：

| mesh | 有意接触 | 限制 |
| --- | --- | --- |
| `skin-paint.±1.0/1` 四片 | 宿主真实头面外的 +z `.001` 薄层；落入既有头描边外壳是贴肤意图 | 完整片三角按宿主前向面切分，不进入颅骨本体；不接触口鼻/耳/眼 |
| `attachment-seat` 与描边 | 侧头缝合接头的小范围颅骨/头描边 | 头局部接触 x≈`.698… .730`、y≈`.127… .193`、z≈`.039… .121`；不是整个结带放行 |
| `attachment-cord` 与描边 | 仅近接头第一段触头描边，cord 本体不入头本体 | 头局部 x≈`.726… .754`、y≈`.136… .178`、z≈`.060… .114`；剩余结环/布尾/褶线均检查 |

作者当前 FRAME 是实际 skinned world vertices 的 2856 个四向姿態；whole 旧/新均 308 个继承边界例，owned 新越界 0。独立 main60 的 6608 full/blink +168 ear 采用不同耳峰拆分口径，whole 304/档（头顶252、前爪8、灰灰大耳44），旧新边界相同；不把作者308与独立304混为一个数据集，也不声称整体零裁切。详见 [独立 main60 审核](qa-summary.md)、[原始压缩证据](qa-summary.json)、[main60 同引擎前后对照](before-after.png)。主线 SP 武器更新后的 [独立 bb 补查](qa-post-main.md) 与 [补查 JSON](qa-post-main.json) 另列：新冻结 282 条源码，两档各 168 个三 SP 姿态、两档各 89 用户、正常 native336、真实十 Actor/PET519 次非空 GL，以及最终 36 张 raw→final RGBA 字节一致检查通过。原 main60 大样本没有虚称在 bb 全量重跑。

正常图命令实际由稳定 5189、HMR 关闭的 Vite 执行：

```sh
PORT=5189 CHROME=/usr/bin/chromium npm run shots3d -- .shots/extras-sp-marks/formal-heroes-290-32.png 'ids=wei_simamiyi,shu_pangmiaotong,xian_changmiao,shu_liumiaobei,shu_zhangmiaofei,man_mengmiaohuo&poses=idle,windup,strike&w=290&yaw=32'
```

所有正常图为 `cat3d.html → buildCat3D(lookOf(id),id) → 正常 bake/render`；每行 idle/windup/strike，phase=0，t=.4，现行嘴形，DPR=1，截图 viewport 1000×700。290 格为 290×254；250 格为 250×219；小图 **217×190 原生像素格**，不是缩图。两个用户组均有 290/yaw32，以及 250 和 190 高度的 yaw0/−32/+32/148；三个细节图为 450×394 格、idle/strike。全部 raw 命令和 raw→final SHA/尺寸在作者报告。

| 组 | 290 | 250 四向 | 原生 190 四向 |
| --- | --- | --- | --- |
| 六位主代表 | [32](heroes-290-32.webp) | [0](heroes-250-0.png) / [−32](heroes-250-minus32.png) / [+32](heroes-250-32.png) / [148](heroes-250-148.png) | [0](heroes-190-0.png) / [−32](heroes-190-minus32.png) / [+32](heroes-190-32.png) / [148](heroes-190-148.png) |
| 其余八位含灰灰 | [32](users-290-32.webp) | [0](users-250-0.webp) / [−32](users-250-minus32.webp) / [+32](users-250-32.webp) / [148](users-250-148.png) | [0](users-190-0.png) / [−32](users-190-minus32.png) / [+32](users-190-32.png) / [148](users-190-148.png) |

细节：[灵瞳](detail-glowEyes.png)、[战纹](detail-warPaint.png)、[结带/兜帽/大耳灰灰](detail-tassel.png)。

真实十猫截图使用 `battle.html?test=1&r3d=1&theme=meadow&seed=2&tac=0&combo=0&pet=pet_huihui`，明确我方 `wei_simamiyi,shu_pangmiaotong,xian_changmiao,shu_liumiaobei,shu_zhangmiaofei`、敌方 `shu_zhugemiaoliang,wu_ganning,man_mengmiaohuo,man_zhurong,man_shamoke`。作者执行 `node .shots/extras-sp-marks/formal-battle.mjs`；临时只读响应加注册调用记录、复制 actual simulate pet events，没有改源、注入假 Actor、伪造事件或强设 alpha/pose。10 个实际 Actor 都有 `rig.cat3d` 与正常 skinned mesh；12 帧以 `.5` 秒推进，nominal `.5…6`，980×620 viewport，canvas 成图 948×593，DPR1，完整 HUD。引擎随机 phase 保留实际值并写报告。

[战斗第 6 帧](battle_05.webp)；完整 `battle_00…11.webp` 均出库。随后真实 `Player.doPet` 让灰灰在 nominal14.75 出场，uid−1、实际 alpha `.888888888888911`、head.scale `1.14×1.12=1.2768`，与 `player.petActors.get('A')` 是同一个 Actor；注册调用增加真实灰灰 tassel，累计 11 次目标命中。三帧 [灰灰0](pet_0.webp) / [1](pet_1.webp) / [2](pet_2.webp) 使用同场战斗推进，没有另造宠物舞台。自然战斗 HUD、特效与其他猫前后遮挡保留。

全部 36 张交付图小于 500000 字节（最大 480011）：PNG optimize compression9，超限图改 lossless WebP exact/quality100/method6；每张与对应 raw 的尺寸和解码 RGBA 逐字节一致、最大差 0，无缩放裁切。文件名/大小/SHA 在作者报告最终导出表。

最不满意的是嫦喵浅蓝亮弧在白毛上的对比偏弱，棕战纹在蛮族豹斑上也容易融入底色；190px 下结带可读而褶线较弱。亮弧挂 head，不会跟眼睑闭合骨缩放同步，眨眼时仍保留静态灵光；没有替换眼核或隐藏眼轮廓。继承头饰/耳峰和姿势取景边界如上明确保留。这些是当前造型与挂接契约的限制，没有靠修改引擎或数据掩盖。


主线bb后的独立限定复验：[补查摘要](qa-post-main.md) / [新机器证据](qa-post-main.json)。原main60的6608+168仍保留其源快照；bb实际重查282源、89两档、三SP两档各168及真实10Actor/PET/HUD，36当前官图逐全RGBA核验通过，不将旧大样本冒称新主线重跑。
