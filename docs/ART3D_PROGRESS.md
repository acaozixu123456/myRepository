# 3D 部件进度表（Codex 每完成 / 被打回一轮就更新对应行）

状态：`底版`（Claude 的占位造型，认得出来但粗糙）→ `待审`（已提交）→ `返修`（带意见打回）→ `通过`。
「使用者」按稀有度排序（SP > UR > SSR > SR > 杂兵）；**优先做被高稀有度英雄使用的部件**。
一个 PR 做同一文件里的 3~6 个相关部件即可（例如「武器：长剑 / 双股剑 / 短刀 / 飞刀 / 双短刀」）。

## 武器（`src/art3d/parts/weapons.ts`）

武器第 2 批：`codex/3d-weapon-blades`，四个新部件第 1 轮，加上 `herbs` / `fan` 按 #89 建议追加细节的第 2 轮，共 6 个部件，已在 #91 通过并合并。内部候选调整不增加审核轮次。

| 部件 | 使用者 | 状态 | 轮次 | 备注 |
| --- | --- | --- | --- | --- |
| `herbs` | `xian_changmiao`(SP), `qun_huatuo`(SSR) + 杂兵×6（`mob_wei_healer`, `mob_shu_healer`, `mob_wu_healer`, `mob_qun_healer`, `mob_man_healer`, `mob_xian_healer`） | 通过 | 2 | 首版 #89 已通过；追加叶尖深浅细节在 #91 通过并合并；23 网格；codex/3d-weapon-blades |
| `bow` | `shu_pangmiaotong`(SP), `wu_sunxiangxiang`(SSR), `shu_huangzhong`(SR) + 杂兵×3（`mob_shu_archer`, `mob_wu_archer`, `mob_qun_archer`） | 通过 | 1 | #89 已通过并合并；双曲弓臂、独立弓弦与弦槽；10 网格；codex/3d-weapon-sp-kit |
| `fan` | `wei_simamiyi`(SP), `shu_zhugemiaoliang`(SSR), `wu_luxun`(SSR) + 杂兵×2（`mob_shu_strategist`, `mob_wu_strategist`） | 通过 | 2 | 首版 #89 已通过；追加扇面倾角调整在 #91 通过并合并；24 网格；codex/3d-weapon-blades |
| `mace` | `man_mengmiaohuo`(UR), `wei_xuhuchi`(SSR), `man_shamoke`(SSR) 等4只 + 杂兵×1 | 底版 | 0 | |
| `sword` | `wei_caomiaode`(UR), `wu_sunxiaoba`(SSR) + 杂兵×3（`mob_wei_vanguard`, `mob_wu_vanguard`, `mob_xian_vanguard`） | 通过 | 1 | #91 已通过并合并；12 网格；[姿势](../src/art3d/parts/reviews/weapon-blades-poses.png) / [战斗](../src/art3d/parts/reviews/weapon-blades-battle.png)；codex/3d-weapon-blades |
| `staff` | `xian_zuoci`(UR), `qun_zhangjiao`(SSR) | 底版 | 0 | |
| `dualSwords` | `shu_liumiaobei`(UR) | 通过 | 1 | #91 已通过并合并；主手 12 + 副手 12，共 24 网格；[姿势](../src/art3d/parts/reviews/weapon-blades-poses.png) / [战斗](../src/art3d/parts/reviews/weapon-blades-battle.png)；codex/3d-weapon-blades |
| `halberd` | `qun_lvbuding`(UR) | 底版 | 0 | |
| `qin` | `wu_zhoumiaoyu`(UR) | 底版 | 0 | |
| `spear` | `wei_xiahoudun`(SSR), `shu_zhangmiaofei`(SSR), `shu_zhaomiaoyun`(SSR) 等5只 | 底版 | 0 | |
| `glaive` | `shu_guanyunmiao`(SSR), `qun_huaxiong`(SR) + 杂兵×2 | 底版 | 0 | |
| `drum` | `man_mulu`(SSR) + 杂兵×1 | 底版 | 0 | |
| `brush` | `xian_shuijing`(SSR) | 底版 | 0 | |
| `dualBlades` | `wei_zhangliao`(SSR) | 通过 | 1 | #91 已通过并合并；主手 10 + 副手 10，共 20 网格；[姿势](../src/art3d/parts/reviews/weapon-blades-poses.png) / [战斗](../src/art3d/parts/reviews/weapon-blades-battle.png)；codex/3d-weapon-blades |
| `knives` | `man_zhurong`(SSR) | 通过 | 1 | #91 已通过并合并；主手 8 + 副手 16，共 24 网格；[185px 近看](../src/art3d/parts/reviews/weapon-blades-knives-185px.png) / [战斗](../src/art3d/parts/reviews/weapon-blades-battle.png)；codex/3d-weapon-blades |
| `talisman` | `xian_zhangzhua`(SSR) | 底版 | 0 | |
| `whisk` | `xian_yuji`(SSR) | 底版 | 0 | |
| `scroll` | `wei_guojia`(SR) + 杂兵×3 | 底版 | 0 | |
| `axe` | `wei_xuhuang`(SR) | 底版 | 0 | |
| `coins` | `xian_guanlu`(SR) | 底版 | 0 | |
| `hooks` | `wu_ganning`(SR) | 底版 | 0 | |
| `whip` | `wu_huanggai`(SR) | 底版 | 0 | |
| `dagger` | 杂兵×6 | 底版 | 0 | |
| `shield` | 杂兵×5 | 底版 | 0 | |
| `boxShield` | 杂兵×1 | 底版 | 0 | |
| `coinsPlain` | 杂兵×1 | 底版 | 0 | |
| `crossbow` | 杂兵×1 | 底版 | 0 | |
| `slingshot` | 杂兵×1 | 底版 | 0 | |

### 武器审核记录

- 2026-10-11 · [#89](https://github.com/acaozixu123456/myRepository/pull/89) · 首批 `herbs` / `bow` / `fan` **通过并合并**。Claude 的 [审核评论](https://github.com/acaozixu123456/myRepository/pull/89#issuecomment-6109941469) 提出两条后续建议：扇面略向外倾，改善 `strike` 侧视时成一条线的效果；药草叶尖增加一档深浅。两条建议随后在 #91 落实并通过，首版通过记录保留。
- 2026-10-11 · [#91](https://github.com/acaozixu123456/myRepository/pull/91) · 武器第 2 批 **通过并合并**，按 [固定队列](CODEX_QUEUE.md) 同步状态。四个新部件为 `sword` / `dualSwords` / `dualBlades` / `knives`，另含 `herbs` / `fan` 的建议调整；已有姿势卡点由 Claude 在 `pose.ts` 处理。
- `codex/3d-weapon-blades` 使用者核对：四个新部件共 8 只（5 英雄 + 3 杂兵），连同追加细节的 `herbs` / `fan` 共 21 只（10 英雄 + 11 杂兵）。依据 `src/data/heroes.ts`、`src/content/mobs.ts` 与 `src/data/mob-looks.ts` 核对；本批对应行的原有数量无误，补齐杂兵 ID。
- `dagger` 保持底版第 0 轮，本批未制作。后续按固定队列继续。

### 武器第 2 批检查与截图（#91）

`npm run typecheck` 与 `npm test` 通过（58 个测试文件、912 个测试）。本批全部复用缓存材质；球 / 圆柱最大 12 分段，`fan` 的 TubeGeometry 使用 16 个纵向分段。双持网格数按主手加副手统计，均在单部件 24 网格预算内。

静态检查覆盖 21 使用者 × 14 姿势，共 294 组，坐标均有限；审核要求的 `idle,windup,strike` 共 63 组，框内且未检出穿头。

动画采样覆盖 21×3×12，共 756 组；四个新部件的 8 使用者对应 288 组均未检出穿头，新增穿头组合为 0。其余采样保留两组与底版相同的旧握段描边轻微交叠，具体记录见下文。

审核截图：[idle / windup / strike](../src/art3d/parts/reviews/weapon-blades-poses.png)、[十猫同屏战斗](../src/art3d/parts/reviews/weapon-blades-battle.png)、[祝融飞刀 185px 近看](../src/art3d/parts/reviews/weapon-blades-knives-185px.png)、[#89 建议的扇面与叶尖细节](../src/art3d/parts/reviews/weapon-blades-fan-herbs.png)。

最不满意：`windup` 的主手武器大部分位于头肩后，`strike` 的金属刀面在侧视时仍显得较薄。

其他姿势保留的既有卡点：21 使用者在 `cast / castUp / victory` 中掌心本身进入头部；`guard` 的 21 组武器与头部交叠，其中只有 4 组掌心进入头部，其余接近边界。该组合与底版相同，需由 Claude 的姿势 / 插槽调整处理。

动画采样中的两组描边轻微交叠为 `fan` 的 `mob_shu_strategist` 与 `herbs` 的 `mob_shu_healer`，均在 `t=2.4`，与底版相同；本批保留旧握段。这两组仍列作既有卡点。

## 头饰（`src/art3d/parts/headgear.ts`）

头饰第 1 批 `codex/3d-headgear-crowns` 已在 #93 通过并合并，六种均为第 1 轮。当前第 2 批 `codex/3d-headgear-crests`：`pheasant / helmetWei / helmetGeneral / featherHeaddress / yellowBand / tigerHood`，第 1 轮待审，共 21 使用者（14 英雄 + 7 杂兵）。已按 `src/data/heroes.ts`、`src/data/mob-looks.ts` 和 `src/content/mobs.ts` 核对，原表数量无误，补齐使用者 ID。

| 部件 | 使用者 | 状态 | 轮次 | 备注 |
| --- | --- | --- | --- | --- |
| `scholarCap` | `wei_simamiyi`(SP), `shu_guanyunmiao`(SSR), `shu_zhugemiaoliang`(SSR), `wu_luxun`(SSR), `qun_huatuo`(SSR), `xian_shuijing`(SSR), `wei_guojia`(SR), `shu_jiangwei`(SR) + 杂兵×4（`mob_wei_archer`, `mob_wei_strategist`, `mob_qun_archer`, `mob_qun_strategist`） | 通过 | 1 | #93 已通过并合并；12 网格；短翼与额带，190px 下布折较弱；codex/3d-headgear-crowns |
| `flowerPin` | `shu_pangmiaotong`(SP), `wu_sunxiangxiang`(SSR), `qun_diaochan`(SSR) | 通过 | 1 | #93 已通过并合并；19 网格；配色参考已批准立绘及 ref；codex/3d-headgear-crowns |
| `lotusCrown` | `xian_changmiao`(SP), `xian_zuoci`(UR) + 杂兵×1（`mob_xian_guard`） | 通过 | 1 | #93 已通过并合并；19 网格；金莲冠配色参考已批准立绘及 ref；codex/3d-headgear-crowns |
| `taoistCrown` | `wu_zhoumiaoyu`(UR), `xian_yuji`(SSR) + 杂兵×4（`mob_shu_strategist`, `mob_wu_strategist`, `mob_xian_vanguard`, `mob_xian_healer`） | 通过 | 1 | #93 已通过并合并；10 网格；道簪留出折耳活动间隙；codex/3d-headgear-crowns |
| `emperorCrown` | `wei_caomiaode`(UR), `qun_dongzhuo`(SR) | 通过 | 1 | #93 已通过并合并；24 网格；冕板抬高以避开耳抖；codex/3d-headgear-crowns |
| `boneCrown` | `man_mengmiaohuo`(UR) | 通过 | 1 | #93 已通过并合并；20 网格；codex/3d-headgear-crowns |
| `pheasant` | `qun_lvbuding`(UR) | 待审 | 1 | 15 网格；codex/3d-headgear-crests |
| `helmetWei` | `wei_xiahoudun`(SSR), `wei_xuhuang`(SR) + 杂兵×5（`mob_wei_guard`, `mob_wei_vanguard`, `mob_shu_vanguard`, `mob_wu_vanguard`, `mob_qun_guard`） | 待审 | 1 | 12 网格；codex/3d-headgear-crests |
| `helmetGeneral` | `wei_zhangliao`(SSR), `shu_zhangmiaofei`(SSR), `shu_zhaomiaoyun`(SSR), `wu_sunxiaoba`(SSR), `shu_machao`(SR), `qun_huaxiong`(SR) | 待审 | 1 | 13 网格；codex/3d-headgear-crests |
| `featherHeaddress` | `man_zhurong`(SSR), `man_mulu`(SSR) + 杂兵×1（`mob_man_strategist`） | 待审 | 1 | 24 网格；codex/3d-headgear-crests |
| `yellowBand` | `qun_zhangjiao`(SSR), `xian_zhangzhua`(SSR) + 杂兵×1（`mob_xian_strategist`） | 待审 | 1 | 9 网格；codex/3d-headgear-crests |
| `tigerHood` | `wei_xuhuchi`(SSR) | 待审 | 1 | 16 网格；codex/3d-headgear-crests |
| `sailorBandana` | `wu_ganning`(SR) + 杂兵×6 | 底版 | 0 | |
| `fortuneHat` | `xian_guanlu`(SR) + 杂兵×1 | 底版 | 0 | |
| `rattanHelm` | `man_wutugu`(SR) + 杂兵×1 | 底版 | 0 | |
| `leafHat` | 杂兵×5 | 底版 | 0 | |
| `hood` | 杂兵×3 | 底版 | 0 | |
| `ratCap` | 杂兵×1 | 底版 | 0 | |

### 头饰审核记录

- 2026-10-11 · [#93](https://github.com/acaozixu123456/myRepository/pull/93) · 六种头饰第 1 轮 **通过并合并**，按 [固定队列](CODEX_QUEUE.md) 同步。Claude 确认六种轮廓在 190px 下可辨认；浅色官帽布折偏弱，后续头饰注意剪影对比。

### 头饰第 1 批检查（#93）

`npm run typecheck && npm test` 已通过（退出码 0；58 个测试文件、912 个测试）。六种头饰分别为 12 / 19 / 19 / 10 / 24 / 20 网格，均在单部件预算内；球 / 圆柱最大 20 分段，全部使用缓存材质和 `toon` / `solid` 描边，根变换与坐标有限性检查通过。

独立 QA 覆盖 27 使用者：静态三姿势 81 组、精确耳抖峰值 81 组、全部 14 姿势 378 组，以及三姿势 × 12 动画时刻 972 组。所有检查中，头饰自身裁切、眼部样本遮挡、非有限坐标和新增整猫越框回归均为 0。眼部检查使用真实眼三角投影采样，每眼至少 71 个有效样本，并结合原尺寸与 190px 截图核对。

整猫旧越框在底版 / 最终版保持一致：静态 2 / 2、全姿势 8 / 8、动画 24 / 24。全姿势案例为 `wei_caomiaode`、`wei_simamiyi` 各在 `strike / thrust / hurt / dash` 的底部越框；本批头饰自身在这些姿势中均通过框内检查。

审核截图：[idle / windup / strike](../src/art3d/parts/reviews/headgear-crowns/poses.png)、[十猫同屏战斗](../src/art3d/parts/reviews/headgear-crowns/battle.png)、[190px 剪影](../src/art3d/parts/reviews/headgear-crowns/small-190px.png)、[190px 三姿势](../src/art3d/parts/reviews/headgear-crowns/poses-190px.png)、[底版 / 最终版对照](../src/art3d/parts/reviews/headgear-crowns/before-after.png)。拍摄命令、基线与冻结源码信息见 [截图说明](../src/art3d/parts/reviews/headgear-crowns/README.md)，独立审核依据见 [QA 摘要](../src/art3d/parts/reviews/headgear-crowns/qa-summary.md) 与 [方法说明](../src/art3d/parts/reviews/headgear-crowns/qa-method-notes.json)。页面运行错误为 0，交付图片均 ≤500KB。

最不满意：官帽在 190px 下布折较弱，浅色 `pal` 的圆顶接近圆帽，短翼与额带仍可辨认。

### 头饰第 2 批检查

`npm run typecheck && npm test` 已通过（退出码 0；58 个测试文件、919 个测试）。六种分别为 15 / 12 / 13 / 24 / 9 / 16 网格，均在单部件预算内；球 / 圆柱最大 14 分段，全部复用缓存材质与 `toon` / `solid` 描边。

独立 QA 覆盖 21 使用者：静态三姿势 63 组、精确耳抖峰值 63 组、全部 14 姿势 294 组，以及三姿势 × 12 动画时刻 756 组。预算违规、非有限坐标、遮眼样本、头饰自身裁切与新增整猫越框回归均为 0；每眼至少 104 个有效三角采样。

魏 / 将盔额带、虎帽低位带绳和黄巾结尾保留耳根佩戴接合，最高交点在头饰局部 y=-0.168291；有限采样中，虎帽壳与耳三角交叉为 0，截图未见耳尖截断。具体方法与接合范围见 [QA 摘要](../src/art3d/parts/reviews/headgear-crests/qa-summary.md) 和 [机器报告](../src/art3d/parts/reviews/headgear-crests/qa-summary.json)。

整猫越框的底版 / 最终版计数为：静态 3 / 1、耳抖峰值 3 / 1、全姿势 14 / 4、动画 36 / 12。最终全姿势剩余 4 例为 `qun_lvbuding` 在 `strike / thrust / hurt / dash` 的既有下身底部裁切，动画剩余 12 例为其 `strike` 底部裁切；头饰自身全部在框内。

审核截图：[idle / windup / strike](../src/art3d/parts/reviews/headgear-crests/poses.png)、[十猫同屏战斗](../src/art3d/parts/reviews/headgear-crests/battle.png)、[190px 剪影](../src/art3d/parts/reviews/headgear-crests/small-190px.png)、[190px 三姿势](../src/art3d/parts/reviews/headgear-crests/poses-190px.png)、[底版 / 最终版对照](../src/art3d/parts/reviews/headgear-crests/before-after.png)。拍摄命令、基线和冻结源码见 [截图说明](../src/art3d/parts/reviews/headgear-crests/README.md)。两次 `shots3d` 与十二帧战斗截图已完成，页面运行错误为 0，交付图片均 ≤500KB。

最不满意：黄巾在张角角的黄色毛色上对比偏低，需 Claude 按 190px 游戏尺度审核。

## 衣服（`src/art3d/parts/body.ts`）

| 部件 | 使用者 | 状态 | 轮次 | 备注 |
| --- | --- | --- | --- | --- |
| `robeSilk` | `wei_simamiyi`(SP), `shu_pangmiaotong`(SP), `wei_caomiaode`(UR) 等7只 | 底版 | 0 | |
| `dress` | `xian_changmiao`(SP), `qun_diaochan`(SSR) | 底版 | 0 | |
| `armorHeavy` | `qun_lvbuding`(UR), `wei_xiahoudun`(SSR), `shu_zhangmiaofei`(SSR) 等7只 | 底版 | 0 | |
| `robeTaoist` | `xian_zuoci`(UR), `shu_zhugemiaoliang`(SSR), `qun_zhangjiao`(SSR) 等5只 + 杂兵×2 | 底版 | 0 | |
| `tribal` | `man_mengmiaohuo`(UR), `man_zhurong`(SSR), `man_mulu`(SSR) 等4只 + 杂兵×2 | 底版 | 0 | |
| `robeScholar` | `wu_luxun`(SSR), `qun_huatuo`(SSR), `xian_shuijing`(SSR) 等7只 + 杂兵×12 | 底版 | 0 | |
| `armorLight` | `wei_xuhuchi`(SSR), `wu_sunxiaoba`(SSR), `wu_sunxiangxiang`(SSR) 等5只 + 杂兵×7 | 底版 | 0 | |
| `armorWei` | `wei_zhangliao`(SSR) + 杂兵×2 | 底版 | 0 | |
| `vest` | `wu_ganning`(SR), `man_mengyou`(SR) + 杂兵×9 | 底版 | 0 | |
| `rattan` | `man_wutugu`(SR) + 杂兵×2 | 底版 | 0 | |

## 披挂（`src/art3d/parts/back.ts`）

| 部件 | 使用者 | 状态 | 轮次 | 备注 |
| --- | --- | --- | --- | --- |
| `capeLong` | `wei_simamiyi`(SP), `wei_caomiaode`(UR), `qun_lvbuding`(UR) | 底版 | 0 | |
| `ribbons` | `xian_changmiao`(SP), `wu_sunxiangxiang`(SSR), `qun_diaochan`(SSR) | 底版 | 0 | |
| `wings` | `shu_pangmiaotong`(SP) | 底版 | 0 | |
| `cape` | `shu_liumiaobei`(UR), `wei_xiahoudun`(SSR), `shu_guanyunmiao`(SSR) 等6只 | 底版 | 0 | |
| `gourd` | `xian_zuoci`(UR), `wei_guojia`(SR) + 杂兵×2 | 底版 | 0 | |
| `furCloak` | `man_mengmiaohuo`(UR), `man_mulu`(SSR), `qun_dongzhuo`(SR) | 底版 | 0 | |
| `scrollBack` | `xian_zhangzhua`(SSR) + 杂兵×1 | 底版 | 0 | |

## 配饰（`src/art3d/parts/extras.ts`）

| 部件 | 使用者 | 状态 | 轮次 | 备注 |
| --- | --- | --- | --- | --- |
| `beardGoat` | `wei_simamiyi`(SP), `wei_caomiaode`(UR), `qun_huatuo`(SSR) 等8只 | 底版 | 0 | |
| `bell` | `xian_changmiao`(SP), `wu_sunxiangxiang`(SSR), `wu_ganning`(SR) + 杂兵×1 | 底版 | 0 | |
| `earring` | `shu_pangmiaotong`(SP), `wu_zhoumiaoyu`(UR), `qun_lvbuding`(UR) | 底版 | 0 | |
| `glowEyes` | `wei_simamiyi`(SP), `shu_pangmiaotong`(SP), `xian_changmiao`(SP) | 底版 | 0 | |
| `tassel` | `shu_liumiaobei`(UR), `shu_zhugemiaoliang`(SSR), `wu_ganning`(SR) + 杂兵×3 | 底版 | 0 | |
| `warPaint` | `man_mengmiaohuo`(UR), `shu_zhangmiaofei`(SSR), `man_zhurong`(SSR) 等4只 | 底版 | 0 | |
| `beardLong` | `shu_guanyunmiao`(SSR) | 底版 | 0 | |
| `eyepatch` | `wei_xiahoudun`(SSR) | 底版 | 0 | |
| `redFace` | `shu_guanyunmiao`(SSR) | 底版 | 0 | |
| `scar` | `wu_sunxiaoba`(SSR) | 底版 | 0 | |
| `monocle` | `xian_guanlu`(SR) | 底版 | 0 | |
| `scarf` | 杂兵×4 | 底版 | 0 | |

## 毛色花纹（`src/art3d/patterns.ts`）

| 花纹 | 状态 | 轮次 | 备注 |
| --- | --- | --- | --- |
| `tabby` | 底版 | 0 | |
| `tuxedo` | 底版 | 0 | |
| `calico` | 底版 | 0 | |
| `point` | 底版 | 0 | |
| `spots` | 底版 | 0 | |
| `cow` | 底版 | 0 | |
| `tortie` | 底版 | 0 | |
| `butterfly` | 底版 | 0 | |

## 英雄专属造型（`src/art3d/heroes.ts` 的 `HERO_PARTS`）

通用部件做完之后，再给 SP / UR 英雄做「独一份」的东西（青龙偃月刀、冕旒、羽扇等）。按 `docs/ILLUST_PROGRESS.md` 的顺序：SP → UR → SSR。
