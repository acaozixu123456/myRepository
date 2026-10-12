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
| `robeTaoist` | `xian_zuoci`(UR), `shu_zhugemiaoliang`(SSR), `qun_zhangjiao`(SSR), `xian_zhangzhua`(SSR), `xian_yuji`(SSR) + 杂兵×2（`mob_xian_guard`, `mob_xian_strategist`） | 待审 | 1 | 21 网格；宽交领、阴阳纹、符袋；codex/3d-body-robes |
| `tribal` | `man_mengmiaohuo`(UR), `man_zhurong`(SSR), `man_mulu`(SSR), `man_shamoke`(SSR) + 杂兵×2（`mob_man_vanguard`, `mob_man_strategist`） | 待审 | 1 | 24 网格；露毛胸面、骨扣、三片短皮裙；codex/3d-body-robes |
| `robeScholar` | `wu_luxun`(SSR), `qun_huatuo`(SSR), `xian_shuijing`(SSR), `wei_guojia`(SR), `shu_jiangwei`(SR), `xian_guanlu`(SR), `xian_nanhua`(SR) + 杂兵×12（`mob_wei_strategist`, `mob_wei_healer`, `mob_shu_strategist`, `mob_shu_healer`, `mob_wu_strategist`, `mob_wu_healer`, `mob_qun_strategist`, `mob_qun_healer`, `mob_man_healer`, `mob_xian_vanguard`, `mob_xian_healer`, `mob_xian_assassin`） | 待审 | 1 | 18 网格；短翼领、侧开裾、侧扣；codex/3d-body-robes |
| `armorLight` | `wei_xuhuchi`(SSR), `wu_sunxiaoba`(SSR), `wu_sunxiangxiang`(SSR), `shu_huangzhong`(SR), `shu_machao`(SR) + 杂兵×7（`mob_wei_vanguard`, `mob_shu_vanguard`, `mob_wu_guard`, `mob_wu_vanguard`, `mob_wu_archer`, `mob_qun_vanguard`, `mob_man_assassin`） | 待审 | 1 | 22逻辑 / 42含描边网格；X绑带、低V领、短肩与腰片；codex/3d-body-field-armor |
| `armorWei` | `wei_zhangliao`(SSR) + 杂兵×2（`mob_wei_guard`, `mob_qun_guard`） | 待审 | 1 | 22逻辑 / 42含描边网格；规整札片、窄层肩与圆胸镜；codex/3d-body-field-armor |
| `vest` | `wu_ganning`(SR), `man_mengyou`(SR) + 杂兵×9（`mob_wei_archer`, `mob_wei_assassin`, `mob_shu_archer`, `mob_shu_assassin`, `mob_wu_assassin`, `mob_qun_archer`, `mob_qun_assassin`, `mob_man_archer`, `mob_xian_archer`） | 待审 | 1 | 15逻辑 / 29含描边网格；开襟翻领、盘扣与短开衩；codex/3d-body-field-armor |
| `rattan` | `man_wutugu`(SR) + 杂兵×2（`mob_shu_guard`, `mob_man_guard`） | 待审 | 1 | 22逻辑 / 38含描边网格；前胸、前腰交错藤编与低肩片；codex/3d-body-field-armor |

### 衣服第 1 批检查

`codex/3d-body-regalia` 交付 `robeSilk / dress / armorHeavy`，第 1 轮待审，共 16 位英雄、无杂兵。原表的 7 / 2 / 7 数量正确，现补齐 ID。配色与造型参考 `ART_PROMPTS.md`、英雄参考 JPG 及已批准的 SP / UR 立绘；领口、裙摆与肩甲只改衣服部件，下摆继续挂在 `hip`。

`npm run typecheck && npm test` 通过：65 个测试文件、980 项测试，退出码 0。三件逻辑网格为 16 / 18 / 24，几何分段最大 24，复用缓存材质，无每帧新增代码。内部修订已解决曲面装饰沉入壳体和裙层被遮挡的问题；已同步主分支 `bf37bd3` 最新大头 / 肉垫 / Toon，增强三层金属肩甲并合批裙甲金边，预算保持不变。同步后的检查和截图重新生成，不增加审核轮次。

独立 QA 覆盖 16×14＝224 姿势和 16×3×12＝576 动画样本。衣服自身出框、眼睛及五个脸部样点遮挡、非有限坐标和新增整猫取景回归均为 0；每眼至少 71 个有效三角投影样本。三姿势 / 全 14 姿势 / 动画的正常蒙皮整猫裁切基线与候选相同，为 13 / 55 / 135；全姿势含背挂旧底裁切 12 与新版大头下既有头饰上裁切 43，动画为 36 / 99。最高 y=3.770092 超过 FRAME 上界 3.6，最低 y=-0.361908 低于下界 -0.25，双方边界完全一致。有限采样不能证明所有连续时刻无交叉；方法和边界见 [QA 摘要](../src/art3d/parts/reviews/body-regalia/qa-summary.md)。

三种裙面在构建时固定腰口 y=0.57，连同裙饰收短至约 -0.20～-0.22，根仍为单位变换；官方三姿势及十猫截图确认肉垫靴露出。

审核图：[三姿势](../src/art3d/parts/reviews/body-regalia/poses.png)、[十猫同屏战斗](../src/art3d/parts/reviews/body-regalia/battle.webp)、[小尺寸三姿势](../src/art3d/parts/reviews/body-regalia/poses-small.png)、[同引擎前后对照](../src/art3d/parts/reviews/body-regalia/before-after.png)、[胖体型与浅色甲](../src/art3d/parts/reviews/body-regalia/boundaries.png)。命令与冻结记录见 [截图说明](../src/art3d/parts/reviews/body-regalia/README.md)。

最不满意：重甲在 190px 游戏尺度下的胸片细节偏简，浅色赵喵云的护心镜对比偏弱；短甲裙与肩饰仍能区别于丝袍。请 Claude 按实际战斗尺度审核。后续按最新固定队列先做毛色花纹，再做英雄专属造型，与 WORLD A10 地面贴花交替推进。

### 衣服第 2 批检查

`codex/3d-body-robes` 交付道袍 / 兽皮 / 文士袍，第 1 轮待审；共 32 使用者（16 英雄 + 16 杂兵），核对原表 5+2 / 4+2 / 7+12 数量正确，已补齐 ID。第 1 批衣服在 #99 待审，本批从主分支 `bf37bd3` 独立制作，保留最新大头比例、大肉垫、毛领、靴子和去除斑点高光的 Toon，不依赖未合并的 #99。

参考 `ART_PROMPTS.md` 和实际英雄 JPG，配色来自 `pal` / `fur` / `light`。道袍用宽交领与长垂带，兽皮用交绑与短皮裙，文士袍用短翼领与侧襟直裾。局部实现放在 `parts/body-robes.ts`，只更新对应三件注册函数，下摆仍挂 hip。

`npm run typecheck && npm test` 通过：65 个测试文件、980 项测试，退出码 0。三件逻辑网格为 21 / 24 / 18，分段最大 24，重复构建复用缓存材质。独立 QA 的 448 全姿势与 1152 动画样本中，衣服自身出框、眼 / 鼻口样点遮挡、非有限坐标及新增整猫取景回归均为 0；每眼最低 71 个有效三角投影样本。普通蒙皮整猫保留与基线相同的头饰上裁切，三姿势 / 全姿势 / 动画为 8 / 27 / 49；最高 y=3.696244，FRAME 上界 3.6，双方采样边界一致。构建时固定腰口 y=0.57，收短裙面至约 -0.214～-0.216，露靴且根变换保持单位。方法、源码冻结与有限观测范围见 [QA 摘要](../src/art3d/parts/reviews/body-robes/qa-summary.md) / [机器报告](../src/art3d/parts/reviews/body-robes/qa-summary.json)。

审核图：[三姿势](../src/art3d/parts/reviews/body-robes/poses.png)、[真实十猫战斗](../src/art3d/parts/reviews/body-robes/battle.webp)、[小尺寸](../src/art3d/parts/reviews/body-robes/poses-small.png)、[最新同引擎前后对照](../src/art3d/parts/reviews/body-robes/before-after.png)、[体宽与深色杂兵](../src/art3d/parts/reviews/body-robes/boundaries.png)。命令和截图版本记录见 [说明](../src/art3d/parts/reviews/body-robes/README.md)；十二帧战斗完成，运行错误 0，单图均 <500000 B。

最不满意：浅色文士袍的小扣在游戏尺度偏弱，兽皮胸面的素色毛色片仍待后续花纹批次统一。后续按最新固定队列先做毛色花纹，再做英雄专属造型，与 A10 地面贴花交替。

### 衣服第 3 批检查（战场衣服，2026-10-12）

`codex/3d-body-field-armor` 交付 `armorWei / armorLight / vest / rattan`，第1轮待审。共29名实际使用者（9英雄、20杂兵），四件分别3 / 12 / 11 / 3名，完整ID已补在上表，并与独立机器报告核对。参考9张英雄原JPG与 `ART_PROMPTS.md`，采用魏甲札片和胸镜、轻甲X绑带、短褂开襟与藤甲菱形篮编，配色来自当前 `PartCtx.pal`。最不满意：190px下藤编前后穿插深度仍弱，背面是暖藤色完整底壳；魏甲小札片在侧后视更依赖肩层和胸镜识别。

源码只替换 `body.ts` 四项注册、新增 `parts/body-field-armor.ts`，并删除四项旧底版替换后确实不再使用的辅助链和 `sphere` import，以满足 noUnused 检查。已通过六款衣服的 regalia 函数区间及 `body-robes.ts` helper与基线字节相同；没有改猫、姿势、材质、数据或挂接契约。

固定审核与官图基线为 `e777d58f3b0e9965f7af25ded73948a84e68d219`。注册源码SHA为 `deff4ede63cecfff2513149843d01dbb48c570689658a66a60413c64daae959a`，helper为 `1735d0cbbb9095bdcf995a91fb9cd406c0096d9882b885f341b970081b012942`，body→helper按path+NUL+bytes+NUL合成 `74787654cae61640cc5634965b8a27632c87182271e3ea123156a13e8201918d`。当前cat/pose为 `39b82bcb… / 3abe84b5…`，含整颗头缩放、前举持握及眯眼/张嘴表情。腰口y=.57不动，上身几何在构建时收至.90，腰下仍挂hip；body根与skirt根为单位变换。

| 衣服 | 逻辑网格（含skirt） | 含描边实际网格 | 最大分段 |
| --- | ---: | ---: | ---: |
| armorWei | 22 | 42 | 24 |
| armorLight | 22 | 42 | 24 |
| vest | 15 | 29 | 24 |
| rattan | 22 | 38 | 24 |

全部29名使用者复测，Toon/outline材质均复用缓存，尺度与行列式为正；没有每帧分配或新增独立动画。固定e777源码已有 `npm run typecheck && npm test` 通过记录，68文件 / 1019测试、退出0；提交前维护者另同步主线29f6日期修复并实际再次执行同命令，退出0、68文件/1019测试全部通过。相关 art3d/look/actor/player 累计字节无变化，2源、22图及独立QA三件保持冻结记录，拍摄基线仍为e777。

独立 [QA说明](../src/art3d/parts/reviews/body-field-armor/qa-summary.md) / [机器报告](../src/art3d/parts/reviews/body-field-armor/qa-summary.json) 锁定整src的298文件到唯一运行快照，核对SHA哨兵及全部源文件前后相同，旧BODY通过真实 `git show e777d58:src/art3d/parts/body.ts` 获取。29×(14姿势×4朝向+3姿势×12时刻)=2668状态，其中静态1624、动画1044；静态yaw=0/32/-32/148、t=.4、phase0，动画yaw32、t=i×8/11。

- 新衣服实体及沿normal展开的描边，对真实颅骨1120三角面strict interior逐面裁剪，交叉状态0；能检查无inside顶点的跨壳三角，没有用名义椭球或仅顶点计数推断无交叉。旧高领2668状态均有真实交叉，新候选消除了本次采样中的交叉。
- 眼睛来自实际baked eye核心三角的12×12投影网格，按具体被遮sample ID差集比较；眼睛与动态鼻口新增ID均0、有效眼格点不一致0。动态5面部点来自当前nose/muzzle及启用的smile或mouthO表面，包含mouthO1972 / smile696状态。受击眯眼和呼吸采样中，每眼最低有效数静态50 / 动画70，没有使用旧引擎110阈值。
- 全89个显式id/look含41英雄、36杂兵、12宠物；29目标旧/新均真实调用BODY恰好1次，60非目标所有geometry attributes及index的TypedArray原始字节完全一致；12宠物body均none。
- 自衣服出FRAME、非有限值、新增整猫裁切和四边裁幅增加均0。整猫仍保留双方相同的277个既有裁切（静态184、动画93），来自headTop及蜀/群前锋paw；最低y=-.290644194、最高y=3.755856928，FRAME y=[-.25,3.6]。不声称全员完整入框或所有连续时刻没有交叉。

官图覆盖全部29名使用者：英雄 [三姿势1](../src/art3d/parts/reviews/body-field-armor/heroes-1.png) / [三姿势2](../src/art3d/parts/reviews/body-field-armor/heroes-2.png)，杂兵 [1](../src/art3d/parts/reviews/body-field-armor/mobs-1.png) / [2](../src/art3d/parts/reviews/body-field-armor/mobs-2.png) / [3](../src/art3d/parts/reviews/body-field-armor/mobs-3.png) / [4](../src/art3d/parts/reviews/body-field-armor/mobs-4.png)；各组另有原生250×219单格的小尺寸图，英雄另有正面/反侧/背面三姿势。补充 [大头低领](../src/art3d/parts/reviews/body-field-armor/neckroom-large-heads.png)、[藤编细节](../src/art3d/parts/reviews/body-field-armor/rattan-front-detail.png)、[独立正常前后](../src/art3d/parts/reviews/body-field-armor/before-after.png) 和 [真实十猫战斗](../src/art3d/parts/reviews/body-field-armor/battle.webp)。战斗保留HUD，十二帧取第04帧t=4.25s，10/10真实cat3d，四种body和skirt组逐只命中。

官图20张PNG及battle为原尺寸无损，另有独立前后对照；单文件均小于500000 B，完整解码RGBA像素差0。原图/导出SHA、参数、采集依赖前后记录与错误见 [采集记录](../src/art3d/parts/reviews/body-field-armor/capture-records.json) 和 [README](../src/art3d/parts/reviews/body-field-armor/README.md)。页面脚本错误0；外部Google Fonts失败后回退系统字体的记录保留。原有盾与爪动作可能遮住部分口鼻，这批衣服没有通过隐藏其他部件改变这些既有动作。

## 披挂（`src/art3d/parts/back.ts`）

| 部件 | 使用者 | 状态 | 轮次 | 备注 |
| --- | --- | --- | --- | --- |
| `capeLong` | `wei_simamiyi`(SP), `wei_caomiaode`(UR), `qun_lvbuding`(UR), `pet_jinjin`(SR) | 待审 | 1 | 圆润肩折、分片软弧下摆；12 逻辑网格 |
| `ribbons` | `xian_changmiao`(SP), `wu_sunxiangxiang`(SSR), `qun_diaochan`(SSR), `pet_diandian`(SR), `pet_jiuwei`(SSR) | 待审 | 1 | 双条厚弧布、背面衬色与金边；10 逻辑网格 |
| `wings` | `shu_pangmiaotong`(SP), `pet_longmao`(SSR), `pet_xingxing`(SSR) | 待审 | 1 | 分层圆钝凤羽、小体型内部收窄；22 逻辑网格 |
| `cape` | `shu_liumiaobei`(UR), `wei_xiahoudun`(SSR), `shu_guanyunmiao`(SSR) 等6只 | 底版 | 0 | |
| `gourd` | `xian_zuoci`(UR), `wei_guojia`(SR) + 杂兵×2 | 底版 | 0 | |
| `furCloak` | `man_mengmiaohuo`(UR), `man_mulu`(SSR), `qun_dongzhuo`(SR) | 底版 | 0 | |
| `scrollBack` | `xian_zhangzhua`(SSR) + 杂兵×1 | 底版 | 0 | |

### 披挂第 1 批检查（第 1 轮待审）

`codex/3d-back-sp-regalia` 交付 `capeLong / ribbons / wings`，共 12 位实际使用者（7 英雄 + 5 宠物，无杂兵），全员均以真实 ID 装配并命中 BACK 注册函数。基线固定为 `e777d58`；注册表源码冻结 `1f7074104ea1`，helper 冻结 `b356c5152e96`，仅改这三个条目及 `parts/back-sp-regalia.ts`，没有改宠物数据。完整参考、命令、源码哈希与十五张正式图见 [README](../src/art3d/parts/reviews/back-sp-regalia/README.md)，独立检查见 [QA 摘要](../src/art3d/parts/reviews/back-sp-regalia/qa-summary.md) / [机器报告](../src/art3d/parts/reviews/back-sp-regalia/qa-summary.json)。当前待 Claude 评审。

三件逻辑网格为 12 / 10 / 22（描边计入原件），分段最大 20；三次装配复用缓存 Toon 材质，根变换保持单位、子节点尺度为正，无每帧更新分配。`npm run typecheck && npm test` 通过：68 个测试文件、1019 项测试，退出码 0。其余 77 个非目标的正常 bake 几何属性、布局和索引逐字节一致。

独立 QA 的 2400 个新/旧配对姿势、时刻与朝向样本中，新增眼点 ID 为 0、新增可见鼻口遮挡为 0，部件自身出框、新增或增大的整猫四侧裁切及非有限坐标均为 0。600 个实际相对形位使用真实 skull 的 1120 个三角平面对本体与描边整三角裁剪，12 位候选内部顶点与内部三角均为 0。保守鼻口深度新增 48 个 ID，全在 148° 背视，其中 46 点先被 head 骨表面遮住、2 点先被 shoulder 骨表面遮住；保留的 62 个旧眼深度 ID 也只在两只羽翼宠物背视，不宣称所有 raw 深度计数为 0。

整猫出框样本 760 → 568，无新增或增大；余下为相同的既有 `headTop / ear` 上裁切。正常背视保留尾根可读，中心距检查不代替整条摆动尾巴的碰撞求解。真实十猫战斗记录 10/10 cat3d、7/7 本批英雄背饰；另单独观察 `pet_xingxing` 的真实 `petActors` 出场，12 帧裁切为 0，实际左缘最小 10.64 逻辑 px，扣除最坏震屏 4 px 后仍为 6.64 > 5 px。修复只收窄两只小体型宠物的内部羽组，没有移动根、舞台或镜头。

正式十五张图均 <500000 B，PNG / 无损 WebP 与浏览器原始 PNG 的完整 RGBA 差异为 0；四张宠物图及宠物战斗已按最终 b356 重拍，九张英雄图及主战斗图的保留依据与拍摄版本如实记录在 README。最不满意：飘带在 190px 正面仍略像两条圆弧，浅色内羽从背面部分被外羽盖住；既有冠顶、耳部裁切保留。

提交前另同步主线 `29f6a8b` 的日期测试修复；相关 art3d / look / actor / player 源码与拍摄基线 e777 没有变化，本批两源与十九个审图字节保持原记录。维护者再次实际 typecheck + test 退出0，68文件 / 1019测试全部通过。
| `wings` | `shu_pangmiaotong`(SP) | 底版 | 0 | |
### 披挂第 2 批检查
`codex/3d-back-fieldgear` 交付 `cape / gourd / furCloak`，第 1 轮待审，共 16 个真实使用者：11 英雄、2 杂兵、3 宠物，完整 ID 见上表。基线固定 `29f6a8bbe66bbcf4ea1c0119675cac65f8c4e00a`；仅更新三件注册与 `parts/back-fieldgear.ts`。最终注册表 SHA256 为 `50171fc70ea9b9a2d74f544cc86bcdcdbaa068311031d517543606946034f162`，helper 为 `87a4a0b05b51cf180ff64d1a2ba52f62282f128322432832dffa1f712326c3aa`；cat/pose/actor 分别固定 `39b82bcb… / 3abe84b5… / 268bc636…`。236 个 src 文件的独立快照与审核前后源码一致，23 张作者正式图均在最终冻结源下鲜拍，没有沿用旧候选图。
三件逻辑网格 12 / 10 / 16，含描边实际 24 / 20 / 32，分段最大 20；三次构建复用 Toon/描边缓存，根为单位变换、内部尺度为正，无每帧新增代码。披风保留阵营主辅色与滚边，小体型宠物内部收宽；葫芦用一体双腹、木塞和连续吊带连接背扣与腰束；兽皮沿用天然暖棕皮/米色毛边，绑带与扣来自阵营色。参考 11 张英雄 JPG、`ART_PROMPTS.md` 对应设定与刘喵备 full 立绘。
独立 QA 完成 3200 组新旧配对：16×（14 姿势×4 yaw + 3 姿势×12 时刻×4 yaw），静态 896、动画 2304；yaw=0/-32/+32/148，静态 t=.4、动画 t=i×8/11，phase0，dash 使用 moving=true。两眼实际 core 三角 12×12 采样，最少有效点 50，新增眼部 sample ID 为 0；五个实际鼻子/笑嘴或 mouthO/口鼻垫点的名称、世界坐标与口型模式逐组一致。新增 raw `mouthR` 命中 2 个（董桌、孟获 slump/t=.4/yaw148），实际剩余 paw 表面已先遮住该嘴点，未发现新增可见鼻口探针遮挡；不把 raw 数写成 0。
800 个相对姿势/时刻用实际 1120 非退化颅壳面，完整裁剪披挂本体与法线扩张描边的三角形，新旧两版进入颅壳的顶点/完整三角均 0；共同刚性 yaw 不改变交叠关系。披挂自身 FRAME 出框、非有限坐标与新增/加重整猫裁幅均 0。正常整猫保留原有 720 组出框（静态 228、动画 492），其中 headTop 712、关云喵 paw 8，逐组四边幅度与同引擎基线完全相同；不能说所有猫都在取景框内。73 个非目标的全部 attribute/layout/类型与索引 Uint8 字节一致，89 个真实 look/id 均显式构建，16 个目标新旧注册各命中一次，包含全部 12 宠物。
真实十猫战斗为 10/10 cat3d、10/10 本批 BACK 名称命中。煤球、雪球、守护喵分别经真实 `Player.doPet` 出场，新旧各 12 帧，共 72 条记录，均 alpha1、实际 cape 装配 hit1、主演员 10/10 3D；本体与正常扩张描边的四个舞台边缘裁切均 0。旧新 actor/root/cam 轨迹逐帧相同，未人为挪演员或镜头；煤球技能会自然跨场，不声称每帧 x 固定 62。新版最小空隙 27.640210761641413 逻辑 px，统一扣本批最大实测 shake5 后为 22.640210761641413>5。此范围是披挂部件的有限出场窗口，不等于整只宠物/VFX或所有战斗镜头无裁切。
作者在最终 87a4 上实际运行 `npm run typecheck && npm test`，68 文件、1019 测试通过、退出 0；独立 QA 没有冒称另跑这些命令，也未用未逐一传入 heroId/PET 的单测代替真实装配。23 张正式图与对应 raw 尺寸相同、完整 RGBA 差 0，单图均 <500000 B；独立正常 bake 的 11 英雄旧新对照为 530×2948、316654 B，同 raw 字节/RGBA 差 0。QA md/json 均 <500000 B，紧凑 JSON 无损保留全部 3200 样本键、眼/鼻口 ID、mouth mode、精确 margin 与完整物理统计，往返核验通过；完整 raw 留临时目录并记录 SHA。
审核证据：[作者说明与 23 图索引](../src/art3d/parts/reviews/back-fieldgear/README.md)、[三姿势](../src/art3d/parts/reviews/back-fieldgear/poses.png)、[真实十猫](../src/art3d/parts/reviews/back-fieldgear/battle.webp)、[煤球真实宠物技](../src/art3d/parts/reviews/back-fieldgear/pet-battle.webp)、[独立摘要](../src/art3d/parts/reviews/back-fieldgear/qa-summary.md)、[机器报告](../src/art3d/parts/reviews/back-fieldgear/qa-summary.json)、[正常旧新对照](../src/art3d/parts/reviews/back-fieldgear/before-after.png)。有限离散 pose/time/phase、颅壳不含耳/绒毛/口鼻、尾根辅助距离不等于完整摆尾碰撞；葫芦退化 Lathe 封口的最近点诊断仅在 QA 临时夹具补核，来源与方法见机器报告。最不满意：毛边仍读成圆块，190px 下短披风细折与绳结偏弱，-32° 壶身多被躯干遮住，+32°/背视双腹较清楚。

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
| `tabby` | 待审 | 1 | 11 使用者（7 英雄 + 4 杂兵）；前脸 u=.25 的额头 M、双颊纹、沿 z 的尾环；codex/3d-patterns-coat-basics |
| `tuxedo` | 待审 | 1 | 6 使用者（2 英雄 + 4 杂兵）；前脸白鼻梁接下颌，body 白袜；胸领 / 手爪由既有引擎材质提供；codex/3d-patterns-coat-basics |
| `calico` | 待审 | 1 | 4 使用者（2 英雄 + 2 杂兵）；浅底与橘 / 深块、不对称侧后块；保留实际毛色数据；codex/3d-patterns-coat-basics |
| `point` | 待审 | 1 | 5 使用者（4 英雄 + 1 杂兵）；前脸渐深面罩，保留嫦喵浅冷蓝；codex/3d-patterns-coat-special |
| `spots` | 待审 | 1 | 7 使用者（3 英雄 + 4 杂兵）；开口玫瑰环，脸侧留眼周空间；codex/3d-patterns-coat-special |
| `cow` | 待审 | 1 | 5 使用者（2 英雄 + 3 杂兵）；浅底、不对称大斑，解决 accent=base 时底版斑纹不可见；codex/3d-patterns-coat-special |
| `tortie` | 待审 | 1 | 孟优优（`man_mengyou`）；深棕底与橙金大斑，不引入白色；codex/3d-patterns-coat-special |
| `butterfly` | 待审 | 1 | 南华喵；前脸额头四瓣镜像毛色，中央负空间；codex/3d-patterns-coat-special |

### 毛色花纹第 2 批检查

`point / spots / cow / tortie / butterfly` 覆盖 19 使用者（11 英雄 + 8 杂兵），第 1 轮待审，首批三种在 #102 待审。本批从 `aa9afd3` 独立制作，只改五种花纹与审图 / 进度；保留三种首批基线输出、solid / shaded、缓存与 public API，未带入未合并 #102 实现。

参考 11 张实际英雄 JPG 与 `ART_PROMPTS.md`。重点色的前脸渐深面罩保留嫦喵冷浅蓝；豹纹改为开口玫瑰环；奶牛改为浅底大斑，解决既定 accent=base 时底版图案不可见；玳瑁保留深底橘金大块；蝶斑为额心左右四瓣毛色与中央负空间。所有颜色来自既有 coat 字段，按 +z / u=.25 放置正脸。

`npm run typecheck && npm test` 通过，66 文件 / 987 项测试。独立 QA：38 张目标 head/body 纹理均 256²、sRGB、全不透明，缓存 / 独立像素确定性 38/38，116 非目标输出逐 RGBA 或 null 同基线；3800 热调用新增 Canvas 0、全 77 位使用者 SSR 154/154 返回 null。两 mode 的 Canvas 约 9.5 MiB、默认 mipmap GPU 数据约 12.67 MiB，纹理数量 / 尺寸与基线相同，没有新网格或逐帧分配。

266 全姿势静态与 228 三姿势动画样本中，正常烘焙几何属性 / 索引一致、世界坐标最大差 0、非有限 / 新取景回归 0。既有头饰上裁切保留，静态 41 / 动画 38 与基线相同，最高静态 y=3.74145395，FRAME 上界 3.6。边缘像素有 13 张相同 / 25 张非零差，不称数学无缝；实际审核视角未見明显硬缝。方法和有限性见 [QA](../src/art3d/parts/reviews/patterns-special/qa-summary.md) / [机器报告](../src/art3d/parts/reviews/patterns-special/qa-summary.json)。

审核图：[三姿势](../src/art3d/parts/reviews/patterns-special/poses.png)、[真实十猫战斗](../src/art3d/parts/reviews/patterns-special/battle.webp)、[原生小画布](../src/art3d/parts/reviews/patterns-special/poses-small.png)、[边界杂兵](../src/art3d/parts/reviews/patterns-special/boundaries.png)、[正常烘焙前后对照](../src/art3d/parts/reviews/patterns-special/before-after.png)；0 / ±32 / 148° 与真实参数见 [记录](../src/art3d/parts/reviews/patterns-special/README.md)。七次官方截图与十二帧战斗完成，页面运行错误 0，交付图片均 <500000 B、无损导出 RGB 差 0。

最不满意：南华蓝色四瓣的下瓣在战斗尺度偏弱，尾玫瑰环受低分段球面拉伸。耳、爪、胸绒领、袖子仍为引擎独立纯色；重点色末尾仍取 light，ring 尾奇段仍取既有 stripe / fallback。需 Claude 扩展挂接契约才能改变这些部位，本批不改引擎。后续继续 SP 专属造型，与 A10 裂缝贴花交替。

### 毛色花纹第 1 批检查

`tabby / tuxedo / calico` 首批覆盖 21 使用者（11 英雄 + 10 杂兵），第 1 轮待审。参考实际刘喵备、吕布丁、貂蝉喵、庞喵统 JPG 与 `ART_PROMPTS.md`，花纹按球面前脸 u≈0.25 放置；仅改程序化 256² head/body CanvasTexture，不改猫模型、五官、数据或其他五种纹样。

`npm run typecheck && npm test` 通过，65 文件 / 980 项测试。42 张纹理冷缓存创建 42 Canvas，同描述 42/42 命中，独立模块 42/42 像素确定；暖调用 4200 次没有新 Canvas，其余 112 head/body 输出逐 RGBA 与基线相同。全批创建两个 mode 时 RGBA Canvas 约 10.5 MiB、含默认 mipmap 的 GPU 数据约 14 MiB，与原实现纹理数量 / 分辨率相同，没有新增网格或逐帧分配。

独立检查覆盖 294 全姿势静态与 252 三姿势动画样本，正常烘焙几何属性和索引均与基线相同，顶点差 0、非有限 0、新取景回归 0；保留吕布丁已有头饰上裁切 / 背挂下裁切：静态 11 例（头饰 7 / 背挂 4）、动画 12 例（头饰 8 / 背挂 4），与基线相同。具体采样、缓存、UV 和视觉限制见 [QA 摘要](../src/art3d/parts/reviews/patterns-basics/qa-summary.md) / [机器报告](../src/art3d/parts/reviews/patterns-basics/qa-summary.json)。

审核图：[代表三姿势](../src/art3d/parts/reviews/patterns-basics/poses.png)、[真实十猫战斗](../src/art3d/parts/reviews/patterns-basics/battle.webp)、[原生紧凑画布](../src/art3d/parts/reviews/patterns-basics/poses-190px.png)、[边界杂兵](../src/art3d/parts/reviews/patterns-basics/mobs-poses-190px.png)、[前后对照](../src/art3d/parts/reviews/patterns-basics/before-after.png)；正面、反侧与背面、实参和冻结哈希见 [记录](../src/art3d/parts/reviews/patterns-basics/README.md)。七次官方拍图及十二帧战斗已完成，页面运行错误 0，图片均 <500000 B。

最不满意：浅虎斑杂兵 M 对比弱，三花朝橘块的 32° 视角露出深块较少。body 纹理共享小腿与每个尾球 UV，燕尾尾腹浅带 / 三花块面会随尾节重复；手爪、耳和胸绒领仍由引擎独立材质决定。没有把 body 图上的白围兜宣称为实际躯干已重画。燕尾边界有一行抗锯齿差，不称逐像素无缝。继续剩余五种花纹与 A10 贴花，再做专属造型。

## 英雄专属造型（`src/art3d/heroes.ts` 的 `HERO_PARTS`）

通用部件做完之后，再给 SP / UR 英雄做「独一份」的东西（青龙偃月刀、冕旒、羽扇等）。按 `docs/ILLUST_PROGRESS.md` 的顺序：SP → UR → SSR。

### UR 专属首批（第 1 轮待审）

`codex/3d-heroes-ur-icons`：六位 UR 的独有冠饰 / 武器，第 1 轮待 Claude 审核，未标记为通过。仅新增三个 helper 与六条 `HERO_PARTS` 映射，通用部件和英雄数据保留；参考实际六张 JPG、`ART_PROMPTS.md` 与已认可的曹 / 刘立绘。内部候选修订不增加审核轮次。

| 英雄 / 正式 ID | 覆盖组 | 状态 | 轮次 | 逻辑 / 含描边物理网格 | 备注 |
| --- | --- | --- | ---: | ---: | --- |
| 曹喵德 `wei_caomiaode` | headgear | 待审 | 1 | 12 / 23 | 低冕板、七列三珠帘，耳侧收腰 |
| 刘喵备 `shu_liumiaobei` | weapon，主副两手 | 待审 | 1 | 16 / 30（每手 8） | 外展直双剑、镂空金卷护手；新增绳 / 结 / 短穗 / 折纹已删除 |
| 周喵瑜 `wu_zhoumiaoyu` | headgear | 待审 | 1 | 10 / 20 | 仅低红吴冠；横抱 `qin` 专属未完成 |
| 吕布丁 `qun_lvbuding` | weapon | 待审 | 1 | 13 / 24 | 双月牙、紫系带 / 上箍整体外斜，真实曲木颈接刀座 |
| 孟喵获 `man_mengmiaohuo` | weapon | 待审 | 1 | 17 / 33 | 短木卵、双骨箍、七短圆齿与连续木颈 |
| 左慈喵 `xian_zuoci` | weapon | 待审 | 1 | 17 / 30 | 金环青珠 / 托座 / 青穗整体外斜，真实曲木颈接上饰 |

固定主线基线 `29f6a8bbe66bbcf4ea1c0119675cac65f8c4e00a`，相关 art3d / look / actor / player 与 e777 字节相同；包含最新六件衣服、八种毛色、表情嘴骨与 armed 姿态。最终四源 SHA256：

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

按上述顺序直接串接四文件 bytes 的 SHA256 为 `75b79a46c1fabae8ac82a057931013a01cc60a0330ceafa073f38aa9fa0a58ea`，不是 path-NUL 摘要。全部逻辑网格 ≤24、最高分段 20，复用缓存 Toon / outline；根零位移 / 零旋转 / 单位缩放、内部正尺度、PartCtx 不变，刘的真实 offhand 由正常插槽挂到左掌。

独立冻结完整 src 339 文件，四源与 18 依赖前后 SHA 不变；基线 WEAPON / HEADGEAR 取 29f 原始 Git bytes，正常引擎与候选相同。300 个有限样本为六位 ×14 姿势 `t=.4`（84）＋每位 `idle/windup/strike` ×12 时点 `[0,8]`（216），phase=0 / yaw=32。实际 Eye 骨眼核 12×12 逐 sample ID 旧新差集新增 0（有效点 66521、单眼最低 50），五固定鼻口 ID 新增 0；真实活跃 smile / mouthO 骨三角的三个代表点新增 ID 0，210 张口 / 90 微笑例。正常 bake 的 FRAME 增幅、新所选部件越框与非有限均 0；整猫仍有 60 例旧裁切，基线 61，曹低冠消除 `castUp` 的一个原裁切。此为有限几何与可见性采样，不是全像素或连续时间证明。

构建覆盖 77 位英雄 / 杂兵＋12 PET，共 89 个实际单位；六个 UR 使用真实 `buildCat3D(lookOf(id), id)` 命中，71 个非目标与另查 12 PET 的正常 bake 属性 / 索引按 Uint8Array 原字节相同。77 指 41 英雄＋36 杂兵，不泛指所有游戏单位。

三杆完整新增上部 / 饰物 / 真颈分别核 199 个不同形位，合计 597：14 姿势 ×（12 均匀时点＋`.4`＋耳峰 `π/1.4`）再补 dash `.2/.8/1.2`，dash 共17个不同时间、moving=true，其余 moving=false，phase=0。保留原网格的独立 secondary 几何夹具取实际层级矩阵、实际颅骨 / 法线外扩描边，严格 ConvexHull 逐三角裁剪，吕 16 / 孟 23 / 左 22 个物理网格的本体→头本体、描边→头本体、描边→头描边均 0；scope 只含各自完整上部与曲木颈，未宣称全部武器根 / 握段 / 掌及所有连续动画接触为零。

刘双剑保留旧掌 / 外展刀座在部分高举动作的真实头部接触；最终两手新增短穗全部撤除。独立对 `windup/castUp/victory t=.4` 实际两手逐面裁剪 / LP 对照，blade-mount 长宽与挂装同通用版，最大深度仍有约 `.00007/.00059` 世界单位微差。护孔内壁 / 曲面细分改变三角数与表面积，面积和面数不等于占据体积增加，不以旧新接触 case 数相同声称无差异；完整数值与有限范围写入 QA。正常 bake 原生 218×190 的六位三姿势四 yaw、耳峰、三杆低举 / 受击 / 垂头及刘高举样本已独立工具实看。

审图共 19 文件：14 张官方图、README、两个 QA 文件、独立正常 bake before-after、横琴契约建议；全部 <500000 B。官方 raw→PNG / lossless WebP 保持完整尺寸、不重采样，14 图解码 RGBA 原字节差 0。链接：[全部图 / 参考 / 命令 / 冻结记录](../src/art3d/parts/reviews/heroes-ur-icons/README.md)、[独立 QA](../src/art3d/parts/reviews/heroes-ur-icons/qa-summary.md)、[机器报告](../src/art3d/parts/reviews/heroes-ur-icons/qa-summary.json)、[原生 218×190 旧新对照](../src/art3d/parts/reviews/heroes-ur-icons/before-after.png)、[官方约190px角色图](../src/art3d/parts/reviews/heroes-ur-icons/poses-small.png)、[原生190×166画布](../src/art3d/parts/reviews/heroes-ur-icons/poses-tiny.png)、[真实耳峰](../src/art3d/parts/reviews/heroes-ur-icons/ear-peak.png)、[真实十猫战斗](../src/art3d/parts/reviews/heroes-ur-icons/battle.webp) / [战技帧](../src/art3d/parts/reviews/heroes-ur-icons/battle-action.webp)。

真实战斗使用 Player / HUD / 正常 bake，十个 actor 都有实际 `rig.cat3d`；曹 / 刘 / 周 / 吕 / 孟 / 左的六个专属 builder 命中次数为 2 / 2 / 1 / 2 / 2 / 1，十次全部命中，刘同时登记左右手。12 帧 nominal t=.5…6.0，每帧十猫 alive / cat3d，page errors 0，最终帧与原图 RGBA 字节相同；未用只摆模型的样板冒充游戏接入。

作者在本次最终 75b 源码真实运行 `npm run typecheck && npm test`，退出 0，68 文件 / 1019 测试全部通过，无 Date shim；日志 `.shots/ur-icons/tests-all-weapons-final-29.log`。独立 QA 读取此日志，不把协调者早先 b2f 源码的检查冒充新源码测试。

最不满意：刘双剑主要剪影仍接近通过版 stock，护孔 / 亮片在190px较小；周外耳描边最小间隙 `.00852802` 世界单位仍紧，保留有限耳峰采样限制。周横抱琴仍未实现，当前只完成吴冠，未计入完成的 weapon；[横琴挂点 / 手势契约建议](../src/art3d/parts/reviews/heroes-ur-icons/qin-contract-request.md) 仅供 Claude 决定后续接口，不改引擎或把建议写成实现。此批交审后继续队列其余衣服 / 披挂 / WORLD，不等待审核。
## 配饰首批（第 1 轮待审）
以下记录本批实际使用者与验收结果；上方底版第 0 轮表保留为历史。三项覆盖 20 个实际 ID：14 英雄、1 杂兵、5 宠物。宠物数据未改，12 只宠物的 body 仍为 none。
| 部件 | 使用者（实际 ID） | 状态 | 轮次 | 备注 |
| --- | --- | --- | --- | --- |
| `beardGoat` | `wei_caomiaode`, `shu_huangzhong`, `wu_huanggai`, `qun_dongzhuo`, `qun_huatuo`, `xian_shuijing`, `xian_yuji`, `wei_simamiyi` | 待审 | 1 | 8 英雄；三束钝圆浅毛须与小绑环；逻辑 / 含描边实际网格 5 / 10 |
| `bell` | `wu_sunxiangxiang`, `wu_ganning`, `xian_changmiao`, `mob_xian_assassin`, `pet_tuanzi`, `pet_xueqiu`, `pet_huihui`, `pet_xingxing` | 待审 | 1 | 3 英雄 + 1 杂兵 + 4 宠物；颈带、挂环、开槽壳、内衬与铃舌；网格 8 / 12 |
| `earring` | `wu_zhoumiaoyu`, `qun_lvbuding`, `shu_pangmiaotong`, `pet_jiuwei` | 待审 | 1 | 3 英雄 + 1 宠物；固定侧耳根耳钉、接链、金圈与圆钝垂饰；网格 6 / 11 |
基线 `a7a41e9ebaf4083f5cf3c0904f3850a9c81f7a07`，仅替换 `EXTRA.beardGoat / bell / earring`，其余九项注册行与真实旧版逐字相同。冻结源码 SHA256：
| 文件 | SHA256 |
| --- | --- |
| `src/art3d/parts/extras.ts` | `d74a720eef4820d61e3baf83fcc8aeb8f966997317b31cbf95b5d81d77014e07` |
| `src/art3d/parts/extras-regalia.ts` | `e5a09e559cfedc522f39f8834d172c3fbb2cce9404d3d2f42cf2219ee09db9a2` |
三项最大分段均 24，材质复用缓存 Toon / outline；真实 head 插槽根位置、旋转为零，scale=1，所有节点正尺度、正行列式，无新逐帧分配。独立完整运行时快照 321 个原有源 / 依赖文件的 SHA 前后一致；显式构建 41 英雄 + 36 杂兵 + 12 宠物，共 89 个实际造型。20 个目标旧 / 新 builder 各命中一次，69 个非目标的正常烘焙几何属性规格、TypedArray 与 index 原始字节相同。
独立 QA 覆盖 1,840 状态：20×〔14 姿势×yaw 0/32/-32/148 + idle/windup/strike×12 时刻〕，静态 1,120、动画 720，phase=0；静态 t=.4，动画 yaw32、t=i×8/11。实际 baked 眼核心 12×12、动态鼻口 5 点、实际活跃嘴骨表面 3×3 均按具体遮挡采样 ID 比较，新增 ID 0；活跃嘴有效 ID 差异 0。自配饰越框、新增整猫裁切 / 裁幅增加、非有限值均 0。整猫既有 253 例裁切（静态 156、动画 97）保留，旧 / 新边界相同，涉及既有披挂、冠饰与灰灰 / 九尾大耳，不写成所有猫都完整入框。
耳朵使用实际左右外耳实体与展开描边三角复核。另加 20 使用者×3 姿势×t=.2 / 精确耳峰 π/(2×.7)=2.243994752564138，共 120 状态；与 1,840 主状态均未见耳实体内部、实体表面、描边表面交叉。覆盖五只宠物 head=1.12、九尾大耳及折耳。
佩戴接触只允许以下具体网格与对应表面的小范围；真实颅骨 1,120 三角、口鼻垫 560 三角的严格内部裁剪包含跨壳但无内部顶点的三角，未豁免整件配饰。
| 原接触网格 | 表面 | 实体 / 描边相交三角（每状态） |
| --- | --- | ---: |
| `goat-muzzle-contact` | 口鼻垫下沿 | 47 / 47 |
| `bell-collar-contact` | 颅骨颈带区 | 38 / 88 |
| `earring-stud-contact` | 颅骨侧耳根皮肤 | 10 / 16 |
其余可见组件（须束、绑环、铃壳 / 内衬 / 铃舌 / 挂环 / 底沿 / 高光、耳链 / 圈 / 钩 / 垂饰 / 高光）逐网格对颅骨及口鼻垫均为 0；胡须根垫对颅骨、颈带 / 耳钉对口鼻垫亦为 0。上述非零数是相交三角计数，不是穿插体积或可见像素面积。后向铃铛 16 个保守鼻口命中状态没有新增 ID；当前被测 32 点在配饰前已被颅骨挡住，不将其写成新增可见脸遮挡。有限姿势、时刻和采样网格不证明全部连续时刻或每个渲染像素。
审图与方法：[README](../src/art3d/parts/reviews/extras-regalia/README.md)、[独立 QA](../src/art3d/parts/reviews/extras-regalia/qa-summary.md)、[机器记录](../src/art3d/parts/reviews/extras-regalia/qa-summary.json)、[正常旧 / 新对照](../src/art3d/parts/reviews/extras-regalia/before-after.png)、[真实十猫战斗](../src/art3d/parts/reviews/extras-regalia/battle.webp)。对照图含曹喵德 / 司马喵懿、甘宁宁 / 团子、庞喵统 / 九尾；正常 bake、idle/t=.4/phase0/yaw32，无损压缩解码字节差 0。官图 28 张 PNG 保留原画布，真实战斗 12 帧全 10 actor 有 rig.cat3d 并命中三类配饰，未以 2D 缓存代替。最终 `battle.webp` 为 397,966 B，SHA256 `ad428b26f82b2fc95600fe5d84eb7a2507c399b25e458ea02365cc8e088f1d81`，完整 RGBA changedPixels=0；审核交付单文件均 <500000 B。
作者原生 `npm run typecheck && npm test` 通过，68 文件 / 1,021 项测试，日志 `.shots/extras-regalia/tests-final.log`；引用作者实测，独立 QA 未重复跑产品测试。小尺寸浅毛角色的羊须分束深度仍偏弱，铃舌与耳链细节较小；保持待审第 1 轮，未写 Claude 已通过。

### SP 专属武器第 1 批（2026-10-12）

| 英雄 / 覆盖组 | 状态 | 轮次 | 造型与预算 |
| --- | --- | --- | --- |
| `wei_simamiyi` / `weapon` | 待审 | 1 | 冠形七羽扇；米白羽、深紫尖、金骨，中央长 / 外羽短；24 逻辑网格 |
| `shu_pangmiaotong` / `weapon` | 待审 | 1 | 凤羽金梢弓；暖木与红金小羽，前举侧卷钩贴弓收短；16 逻辑网格 |
| `xian_changmiao` / `weapon` | 待审 | 1 | 月桂三枝；Y 形空隙、两片宽主叶、两颗节点月珠；23 逻辑网格 |

- 分支 `codex/3d-heroes-sp-weapons`。仅登记三个英雄武器，参考三张原 JPG、三张批准立绘和英雄 lore；当前固定 `e777d58` 引擎，武器源码仍为 `7656746361b4…`，完整记录见 [README](../src/art3d/parts/reviews/heroes-sp-weapons/README.md)。
- 当前九图全部重拍：[三姿势](../src/art3d/parts/reviews/heroes-sp-weapons/current-e777/poses.png)、[约190px检查](../src/art3d/parts/reviews/heroes-sp-weapons/current-e777/poses-190px.png)、[正常烘焙前后](../src/art3d/parts/reviews/heroes-sp-weapons/current-e777/before-after.png)、[真实十猫战斗](../src/art3d/parts/reviews/heroes-sp-weapons/current-e777/battle.webp)；另有四方向、弓动作探针与泛用家族图，全部原尺寸无损、单文件小于500000 B。战斗12帧中取frame00 / t=3.25s，10/10 cat3d、三个实际命名武器组命中，页面脚本错误0。
- 当前 [QA](../src/art3d/parts/reviews/heroes-sp-weapons/current-e777/qa-summary.md) / [机器报告](../src/art3d/parts/reviews/heroes-sp-weapons/current-e777/qa-summary.json) 由维护者重新运行原独立方法，核对18个相关源文件SHA前后相同。42静态与108动画共150例，实际baked眼芯12×12采样按具体ID比较：新增眼ID0、有效格点不一致0，最低有效样本静态68 / 动画104；庞统thrust/castFwd旧/新各30个同ID保守眼深度命中，guard为0，深度命中不等于可见像素。
- 原5个固定鼻口点新增ID0；另外150例实际baked活跃smile/mouthO表面3×3采样，新ID与有效ID不一致均0，每例至少4个有效点。全89位显式heroId/look包含12宠物，三个目标旧/新各命中1次，86位非目标所有geometry属性与index原始字节完全一致；三根保持掌心原点、正尺度、缓存材质，最大分段20。
- 150例非有限顶点、武器及描边出框、新增整猫裁切与四侧裁幅增加均0。整猫旧裁切静态5 / 动画12例不变：司马披风下沿最大下裁 .1119077、嫦喵victory冠顶上裁 .014626。windup右掌与后颅、武器持握仍有旧交叠；实际1120颅骨面及壳内顶点检测不代表所有三角无交叉，也不把不同网格的点数当作可见严重程度；未改姿势或镜头。
- 固定e777的typecheck与68文件 / 1019测试通过；主线随后日期修订的同步和提交前复检由维护者另记。原aa9/e6和fece图与报告完整保留为历史，当前交付使用current-e777，历史数据不充当当前复核。最不满意：strike羽扇仍呈窄斜面；月桂叶脉/月珠及前举侧弓饰在战斗尺度较小。

提交前另同步主线 `29f6a8b` 日期测试修复；相关 art3d/look/actor/player 与 e777 累计变化为0，18源/9图保持原记录。维护者再次实际 typecheck + test 退出0，68文件 / 1019测试全通过。

### SSR 蜀族专属制作中（第0轮，通过0）

`codex/3d-heroes-shu-icons` 公开认领后三位蜀族SSR，仅做 HERO_PARTS 对应 weapon 覆盖与新helper：关云喵 `shu_guanyunmiao` 青龙偃月鱼骨刀、张喵飞 `shu_zhangmiaofei` 圆钝蛇矛、诸葛喵亮 `shu_zhugemiaoliang` 逗猫羽扇。当前仅制作中认领、无成品或通过裁决，不改角色数据或通用武器；魏SSR三位属于另一线程PR #121，已合SP/UR保留，周喵瑜古琴暂不做。

基线 `a01bfc286e1d583f9fd2dad9eb2fcefb88318680`，本工作树认领前实际 `npm run typecheck && npm test` 退出0，76文件 /1072测试。三张原JPG、ART_PROMPTS与实际lore已读，后续按公开资源优先检索、正常190px三姿势/四yaw与真实十猫命中/完整头壳和五官/89非目标验证完成后更新同一PR至第1轮待审；不等待其它PR审核停止本队列。
