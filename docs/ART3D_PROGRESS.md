# 3D 部件进度表（Codex 每完成 / 被打回一轮就更新对应行）

状态：`底版`（Claude 的占位造型，认得出来但粗糙）→ `待审`（已提交）→ `返修`（带意见打回）→ `通过`。
「使用者」按稀有度排序（SP > UR > SSR > SR > 杂兵）；**优先做被高稀有度英雄使用的部件**。
一个 PR 做同一文件里的 3~6 个相关部件即可（例如「武器：长剑 / 双股剑 / 短刀 / 飞刀 / 双短刀」）。

## 武器（`src/art3d/parts/weapons.ts`）

| 部件 | 使用者 | 状态 | 轮次 | 备注 |
| --- | --- | --- | --- | --- |
| `herbs` | `xian_changmiao`(SP), `qun_huatuo`(SSR) + 杂兵×6 | 待审 | 1 | 六叶药草束、叶脉与阵营束带；17 网格；codex/3d-weapon-sp-kit |
| `bow` | `shu_pangmiaotong`(SP), `wu_sunxiangxiang`(SSR), `shu_huangzhong`(SR) + 杂兵×3 | 待审 | 1 | 双曲弓臂、独立弓弦与弦槽；10 网格；codex/3d-weapon-sp-kit |
| `fan` | `wei_simamiyi`(SP), `shu_zhugemiaoliang`(SSR), `wu_luxun`(SSR) + 杂兵×2 | 待审 | 1 | 七羽扇、阵营羽尖与扇骨；24 网格；codex/3d-weapon-sp-kit |
| `mace` | `man_mengmiaohuo`(UR), `wei_xuhuchi`(SSR), `man_shamoke`(SSR) 等4只 + 杂兵×1 | 底版 | 0 | |
| `sword` | `wei_caomiaode`(UR), `wu_sunxiaoba`(SSR) + 杂兵×3 | 底版 | 0 | |
| `staff` | `xian_zuoci`(UR), `qun_zhangjiao`(SSR) | 底版 | 0 | |
| `dualSwords` | `shu_liumiaobei`(UR) | 底版 | 0 | |
| `halberd` | `qun_lvbuding`(UR) | 底版 | 0 | |
| `qin` | `wu_zhoumiaoyu`(UR) | 底版 | 0 | |
| `spear` | `wei_xiahoudun`(SSR), `shu_zhangmiaofei`(SSR), `shu_zhaomiaoyun`(SSR) 等5只 | 底版 | 0 | |
| `glaive` | `shu_guanyunmiao`(SSR), `qun_huaxiong`(SR) + 杂兵×2 | 底版 | 0 | |
| `drum` | `man_mulu`(SSR) + 杂兵×1 | 底版 | 0 | |
| `brush` | `xian_shuijing`(SSR) | 底版 | 0 | |
| `dualBlades` | `wei_zhangliao`(SSR) | 底版 | 0 | |
| `knives` | `man_zhurong`(SSR) | 底版 | 0 | |
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

## 头饰（`src/art3d/parts/headgear.ts`）

| 部件 | 使用者 | 状态 | 轮次 | 备注 |
| --- | --- | --- | --- | --- |
| `scholarCap` | `wei_simamiyi`(SP), `shu_guanyunmiao`(SSR), `shu_zhugemiaoliang`(SSR) 等8只 + 杂兵×4 | 底版 | 0 | |
| `flowerPin` | `shu_pangmiaotong`(SP), `wu_sunxiangxiang`(SSR), `qun_diaochan`(SSR) | 底版 | 0 | |
| `lotusCrown` | `xian_changmiao`(SP), `xian_zuoci`(UR) + 杂兵×1 | 底版 | 0 | |
| `taoistCrown` | `wu_zhoumiaoyu`(UR), `xian_yuji`(SSR) + 杂兵×4 | 底版 | 0 | |
| `emperorCrown` | `wei_caomiaode`(UR), `qun_dongzhuo`(SR) | 底版 | 0 | |
| `boneCrown` | `man_mengmiaohuo`(UR) | 底版 | 0 | |
| `pheasant` | `qun_lvbuding`(UR) | 底版 | 0 | |
| `helmetWei` | `wei_xiahoudun`(SSR), `wei_xuhuang`(SR) + 杂兵×5 | 底版 | 0 | |
| `helmetGeneral` | `wei_zhangliao`(SSR), `shu_zhangmiaofei`(SSR), `shu_zhaomiaoyun`(SSR) 等6只 | 底版 | 0 | |
| `featherHeaddress` | `man_zhurong`(SSR), `man_mulu`(SSR) + 杂兵×1 | 底版 | 0 | |
| `yellowBand` | `qun_zhangjiao`(SSR), `xian_zhangzhua`(SSR) + 杂兵×1 | 底版 | 0 | |
| `tigerHood` | `wei_xuhuchi`(SSR) | 底版 | 0 | |
| `sailorBandana` | `wu_ganning`(SR) + 杂兵×6 | 底版 | 0 | |
| `fortuneHat` | `xian_guanlu`(SR) + 杂兵×1 | 底版 | 0 | |
| `rattanHelm` | `man_wutugu`(SR) + 杂兵×1 | 底版 | 0 | |
| `leafHat` | 杂兵×5 | 底版 | 0 | |
| `hood` | 杂兵×3 | 底版 | 0 | |
| `ratCap` | 杂兵×1 | 底版 | 0 | |

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
