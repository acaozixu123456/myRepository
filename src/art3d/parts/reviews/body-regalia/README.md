# 衣服第 1 批截图记录

基线：`1f45261f2ec706043b7fbcb0f6ce3d60122a094f`。已同步主分支的新版模型、毛领、大眼、靴子与 Toon。候选仅替换 `robeSilk / dress / armorHeavy` 及本文件局部构建工具；不改骨架、姿势、渲染器、数据或其余衣服。

最终 `body.ts` SHA256：`17dba1912cfc1ef3b4d90428590bcb57262618c308a59434e562803f26ea52f4`。检查和以下最终截图都使用这一冻结版本，拍后哈希保持相同。

| 共用源码 | SHA256 |
| --- | --- |
| `cat3d.ts` | `56288d563537fc36ee3e419e8f8a5ae741b57d8dc7915a0364561b2cdecc149f` |
| `toon.ts` | `01596b5f8927ae99c3c3ba3c85076366b6d43f16cc240a5808cea72fcab95fe1` |
| `pose.ts` | `4ebb282987092cbbd83fe2b35e5319be37d6346fa70bd9c9045270ab3685d265` |
| `renderer.ts` | `ae998f612ae070288c81c8cf2c03bf605407718b7d2c89f5b042d169eb8bc3db` |

## 真实截图

`poses.png`、`poses-small.png` 按行依次为司马喵懿、庞喵统、曹喵德、嫦喵、貂蝉喵、吕布丁，按列为 idle / windup / strike。官方调试页普通蒙皮，yaw=32°，phase=0，t=0.4。原生小画布是 250×219，并非先拍大图缩小；实际角色高度随头饰和姿势不同，约为游戏的 190px 尺度。

```sh
PORT=5174 CHROME=/usr/bin/chromium npm run shots3d -- .shots/body-regalia/metal-poses.png "ids=wei_simamiyi,shu_pangmiaotong,wei_caomiaode,xian_changmiao,qun_diaochan,qun_lvbuding&poses=idle,windup,strike&w=290"
PORT=5174 CHROME=/usr/bin/chromium npm run shots3d -- .shots/body-regalia/metal-small.png "ids=wei_simamiyi,shu_pangmiaotong,wei_caomiaode,xian_changmiao,qun_diaochan,qun_lvbuding&poses=idle,windup,strike&w=250"
PORT=5174 CHROME=/usr/bin/chromium npm run shots3d -- .shots/body-regalia/metal-boundaries.png "ids=qun_dongzhuo,shu_zhangmiaofei,shu_zhaomiaoyun&poses=idle,windup,strike&w=290"
```

`before-after.png` 直接调用相同的 `buildCat3D / applyPose / Renderer3D`，分别用上述基线和候选的 BODY 注册函数，6 位代表英雄两列对照；都使用普通 bake、250×219 原生画布、同光照和相机。仅排版与文字标注，无描绘、调色或锐化。临时基线模块采用每轮唯一 URL，并核对运行时基线源码 SHA，避免缓存旧构建函数。旧引擎与同步中间版本的截图 / 报告仅归档在 `.shots/body-regalia/obsolete/`，不作为本次证据。几何审计的方法与正常截图的区别见 [QA 摘要](qa-summary.md)。

`battle.webp` 来自真实十猫战斗与 HUD，第 7 帧（start=3 秒、step=0.25 秒，t=4.75 秒）。保留全部十二帧在临时目录；只提交其中一帧。按现有 `tools/battle-shots.mjs` 拍摄，临时副本只把 Chromium 路径改为 `/usr/bin/chromium`、端口改为 5174，并记录页面运行错误。5174 使用相同 Vite 配置关闭 HMR，避免审核文件写入触发截图页刷新，未修改游戏源码。

```sh
node .shots/body-regalia/battle-stable.mjs "r3d=1&a=wei_simamiyi,shu_pangmiaotong,qun_lvbuding,xian_changmiao,qun_diaochan&b=wei_caomiaode,wei_xiahoudun,shu_zhangmiaofei,shu_zhaomiaoyun,qun_dongzhuo" /tmp/maoguo-review/battle-metal 0.25 12 3
```

最终十二帧拍摄完成，页面运行错误为 0。外部 Google Fonts 请求被环境网络策略阻止，中文使用已安装的 Noto CJK 回退字体；未改网页字体或 HUD。早期拍摄因 HMR 刷新中断的帧已留在 `.shots`，不作为最终截图。

PNG 只做无损编码优化；战斗从原截图导出无损 WebP，逐像素差异检查为 0。所有提交图片小于 500000 字节。

## 验证

`npm run typecheck && npm test`：64 个文件、976 项测试通过，退出码 0。默认沙盒会阻止测试里的子进程，给执行命令启用网络权限后完整测试通过；没有修改测试或跳过失败项。

独立检查、有限采样范围与既有裁切列在 [QA 摘要](qa-summary.md) / [机器报告](qa-summary.json)。本批待 Claude 审核；最不满意是小尺寸浅色重甲的护心镜对比偏弱。

同步后重甲进一步保留三层冷金属肩甲与小块胸板；五条裙甲金边合成一件网格，在 24 网格预算内保持肩部层次。
