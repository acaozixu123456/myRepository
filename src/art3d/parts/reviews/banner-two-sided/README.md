# 旌旗双面猫爪（第 1 轮待审）

旗布正面现在也能读出猫爪。仅在已批准 [PR #123](https://github.com/acaozixu123456/myRepository/pull/123) 的 `banner` 末尾新增五个 +z 浅浮雕网格；原背面五块爪纹、布、杆、金边、绑带、材质及 `scrollBack` 全部保持原字节。没有新增旗帜装备配置。当前 **banner 真实使用者 0**，下文所有旗帜图及边界探针均为明确标注的合成 factory 样例，无 heroId，无真实战斗旗帜命中声明。

本轮固定基线 `68e3f1d2c8af4337851eba52dca646c128eebc33`，分支 `codex/3d-banner-two-sided`。拍摄和作者自检均使用这份完整冻结引擎；后续主线世界任务未混入本轮照片。作者检查已完成，独立审核另由父线程安排。

## 布面贴合与原件保留

新增爪纹沿原 `flag(t,u)` 的同一曲布投影展开，读取实体布前层的真实 Float32 三角位置，用 XY 重心坐标求前表面 z，再加 `.002` 中心偏置与原浅浮雕深度；不是直接翻转旧爪坐标。球面顶点仍采用原十二分段、正尺度及原索引，重算法线后使用缓存 `toon(pal.trim)` 和 `.004` 正常描边。根位置/旋转为0、尺度为1，没有镜头或插槽补偿。几何仅在装配时建立。

删除新增代码块后，整个 helper 精确恢复批准版本 **8,319 字节**；新版 **10,040 字节**。24 个合成上下文中，原有 31 个本体/描边网格的全部 attribute/layout/index Uint8 字节、节点变换和材质对象身份都与原版一致。原五块背爪保留，正面新五块另行测量，不把新面接触结果推广为旧背爪的额外证明。

| 部件 | 原版逻辑 / 含描边 | 新版逻辑 / 含描边 | 最大分段 |
| --- | ---: | ---: | ---: |
| `banner` | 16 / 31 | **21 / 41** | **20** |
| `scrollBack` | 15 / 30 | 15 / 30（函数源码字节保持） | 20 |

本体与对应描边合算一个逻辑网格，21≤24。24 个上下文均验证新装配根独立、未预先挂父节点、材质缓存复用、全部尺度为正、没有反绕序、skirt/offhand 分根或每帧 builder 调用。

## 来源与实际范围

造型复用本项目 #123 已批准的自制程序几何；五块爪的布局、大小和 palette 来自该原件，新增的是贴到另一面的形变。没有新引入第三方模型、纹理、字体或生成图，不新增 CREDITS 条目，也没有为复制已批准项目几何另行生成或采购素材。原件来源和此前公开目录检查见 [BACK 原轮说明](../back-scroll-banner/README.md)。

实际 89 个显式 look/id（41 英雄、36 杂兵、12 宠物）全部重新正常装配。它们都是本次修改的非目标，**89/89 全部 geometry attribute/layout/index Uint8 字节与固定基线一致**；12 宠物的 body 仍为 none。背卷实际使用者张爪 `xian_zhangzhua` 和羽扇书童 `mob_shu_strategist` 同样包含在字节核对中。banner builder 的真实注册命中为0。没有把“零目标”写成实际用户装配成功。

## 冻结源码与照片

| 源码 / 证据 | SHA256 |
| --- | --- |
| `back.ts`（未改） | `2d5304b9263b3d7768251c55205cda732383fba4cdf8e2e107294509cd541961` |
| 新 `back-scroll-banner.ts` | `f5a80e6693464626d8744ecc5bc4662834c34d9671b5a19053461d8c81f6e631` |
| #123 原 helper | `78b4a124dd58da56c6cc6302fbf1625f9443f2075f3c07b6d8bd04fbc530b5d9` |
| 上述 registry→helper 原字节直接串接 | `5d3cc70201e536f732ce99bc0a7989326d3cfe18f57c85fff48801445e662c18` |
| 保持字节的 `scrollBack` 函数片段 | `efacfa2c36d0360e293269bc22fce6144c5ce9351c91ab775404d27c78da8799` |
| `cat3d.ts` | `e5dd83cb7077e4f5dd5516880bb6b9ea60df0dcbb6069294b1bb18979988f8e0` |
| `pose.ts` | `3abe84b540c541d2637a36e7291c599d9b5a52318d4524662f122ce803e6431c` |
| `fx/actor.ts` | `268bc636c0ea4271432c0b0428105e66c204cb6fb5c3739ccb7c0aabb38f238f` |
| `renderer.ts` | `ccc15c4a584e0f44c91bf7faa35beb15afe6e1d509890003a3d0b7a47120ac05` |

实际拍摄使用唯一 `/tmp/banner-two-sided-selfqa/snapshot-1791794508436-284014`，完整复制300个运行时 src 文件（含 actor/data/body/pose/renderer），所有相对 import 显式解析到同一副本；唯一模块 `/qa-1791794508436-284014.ts` 与 registry/helper/engine/pose/actor/renderer SHA 哨兵核验一致。Vite 5291 关闭 HMR。全部运行及拍摄前后300文件 SHA 相同。基线 helper 来自固定68的真实 `git show`，不是作者优化后的源码。

### 原生190px合成三姿势

合成上下文为六阵营 palette × build `.7 / 1 / 1.3`、head1尖耳，共18种；再加六 palette × build1/head1.12大耳，共24种。`PET-head1.12` 只是合成体型标签，并非实际宠物。各图从上到下魏/蜀/吴/群/蛮/仙，左到右 idle / windup / strike；phase=0、t=.4、正常 bake/Toon/outline、单格 **218×190原生像素**，四向共288格。所有17张最终图已逐张实际查看。

| 合成体型 | 正面0° | +32° | -32° | 背面148° |
| --- | --- | --- | --- | --- |
| build.7 / head1尖耳 | [正面](build-0p7_0.png) | [+32°](build-0p7_32.png) | [-32°](build-0p7_-32.png) | [背面](build-0p7_148.png) |
| build1 / head1尖耳 | [正面](build-1_0.png) | [+32°](build-1_32.png) | [-32°](build-1_-32.png) | [背面](build-1_148.png) |
| build1.3 / head1尖耳 | [正面](build-1p3_0.png) | [+32°](build-1p3_32.png) | [-32°](build-1p3_-32.png) | [背面](build-1p3_148.png) |
| build1 / head1.12大耳 | [正面](PET-head1p12_0.png) | [+32°](PET-head1p12_32.png) | [-32°](PET-head1p12_-32.png) | [背面](PET-head1p12_148.png) |

[旧新及两面布细节](before-after.png) 使用同一魏配色合成上下文。前四行旧左/新右，正常218×190、idle/.4、0/32/-32/148°；末两行分别前面和背面，来自900×788原生正常渲染的布面 ROI，旧新使用同一裁矩，无放大或重采样。正面现在可读猫爪；+32°旗布部分被原头部挡住，背面原爪及轮廓保持。正常影像与 full-triangle 实测共同确认新爪贴布，不把外描边接触当成实体连接。

最不满意的是190px下四趾很小，旗布的起伏也较轻，侧面浅浮雕感弱；本轮保留原旗布的软弧和比例，没有为了放大标志改动已批准原件。

## 作者自检与观测范围

最终 `npm run typecheck` 退出0，原生 `npm test` **80文件 / 1,102测试通过**、退出0。首次默认沙箱运行对 CLI 子进程 `spawnSync node` 报 EPERM；在允许的附加网络执行能力下，对同一冻结源码重跑全部测试后通过，没有改测试或依赖。最终日志 `.shots/banner-two-sided/tests-final.log`。

完整 **4,800 新旧配对**：24上下文 ×〔14真实 POSES ×4yaw + idle/windup/strike ×12时刻 ×4yaw〕；静态t=.4，动画t=i×8/11包含0与8，yaw=0/32/-32/148、phase0，dash使用moving:true。静态1,344、动画3,456，每组正常 bake 的实际 eye-core12×12、动态 active smile/mouthO3×3 与五鼻口点都按具体 sample ID 对比。物理裁剪只按全部 BACK→head/ear 相对矩阵缓存数值，键精度1e-10；不是只测一次静态后推广为动画。每组 FACE/FRAME 都实际重新计算。

- 正常眼有效集合完全相同，新增遮挡眼ID0，最低有效点静态95、动画112。动态 smile1,440组 / mouthO3,360组，实际嘴面有效ID最低4；旧新有效集合相同、新增遮挡嘴ID0。五鼻口点新增ID0。有限采样不是全部五官表面或所有连续时间的可见性证明。
- 所有旗本体及正常展开描边，以真实 skull1120、头部正常展开壳1120、muzzle560 完整三角的凸壳裁剪；两耳的实际外耳/内耳/毛簇/展开描边还逐组件完整 TRI-TRI 检查。颅壳/展开壳/口鼻/耳的内部三角及表面交叉均0，没有排除整旗或用名义球半径代替真实三角。
- 旗自身 FRAME 出框0、finite0、整猫新增出框0、四边裁幅增大0。旧版整猫已有大耳上沿出框 **264组（静态96 / 动画168）**，新版同数量同幅度，均来自六个 head1.12合成大耳上下文；四边最大裁幅旧/新均 `[0,0,0,0.05037611242197215]`。不能将这部分写成整猫0出框。
- 新五块爪的本体分别对真实536面封闭厚布做完整 TRI-TRI：24上下文共120块本体，每块有 **40～42个源三角**接触不透明实体布，包含240块本体/展开描边的背层224面交叉均0。原图案保留，不用 outline-only 连接。
- 对所有新本体及展开描边的每个完整三角，XY裁剪到真实后布三角单元，在每个裁剪多边形顶点求精确线性深度差（含退化投影）；最小后层余量 **0.006788294490105762**，全部为正。不是仅检查爪顶点而忽略三角穿布。

完整 [作者报告](author-report.json) 保存89实际逐ID字节结果、24预算、全部4,800样本ID/四边margin/有效眼口集合及逐网格碰撞三角记录。重复数据用身份字典和标准 zlib-base64 无损压缩，浮点不舍入；字段内含 schema、解码后JSON SHA与字节数。四份完整原始JSON仍留 `/tmp/banner-two-sided-selfqa/`，各路径/大小/SHA在报告登记，不提交大raw。解码方式为 Python `json.loads(zlib.decompress(base64.b64decode(field['data'])))`；再按样本 `measurementIndex` 和物理 `$dictionary/index` 解析。

夹具命令和逐图参数在报告登记；核心命令为 `node /tmp/banner-two-sided-selfqa/run.mjs full synthetic`，另跑完整 `grid-only.mjs` 保存具体有效眼ID，并跑 `front-contact.mjs / retention-depth.mjs / formal.mjs`。只读探针位于私有副本，产品引擎/data/pose/registry均未改。本报告是作者自检，不代替独立审核。离散phase0与这24种look不证明所有连续动画、未来服装或新增装备用户。

## 无损交付

17张PNG直接保留完整raw文件，像素尺寸与解码RGBA逐字节一致，差异0；没有调色、缩放、重新画图或交付裁切。对比图内四块布面ROI是在拍摄时从上述正常原生900×788源裁取，坐标已登记。全部单文件小于500000B，最大354419B。逐图raw/final SHA、RGBA核对、来源冻结SHA及拍摄上下文见报告，临时正式 manifest 为 `.shots/banner-two-sided/formal/manifest.json`。

| 文件 | 尺寸 | 字节 |
| --- | ---: | ---: |
| [before-after.png](before-after.png) | 676×1327 | 119254 |
| [build-0p7_0.png](build-0p7_0.png) | 676×1340 | 296676 |
| [build-0p7_32.png](build-0p7_32.png) | 676×1340 | 286038 |
| [build-0p7_-32.png](build-0p7_-32.png) | 676×1340 | 318943 |
| [build-0p7_148.png](build-0p7_148.png) | 676×1340 | 284033 |
| [build-1_0.png](build-1_0.png) | 676×1340 | 304519 |
| [build-1_32.png](build-1_32.png) | 676×1340 | 291240 |
| [build-1_-32.png](build-1_-32.png) | 676×1340 | 323907 |
| [build-1_148.png](build-1_148.png) | 676×1340 | 295956 |
| [build-1p3_0.png](build-1p3_0.png) | 676×1340 | 310478 |
| [build-1p3_32.png](build-1p3_32.png) | 676×1340 | 295992 |
| [build-1p3_-32.png](build-1p3_-32.png) | 676×1340 | 331758 |
| [build-1p3_148.png](build-1p3_148.png) | 676×1340 | 304198 |
| [PET-head1p12_0.png](PET-head1p12_0.png) | 676×1340 | 334418 |
| [PET-head1p12_32.png](PET-head1p12_32.png) | 676×1340 | 322899 |
| [PET-head1p12_-32.png](PET-head1p12_-32.png) | 676×1340 | 354419 |
| [PET-head1p12_148.png](PET-head1p12_148.png) | 676×1340 | 315341 |
