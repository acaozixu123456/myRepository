# 旗两面猫爪：独立 QA，第 1 轮待审

结论：在以下有限范围内可交 Claude 审核，无阻塞项；这不是 Claude 已通过。真实游戏中 `banner` 用户为 **0**，本批所有旗面正常图与姿态样本均为合成 context，不分配英雄 ID，不声称真实战斗出现旗或命中 builder。

- [逐样本、原始证据 SHA、技术结果](qa-summary.json)
- [独立正常 bake 旧新对照与布面细节](before-after-independent.png)
- [作者正常图和说明](README.md)

## 实际冻结与同步时间

独立采样固定 `68e3f1d2c8af4337851eba52dca646c128eebc33`，完整 **300 个产品 src** 复制到唯一私有快照 `/tmp/banner-two-sided-independent/snapshot-1791797230361-314862`；相对依赖、pose、actor、renderer 均在该副本内。Vite 5339，HMR 关闭，watcher 全忽略；浏览器实际 SHA 哨兵区分当前 registry、当前 helper 和 Git 原 helper。隔离 owned 几何时仅私有副本 noBake，正常眼、嘴、whole、官图复拍仍使用真实 catBake 与 Renderer3D。

- registry `back.ts`：`2d5304b9263b3d7768251c55205cda732383fba4cdf8e2e107294509cd541961`
- 当前 helper：`f5a80e6693464626d8744ecc5bc4662834c34d9671b5a19053461d8c81f6e631`
- Git 原 helper：`78b4a124dd58da56c6cc6302fbf1625f9443f2075f3c07b6d8bd04fbc530b5d9`
- 当前 cat：`e5dd83cb7077e4f5dd5516880bb6b9ea60df0dcbb6069294b1bb18979988f8e0`
- pose：`3abe84b540c541d2637a36e7291c599d9b5a52318d4524662f122ce803e6431c`

源码独立差分确认仅追加 27 行、1721 字节的五个前面猫爪 mesh，删除该块后恢复原 helper 8319 字节逐字节相同；`scroll` 函数字节相同。完整 300 src 在实际采样前后及 17 张重拍前后 SHA 相同，私有已插桩 302 源文件亦保持不变。父线程在全部采样结束后将工作树同步到 c569，为其后续真实 89 用户和 native 检查准备；此同步没有倒推改写本报告的 68 基线，也不把打包时新增主线源文件认作采样期间变动。具体后同步差分列在 JSON，后续主线结果由维护者另附。

## 真实 89 用户与 4800 合成样本

独立调用真实 `buildCat3D(look,id)` 的 41 英雄、36 小怪、12 PET：**89 个全部是非目标**，旧新完整 geometry attributes/index 的原 Uint8、类型、布局逐字节一致。真实旗 builder 命中为 0；目标计数为 0 时的空集断言不能当作真实旗已经接入。

合成边界独立 24 个：六阵营 palette × build .7/1/1.3、head 1、pointy ears 共 18；另六 palette × build 1/head 1.12/big ears 共 6。总计 **4800 旧新成对样本**：

- 1344 静态：24 × 14 姿态 × 四 yaw 0/32/-32/148，t=.4。
- 3456 动态：24 × idle/windup/strike × 12 时点（0..8，步长 8/11）× 四 yaw。

phase=0；dash 仅对应静态 moving=true，其余按正常参数。96 次合成 assembly 是 24 contexts × old/new × isolation/normal，不在 4800 pose 更新中重建。各 context 21 逻辑 mesh、41 含描边 physical mesh、最大 segments 20；unit root 未挂接、正 scale、有限值、无反绕序、toon/material cache 重用且 builder root 独立。无共享 mesh/root；未声称无限时间的 GPU 分配性能证明。

## 眼、嘴与真实实体几何

正常 baked eye 骨的有效 core triangle 上 12×12 样点，逐 **sample ID** 比旧新有效集和阻挡集，新阻挡 ID 为 0；有效数量并非只比较总数。另取真实白眼前面每眼 3×3 点，使用实际 skull 1120 面 front depth 分层，旧新有效 ID 与 skull-visible ID 完全一致，新增保守和可见阻挡 ID 均 0。白眼补充采样不是整个白眼像素逐点穷尽。

正常 active smile/mouthO 的 3×3 点新增 ID 为 0，有效集一致（最少 4 个）；mouthO 3360、smile 1440。五个实际鼻/活跃嘴/口鼻点坐标旧新相同，新增 ID 为 0。这五点也不是全脸每个表面的穷尽证明。所有逐样本数据在 JSON 的无损 zlib/base64 包中，解包内容 SHA 和大体积原报告 SHA 同时保留；未按三位小数抹掉 margin 或 ID 差异。

实体独立检查使用完整 owned 41 本体及正常描边三角，对实际 skull 1120、正常 expanded skull 1120、muzzle 560 的凸半空间完整裁剪；实际 outer/inner/tuft ear 和描边完整 TRI–TRI，包含共面/内部情况。耳 outer cone 父节点 local y=.22 纳入完整矩阵，未用名义 rho 或仅 inside vertex 代替。物理缓存键为未舍入的完整相对矩阵。owned 头/口鼻/耳实体及 shell 新接触 0，finite 与 owned FRAME 新增 0，runtime/page error 0。

**whole cat 的既有裁切诚实保留**：六个合成 big-ear context 旧新各 264 例（静态 96、动态 168），仅 ear；所有 4800 例四边精确 margin 数组旧新相同，最大顶部越界 `0.05037611242197215`。因此不能写整猫 FRAME/裁切全部为 0。

## 布面接合与后层穿透

另对 24 context 的 120 个新 primary paw 与 120 个正常 expanded-outline，独立提取源索引三角。布本体为真实不透明 MeshToonMaterial、opacity=1，闭合布共 536 TRI、后层 224 TRI。

每个 primary 实际与 **40–42 个 opaque 布主三角**接触，120/120 成立，不以描边碰布替代本体接合。240 个 primary/outline 与后布 224 三角交叉全部 0。完整每个新三角按 XY 裁到对应真实后布 cell，在线性深度的全部裁切多边形顶点、退化投影边界计算前后间隔；最小 rear signed-z clearance **0.006788294490105762**，不是仅顶点距离。该测试为每个 context 的 idle/.4/yaw0；旗与爪共父节点、相对 owned 形位固定，不额外声称任意未来布动画连续证明。

原 31 个 physical mesh 的 attributes/index 原字节、节点变换及材质对象 identity 在全部 24 context 旧新一致。旧背面 paw、卷纸、布面、旗杆、绑带没有因追加前 paw 改形；多 palette cache 亦核实。

## 正常图的实际独立查看

通过自己的固定源 Vite 和真实正常 Renderer3D 重新拍 **17 张**：四体型边界 × 四 yaw × 六 palette × idle/windup/strike，共 **288 个原生 218×190 格**；另八个旧新 190 格及四个前/后布细节。工具实际 view 了全部 17 张独立重拍图。独立完整 RGBA 与作者原始 PNG、交付 17 PNG 均为 0 差，未只读作者 self-report。

独立交付 `before-after-independent.png` 为 676×1327、119254 字节，SHA `498801afa296c22feffd16dc45075660bca2245c26c6eee73f93d107e4d6be74`。细节源是正常 900×788 原生 bake，yaw0 ROI `[650,169,141,204]`、yaw148 ROI `[80,169,120,204]`，未放大描线或替换布纹。其余独立 raw 留 `/tmp/banner-two-sided-independent/normal-retakes/`。

可接受限制／最不满意：0/-32 的正面金爪可辨，+32 大部被原头遮住；190 格中四小趾与浅浮雕较弱。背面原爪形位保持。此处接受深度遮挡与小尺寸细节，不虚称各视角都能看见完整猫爪。无真实战斗旗图，也未把合成图冒充已分配英雄。

## 原生检查与交付范围

读取作者固定 68 的原生日志 `.shots/banner-two-sided/tests-final.log`，SHA `5fc4aa51caa37db91dea40649c193cce4357a17f6585849b4abe6472b87cabf8`：80 files /1102 tests passed；作者 typecheck 退出 0。**不是本独立 reviewer 重跑产品测试**。维护者负责同步后 native 和真实 89 重检。

仅新增本目录 QA md/json/独立 PNG 三文件，每文件 <500000B；19 作者文件 SHA 保持、正常图不覆盖；不改 source、docs、metadata、progress，不 commit/push。全部原始 raw、私有脚本、完整三角/点记录的路径与 SHA 在 JSON。有限 samples 可交下一轮审核，不等同 Claude 已批准或所有连续状态已经证明。
