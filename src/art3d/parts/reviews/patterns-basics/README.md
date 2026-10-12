# 毛色花纹第 1 批：虎斑 / 燕尾服 / 三花

本批只细化 `src/art3d/patterns.ts` 的 `tabby / tuxedo / calico`，没有改造型数据、引擎、材质、注册表或依赖。参考现有设定图后，在正常烘焙的原生 3D 猫上检查额头、脸颊、白鼻梁与三花块面，再拍真实战斗。

## 源码与参考

- 基线：主分支 `claude/awesome-babbage-ygba4h` 的 `bf37bd3`；保留该基线的 1.14 倍头部、颊毛、绒领、靴子与 Toon 光照。
- 冻结纹样源码 SHA-256：`58ff3d8821b43c924cbb766c07977307813d95c52692ac89360204263524f8a2`。
- 未改动的 `cat3d.ts` SHA-256：`06e44bc80ab32181fc5bc42149ab957fbff0ca4716392f9304620f8f98904e56`。
- 未改动的 `toon.ts` SHA-256：`bcb0fcfb3a9011e43d4720e5f2ec6b87f6a931fd7ad31be72c277520968bb837`。
- 已实际查看原 JPG：[刘喵备](../../../../../assets/heroes/ref/shu_liumiaobei.jpg)、[吕布丁](../../../../../assets/heroes/ref/qun_lvbuding.jpg)、[貂蝉喵](../../../../../assets/heroes/ref/qun_diaochan.jpg)、[庞喵统](../../../../../assets/heroes/ref/shu_pangmiaotong.jpg)，并核对 [ART_PROMPTS](../../../../../docs/ART_PROMPTS.md) 的毛色设定。

虎斑的前脸中心是 `u≈0.25 / x≈64`：额头画连成 M 的圆润长短纹，颊纹向口鼻渐细；身体模式按球面法线 z 留环，匹配沿 z 拉长的尾段。燕尾服的白鼻梁从额头渐宽并连接口鼻与下颌。三花改成浅毛底、左上橘块、另一侧太阳穴深块与侧后斑；块边使用确定的贝塞尔曲线，不撒随机颗粒。所有颜色取现有 `coat.base / light / accent / stripe`。

## 使用者与排列

实际使用者共 21 只：11 英雄、10 杂兵。

| 花纹 | 英雄 | 杂兵 |
| --- | --- | --- |
| `tabby`（11） | `shu_liumiaobei`（UR）、`wei_xiahoudun / wu_luxun / man_shamoke`（SSR）、`wei_xuhuang / shu_huangzhong / wu_huanggai`（SR） | `mob_wei_vanguard / mob_shu_vanguard / mob_shu_strategist / mob_shu_assassin` |
| `tuxedo`（6） | `qun_lvbuding`（UR）、`xian_zhangzhua`（SSR） | `mob_wei_strategist / mob_shu_guard / mob_qun_assassin / mob_xian_strategist` |
| `calico`（4） | `shu_pangmiaotong`（SP）、`qun_diaochan`（SSR） | `mob_shu_archer / mob_qun_archer` |

代表英雄六行依次是 `shu_liumiaobei,man_shamoke,qun_lvbuding,xian_zhangzhua,shu_pangmiaotong,qun_diaochan`。边界杂兵六行依次是 `mob_shu_strategist,mob_shu_assassin,mob_wei_strategist,mob_shu_guard,mob_qun_archer,mob_shu_archer`，覆盖浅虎斑 / 深虎斑、蓝白 / 橘白燕尾服、暖棕 / 米白三花，以及 0.89～1.08 的体宽。

## 正式截图

三姿势图每行从左至右为 `idle,windup,strike`。均为正常产品入口 `cat3d.html`，沿用 `tools/cat3d-shots.mjs` 的 `phase=0 / t=0.4`、共享渲染器、Toon 光照与正常烘焙；没有替换材质、几何或姿势。

`w=290` 的原生单格为 290×254；紧凑检查 `w=250` 的单格为 250×219（文件名沿用约 190px 角色检查尺度，图片本身没有缩放）。

| 文件 | 内容与方向 | 原生尺寸 | 文件字节数 |
| --- | --- | --- | --- |
| [poses.png](poses.png) | 6 代表英雄 × 三姿势，yaw=32°，w=290 | 1000×1570 | 462790 |
| [poses-190px.png](poses-190px.png) | 同上，w=250 | 1000×1360 | 377700 |
| [mobs-poses.png](mobs-poses.png) | 6 边界杂兵 × 三姿势，yaw=32°，w=290 | 1000×1570 | 441585 |
| [mobs-poses-190px.png](mobs-poses-190px.png) | 同上，w=250 | 1000×1360 | 358924 |
| [front.png](front.png) | 6 英雄后接 6 杂兵，idle 正面，yaw=0°，w=250 | 1000×2698 | 276020 |
| [reverse.png](reverse.png) | 6 英雄 × 三姿势，yaw=-32°，w=250 | 1000×1342 | 371949 |
| [reverse-mobs.png](reverse-mobs.png) | 6 杂兵 × 三姿势，同方向 | 1000×1356 | 360342 |
| [back.png](back.png) | 6 英雄 × 三姿势，yaw=148°，w=250 | 1000×1342 | 301401 |
| [back-mobs.png](back-mobs.png) | 6 杂兵 × 三姿势，同方向 | 1000×1356 | 296067 |
| [battle.webp](battle.webp) | 10 使用者真实战斗，t=4.25s | 948×593 | 381614 |

七次 `shots3d` 与十二帧战斗截图完成，页面运行错误为 0。战斗页原有 Google Fonts 请求出现一次 `ERR_TUNNEL_CONNECTION_FAILED`；画面使用系统中文字体，角色、技能与状态文本实际正常显示。

PNG 以 Pillow `optimize=True, compress_level=9` 无损重编码，解码 RGBA 差异为 0。反侧 / 背面原图均为 12 行 1000×2698，分别在两组之间 y=1342 裁成英雄与杂兵两张；与原图对应窗口逐 RGBA 相同，未缩放或重画。原完整图留在未提交的 `.shots/patterns-basics/reverse-12.png / back-12.png`。战斗第 04 帧用 Pillow `lossless=True, quality=100, method=6` 转 WebP，与原 PNG 解码 RGBA 差异为 0。全部交付图片 <500000 字节。

### 拍摄命令

临时稳定服务位于未提交的 `.shots/patterns-basics/stable-vite.mjs`，端口 5176，`hmr:false`，忽略 `.shots/**` 与 `parts/reviews/**` 的监听，审核文件写入不会刷新拍摄页面。该脚本仅从 Vite 的 `createServer` 启动现有工程。

```bash
CHROME=/usr/bin/chromium PORT=5176 npm run shots3d -- src/art3d/parts/reviews/patterns-basics/poses.png 'ids=shu_liumiaobei,man_shamoke,qun_lvbuding,xian_zhangzhua,shu_pangmiaotong,qun_diaochan&poses=idle,windup,strike&yaw=32&w=290'
CHROME=/usr/bin/chromium PORT=5176 npm run shots3d -- src/art3d/parts/reviews/patterns-basics/poses-190px.png 'ids=shu_liumiaobei,man_shamoke,qun_lvbuding,xian_zhangzhua,shu_pangmiaotong,qun_diaochan&poses=idle,windup,strike&yaw=32&w=250'
CHROME=/usr/bin/chromium PORT=5176 npm run shots3d -- src/art3d/parts/reviews/patterns-basics/mobs-poses.png 'ids=mob_shu_strategist,mob_shu_assassin,mob_wei_strategist,mob_shu_guard,mob_qun_archer,mob_shu_archer&poses=idle,windup,strike&yaw=32&w=290'
CHROME=/usr/bin/chromium PORT=5176 npm run shots3d -- src/art3d/parts/reviews/patterns-basics/mobs-poses-190px.png 'ids=mob_shu_strategist,mob_shu_assassin,mob_wei_strategist,mob_shu_guard,mob_qun_archer,mob_shu_archer&poses=idle,windup,strike&yaw=32&w=250'
CHROME=/usr/bin/chromium PORT=5176 npm run shots3d -- src/art3d/parts/reviews/patterns-basics/front.png 'ids=shu_liumiaobei,man_shamoke,qun_lvbuding,xian_zhangzhua,shu_pangmiaotong,qun_diaochan,mob_shu_strategist,mob_shu_assassin,mob_wei_strategist,mob_shu_guard,mob_qun_archer,mob_shu_archer&poses=idle&yaw=0&w=250'
CHROME=/usr/bin/chromium PORT=5176 npm run shots3d -- src/art3d/parts/reviews/patterns-basics/reverse.png 'ids=shu_liumiaobei,man_shamoke,qun_lvbuding,xian_zhangzhua,shu_pangmiaotong,qun_diaochan,mob_shu_strategist,mob_shu_assassin,mob_wei_strategist,mob_shu_guard,mob_qun_archer,mob_shu_archer&poses=idle,windup,strike&yaw=-32&w=250'
CHROME=/usr/bin/chromium PORT=5176 npm run shots3d -- src/art3d/parts/reviews/patterns-basics/back.png 'ids=shu_liumiaobei,man_shamoke,qun_lvbuding,xian_zhangzhua,shu_pangmiaotong,qun_diaochan,mob_shu_strategist,mob_shu_assassin,mob_wei_strategist,mob_shu_guard,mob_qun_archer,mob_shu_archer&poses=idle,windup,strike&yaw=148&w=250'
node .shots/patterns-basics/battle-stable.mjs 'r3d=1&seed=2&theme=meadow&a=shu_liumiaobei,qun_lvbuding,shu_pangmiaotong,qun_diaochan,man_shamoke&b=xian_zhangzhua,wei_xiahoudun,wei_xuhuang,wu_huanggai,wu_luxun' .shots/patterns-basics/battle 0.25 12 3
```

`battle-stable.mjs` 只复制原 `tools/battle-shots.mjs` 的拍摄流程，将 Chromium 路径设为 `/usr/bin/chromium`、端口设为 5176，并记录页面运行错误数；没有改产品。保留全部十二个原始战斗帧供复核，第 04 帧时刻是 `3 + 5×0.25 = 4.25s`。

## 检查与边界

`npm run typecheck` 退出 0；`npm test` 在本机需要附加网络权限才能运行测试的 Node 子进程，最终 **65 文件 / 980 测试全部通过，退出 0**。最初普通 sandbox 的 13 例 `spawnSync EPERM` 在附加权限重跑后全部消失。`git diff --check` 通过。

作者另外在实际浏览器中核对 21 使用者 × head/body：42 张纹理均为 256² / sRGB，首次只创建 42 个 Canvas，同描述重复调用缓存命中 42/42；另一个独立模块生成的像素确定性 42/42；默认 body、head/body 分离、base/light/accent/stripe 缓存键分离均正确。其余 56 使用者 × 两个 mode 共 112 例，与 `bf37bd3` 的原实现逐 RGBA 相同。无 document 的 SSR 共 154 调用全部返回 null。此核对的临时脚本为 `/tmp/patterns-basics-runtime-check.mjs`。

同一有效缓存键仍只保留一张小贴图，没有新增网格或每帧分配。若本批全部 21 种实际毛色的两个 mode 都创建，42 张 RGBA Canvas 合计约 10.5 MiB，默认 mipmap GPU 数据约 14 MiB；与原实现相同的纹理数量、分辨率和缓存规则。此估算不含浏览器额外开销。

当前引擎颅骨用 head 纹理，小腿与每个尾球复用 body 纹理；衣服躯干和袖子走服装色，手爪单独使用毛色材质（燕尾服已经是浅爪），胸前绒领已经取 `coat.light`。因此本批新增的是颅骨花纹与 body 白袜 / 围兜纹样，没有声称 body 贴图重新绘制了实际衣服下的白胸或独立手爪。共享尾节 UV 也会重复 body 块面；燕尾服尾巴有浅色腹侧带，三花尾段有重复块纹。

最不满意：浅虎斑 `mob_shu_strategist` 的底色和纹色对比低，紧凑尺度 M 纹较弱；三花在朝橘色一侧的 32° 视角里，深色太阳穴露出较少，因此补了 -32° 实图。庞喵统的深块保留设定中的暖棕色，`mob_qun_archer` 的浅底保留设定中的暖棕浅色，没有为了更白 / 更黑改英雄或杂兵毛色数据。
