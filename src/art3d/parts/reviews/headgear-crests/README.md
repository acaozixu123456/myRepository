# 头饰六件 · 雉尾、盔饰、羽冠、黄巾与虎帽

本批 `pheasant / helmetWei / helmetGeneral / featherHeaddress / yellowBand / tigerHood`。截图 base 为 `claude/awesome-babbage-ygba4h` 的 `2afab71e5f739dffd307ffb271ae6845714b1f12`。Claude 已在此 base 更新 toon，本批 baseline 也重新真实渲染，没有沿用旧版 toon 截图。

冻结 `headgear.ts` SHA256：

```text
9c26b1093bdda9df66fd958e5e81c8033b72ff927ccb71023262813218ce130c
```

两次实际 npm run shots3d 与十二帧战斗截图均 exit 0，pageErrors=[]。拍摄前后 headgear/toon/pose/renderer/dev-cat3d 源码哈希一致；toon、姿势、渲染器与新 baseline 相同。toon SHA256 `03d9f550749210bd73577b360753d569005e22ea2666802b4c16d87588224c29`；baseline headgear SHA256 `8cd1188aca84ea2c242f9f7032c451898c8b138ef8960de901b9588d33851be5`。

## 截图

姿势图八行顺序：吕布丁、夏侯墩、徐晃晃、张喵辽、赵喵云、祝融喵、张角角、许虎痴；每行左至右 `idle / windup / strike`，yaw=32°。

`poses.png` 来自 w=300；`poses-190px.png` 来自另一次原生 w=250，Canvas 250×219，角色接近战斗尺度。`small-190px.png` 只从这些原生 Canvas 裁出 idle 格并排版，角色未缩放。`before-after.png` 两侧都采用相同 w=250 原生渲染、同一 toon 和相机。底版雉尾已在真实渲染取景框中截顶，保留该问题；最终雉尾与羽冠在八猫三姿势中完整留在取景框内，没有扩大取景或遮掉顶端。

`battle.png` 取 meadow、seed=2、初始状态步进 0.25s 的第一帧，十猫同屏；额外包含张喵飞与 `mob_xian_strategist`（黄巾小道喵）。未选爆炸特效挡住头饰的帧。其余十一帧保留在 scratch。

| 文件 | 尺寸 | 字节数 |
| --- | --- | --- |
| [poses.png](poses.png) | 1000x2158 | 347203 |
| [poses-190px.png](poses-190px.png) | 1000x1806 | 279411 |
| [small-190px.png](small-190px.png) | 1024x514 | 103998 |
| [battle.png](battle.png) | 948x593 | 450499 |
| [before-after.png](before-after.png) | 1024x1122 | 231068 |
| [baseline-poses.png](baseline-poses.png) | 1000x2158 | 318225 |
| [baseline-poses-190px.png](baseline-poses-190px.png) | 1000x1806 | 258532 |
| [baseline-small.png](baseline-small.png) | 1024x514 | 94353 |
| [baseline-battle.png](baseline-battle.png) | 948x593 | 439958 |

所有 PNG ≤500000 字节。截图处理仅包括原生 Canvas 裁格、文字标签、8 位 PNG 输出及无损压缩，保留实际渲染的模型和色彩。

## 实际命令

工作目录 `/workspace/three-worktrees/headgear-crests`；独立 Vite 5179；Chromium `/usr/bin/chromium`，SwiftShader。战斗 viewport=980×620、Canvas=948×593。

```bash
npm run dev -- --host 127.0.0.1 --port 5179 --strictPort

PORT=5179 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/headgear-crests/final-poses-raw.png 'ids=qun_lvbuding,wei_xiahoudun,wei_xuhuang,wei_zhangliao,shu_zhaomiaoyun,man_zhurong,qun_zhangjiao,wei_xuhuchi&poses=idle,windup,strike&w=300&yaw=32'
PORT=5179 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/headgear-crests/final-small-native-raw.png 'ids=qun_lvbuding,wei_xiahoudun,wei_xuhuang,wei_zhangliao,shu_zhaomiaoyun,man_zhurong,qun_zhangjiao,wei_xuhuchi&poses=idle,windup,strike&w=250&yaw=32'
PORT=5179 CHROME=/usr/bin/chromium node /workspace/three-review/headgear-crests/battle-shots-local.mjs 'r3d=1&a=qun_lvbuding,wei_xiahoudun,wei_zhangliao,shu_zhaomiaoyun,man_zhurong&b=wei_xuhuang,qun_zhangjiao,wei_xuhuchi,shu_zhangmiaofei,mob_xian_strategist&theme=meadow&seed=2' /workspace/three-review/headgear-crests/final-battle 0.25 12 0
```

battle 使用 scratch 的原 tools/battle-shots.mjs 副本，只改 Playwright 导入路径、Chromium 路径与端口读取；步进、等待及 Canvas 截图逻辑保持原样。未修改 tracked tools 或引擎。

复跑 `node /workspace/three-review/headgear-crests/capture-review.mjs final`。该脚本先核对引擎/toon 与 baseline 相同，拍摄后核对源码冻结，再检查图像预算及 pageErrors。完整运行记录为 scratch `final-capture-report.json`。

## 真实使用者

依据当前 data 解析，共 14 英雄、7 杂兵；截图仅展示其中八位代表，battle 再补两位，不以图像取景覆盖替代全部使用者的数值 QA。

| 部件 | 英雄 | 杂兵 |
| --- | --- | --- |
| `pheasant` | 吕布丁（`qun_lvbuding`） | — |
| `helmetWei` | 夏侯墩（`wei_xiahoudun`）、徐晃晃（`wei_xuhuang`） | `mob_wei_guard`、`mob_wei_vanguard`、`mob_shu_vanguard`、`mob_wu_vanguard`、`mob_qun_guard` |
| `helmetGeneral` | 张喵辽（`wei_zhangliao`）、张喵飞（`shu_zhangmiaofei`）、马超超（`shu_machao`）、赵喵云（`shu_zhaomiaoyun`）、孙小霸（`wu_sunxiaoba`）、华雄雄（`qun_huaxiong`） | — |
| `featherHeaddress` | 祝融喵（`man_zhurong`）、木鹿大王（`man_mulu`） | `mob_man_strategist` |
| `yellowBand` | 张角角（`qun_zhangjiao`）、张爪（`xian_zhangzhua`） | `mob_xian_strategist` |
| `tigerHood` | 许虎痴（`wei_xuhuchi`） | — |

## 实看

六类头饰的剪影均比底版更容易区分，魏盔与将盔的顶饰、雉尾羽状轮廓、羽冠、虎耳与虎纹均能在原生近战斗尺度辨认；三姿势可见眼睛。最弱的一处是张角角的黄巾与黄色毛色对比偏低，主要靠折边及侧后结带辨识。几何、动画峰值与完整使用者审计由独立 QA 另行给出，本 README 只记录实际截图检查。
