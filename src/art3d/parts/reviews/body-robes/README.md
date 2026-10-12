# 衣服第 2 批截图记录

基线：`bf37bd307e8669850af6cd5b502172ad7d7ab102`，包含 `bdcc799` 的 Q 版比例（头部倍率 1.14、爪半径 0.17）、露靴下摆和去除脏斑高光，以及已合并的 #97 / #98。本批从主分支独立制作，不依赖 #99；只替换 `robeTaoist / tribal / robeScholar`。腰下裙面与全部裙饰在构建时一起收短，保持腰口 y=.57、插槽及裙根单位变换；三种代表的实际裙网格下沿约为 -.214 / -.216 / -.216。

冻结 SHA256：`body.ts` 为 `759c9b7b5bfcc2b4f08b8970c6893181aabf78d44350fde28f2dfc68c7800485`，`body-robes.ts` 为 `0deacc5ee8a1c8e766f9e7e9aa803a24ce0c37ce52ef3f23db5f70b15bb24cfd`。按路径 + NUL + 文件字节 + NUL 拼接两文件的聚合 SHA 为 `946185becea8fe9c992b9278ec32af848ee0f9dc7a14b178fa6ead3e7ff4460a`。截图前后源码一致，拍摄没有改写源码或触发 HMR。

引擎 SHA256：`cat3d.ts` 为 `06e44bc80ab32181fc5bc42149ab957fbff0ca4716392f9304620f8f98904e56`，`toon.ts` 为 `bcb0fcfb3a9011e43d4720e5f2ec6b87f6a931fd7ad31be72c277520968bb837`，`renderer.ts` 为 `ae998f612ae070288c81c8cf2c03bf605407718b7d2c89f5b042d169eb8bc3db`。浏览器实际构建核对 head.scale=[1.14,1.14,1.14]、新爪半径、三个收短系数以及根单位变换，运行错误为 0。

## 参考与造型

参考 `docs/ART_PROMPTS.md` 与 `assets/heroes/ref/` 中左慈、诸葛、孟获、祝融、姜维、管辂的实际 JPG。道袍与文士袍采用 pal.cloth 的大面积袍面，阵营主色交领、腰带和包边与引擎自带袖子协调。道袍有宽交襟、道纹与符袋；文士袍有短翼领、侧扣与前后分裾。兽皮用 fur / light 胸面、交绑、骨扣和三片短皮裙保留露毛感觉。袖子仍使用主分支自带的 pal.main。

## 真实截图

`poses.png / poses-small.png` 按行是左慈喵、诸葛喵亮、孟喵获、祝融喵、姜喵维、水镜喵，按列是 idle / windup / strike。官方调试页正常蒙皮，yaw=32°、phase=0、t=0.4。大图单格原生 290×254；小图单格原生 250×219，接近战斗里的 190px 角色尺度，没有从大画布缩小。已实看两种尺度，头、衣领、短裙片与露出的靴子保持可辨认。

```sh
PORT=5175 CHROME=/usr/bin/chromium npm run shots3d -- .shots/body-robes/bf37-final-poses-290.png "ids=xian_zuoci,shu_zhugemiaoliang,man_mengmiaohuo,man_zhurong,shu_jiangwei,xian_shuijing&poses=idle,windup,strike&w=290"
PORT=5175 CHROME=/usr/bin/chromium npm run shots3d -- .shots/body-robes/bf37-final-poses-250.png "ids=xian_zuoci,shu_zhugemiaoliang,man_mengmiaohuo,man_zhurong,shu_jiangwei,xian_shuijing&poses=idle,windup,strike&w=250"
PORT=5175 CHROME=/usr/bin/chromium npm run shots3d -- .shots/body-robes/bf37-final-boundaries-290.png "ids=mob_xian_guard,xian_guanlu,mob_wei_strategist,mob_man_strategist&poses=idle,windup,strike&w=290"
```

`boundaries.png` 核对较宽道袍、深色文士袍及灰绿兽皮。玄门守卫在 strike 的盾牌遮脸属于既有武器表现；本批没有修改盾牌，衣服与武器的遮挡需分别审核。

`before-after.png` 与独立 QA 摘要由独立审核流程生成，双方使用相同最新模型、相机与光照；具体冻结参数和采样范围见 [QA 摘要](qa-summary.md) / [机器报告](qa-summary.json)。旧 `1f45261` 的本批官方截图及交付副本已归档到 `.shots/obsolete/body-robes-1f45261/`，不作为本次证据。

`battle.webp` 是真实十猫战斗与 HUD，取编号 07（第 8 帧、t=5.00 秒；start=3 秒、step=0.25 秒）。临时 `battle-stable.mjs` 使用现有 battle-shots 流程，只调整 Chromium 路径为 `/usr/bin/chromium`、端口为 5175，并统计 page errors。十二帧新输出保留在 `.shots/body-robes/bf37-final-battle_*.png`。5175 使用同一 Vite 配置关闭 HMR，忽略 `.shots` 和 review 输出，没有改游戏配置。

```sh
node .shots/body-robes/battle-stable.mjs "r3d=1&a=xian_zuoci,man_mengmiaohuo,man_zhurong,shu_jiangwei,qun_huatuo&b=shu_zhugemiaoliang,qun_zhangjiao,xian_yuji,xian_shuijing,xian_nanhua" .shots/body-robes/bf37-final-battle 0.25 12 3
```

三次 shots3d 和十二帧战斗截图均完成，页面运行错误为 0。外部 Google Fonts 请求被环境网络策略阻止，中文使用系统 Noto CJK 回退；HUD 和网页字体保持原样。PNG 仅做无损编码优化；战斗为无损 WebP，解码后逐像素 RGB 差为 0。

| 交付图 | 字节数 | RGB 差 |
| --- | ---: | ---: |
| poses.png | 451644 | 0 |
| poses-small.png | 367781 | 0 |
| boundaries.png | 287412 | 0 |
| battle.webp | 381236 | 0 |

## 验证

基于上述冻结源码，以 network grant 运行 `npm run typecheck && npm test`：65 个测试文件、980 项测试全部通过，退出码 0。全部 32 使用者预算检查通过：道袍 21 / 兽皮 24 / 文士袍 18 逻辑网格，最大分段 24，顶点坐标有限、重复构建复用缓存材质。

本批第 1 轮待审，造型是否通过由 Claude 审核。最不满意：浅色文士袍的小扣与侧襟在小画布下较弱；兽皮胸面仍是素色毛色片，后续按最新队列优先完善毛色花纹与英雄专属造型。
