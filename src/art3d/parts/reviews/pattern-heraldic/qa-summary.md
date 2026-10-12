# 三类毛色独立 QA（待 Claude 审核）

建议可送审。只核对 `tabby / tuxedo / calico`；实际 21 使用者（11 英雄、10 杂兵），其中虎斑 11、燕尾服 6、三花 4。没有发现新增机械或视觉阻塞项。此结论是独立内审，未标为 Claude 通过。

最终 `patterns.ts` SHA256：`3519b29b5275329d4f3abe96205bd55fdb2884060c4979136a0c47ee231cf98b`。修改前后都使用 `bf37bd307e8669850af6cd5b502172ad7d7ab102` 的同一模型、toon、body、parts、相机和数据；C1 与旧 206 模型截图只留历史，未作为正式结果。

## 机械核对

| 项目 | 实际结果 |
| --- | --- |
| 活注册表 / canonical 使用者 | 21 个 ID 与 look 输入一致 |
| 目标纹理 | 42 个独立键，全部 256×256 CanvasTexture、sRGB、alpha=255 |
| 缓存与纯度 | 同键对象复用；head/body 分开；输入不变；两次全新浏览器上下文的目标 RGBA 哈希一致 |
| 实际贴图区域 | head 仅颅骨 638 顶点；body 为双小腿各 338 顶点及各可贴图尾球 130 顶点 |
| 烘焙材质 | 贴图材质和顶点色均白，最终材质缓存引用正确 |
| 模型 / 姿势 | 每版本 21 模型、63 姿势；几何指纹、姿势边界均前后完全相同，有限坐标全部通过；每模型仍 7 个合并网格 |
| 未改分支 | 22 保护项像素 / null 输出不变：5 位 point×2、其余 4 斑型单配色×2、solid/shaded null×2 |
| 正式截图 | 22 PNG 的哈希、尺寸、字节预算逐项核对；217 个原始 canvas 块 RGB 全等；最大 497,698 B，全部 ≤500,000 B |

源码在正式数值审计及 31 依赖姿势截图捕获前后均保持冻结；合入 aa 主分支后的新版 battle 捕获另冻结 33 份源码，独立逐份哈希复核一致。机械 pageErrors=[]；本审核没有重复运行项目测试，项目 `typecheck/test` 由根线程执行。

## 实看结论

实看 6 张原生纹理板、全部 21 猫×3 姿势的 w250 原始 canvas（250×219，角色高度随造型 / 姿势变化；实际战斗作为 190px 标准的参照）、全部 21 猫的正面 0° / 反侧 -32° / 背向 148°。另看正式前后对照与分类 PNG，旧 bf 战斗第 0/3/7/11 帧只留历史。合入 aa 主分支后又实看真实 10 猫新版战斗全部 12 帧，以及更新后的正式 `battle.png`（索引 4）。新版使用 `__demo.advance(.25)` 逐次推进，所选帧累计 5 次，名义参数和 1.25 秒，不冒称测得精确时钟。

- **虎斑**：额头 M 与渐尖颊纹可辨，后脑三道短纹及分段尾纹也可读。头盔 / 布巾会遮住部分 M；小腿裸露区受鞋和衣摆限制。尾球内纹按局部 z 等值线布置，共用此图的小腿呈侧弧纹，未把它误称腿轴环纹。
- **燕尾服**：鼻梁与下颌白区能接上口鼻读形，后脑保留 base。C2 的尾体留有明确 base 区域，仍可见少量白面与原引擎白尾尖；白爪 / 白绒领来自原有纯色，不能声称由本批贴图新增。
- **三花**：庞喵统、貂蝉与蜀弓的左右异色、非对称斑块可认，五官清楚。**最不满意处是群弓 `mob_qun_archer`**：原 `light` 为棕色，头盔又盖上额，190px 正脸三色差异偏弱，后脑深斑更明显；保留原配色并向 Claude 披露。

没有在已看视角发现明显连续 u 接边直线或极点异色扇片。原生左右边 RGB MAE 范围：虎斑 head 0.4023–0.6289 / body 0；燕尾服 head 0.3190–0.7721 / body 0.1602–0.3867；三花 head/body 0.0534–0.2656（0–255，所有行 p95=0）。少量接边行仍有像素差，所以不宣称严格像素无缝。球面正脸 u=.25，颅骨接边在 -x；小腿 Capsule 正前方却是 u=0/1。上下 v 边分别是不同极点 / 端盖，无 WORLD 四边周期要求。

## 已有边界与观察限制

吕布丁羽尖在 bf 与 C2 三姿势都到 y=3.662394，超过 FRAME.y1=3.6；边界前后完全一致。应写“0 新增裁切”，不能写“63 格全部不裁切”。

耳、颊绒、爪、袖、衣身、靴和部分尾段不采样 coatTexture。当前 bf 外耳仍 `toon(coat.base)`、内耳粉色，因此深色 point 耳 / 爪 / 尾尖不能仅靠本文件补齐，point 保持底版第 0 轮。尾球重复 UV，有限视图不保证所有动画角度或跨球接合都连续。

Google Fonts CSS 在 bf 和最终捕获均出现 `ERR_TUNNEL_CONNECTION_FAILED`；最终网络观察另有 favicon 404。没有 JS pageerror，毛色 CanvasTexture 正常生成；未修改网络或字体配置。

## 证据

- 数值报告：`audit-final-c2.json`；独立方法：`qa-method-notes.json`。
- 正式捕获 / 排版：`final-capture-report.json`、`review-delivery.json`；独立像素复核：`qa-preview-pixel-validation.json`。
- 审图目录：`src/art3d/parts/reviews/pattern-heraldic/`，优先看 `before-after.png`、`native-all21-idle.png`、各类三姿势 PNG、`rear-tuxedo.png` 和 `battle.png`。

已同步主分支 `aa9afd3270c839b3ba5aa72d2836dec3fe2d0f93`，工作树 HEAD `193b08e9fdaf561a084bc1b47d314d751d48d6f4`。独立复核机械报告所记录的 24 份模型 / toon / pose / actor / look 数据源码哈希全部未变，因此保留 bf 同依赖的 63 / 42 审计，不重复执行。

正式 `battle.png` 已替换为新版 `latest-battle_04.png` 的完整 RGB 无损编码：948×593，497,698 B，SHA256 `323c90f52c7f4864ab6ad49cd691b41fefb328d365f14e0c338931b34f795d31`。全部 12 新帧中的攻击 / 受击 / 临时文字特效下花纹稳定；正式帧脸部清楚。独立核对其余 21 张 PNG 字节哈希不变，新战斗与原帧 RGB 全等，22 图全部预算通过。旧 bf battle 原图、数值审计和姿势来源保留原标识，不重标为新主分支。

新增复核记录：`qa-main-sync-verification.json`、`latest-battle-capture-report.json`、`qa-preview-pixel-validation-aa9.json`。

冻结完成 UTC：2026-10-12T03:38:44.272459+00:00。独立审核只写 scratch，未改生产、提交或开 PR。
