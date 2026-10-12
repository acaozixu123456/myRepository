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

头饰前两批已在 #93 / #95 通过并合并，各六种均为第 1 轮。当前第 3 批 `codex/3d-headgear-fieldwear`：`sailorBandana / fortuneHat / rattanHelm / leafHat / hood / ratCap`，共 20 使用者（3 英雄 + 17 杂兵），第 1 轮待 Claude 审核。已按当前英雄与杂兵造型核对，原表数量无误，补齐使用者 ID。

| 部件 | 使用者 | 状态 | 轮次 | 备注 |
| --- | --- | --- | --- | --- |
| `scholarCap` | `wei_simamiyi`(SP), `shu_guanyunmiao`(SSR), `shu_zhugemiaoliang`(SSR), `wu_luxun`(SSR), `qun_huatuo`(SSR), `xian_shuijing`(SSR), `wei_guojia`(SR), `shu_jiangwei`(SR) + 杂兵×4（`mob_wei_archer`, `mob_wei_strategist`, `mob_qun_archer`, `mob_qun_strategist`） | 通过 | 1 | #93 已通过并合并；12 网格；短翼与额带，190px 下布折较弱；codex/3d-headgear-crowns |
| `flowerPin` | `shu_pangmiaotong`(SP), `wu_sunxiangxiang`(SSR), `qun_diaochan`(SSR) | 通过 | 1 | #93 已通过并合并；19 网格；配色参考已批准立绘及 ref；codex/3d-headgear-crowns |
| `lotusCrown` | `xian_changmiao`(SP), `xian_zuoci`(UR) + 杂兵×1（`mob_xian_guard`） | 通过 | 1 | #93 已通过并合并；19 网格；金莲冠配色参考已批准立绘及 ref；codex/3d-headgear-crowns |
| `taoistCrown` | `wu_zhoumiaoyu`(UR), `xian_yuji`(SSR) + 杂兵×4（`mob_shu_strategist`, `mob_wu_strategist`, `mob_xian_vanguard`, `mob_xian_healer`） | 通过 | 1 | #93 已通过并合并；10 网格；道簪留出折耳活动间隙；codex/3d-headgear-crowns |
| `emperorCrown` | `wei_caomiaode`(UR), `qun_dongzhuo`(SR) | 通过 | 1 | #93 已通过并合并；24 网格；冕板抬高以避开耳抖；codex/3d-headgear-crowns |
| `boneCrown` | `man_mengmiaohuo`(UR) | 通过 | 1 | #93 已通过并合并；20 网格；codex/3d-headgear-crowns |
| `pheasant` | `qun_lvbuding`(UR) | 通过 | 1 | #95 已合并；15 网格；codex/3d-headgear-crests |
| `helmetWei` | `wei_xiahoudun`(SSR), `wei_xuhuang`(SR) + 杂兵×5（`mob_wei_guard`, `mob_wei_vanguard`, `mob_shu_vanguard`, `mob_wu_vanguard`, `mob_qun_guard`） | 通过 | 1 | #95 已合并；12 网格；codex/3d-headgear-crests |
| `helmetGeneral` | `wei_zhangliao`(SSR), `shu_zhangmiaofei`(SSR), `shu_zhaomiaoyun`(SSR), `wu_sunxiaoba`(SSR), `shu_machao`(SR), `qun_huaxiong`(SR) | 通过 | 1 | #95 已合并；13 网格；codex/3d-headgear-crests |
| `featherHeaddress` | `man_zhurong`(SSR), `man_mulu`(SSR) + 杂兵×1（`mob_man_strategist`） | 通过 | 1 | #95 已合并；24 网格；codex/3d-headgear-crests |
| `yellowBand` | `qun_zhangjiao`(SSR), `xian_zhangzhua`(SSR) + 杂兵×1（`mob_xian_strategist`） | 通过 | 1 | #95 已合并；9 网格；codex/3d-headgear-crests |
| `tigerHood` | `wei_xuhuchi`(SSR) | 通过 | 1 | #95 已合并；16 网格；codex/3d-headgear-crests |
| `sailorBandana` | `wu_ganning`(SR) + 杂兵×6（`mob_wei_healer`, `mob_shu_guard`, `mob_shu_healer`, `mob_wu_archer`, `mob_qun_vanguard`, `mob_qun_healer`） | 通过 | 1 | 15 网格；codex/3d-headgear-fieldwear |
| `fortuneHat` | `xian_guanlu`(SR) + 杂兵×1（`mob_xian_archer`） | 通过 | 1 | 8 网格；codex/3d-headgear-fieldwear |
| `rattanHelm` | `man_wutugu`(SR) + 杂兵×1（`mob_man_guard`） | 通过 | 1 | 18 网格；codex/3d-headgear-fieldwear |
| `leafHat` | 杂兵×5（`mob_shu_archer`, `mob_wu_healer`, `mob_man_archer`, `mob_man_healer`, `mob_man_assassin`） | 通过 | 1 | 14 网格；codex/3d-headgear-fieldwear |
| `hood` | 杂兵×3（`mob_wei_assassin`, `mob_wu_assassin`, `mob_qun_assassin`） | 通过 | 1 | 10 网格；codex/3d-headgear-fieldwear |
| `ratCap` | 杂兵×1（`mob_wu_guard`） | 通过 | 1 | 13 网格；codex/3d-headgear-fieldwear |

### 头饰审核记录

- 2026-10-11 · [#93](https://github.com/acaozixu123456/myRepository/pull/93) · 六种头饰第 1 轮 **通过并合并**，按 [固定队列](CODEX_QUEUE.md) 同步。Claude 确认六种轮廓在 190px 下可辨认；浅色官帽布折偏弱，后续头饰注意剪影对比。
- [#95](https://github.com/acaozixu123456/myRepository/pull/95) · 第 2 批六种头饰第 1 轮 **通过并合并**，按 [固定队列](CODEX_QUEUE.md) 的明确审核意见同步。Claude 建议下一批结带颜色更深，以提高小尺寸下的对比。

### 头饰第 1 批检查（#93）

`npm run typecheck && npm test` 已通过（退出码 0；58 个测试文件、912 个测试）。六种头饰分别为 12 / 19 / 19 / 10 / 24 / 20 网格，均在单部件预算内；球 / 圆柱最大 20 分段，全部使用缓存材质和 `toon` / `solid` 描边，根变换与坐标有限性检查通过。

独立 QA 覆盖 27 使用者：静态三姿势 81 组、精确耳抖峰值 81 组、全部 14 姿势 378 组，以及三姿势 × 12 动画时刻 972 组。所有检查中，头饰自身裁切、眼部样本遮挡、非有限坐标和新增整猫越框回归均为 0。眼部检查使用真实眼三角投影采样，每眼至少 71 个有效样本，并结合原尺寸与 190px 截图核对。

整猫旧越框在底版 / 最终版保持一致：静态 2 / 2、全姿势 8 / 8、动画 24 / 24。全姿势案例为 `wei_caomiaode`、`wei_simamiyi` 各在 `strike / thrust / hurt / dash` 的底部越框；本批头饰自身在这些姿势中均通过框内检查。

审核截图：[idle / windup / strike](../src/art3d/parts/reviews/headgear-crowns/poses.png)、[十猫同屏战斗](../src/art3d/parts/reviews/headgear-crowns/battle.png)、[190px 剪影](../src/art3d/parts/reviews/headgear-crowns/small-190px.png)、[190px 三姿势](../src/art3d/parts/reviews/headgear-crowns/poses-190px.png)、[底版 / 最终版对照](../src/art3d/parts/reviews/headgear-crowns/before-after.png)。拍摄命令、基线与冻结源码信息见 [截图说明](../src/art3d/parts/reviews/headgear-crowns/README.md)，独立审核依据见 [QA 摘要](../src/art3d/parts/reviews/headgear-crowns/qa-summary.md) 与 [方法说明](../src/art3d/parts/reviews/headgear-crowns/qa-method-notes.json)。页面运行错误为 0，交付图片均 ≤500KB。

最不满意：官帽在 190px 下布折较弱，浅色 `pal` 的圆顶接近圆帽，短翼与额带仍可辨认。

### 头饰第 2 批检查（#95）

`npm run typecheck && npm test` 已通过（退出码 0；58 个测试文件、919 个测试）。六种分别为 15 / 12 / 13 / 24 / 9 / 16 网格，均在单部件预算内；球 / 圆柱最大 14 分段，全部复用缓存材质与 `toon` / `solid` 描边。

独立 QA 覆盖 21 使用者：静态三姿势 63 组、精确耳抖峰值 63 组、全部 14 姿势 294 组，以及三姿势 × 12 动画时刻 756 组。预算违规、非有限坐标、遮眼样本、头饰自身裁切与新增整猫越框回归均为 0；每眼至少 104 个有效三角采样。

魏 / 将盔额带、虎帽低位带绳和黄巾结尾保留耳根佩戴接合，最高交点在头饰局部 y=-0.168291；有限采样中，虎帽壳与耳三角交叉为 0，截图未见耳尖截断。具体方法与接合范围见 [QA 摘要](../src/art3d/parts/reviews/headgear-crests/qa-summary.md) 和 [机器报告](../src/art3d/parts/reviews/headgear-crests/qa-summary.json)。

整猫越框的底版 / 最终版计数为：静态 3 / 1、耳抖峰值 3 / 1、全姿势 14 / 4、动画 36 / 12。最终全姿势剩余 4 例为 `qun_lvbuding` 在 `strike / thrust / hurt / dash` 的既有下身底部裁切，动画剩余 12 例为其 `strike` 底部裁切；头饰自身全部在框内。

审核截图：[idle / windup / strike](../src/art3d/parts/reviews/headgear-crests/poses.png)、[十猫同屏战斗](../src/art3d/parts/reviews/headgear-crests/battle.png)、[190px 剪影](../src/art3d/parts/reviews/headgear-crests/small-190px.png)、[190px 三姿势](../src/art3d/parts/reviews/headgear-crests/poses-190px.png)、[底版 / 最终版对照](../src/art3d/parts/reviews/headgear-crests/before-after.png)。拍摄命令、基线和冻结源码见 [截图说明](../src/art3d/parts/reviews/headgear-crests/README.md)。两次 `shots3d` 与十二帧战斗截图已完成，页面运行错误为 0，交付图片均 ≤500KB。

最不满意：黄巾在张角角的黄色毛色上对比偏低，需 Claude 按 190px 游戏尺度审核。

### 头饰第 3 批检查（第 1 轮待审）

六种野外 / 制服头饰覆盖 SR 英雄 3 只与杂兵 17 只，头部倍率 0.96～1.07，包含尖耳 / 圆耳 / 折耳 / 大耳 / 簇耳。六种逻辑网格数分别为 15 / 8 / 18 / 14 / 10 / 13，球 / 圆柱最大 14 分段，均在单部件预算内。全部复用缓存材质与 `toon` / `solid` 描边，根平移旋转保持为 0。

独立 QA 覆盖静态三姿势 60 组、精确耳抖峰值 60 组、全部 14 姿势 280 组，以及三姿势 × 12 动画时刻 720 组。预算违规、材质缓存违规、非有限坐标、遮眼样本、头饰自身裁切、整猫裁切与新增回归均为 0；每眼至少 71 个有效样本。以上结论对应本次有限姿势与时刻采样。

圆耳叶帽使用者 `mob_shu_archer` / `mob_wu_healer` 保留低位后耳根接合；普通、精确耳峰与 yaw=148° 背向三姿势实图均确认耳轮廓连续，未见叶片切入耳中部或截掉耳尖。三角接合的具体范围与方法见 [QA 摘要](../src/art3d/parts/reviews/headgear-fieldwear/qa-summary.md) 和 [机器报告](../src/art3d/parts/reviews/headgear-fieldwear/qa-summary.json)。

审核截图：[idle / windup / strike](../src/art3d/parts/reviews/headgear-fieldwear/poses.png)、[十猫同屏战斗](../src/art3d/parts/reviews/headgear-fieldwear/battle.png)、[190px 剪影](../src/art3d/parts/reviews/headgear-fieldwear/small-190px.png)、[190px 三姿势](../src/art3d/parts/reviews/headgear-fieldwear/poses-190px.png)、[底版 / 最终版对照](../src/art3d/parts/reviews/headgear-fieldwear/before-after.png)、[正面](../src/art3d/parts/reviews/headgear-fieldwear/front-190px.png)、[反侧](../src/art3d/parts/reviews/headgear-fieldwear/reverse-190px.png)。本批结带加深折线与结部配色，落实 #95 的后续建议；红 / 绿 / 蓝布巾和三阵营兜帽在实际截图中核对。四次 `shots3d` 与十二帧战斗截图完成，页面运行错误为 0，交付图片均 ≤500KB；取景、冻结源码与实际命令见 [截图说明](../src/art3d/parts/reviews/headgear-fieldwear/README.md)。

本批 `npm run typecheck && npm test` 已通过（退出码 0；58 个测试文件、926 个测试）。

最不满意：叶帽在 `strike` 中剪影偏薄，190px 下背面叶脉与厚度偏弱；`idle / windup` 的叶面与短柄较清楚，等待 Claude 按游戏尺度审核。

## 衣服（`src/art3d/parts/body.ts`）

| 部件 | 使用者 | 状态 | 轮次 | 备注 |
| --- | --- | --- | --- | --- |
| `robeSilk` | `wei_simamiyi`(SP), `shu_pangmiaotong`(SP), `wei_caomiaode`(UR), `shu_liumiaobei`(UR), `wu_zhoumiaoyu`(UR), `shu_guanyunmiao`(SSR), `qun_dongzhuo`(SR) | 待审 | 1 | 16 网格；交领、金边、压褶；codex/3d-body-regalia |
| `dress` | `xian_changmiao`(SP), `qun_diaochan`(SSR) | 待审 | 1 | 18 网格；双层波边裙、蝴蝶腰结；codex/3d-body-regalia |
| `armorHeavy` | `qun_lvbuding`(UR), `wei_xiahoudun`(SSR), `shu_zhangmiaofei`(SSR), `shu_zhaomiaoyun`(SSR), `wei_xuhuang`(SR), `wu_huanggai`(SR), `qun_huaxiong`(SR) | 待审 | 1 | 24 网格；三层金属肩甲、护心镜、五片裙甲；codex/3d-body-regalia |
| `robeTaoist` | `xian_zuoci`(UR), `shu_zhugemiaoliang`(SSR), `qun_zhangjiao`(SSR) 等5只 + 杂兵×2 | 底版 | 0 | |
| `tribal` | `man_mengmiaohuo`(UR), `man_zhurong`(SSR), `man_mulu`(SSR) 等4只 + 杂兵×2 | 底版 | 0 | |
| `robeScholar` | `wu_luxun`(SSR), `qun_huatuo`(SSR), `xian_shuijing`(SSR) 等7只 + 杂兵×12 | 底版 | 0 | |
| `armorLight` | `wei_xuhuchi`(SSR), `wu_sunxiaoba`(SSR), `wu_sunxiangxiang`(SSR) 等5只 + 杂兵×7 | 底版 | 0 | |
| `armorWei` | `wei_zhangliao`(SSR) + 杂兵×2 | 底版 | 0 | |
| `vest` | `wu_ganning`(SR), `man_mengyou`(SR) + 杂兵×9 | 底版 | 0 | |
| `rattan` | `man_wutugu`(SR) + 杂兵×2 | 底版 | 0 | |

### 衣服第 1 批检查

`codex/3d-body-regalia` 交付 `robeSilk / dress / armorHeavy`，第 1 轮待审，共 16 位英雄、无杂兵。原表的 7 / 2 / 7 数量正确，现补齐 ID。配色与造型参考 `ART_PROMPTS.md`、英雄参考 JPG 及已批准的 SP / UR 立绘；领口、裙摆与肩甲只改衣服部件，下摆继续挂在 `hip`。

`npm run typecheck && npm test` 通过：65 个测试文件、980 项测试，退出码 0。三件逻辑网格为 16 / 18 / 24，几何分段最大 24，复用缓存材质，无每帧新增代码。内部修订已解决曲面装饰沉入壳体和裙层被遮挡的问题；已同步主分支 `bf37bd3` 最新大头 / 肉垫 / Toon，增强三层金属肩甲并合批裙甲金边，预算保持不变。同步后的检查和截图重新生成，不增加审核轮次。

独立 QA 覆盖 16×14＝224 姿势和 16×3×12＝576 动画样本。衣服自身出框、眼睛及五个脸部样点遮挡、非有限坐标和新增整猫取景回归均为 0；每眼至少 71 个有效三角投影样本。三姿势 / 全 14 姿势 / 动画的正常蒙皮整猫裁切基线与候选相同，为 13 / 55 / 135；全姿势含背挂旧底裁切 12 与新版大头下既有头饰上裁切 43，动画为 36 / 99。最高 y=3.770092 超过 FRAME 上界 3.6，最低 y=-0.361908 低于下界 -0.25，双方边界完全一致。有限采样不能证明所有连续时刻无交叉；方法和边界见 [QA 摘要](../src/art3d/parts/reviews/body-regalia/qa-summary.md)。

三种裙面在构建时固定腰口 y=0.57，连同裙饰收短至约 -0.20～-0.22，根仍为单位变换；官方三姿势及十猫截图确认肉垫靴露出。

审核图：[三姿势](../src/art3d/parts/reviews/body-regalia/poses.png)、[十猫同屏战斗](../src/art3d/parts/reviews/body-regalia/battle.webp)、[小尺寸三姿势](../src/art3d/parts/reviews/body-regalia/poses-small.png)、[同引擎前后对照](../src/art3d/parts/reviews/body-regalia/before-after.png)、[胖体型与浅色甲](../src/art3d/parts/reviews/body-regalia/boundaries.png)。命令与冻结记录见 [截图说明](../src/art3d/parts/reviews/body-regalia/README.md)。

最不满意：重甲在 190px 游戏尺度下的胸片细节偏简，浅色赵喵云的护心镜对比偏弱；短甲裙与肩饰仍能区别于丝袍。请 Claude 按实际战斗尺度审核。后续按最新固定队列先做毛色花纹，再做英雄专属造型，与 WORLD A10 地面贴花交替推进。

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
