# 毛色首批三类 · 正式截图

`tabby / tuxedo / calico`：21实际使用者（11英雄＋10杂兵）。基线为 `bf37bd307e8669850af6cd5b502172ad7d7ab102`；最终 `patterns.ts` SHA256为 `3519b29b5275329d4f3abe96205bd55fdb2884060c4979136a0c47ee231cf98b`。206fb4旧模型与C1候选图仅存历史scratch，本批对照全部使用bf37bd3。

## 阅读顺序

先看 before-after.png（刘喵备、吕布丁、貂蝉喵，同一idle / yaw32 / w300），再看六页原尺寸三姿势与四页原生w250三姿势。三种方向各按类型分组，另有全21位idle总览；battle.png为真实十猫同屏。

| 图 | 像素尺寸 | 字节 |
| --- | --- | --- |
| [tabby-a.png](tabby-a.png) | 916×1230 | 344637 |
| [tabby-b.png](tabby-b.png) | 916×1230 | 351241 |
| [tabby-c.png](tabby-c.png) | 916×938 | 259904 |
| [tuxedo-a.png](tuxedo-a.png) | 916×938 | 252381 |
| [tuxedo-b.png](tuxedo-b.png) | 916×938 | 248948 |
| [calico.png](calico.png) | 916×1230 | 335275 |
| [tabby-native-a.png](tabby-native-a.png) | 766×1550 | 403909 |
| [tabby-native-b.png](tabby-native-b.png) | 766×1302 | 338980 |
| [tuxedo-native.png](tuxedo-native.png) | 766×1550 | 384406 |
| [calico-native.png](calico-native.png) | 766×1054 | 263952 |
| [front-tabby.png](front-tabby.png) | 1024×830 | 265889 |
| [front-tuxedo.png](front-tuxedo.png) | 1024×570 | 143929 |
| [front-calico.png](front-calico.png) | 1024×310 | 99605 |
| [reverse-tabby.png](reverse-tabby.png) | 1024×830 | 263617 |
| [reverse-tuxedo.png](reverse-tuxedo.png) | 1024×570 | 145238 |
| [reverse-calico.png](reverse-calico.png) | 1024×310 | 100585 |
| [rear-tabby.png](rear-tabby.png) | 1024×830 | 230330 |
| [rear-tuxedo.png](rear-tuxedo.png) | 1024×570 | 125755 |
| [rear-calico.png](rear-calico.png) | 1024×310 | 94290 |
| [native-all21-idle.png](native-all21-idle.png) | 1024×1610 | 487169 |
| [before-after.png](before-after.png) | 916×648 | 193774 |
| [battle.png](battle.png) | 948×593 | 497698 |

## 实际渲染与技术排版

全部原图通过实际npm shots3d生成：w300的canvas为300×263；小图w250的canvas为250×219。每幅角色图直接按原始canvas矩形1:1裁切，添加的文字在画布外；没有缩放、重绘、调色或覆盖渲染像素。不同角色、头饰和动作的可见轮廓高度不同，未宣称每猫实际高190px；真实游戏尺度另看十猫battle。

Renderer3D固定FRAME x[-2.2,2.2]、y[-0.25,3.6]；shots3d固定cat.phase=0，applyPose时间t=0.4。正面yaw0、反侧yaw-32、后侧yaw148。使用Chromium `/usr/bin/chromium`、Swiftshader，所有官方捕获命令exit0。

分组PNG逐页保留完整三姿势原像素，最大图497698 B，全部≤500000 B。PNG为RGB无损压缩；battle原图若有全不透明alpha，仅移除该通道，RGB逐像素相同。

## 命令

工作目录：`/workspace/three-worktrees/pattern-heraldic`。原图及脚本记录在 `/workspace/three-review/patterns-heraldic`。

完整21-ID参数（以下各shots3d命令使用同一ids）：

```text
ids=shu_liumiaobei,wei_xiahoudun,wu_luxun,man_shamoke,wei_xuhuang,shu_huangzhong,wu_huanggai,mob_wei_vanguard,mob_shu_vanguard,mob_shu_strategist,mob_shu_assassin,qun_lvbuding,xian_zhangzhua,mob_wei_strategist,mob_shu_guard,mob_qun_assassin,mob_xian_strategist,shu_pangmiaotong,qun_diaochan,mob_shu_archer,mob_qun_archer
```

```bash
PORT=5183 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/patterns-heraldic/final-poses-raw.png "ids=shu_liumiaobei,wei_xiahoudun,wu_luxun,man_shamoke,wei_xuhuang,shu_huangzhong,wu_huanggai,mob_wei_vanguard,mob_shu_vanguard,mob_shu_strategist,mob_shu_assassin,qun_lvbuding,xian_zhangzhua,mob_wei_strategist,mob_shu_guard,mob_qun_assassin,mob_xian_strategist,shu_pangmiaotong,qun_diaochan,mob_shu_archer,mob_qun_archer&poses=idle,windup,strike&w=300&yaw=32"
PORT=5183 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/patterns-heraldic/final-native-raw.png "ids=shu_liumiaobei,wei_xiahoudun,wu_luxun,man_shamoke,wei_xuhuang,shu_huangzhong,wu_huanggai,mob_wei_vanguard,mob_shu_vanguard,mob_shu_strategist,mob_shu_assassin,qun_lvbuding,xian_zhangzhua,mob_wei_strategist,mob_shu_guard,mob_qun_assassin,mob_xian_strategist,shu_pangmiaotong,qun_diaochan,mob_shu_archer,mob_qun_archer&poses=idle,windup,strike&w=250&yaw=32"
PORT=5183 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/patterns-heraldic/final-front-raw.png "ids=shu_liumiaobei,wei_xiahoudun,wu_luxun,man_shamoke,wei_xuhuang,shu_huangzhong,wu_huanggai,mob_wei_vanguard,mob_shu_vanguard,mob_shu_strategist,mob_shu_assassin,qun_lvbuding,xian_zhangzhua,mob_wei_strategist,mob_shu_guard,mob_qun_assassin,mob_xian_strategist,shu_pangmiaotong,qun_diaochan,mob_shu_archer,mob_qun_archer&poses=idle&w=250&yaw=0"
PORT=5183 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/patterns-heraldic/final-reverse-raw.png "ids=shu_liumiaobei,wei_xiahoudun,wu_luxun,man_shamoke,wei_xuhuang,shu_huangzhong,wu_huanggai,mob_wei_vanguard,mob_shu_vanguard,mob_shu_strategist,mob_shu_assassin,qun_lvbuding,xian_zhangzhua,mob_wei_strategist,mob_shu_guard,mob_qun_assassin,mob_xian_strategist,shu_pangmiaotong,qun_diaochan,mob_shu_archer,mob_qun_archer&poses=idle&w=250&yaw=-32"
PORT=5183 CHROME=/usr/bin/chromium npm run shots3d -- /workspace/three-review/patterns-heraldic/final-rear-raw.png "ids=shu_liumiaobei,wei_xiahoudun,wu_luxun,man_shamoke,wei_xuhuang,shu_huangzhong,wu_huanggai,mob_wei_vanguard,mob_shu_vanguard,mob_shu_strategist,mob_shu_assassin,qun_lvbuding,xian_zhangzhua,mob_wei_strategist,mob_shu_guard,mob_qun_assassin,mob_xian_strategist,shu_pangmiaotong,qun_diaochan,mob_shu_archer,mob_qun_archer&poses=idle&w=250&yaw=148"
PORT=5183 CHROME=/usr/bin/chromium node /workspace/three-review/patterns-heraldic/battle-shots-local.mjs "r3d=1&a=shu_liumiaobei,wei_xuhuang,qun_diaochan,shu_pangmiaotong,mob_wei_strategist&b=qun_lvbuding,mob_shu_guard,wu_luxun,man_shamoke,mob_qun_archer&theme=meadow&seed=2" /workspace/three-review/patterns-heraldic/final-battle 0.25 12 0
```

基线21-user shots3d由根线程实际执行并确认同上述IDs、idle/windup/strike、w300、默认yaw32，原图baseline/root-bf-poses.png；基线battle用相同阵容、theme=meadow、seed=2与步进参数。BF首次battle共12帧曾选择第0帧；正式battle已按下文aa9更新。步进参数每次0.25s，startAt=0。shots3d的phase固定；battle保留原游戏初始化，未把seed称为逐像素完全确定的视觉随机种子。

临时battle工具仅替换已有playwright-core的import执行路径、Chromium执行路径与URL端口。没有修改tracked tools/battle-shots.mjs，步进、场景和截图流程保持原样。原工具SHA256：`99ad6d721fb20f85947ca7dc097328741ffa1be1762d78a534c141174ffaefe4`；实际临时副本SHA256：`cc41a115a8672f13f17fea67db3bf29ac6c16899d63bac72f9462c054e2e4fcd`。

## 冻结源码

捕获前后核对31份源文件，除patterns.ts外其余30份与bf基线相同；截图期间源码未变化。

| 文件 | SHA256 |
| --- | --- |
| src/art3d/patterns.ts | `3519b29b5275329d4f3abe96205bd55fdb2884060c4979136a0c47ee231cf98b` |
| src/art3d/cat3d.ts | `06e44bc80ab32181fc5bc42149ab957fbff0ca4716392f9304620f8f98904e56` |
| src/art3d/toon.ts | `bcb0fcfb3a9011e43d4720e5f2ec6b87f6a931fd7ad31be72c277520968bb837` |
| src/art3d/renderer.ts | `ae998f612ae070288c81c8cf2c03bf605407718b7d2c89f5b042d169eb8bc3db` |
| src/art3d/pose.ts | `4ebb282987092cbbd83fe2b35e5319be37d6346fa70bd9c9045270ab3685d265` |
| src/art3d/parts/body.ts | `65eb57a345cf584e3b064206c469e1f606bdaf67e552c0dcb859361ad0f56167` |
| src/dev/cat3d.ts | `3dc4e040a693d529d89aa9cde9da7d1b06c2f34c802c95901396096c4fef9bc5` |

## 实测告警与已知限制

pageerror为空。BF与C2的独立网络观察都定位到外部字体CSS请求失败：`https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&family=ZCOOL+KuaiLe&display=swap`，resourceType=stylesheet，`net::ERR_TUNNEL_CONNECTION_FAILED`；浏览器使用字体fallback。C2观察另有本地 `/favicon.ico` 的HTTP404 consoleerror。没有把这些console/network记录写成“0错误”；没有改网络或渲染源码来隐藏告警。

独立QA及根线程确认：吕布丁羽冠在BF与C2三姿势均yMax=3.662394，超过FRAME上沿3.6；这是bf既有裁切，两版相同。保留原相机与取景，未调整模型或取景掩盖。

最弱处：mob_qun_archer的calico来自base=#ac8054、light=#b39371、accent=#50443f，都是较接近的棕色；小尺度三色对比有限。保留角色设定配色，没有将它改成白底黑斑。头盔/头巾、披挂、白口鼻、袖子、爪及尾尖有独立材质/遮挡，因此各部位的可见变化以这些实际截图为准。point本轮保留底版，耳/手/尾尖需要Claude引擎挂钩。

11张本轮英雄JPG与ART_PROMPTS均只读核对并实看，输入SHA在scratch/reference-manifest.json；未生成新参考图。预览helper没有修改生产patterns、模型、引擎、依赖、进度表或测试，也未提交。

原始命令/31源hash/图片hash记录：scratch/final-capture-report.json、baseline-bf-source-snapshot.json、baseline-bf-layout.json、review-delivery.json、final-network-report.json。

## 合入aa9后的正式battle更新

主分支aa9afd3已合入本树，实际捕获HEAD为 `193b08e9fdaf561a084bc1b47d314d751d48d6f4`。修改集中于battle demo / fx player / engine及工具异步步进；parts、patterns、cat3d、toon、renderer、pose、actor、looks等全员图依赖保持不变，21张全员/方向/前后图保留原字节与原BF来源，没有重拍63姿势。最终pattern源仍为3519b29b…。

现在的battle.png来自最新工具实际执行的12帧：step参数0.25s、startAt=0，使用 `__demo.advance` 等待步进微任务；选第4索引（按五次参数步进为1.25s）。这帧十猫均可见、没有大特效遮脸；没有降采样、调色或量化。948×593、497698 B，解码RGB的全部562164像素与原始latest-battle_04.png完全相同。BF旧battle及最新12个原帧均保留scratch。

```bash
PORT=5183 CHROME=/usr/bin/chromium node /workspace/three-review/patterns-heraldic/battle-shots-aa9.mjs "r3d=1&a=shu_liumiaobei,wei_xuhuang,qun_diaochan,shu_pangmiaotong,mob_wei_strategist&b=qun_lvbuding,mob_shu_guard,wu_luxun,man_shamoke,mob_qun_archer&theme=meadow&seed=2" /workspace/three-review/patterns-heraldic/latest-battle 0.25 12 0
```

最新tracked tools/battle-shots.mjs源SHA256：`394a20647b7b0791c9d3615d57727d6e7451b84a5e960ef1782c0c27178ac08c`；三处环境适配后的实际临时副本SHA256：`a0040860f956814fa900e91a222ebbfe41e7b46be6618c2f36c8e3c76930cc38`。临时副本保留最新advance流程，三个替换仍只涉及已有playwright执行路径、Chrome路径、PORT5183；未改仓库工具。

捕获前后33源文件SHA相同。pageerror为空，官方工具记录1条外部字体请求 `net::ERR_TUNNEL_CONNECTION_FAILED` console告警；battle.html未改变，既有网络观察的Google字体stylesheet URL与类型记录仍保留。未将console告警写成“0错误”。

最新33源/命令/步进/图hash记录：scratch/latest-battle-capture-report.json；22张最终图片hash记录：scratch/review-delivery.json。原final-capture-report与BF网络报告保留原捕获历史，不重标为新main验证。
