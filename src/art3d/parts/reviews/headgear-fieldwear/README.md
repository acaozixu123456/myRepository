# 头饰 fieldwear 最终审图

六件：sailorBandana / fortuneHat / rattanHelm / leafHat / hood / ratCap。base / 拍摄 HEAD=`83b8abd7ccb1592c6eb208ca27590f13c182ca5e`。baseline于2026-10-11T23:23:53.203Z从当时真实底版拍摄，最终于2026-10-11T23:43:54.470Z重拍；补充正面与反侧实际捕获时间见scratch/final-supplements-report.json。

最终 headgear SHA256=`80b57c864f0a276b4809fd6a1cadd6b1e774674025a9c2cc8a5ac93ada89c885`；baseline headgear=`9c26b1093bdda9df66fd958e5e81c8033b72ff927ccb71023262813218ce130c`。其余15份骨架、toon、pose、renderer、调试页、数据与工具源码均与本底版相同，拍前后16份hash均保持冻结。没有使用后来不同主分支或toon重拍的图作前后比较。

## 真实使用者与取景

完整使用者：3英雄+17杂兵=20位，依据本base的heroes / MOB_LOOKS / content mobs核对，列表保存在scratch/preview-users.json；全员几何/眼部/耳抖/动作QA由根线程与独立QA提供，本README只记录真实截图。

八行顺序：wu_ganning, xian_guanlu, man_wutugu, mob_shu_archer, mob_wei_assassin, mob_wu_guard, mob_shu_guard, mob_man_healer。依次为甘宁宁、管辂喵、兀突骨、青竹铃箭喵、夜巡绒卫、水寨鼠兵、草鞋护粮喵、山草医喵。八位覆盖六类型，另补大耳跨阵营布巾和簇耳叶帽。

主图：idle / windup / strike、yaw=32，w300和w250各实际执行一次shots3d。近看从原生250×219 Canvas直接裁格并在图外加标签、拼版，不调整角色像素；角色约190px高，250px是格宽。before-after使用相同toon、骨架、相机与取景；仅拼版和标签。PNG仅depth8 / strip /无损压缩。

正面图：管辂喵、三阵营hood杂兵和鼠帽的idle、yaw=0、w250。反侧图：甘宁宁、草鞋护粮喵、温奶医喵的idle、yaw=-32、w250；真实反侧渲染，没有翻转截图。

十猫战斗我方：wu_ganning,man_wutugu,mob_wu_guard,mob_shu_archer,mob_wei_assassin。
敌方：xian_guanlu,mob_shu_guard,mob_man_healer,mob_wei_healer,mob_man_guard。
meadow / seed2，十二次0.25s步进，从实看的0.25s帧交付；十猫均可见，无爆炸FX挡帽。额外覆盖蓝色折耳布巾与最大头head1.07的藤盔杂兵。战斗Canvas948×593，viewport980×620，真实HUD保留。

## 验证与视觉观察

四次实际npm shots3d与12帧战斗流程均exit0，pageErrors=[]；源码拍前后冻结。原战斗工具仅在scratch复制，替换import路径、Chrome路径与端口，production tools未改。CHROME=/usr/bin/chromium，Chromium154.0.8037.57；Swiftshader args为--no-sandbox、--use-angle=swiftshader、--enable-unsafe-swiftshader、--ignore-gpu-blocklist。

根线程已实际执行typecheck && test，通过58文件926测试；实际日志为scratch/validation-candidate-03.log。没有将截图捕获记作新的测试执行。

独立终审记录见 [QA 摘要](qa-summary.md) 和 [机器摘要](qa-summary.json)：20 位真实使用者覆盖 60 个三姿势、60 个精确耳峰、280 个全姿势与 720 个动画案例。两种圆耳叶帽仍有低位后耳根三角接合，已联合普通、耳峰和背向截图确认耳轮廓连续；记录保留实际范围与采样限制。

实看：布巾红/绿/蓝可区分，侧结可见；藤编和鼠耳比底版明确；hood布边包到颈侧，三阵营正面眼口可见；leafHat strike已显示浅绿色背面，耳槽后的叶茎与前缘仍呈扁叶帽。

最弱：**叶帽strike较扁，190px下细叶脉偏弱**；绿色背面保持可辨。没有用后期调色或手工修图改善该限制。

## 图片预算

| 图 | 尺寸 | 字节 |
| --- | --- | --- |
| [poses.png](poses.png) | 1000×2158 | 314674 |
| [poses-190px.png](poses-190px.png) | 1000×1806 | 255918 |
| [small-190px.png](small-190px.png) | 1024×514 | 100435 |
| [battle.png](battle.png) | 948×593 | 448206 |
| [before-after.png](before-after.png) | 1024×1122 | 226597 |
| [front-190px.png](front-190px.png) | 768×514 | 59401 |
| [reverse-190px.png](reverse-190px.png) | 768×257 | 37893 |
| [baseline-poses.png](baseline-poses.png) | 1000×2158 | 284966 |
| [baseline-poses-190px.png](baseline-poses-190px.png) | 1000×1806 | 232632 |
| [baseline-small.png](baseline-small.png) | 1024×514 | 93165 |
| [baseline-battle.png](baseline-battle.png) | 948×593 | 436704 |

所有提交PNG≤500000 B。完整sha在scratch/review-delivery.json；原始raw PNG、十二帧与执行log仅保留scratch。

## 真实命令

Vite在本批worktree：`npm run dev -- --host 127.0.0.1 --port 5181 --strictPort`。

```bash
PORT=5181 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/headgear-fieldwear/final-poses-raw.png 'ids=wu_ganning,xian_guanlu,man_wutugu,mob_shu_archer,mob_wei_assassin,mob_wu_guard,mob_shu_guard,mob_man_healer&poses=idle,windup,strike&w=300&yaw=32'
PORT=5181 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/headgear-fieldwear/final-small-native-raw.png 'ids=wu_ganning,xian_guanlu,man_wutugu,mob_shu_archer,mob_wei_assassin,mob_wu_guard,mob_shu_guard,mob_man_healer&poses=idle,windup,strike&w=250&yaw=32'
PORT=5181 CHROME=/usr/bin/chromium node /workspace/three-review/headgear-fieldwear/battle-shots-local.mjs 'r3d=1&a=wu_ganning,man_wutugu,mob_wu_guard,mob_shu_archer,mob_wei_assassin&b=xian_guanlu,mob_shu_guard,mob_man_healer,mob_wei_healer,mob_man_guard&theme=meadow&seed=2' /workspace/three-review/headgear-fieldwear/final-battle 0.25 12 0
PORT=5181 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/headgear-fieldwear/final-reverse-raw.png 'ids=wu_ganning,mob_shu_guard,mob_wei_healer&poses=idle&w=250&yaw=-32'
PORT=5181 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/headgear-fieldwear/final-front-raw.png 'ids=xian_guanlu,mob_wei_assassin,mob_wu_assassin,mob_qun_assassin,mob_wu_guard&poses=idle&w=250&yaw=0'
```

可复跑：scratch/capture-review.mjs final（提供FROZEN_HEADGEAR_SHA=80b57c864f0a276b4809fd6a1cadd6b1e774674025a9c2cc8a5ac93ada89c885）；补图使用scratch/capture-supplements.mjs final 80b57c864f0a276b4809fd6a1cadd6b1e774674025a9c2cc8a5ac93ada89c885。两份报告均记录真实命令、文件尺寸、源码hash和页面错误。

## 冻结源码 SHA256

- `src/art3d/parts/headgear.ts`: `80b57c864f0a276b4809fd6a1cadd6b1e774674025a9c2cc8a5ac93ada89c885`
- `src/art3d/toon.ts`: `03d9f550749210bd73577b360753d569005e22ea2666802b4c16d87588224c29`
- `src/art3d/pose.ts`: `4ebb282987092cbbd83fe2b35e5319be37d6346fa70bd9c9045270ab3685d265`
- `src/art3d/renderer.ts`: `339f18a547a222c2f7caba92a54c094b7ee4cea4b0cc3a50a546316964d6c935`
- `src/dev/cat3d.ts`: `3dc4e040a693d529d89aa9cde9da7d1b06c2f34c802c95901396096c4fef9bc5`
- `src/art3d/cat3d.ts`: `24a11ab16c02f9adbf6bf1869bec739fc945e3ba50ba72792208d9fe01263fe8`
- `src/art3d/parts/types.ts`: `36b7c638a46131e7e0e3a42c55fc91d76895f977a11ac3bfd14bbd8e846d302c`
- `src/art3d/parts/index.ts`: `9cb96c27b47b4051ff793f9110f2f4e9857a17690faadf181b1564e7926d8b4e`
- `src/art3d/heroes.ts`: `0fc83a39421690538c37ac62cc9c1e0dc2d6ed7b1ffc7f2a0baae4a12216ce07`
- `src/art3d/patterns.ts`: `60a0b1468d7cf216a319ac44df5d598a3ff8e67462b8c81b7ea024140271676e`
- `src/data/heroes.ts`: `e4181c0d825b4bcef99d25b084f4e080c450e7d15d50db9125481ed6bc801f59`
- `src/data/mob-looks.ts`: `236fba967b442a28686f9fa5b1669feb57128a0fc627b4bc36a31b181c79a5f5`
- `src/data/units.ts`: `309338e7d843a80f962db03e4cf5c951da72c6a9d983d0d8f5f90463ce1a652b`
- `src/content/mobs.ts`: `72ea942357374719ca81d0992aed6bf08b1d9f3e1223775329b3fe14c5bad438`
- `tools/cat3d-shots.mjs`: `4c9b690b764b5c68f227e5b68bfda913fb45e0c70befe9ff561efc9c60649170`
- `tools/battle-shots.mjs`: `99ad6d721fb20f85947ca7dc097328741ffa1be1762d78a534c141174ffaefe4`
