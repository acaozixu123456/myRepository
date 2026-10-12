# 魏族三件 SSR 专属武器 · C5 / f4 真实预览

本目录为本批最新私有拍摄与技术排版。没有修改生产源码、官方工具、镜头、引擎、依赖、Git 或 PR；C1–C4 历史目录保持冻结。本 helper 不运行完整测试，也不代表 Claude 审核通过。

| 五张正式图 | 实际尺寸 | 字节 | SHA-256 |
| --- | --- | ---: | --- |
| after-poses.png | 1000×823 | 256116 | `d4c028382bc17d7adc435629fdd403bfc5c80ded83b9708642bf159981567139` |
| after-190px.png | 1000×700 | 163605 | `bbf52d0f6b99bb403b53163d350defdb8f11c13518954582915262040e3efc9e` |
| after-rear.png | 1000×700 | 51109 | `bae192e0f73e4153e68e4ff5cb449e01ca3190c4e5a903846c97d598e67f1864` |
| before-after-190px.png | 1408×768 | 198199 | `19edbe3d90e6988629d62ed29d98179718a2c05e75981f398ecfc8a221a72058` |
| battle.webp | 948×593 | 406524 | `7eef0e35ea4b2045041fdf0831bdf18609dd2a33bab0859672a6466c7e5af1cb` |

## 拍摄源与实际基线

本次真实基线是 `f4b3c0c9907dc5b0f5a7315a1c8578de7567a057`。实际拍摄工作树 HEAD 是 `a9261dcccd8184a0a57e8f723f022fccc998d8e7`，根已经 apply f4 merge，但尚未 commit；没有把未提交 HEAD 称为 f4。

两份 writer 源严格等根的 C5/f4 freeze：

- `src/art3d/heroes.ts`：`d685ca31ef7a35a51c82965cce0640d8d3409b80b48b34dffb215ef831dfb428`，8242 B。
- `src/art3d/parts/hero-wei-weapons.ts`：`105b8faa0b6012bc7c372cf4341d62e82af4b5f41231f7b6fe92d5d49ae76cb0`，9338 B。

根 freeze 路径和原文哈希记录在 capture-source-before.json。实际核对 63 份输入，其中 61 份非 writer 逐字节等 f4，包含已合并的 #126/#128 配饰。旧 C4 49 份数量没有冒充本次结果；增加完整 art3d/fx 输入覆盖，所以本次 63 份。

这些源在实际捕获窗口内前后哈希不变。Live capture 最后结束 `2026-10-12T11:49:31.688Z`；生产源读取最后结束 `2026-10-12T11:49:31.815219+00:00`。此后仅处理已落盘截图，没有后续 live 读取。

before 是本次新拍的真正 f4 stock：从明确 f4 Git blobs 导出 242 个源码/配置/官方工具文件到 baseline-f4-tree，仅 symlink 现有 node_modules。stock registry 没有本批三 SSR 映射，也没有 hero-wei-weapons helper。拍摄后 242 文件全部逐字节等原 Git 导出；没有借 C1–C4 的旧 before 换标签。

两台私有 Vite 服务分别用于当前工作树 5186 和 stock 5187。createServer 使用 configFile=false、原 effective dev base './'，只把 optimizer cache 放在本目录；原 tracked vite.config 的其余选项仅用于 build，没有改生产配置。服务命令、实际 PID、端口、启动/停止 UTC 和退出 0 记录在 private-services.json，两台自己启动的服务已经正常停止，没有停止别人的进程。

## 官方 shots3d 实拍

下面四个 npm run shots3d 命令真实执行、全部退出 0，原工具和 dev 页面没有修改。原 dev 固定 applyPose t=0.4；w300 原画布 300×263，w217 原画布 217×190。190 指画布高度，猫轮廓更矮。

```sh
# cwd: /workspace/three-review/heroes-wei-icons/final-candidate05-f4/preview/baseline-f4-tree
PORT=5187 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/heroes-wei-icons/final-candidate05-f4/preview/baseline-190px.png 'ids=wei_xiahoudun,wei_xuhuchi,wei_zhangliao&poses=idle,windup,strike&yaw=32&w=217'
# cwd: /workspace/three-worktrees/heroes-wei-icons
PORT=5186 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/heroes-wei-icons/final-candidate05-f4/preview/after-poses.png 'ids=wei_xiahoudun,wei_xuhuchi,wei_zhangliao&poses=idle,windup,strike&yaw=32&w=300'
# cwd: /workspace/three-worktrees/heroes-wei-icons
PORT=5186 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/heroes-wei-icons/final-candidate05-f4/preview/after-190px.png 'ids=wei_xiahoudun,wei_xuhuchi,wei_zhangliao&poses=idle,windup,strike&yaw=32&w=217'
# cwd: /workspace/three-worktrees/heroes-wei-icons
PORT=5186 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/heroes-wei-icons/final-candidate05-f4/preview/after-rear.png 'ids=wei_xiahoudun,wei_xuhuchi,wei_zhangliao&poses=idle&yaw=180&w=217'
```

每个命令实际开始/完成 UTC、query、cwd、port、尺寸与哈希见 official-capture-images.json。原官方工具只监听 pageerror；四个 log 没有 PAGEERROR，实际 window.done 成功并 saved。原工具没有监听 console/requestfailed，所以不据此宣称全部浏览器告警为零。

before-after-190px.png 使用上述最新 stock/after 的 18 块 217×190 整数画布，合 742140 个 RGB 像素逐块全等。仅加标签和留白，未 resize、重绘、调色或量化。每块源/目标矩形和 RGB 哈希在 before-after-190px.json，保存后再次读取完整 PNG 验证。

## 正常十猫真实战斗

只用官方 battle-shots 的私有副本适配现有 Playwright 绝对 import、本地 CHROME 和 PORT；新增只读源哈希、错误 URL、实际 __demo.player 演员/rig.cat3d 命名组记录。没有手摆猫模型、修改 pose、修改 advance 或替换渲染器。实际命令：

```sh
PORT=5186 CHROME=/usr/bin/chromium node battle-capture.mjs 'r3d=1&a=wei_xiahoudun,wei_xuhuchi,wei_zhangliao,wei_caomiaode,wei_simamiyi&b=shu_liumiaobei,shu_guanyunmiao,wu_sunxiaoba,wu_zhoumiaoyu,qun_lvbuding&seed=121' /workspace/three-review/heroes-wei-icons/final-candidate05-f4/preview/battle 0.25 6 0
```

实际 battle 时段 `2026-10-12T11:49:22.125Z` 至 `2026-10-12T11:49:31.688Z`，start0、0.25 s × 6 帧，每帧均调用正常 __demo.advance 后截图。10/10 演员真实有 rig.cat3d；夏侯 ssr-xiahou-spear、许虎 ssr-xuhu-bone-mace、张辽 ssr-zhangliao-blade-main/off 命名组在正常演员树实际全部命中。两队 10 ID、seed121 保持约定。

实际查看 00 和 05，选原 quiet00。输出 battle.webp 与原 battle_00.png 全部 562164 个 decoded RGB 像素完全等，948×593；raw 原图模式 RGB。原 PNG optimize9 仍为 527454 B，因此采用 Pillow lossless WebP quality100/method6/exactTrue，未缩放、调色、绘制或量化。证据在 battle-selection.json。

battle pageErrors 为空；实际 Google 字体 CSS https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&family=ZCOOL+KuaiLe&display=swap 出现 net::ERR_TUNNEL_CONNECTION_FAILED，http://127.0.0.1:5186/favicon.ico 返回 404。requestfailed、console URL/location 与 pageErrors 各自记录，没有把它们泛称 3D 构建错误，也没有写浏览器零错误。

## 已实看与边界

- 已实际查看三张 after、真正新 f4 stock、18 格原尺寸对照、raw battle00/05 与最终 battle.webp。
- 夏侯精钢柳叶刃和蓝缨、许虎木骨锤的可辨识轮廓比 stock 清楚。夏侯下杆 C5 修改未造成照片中明显的脱离握持；数值碰撞仍以独立 QA 为准。
- 张辽双刃仍可辨，但蓝柄和护手细节在 190 画布最弱；采用原始官方取景，没有为增大细节改变镜头或模型。
- 张辽将军盔 helmetGeneral 红缨在 idle/windup 上沿的已有裁切同时存在于本次 f4 stock 与 after，未称为新增裁切，也未换镜头掩盖。
- 最新 f4 的夏侯眼罩同时保留于 stock 和 after。照片本身不作脸部无遮挡、全动画无穿插或网格预算数值证明。
- 战斗00保留10张可读的脸和孙小霸自然眨眼；部分夏侯长枪、许虎骨锤被队友正常遮挡。张辽双刃在前排可见。05已有白圈战斗特效叠在猫的上身区域，选择原quiet00，未修改战斗内容。

C5 有限碰撞见证、脸/耳投影、逻辑网格数、缓存/主副手挂点与非目标保护由独立 QA 报告。本 helper 没有重复机械 QA，也未用静态照片推断全部动画通过。正式图片全部小于 500000 B；3D review 截图本身不要求 POT。
