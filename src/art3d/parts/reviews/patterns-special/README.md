# 毛色第 2 批：重点色 / 玫瑰斑 / 奶牛 / 玳瑁 / 蝶斑

基线为主分支 `aa9afd3270c839b3ba5aa72d2836dec3fe2d0f93`。本批细化 `patterns.ts` 的 `point / spots / cow / tortie / butterfly`，按真实 `lookOf(id)` 的 coat.base / light / accent / stripe 生成缓存 256×256 head / body 贴图。截图使用此基线的 Q 版模型、头饰、衣服与正常蒙皮。

冻结 `patterns.ts` SHA256：`a6cf3db072053cc57699185a99f13666ecffef9b20006163177c1bafaea46aae`。截图前后相同。引擎 SHA256：cat3d.ts `06e44bc80ab32181fc5bc42149ab957fbff0ca4716392f9304620f8f98904e56`，toon.ts `bcb0fcfb3a9011e43d4720e5f2ec6b87f6a931fd7ad31be72c277520968bb837`，renderer.ts `ae998f612ae070288c81c8cf2c03bf605407718b7d2c89f5b042d169eb8bc3db`。

## 参考与配色

参考 `docs/ART_PROMPTS.md` 与 `assets/heroes/ref/` 中周瑜、诸葛、嫦喵、孟获、孙小霸、祝融、张飞、马超、孟优、南华的实际 JPG：重点色有连续的鼻梁与两颊面罩；玫瑰斑保留开口环心；奶牛有浅底大块非对称斑；玳瑁是深底橙金大斑；南华额头有左右四瓣毛色。

五种实际使用者共 19 位，均提供 accent。奶牛五位全部 accent=base，因此用 light 铺底，再用原有 accent/base 画斑：张飞 / 马超为深色白底，蜀医者为橘白，吴守卫为灰白。嫦喵保持自己的浅冷蓝 accent，没有统一换成棕色。孟优的 light 本身是暖橙色，玳瑁没有加入白色。

## 官方三姿势与角度

主图 `poses.png / poses-small.png` 按行是周喵瑜、嫦喵、孟喵获、张喵飞、孟优优、南华喵，按列是 idle / windup / strike。官方 cat3d 调试页，正常 bake，phase=0、t=0.4、yaw=32°；单格分别原生 290×254 与 250×219。小画布接近游戏约 190px 的角色尺度，未从大画布缩小。

```sh
PORT=5177 CHROME=/usr/bin/chromium npm run shots3d -- .shots/patterns-special/final-poses-290.png "ids=wu_zhoumiaoyu,xian_changmiao,man_mengmiaohuo,shu_zhangmiaofei,man_mengyou,xian_nanhua&poses=idle,windup,strike&w=290"
PORT=5177 CHROME=/usr/bin/chromium npm run shots3d -- .shots/patterns-special/final-poses-250.png "ids=wu_zhoumiaoyu,xian_changmiao,man_mengmiaohuo,shu_zhangmiaofei,man_mengyou,xian_nanhua&poses=idle,windup,strike&w=250"
PORT=5177 CHROME=/usr/bin/chromium npm run shots3d -- .shots/patterns-special/final-boundaries-290.png "ids=mob_shu_healer,mob_wu_guard,mob_wu_assassin,mob_man_vanguard,mob_man_archer,mob_wu_strategist&poses=idle,windup,strike&w=290"
```

`boundaries.png` 按行检查橘白奶牛、灰白奶牛、深棕玫瑰斑、无帽玫瑰斑、低对比棕玫瑰斑、棕色重点色。实际 ID 分别是 `mob_shu_healer / mob_wu_guard / mob_wu_assassin / mob_man_vanguard / mob_man_archer / mob_wu_strategist`。

`front-0.png / front-32.png / front-minus32.png / back-148.png` 使用同一组六位主代表，idle、原生 250×219 单格，依次 yaw=0° / 32° / -32° / 148°。完整页均为 1000×1360，没有裁切、重绘或重采样。

```sh
PORT=5177 CHROME=/usr/bin/chromium npm run shots3d -- .shots/patterns-special/final-yaw-0.png "ids=wu_zhoumiaoyu,xian_changmiao,man_mengmiaohuo,shu_zhangmiaofei,man_mengyou,xian_nanhua&poses=idle&yaw=0&w=250"
PORT=5177 CHROME=/usr/bin/chromium npm run shots3d -- .shots/patterns-special/final-yaw-32.png "ids=wu_zhoumiaoyu,xian_changmiao,man_mengmiaohuo,shu_zhangmiaofei,man_mengyou,xian_nanhua&poses=idle&yaw=32&w=250"
PORT=5177 CHROME=/usr/bin/chromium npm run shots3d -- .shots/patterns-special/final-yaw--32.png "ids=wu_zhoumiaoyu,xian_changmiao,man_mengmiaohuo,shu_zhangmiaofei,man_mengyou,xian_nanhua&poses=idle&yaw=-32&w=250"
PORT=5177 CHROME=/usr/bin/chromium npm run shots3d -- .shots/patterns-special/final-yaw-148.png "ids=wu_zhoumiaoyu,xian_changmiao,man_mengmiaohuo,shu_zhangmiaofei,man_mengyou,xian_nanhua&poses=idle&yaw=148&w=250"
```

所有角度与三姿势已经实看。前脸 +z 在球面 u≈.25，即 256² 贴图的 x≈64；背面在 x≈192。面罩与四瓣位置按前脸定位。玫瑰环、奶牛与玳瑁跨边界的斑形使用 ±256 重绘。有限原生视角中未见明显硬接缝，但两端像素不是数学上全部相等；作者诊断的最大使用者 RGB 端点平均差为：point head/body 0/0，spots 1.207/6.358，cow 2.357/.198，tortie 0/1.552，butterfly 0/0。完整 UV 诊断及独立方法见 [QA 摘要](qa-summary.md) / [机器报告](qa-summary.json)。

[before-after.png](before-after.png) 由独立 QA 生成，使用基线与候选的正常 bake、相同模型 / 相机 / 灯光；六行是诸葛、孟获、祝融、张飞、孟优、南华，与正式主图的代表顺序不同。图为 530×1484、175795 字节，无损像素差 0。

## 真实十猫战斗

`battle.webp` 是真实 battle 页面与 HUD，原生 canvas 948×593，取编号 07（第 8 帧、t=5.00 秒）。start=3 秒、step=.25 秒，共十二帧，原 PNG 留在 `.shots/patterns-special/final-battle_00.png` 至 `_11.png`。

```sh
node .shots/patterns-special/battle-stable.mjs "r3d=1&a=wu_zhoumiaoyu,man_mengmiaohuo,shu_zhangmiaofei,man_mengyou,xian_nanhua&b=xian_changmiao,shu_zhugemiaoliang,wu_sunxiaoba,shu_machao,man_zhurong" .shots/patterns-special/final-battle 0.25 12 3
```

临时脚本沿用 `tools/battle-shots.mjs`，只改 Chromium 路径为 `/usr/bin/chromium`、端口为 5177，并记录 page errors。5177 是相同 Vite 配置关闭 HMR 的稳定服务，忽略 `.shots` 和 review 输出。七次官方截图和十二帧战斗均完成，页面运行错误 0；外部 Google Fonts 请求受环境网络策略阻止，中文使用系统 CJK 回退。

## 导出与验证

PNG 只做无损编码优化，战斗使用 lossless WebP。八张图全部保留原分辨率与像素，解码后逐像素 RGB 差为 0，均小于 500000 字节。

| 交付图 | 字节数 |
| --- | ---: |
| poses.png | 446383 |
| poses-small.png | 362836 |
| boundaries.png | 439147 |
| front-0.png | 135538 |
| front-32.png | 135503 |
| front-minus32.png | 134904 |
| back-148.png | 116558 |
| battle.webp | 355202 |

同一冻结源码以 network grant 运行 `npm run typecheck && npm test`：66 个测试文件、987 项测试通过，退出码 0。作者独立模块自查覆盖正式 19 用户、38 张 256² 不透明 sRGB 纹理：两个独立模块逐 RGBA 确定性、同模块缓存对象复用、base/light/accent/stripe 颜色键隔离通过；116 张非目标纹理的 RGBA/null 与基线完全相同。100×77×2=15400 次缓存命中调用新增 Canvas 为 0。独立 Node SSR 在 document 缺失时，对 19 用户×2part×2次的 76 次调用均返回 null。独立 QA 的更广覆盖与有限采样边界见对应报告。

独立 QA 另覆盖全部 77 用户×2part 的 154 次 SSR 调用，以及本批 19 用户的 266 个静态姿势、228 个动画采样：非有限坐标、新增裁切和基线 / 候选世界顶点差均为 0。38 张目标纹理确定性与缓存、116 张非目标纹理基线一致性全部通过；这与作者的 76 次目标重复 SSR 自查是两个单独覆盖。

## 实际可影响的区域

此引擎把 head 图用于颅骨，body 图用于小腿与未被覆盖的尾球。耳、手爪、脸颊绒毛、胸前绒领和袖子使用原有纯色材质，不会被本图改变。非 ring 尾末段固定 light；ring 尾奇数段固定 stripe 或引擎既有兜底色。因此重点色的耳 / 爪 / 尾尖不能靠本文件染深，南华尾环也不能靠本图改为整套蓝色。每节尾球都复用同一 body 图并沿 z 拉长，当前实现不声称可以定位整条尾巴的前后段。

第 1 轮待审。最不满意：孟优的闭眼线在深棕毛上对比较低，南华深蓝四瓣在约 190px 下的下翼较弱；玫瑰环在 12 段尾球上有拉伸与重复，仍需按真实战斗尺度审核。
