# EXTRA 第 2 批：主线 bb73 补充独立 QA

补查通过。当前基线为 `bb73f1f95e91165fe1c38e3f07cf2b80b42d8392`，已含司马、庞统、嫦喵三位 SP 专属武器。注册表 `4c388b7e…`、helper `e9dcbe48…`、直接连接 SHA `a9600d2a…` 与原 main60 冻结源逐字节相同。原 [main60 QA](qa-summary.md)、[完整证据](qa-summary.json)和[前后对照](before-after.png)保持原 SHA，不替换成新主线结果。

[本次机器证据](qa-post-main.json)登记完整源码哈希、真实几何字节矩阵、89 用户、新三 SP 眼/嘴 ID 集合、正常 WebGL、真实战斗/HUD/PET及截图核验。原 6,608 全量/眨眼和168耳峰样本仍明确固定 main60；这里没有声称在 bb 重跑它们。

## 真正变化与复用范围

用两个独立不可变运行时快照，直接生成14位目标的正常 bake 猫，逐 Uint8 比较全部 mesh attribute/index 以及 typed-array header：**仅 wei_simamiyi、shu_pangmiaotong、xian_changmiao 整体几何变化，其余11位完全相同**；14位实际 look 的完整 JSON 都相同。猫核心、pose、Actor、Renderer、两 EXTRA 源完全同 SHA。当前三 SP builder 是 `heroes.ts` 中实际内联函数，源码 SHA为 `a85d34ff15a1fdf0c308414648c4b8ef907ea8da5c46b2d6fe161cafcfc16d98`，没有假称来自不存在的新 helper 文件。

因此原 main60 的严格头本体/展开壳/口鼻/耳完整三角形、薄贴肤层、detail=.6 odd拓扑与安装触点证据保留使用；三 SP 新武器可能改变正常面前遮挡和战斗画布，下面实际重查该范围。

## 新主线独立检查

完整 **282** 运行时源码/数据文件复制到新的唯一快照，canonical import 全部固定同一树；浏览器核注册表/helper/猫/pose/Actor/Renderer SHA sentinel，282文件前后相同。没有读取作者自检计数代替独立构建。

- 战斗 detail=1 与世界 detail=.6：各 **89**实际 heroId，14目标3/7/4对应注册函数各命中一次，75非目标全部attribute/index Uint8字节相同；含12宠物、11非目标宠物、所有宠物body仍none。
- 两档各 **168**：3 SP ×14姿势 ×0/+32/−32/148 yaw，t=.4、phase0。实际 normal bake 后眼核心12×12、完整正面白眼外围三角形质心、当前笑嘴/张嘴3×3，以及5个实际鼻嘴点均无新增被挡ID，旧新有效ID集合精确相同。最低眼有效62、当前嘴最低4；张嘴132/笑嘴36每档。额外得到的新三 SP owned head/shell/muzzle/眼耳嘴物理意外交叉也是0。
- owned FRAME、新whole越界、旧新margin增加、nonfinite均0；三SP整猫只有4个继承的嫦喵 victory `headTop` 越框样本，margin与基线同。不能把这个子集的4替代原14目标全量的304。
- **336** 正常原生217×190 WebGL：3 SP ×旧新 ×14姿势 ×4yaw，每例读取实际alpha bounds和边缘，全部非空且使用skinned正常猫。另实际看过当前4yaw/3姿势SP正式190图、新30格旧新对照、真实战斗/PET；细光弧依旧在外眼角，未见新的白眼覆盖。

JSON 的 `fresh3SPCaseEvidence` 是标准 zlib+base64 无损 JSON，完整保留336样本键、左右核心眼/外围白眼/当前嘴的有效与被挡 ID、实际5点坐标和精确FRAME margins；每例已与raw核对且无舍入。全物理/坐标raw另留忽略目录，登记bytes和SHA。

## 新真实战斗/HUD/PET

同一个 frozen282src，真实 demo → simulate → Player → Scene → Actor，10位目标英雄，12帧每.5秒，加真实灰灰事件。**11新builder真命中、519次有效且未lost的GL、504次舞台绘制、15次闪白离屏、710次实际HUD文本、50次Scene.draw**；stage alpha bounds使用当时真实Canvas transform逐次测量，四向crop0。观测shakeMag最高3，实际偏移绝对值最高x=2.5475004579405436/y=1.6748922032638234，无强设震动。

灰灰由 `Player.petActors.get('A')` 持有，真实uid−1、alpha=.888888888888911、head scale1.2768、正常skinned4；出场及真实跳跃四次alpha bounds均在舞台内，最靠左x=18.539130434782614。没有插入假Actor/事件、强设alpha或2D fallback。pageErrors/failedRequests均0。有限观察不能保证所有战斗混合姿势/相机组合。

作者当前 bb 原生测试日志 `.shots/extras-sp-marks/tests-main-bb.log` 实际 **75文件/1068测试通过**；typecheck为作者报告的required退出0，本补查不虚称重复运行了单元测试。当前最终21张正常官图、12张战斗及3张PET共36文件，独立逐张解码RGBA与fresh bb原PNG比较均逐字节相同，最大480,011B。各原稿/成品SHA和尺寸已登记本次JSON；原main60三QA文件保持不动。
