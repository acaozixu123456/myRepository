# 头饰六件 · 第 1 轮截图

本批 `scholarCap / flowerPin / lotusCrown / taoistCrown / emperorCrown / boneCrown`，基于 `claude/awesome-babbage-ygba4h` 的 `4b9d0ef3f060f83bd3517560b484c13a37d09606`。

冻结源码 `src/art3d/parts/headgear.ts` SHA256：

```text
8cd1188aca84ea2c242f9f7032c451898c8b138ef8960de901b9588d33851be5
```

底版源码为上述 base 的原文件，SHA256 `f83ff39830bd8c241c3a4082f9a5a58b52f02945ed61832a58e179c15e1fd985`。底版和最终版使用同一 base 的骨架、姿势及渲染器。冻结后实际执行两次 `npm run shots3d`（w=300、w=250）和一次十二帧战斗截图；拍摄前后头饰哈希一致，页面运行错误为 0。

## 图像与顺序

`poses.png` 和 `poses-190px.png` 的每行顺序为司马喵懿、庞喵统、嫦喵、周喵瑜、曹喵德、孟喵获、左慈喵、诸葛喵亮；每列从左到右为 `idle / windup / strike`。`small-190px.png` 保持同样的八猫顺序，按四列两行展示 idle。

`small-190px.png` 从额外执行 w=250 所得的 **250×219 原生 Canvas** 裁出并排版，没有缩放角色；角色全身接近战斗里的 190px 高，250px 是画布宽度。`before-after.png` 的上半底版由先前保存的 w=300 Canvas 统一技术缩小到 250×219，下半最终版使用原生 w=250 Canvas，此取样差异已标在图中。截图只做裁边、排版标签、8 位 PNG 输出和无损压缩；无绘画、重着色或遮挡问题区域。

`battle.png` 是 meadow 场景、seed=2 的同屏十猫，起始状态步进 0.25s 的第一帧；未用爆炸特效遮挡头饰。敌方还包含真实使用花簪的孙香香和使用冕旒的董桌。

| 文件 | 尺寸 | 字节数 |
| --- | --- | --- |
| [poses.png](poses.png) | 1000x2158 | 353680 |
| [battle.png](battle.png) | 948x593 | 455009 |
| [small-190px.png](small-190px.png) | 1024x514 | 109190 |
| [poses-190px.png](poses-190px.png) | 1000x1806 | 285234 |
| [before-after.png](before-after.png) | 1024x1122 | 340878 |
| [baseline-poses.png](baseline-poses.png) | 1000x2158 | 321375 |
| [baseline-battle.png](baseline-battle.png) | 948x593 | 443748 |
| [baseline-small.png](baseline-small.png) | 1024x514 | 183843 |

## 实际拍摄命令

工作目录 `/workspace/three-worktrees/headgear-crowns`；Vite 独立端口 5177；Chromium `/usr/bin/chromium`，SwiftShader。未改动生产引擎或 tracked tools。

```bash
npm run dev -- --host 127.0.0.1 --port 5177 --strictPort

PORT=5177 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/headgear-crowns/final-poses-raw.png 'ids=wei_simamiyi,shu_pangmiaotong,xian_changmiao,wu_zhoumiaoyu,wei_caomiaode,man_mengmiaohuo,xian_zuoci,shu_zhugemiaoliang&poses=idle,windup,strike&w=300&yaw=32'

PORT=5177 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/headgear-crowns/final-small-native-raw.png 'ids=wei_simamiyi,shu_pangmiaotong,xian_changmiao,wu_zhoumiaoyu,wei_caomiaode,man_mengmiaohuo,xian_zuoci,shu_zhugemiaoliang&poses=idle,windup,strike&w=250&yaw=32'

PORT=5177 CHROME=/usr/bin/chromium node /workspace/three-review/headgear-crowns/battle-shots-local.mjs 'r3d=1&a=wei_caomiaode,wu_zhoumiaoyu,man_mengmiaohuo,wei_simamiyi,shu_pangmiaotong&b=xian_changmiao,xian_zuoci,shu_zhugemiaoliang,wu_sunxiangxiang,qun_dongzhuo&theme=meadow&seed=2' /workspace/three-review/headgear-crowns/final-battle 0.25 12 0
```

战斗命令使用 scratch 中的 `tools/battle-shots.mjs` 副本，仅调整 Playwright 导入路径、Chromium 路径和端口读取；步进、等待、画布截图逻辑一致。浏览器 viewport 为 980×620，战斗 Canvas 为 948×593。素材取 `final-battle_00.png`（0.25s）；其余十一帧保留在 scratch。

复跑脚本：`/workspace/three-review/headgear-crowns/capture-review.sh final`，随后 `/workspace/three-review/headgear-crowns/capture-small-native.sh`。脚本核对冻结源码前后哈希，并检查每个交付 PNG ≤500000 字节。完整机器报告保存在 scratch 的 `final-capture-report.json`。

## 真实使用者

以下依据本 base 的 `src/data/heroes.ts`、`src/data/mob-looks.ts`，合计 18 位英雄、9 种杂兵。截图展示其中八位代表使用者，战斗再补充孙香香和董桌；此表不表示所有使用者都出现在截图中。

| 头饰 | 英雄 | 杂兵 |
| --- | --- | --- |
| `scholarCap` | 郭嘉喵（`wei_guojia`）、关云喵（`shu_guanyunmiao`）、诸葛喵亮（`shu_zhugemiaoliang`）、姜喵维（`shu_jiangwei`）、陆喵逊（`wu_luxun`）、华佗喵（`qun_huatuo`）、水镜喵（`xian_shuijing`）、司马喵懿（`wei_simamiyi`） | `mob_wei_archer`、`mob_wei_strategist`、`mob_qun_archer`、`mob_qun_strategist` |
| `flowerPin` | 孙香香（`wu_sunxiangxiang`）、貂蝉喵（`qun_diaochan`）、庞喵统（`shu_pangmiaotong`） | — |
| `lotusCrown` | 左慈喵（`xian_zuoci`）、嫦喵（`xian_changmiao`） | `mob_xian_guard` |
| `taoistCrown` | 周喵瑜（`wu_zhoumiaoyu`）、于吉吉（`xian_yuji`） | `mob_shu_strategist`、`mob_wu_strategist`、`mob_xian_vanguard`、`mob_xian_healer` |
| `emperorCrown` | 曹喵德（`wei_caomiaode`）、董桌（`qun_dongzhuo`） | — |
| `boneCrown` | 孟喵获（`man_mengmiaohuo`） | — |

## 视觉检查

八位三姿势中六类头饰都可辨认，眼睛可见；近战斗尺度可看到冕旒短珠帘、粉色花簪和步摇、金色莲瓣、红金道冠、浅色折布纶巾与象牙骨齿。十猫图保留可读轮廓。莲冠的浅金内侧层次在低尺寸最弱，主要靠外轮廓和蓝／青底带区分；更细的布纹、花蕊与珠点也应以近看图评估。
