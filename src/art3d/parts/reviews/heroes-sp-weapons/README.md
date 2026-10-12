# SP 专属武器首批：司马喵懿 / 庞喵统 / 嫦喵

本批只在 `src/art3d/heroes.ts` 登记三个 `weapon` override。司马喵懿使用中央高、外羽短的冠形七羽扇；庞喵统使用金卷梢与红金小羽长弓；嫦喵使用有 Y 形负空间、两片宽主叶和节点月珠的月桂药枝。握段保留掌心原点，根位置 / 旋转为零、scale 为一。衣服、头饰、毛色、数据、姿势、引擎和通用部件保持基线。

## 参考与配色

以下六张均已实际查看，并核对 [ART_PROMPTS](../../../../../docs/ART_PROMPTS.md) 与三只英雄 lore：

| 使用者 / 武器 | 原 JPG | 已批准立绘 | 采用的造型 |
| --- | --- | --- | --- |
| `wei_simamiyi` / fan | [设定图](../../../../../assets/heroes/ref/wei_simamiyi.jpg) | [立绘](../../../../art/illust/wei_simamiyi.full.webp) | 米白七羽、深紫羽尖、金扇骨与圆扣；重排羽长 / 宽与扇面倾角 |
| `shu_pangmiaotong` / bow | [设定图](../../../../../assets/heroes/ref/shu_pangmiaotong.jpg) | [立绘](../../../../art/illust/shu_pangmiaotong.full.webp) | 暖棕细弓、红握带、金色卷梢；小红金羽饰承接背翼设定 |
| `xian_changmiao` / herbs | [设定图](../../../../../assets/heroes/ref/xian_changmiao.jpg) | [立绘](../../../../art/illust/xian_changmiao.full.webp) | 天然绿疏枝与宽叶；两颗月珠取自 lore，实际附着枝节点 |

| 使用者 | `pal.main / sub / trim / cloth` |
| --- | --- |
| 司马喵懿 | `#33284f / #1a1230 / #f2d36a / #e6dcf7` |
| 庞喵统 | `#d8442a / #8e1f18 / #ffd24a / #fff0d0` |
| 嫦喵 | `#8fb4ff / #5a78d0 / #fff1a8 / #f4f8ff` |

羽尖、握段、金饰、束带与月珠使用 `PartCtx.pal` 的缓存色；扇底米白、木弓与药叶保留通用武器的天然色。没有新增大火焰、凤凰头、浮空粒子或 emissive 材质。

弓的 local -y 梢在前举时会翻到脸前，因此该卷钩与小羽以半尺寸顺着木弓外弧贴附；另一梢保留完整卷形。木弓、弦槽和握点不变，两件实际贴弓，没有透明材质或姿势条件隐藏。月桂只有两片主叶加宽，其余四片短叶留出分叉空隙，月珠承担节点点缀。

## 冻结源码

基线为 `claude/awesome-babbage-ygba4h` 的 `aa9afd3270c839b3ba5aa72d2836dec3fe2d0f93`。所有正式图拍摄前后都核对同一组源码；旧候选图只保留在未提交的 `.shots/sp-weapons/obsolete-d0`，不作为交付图。

| 文件 | SHA-256 |
| --- | --- |
| `heroes.ts` | `7656746361b4bc97b70d28b4d7f2d256a5afaa5040e21057620cb58612c71e46` |
| 未改的 `cat3d.ts` | `06e44bc80ab32181fc5bc42149ab957fbff0ca4716392f9304620f8f98904e56` |
| 未改的 `pose.ts` | `4ebb282987092cbbd83fe2b35e5319be37d6346fa70bd9c9045270ab3685d265` |
| 未改的 `toon.ts` | `bcb0fcfb3a9011e43d4720e5f2ec6b87f6a931fd7ad31be72c277520968bb837` |

## 正式截图与真实装配

前三只的行序始终为司马喵懿、庞喵统、嫦喵；每行三姿势从左到右为 `idle / windup / strike`。调试页实际调用 `buildCat3D(lookOf(id), id)`，使用正常产品烘焙、共享渲染器和材质；冻结 `phase=0 / t=.4`。单格 `w=290` 为 290×254；紧凑检查 `w=250` 为 250×219，角色约 190px，图片没有缩放。

| 文件 | 内容 | 原生尺寸 | 字节数 |
| --- | --- | --- | --- |
| [poses.png](poses.png) | 三 SP 三姿势，yaw=32°，w=290 | 1000×796 | 238345 |
| [poses-190px.png](poses-190px.png) | 同上，w=250 | 1000×700 | 193115 |
| [front.png](front.png) | 三 SP 三姿势，yaw=0° | 1000×700 | 190594 |
| [reverse.png](reverse.png) | 三 SP 三姿势，yaw=-32° | 1000×700 | 194323 |
| [back.png](back.png) | 三 SP 三姿势，yaw=148° | 1000×700 | 162268 |
| [bow-probes.png](bow-probes.png) | 庞统 `thrust / castFwd / guard`，yaw=32° | 1000×700 | 69544 |
| [family.png](family.png) | 同类别使用者 idle，yaw=-32° | 1000×1360 | 146962 |
| [battle.webp](battle.webp) | 真实十猫战斗，frame00 / t=3.25s | 948×593 | 387378 |

`family.png` 六行依次是 `wei_simamiyi / shu_zhugemiaoliang / shu_pangmiaotong / wu_sunxiangxiang / xian_changmiao / qun_huatuo`：展示三套专属与三位泛用 fan / bow / herbs 使用者的真实造型。它比较不同英雄，不作同一英雄的前后对照。

独立审核见 [qa-summary.md](qa-summary.md) 与保留逐样本 ID 的 [qa-summary.json](qa-summary.json)；[before-after.png](before-after.png) 是同一英雄左基线 / 右候选的正常烘焙对照，由独立审核者拍摄。

七次 `shots3d` 与真实战斗十二帧全部完成，页面运行错误为 0。战斗页原有 Google Fonts 请求失败一次，采用系统中文字体；英雄名称和状态文字实际显示正常。

战斗通过 `window.__demo.player.actors` 核实 **10/10 个 actor 都有 `rig.cat3d`**，三个 SP 的实际 root 分别存在 `sp-simayi-seven-feather-fan / sp-pangtong-phoenix-bow / sp-changmiao-moon-laurel`。证据留在未提交的 `.shots/sp-weapons/battle-audit.json`，没有用不带 heroId 的 stock 构建假定专属已命中。战斗阵容 A 是三 SP、曹喵德、刘喵备；B 是诸葛喵亮、孙香香、华佗喵、吕布丁、沙摩柯。

所有 PNG 以 Pillow `optimize=True, compress_level=9` 无损重编码，编码前后完整解码 RGBA 字节相同。战斗 frame00 用 `lossless=True, quality=100, method=6` 转 WebP，与原 PNG 完整 RGBA 字节相同。八张交付图均 <500000 字节，没有裁切或缩放；原始战斗十二帧保留在 `.shots/sp-weapons/battle_00.png`～`battle_11.png`。

### 实际命令

临时 `.shots/sp-weapons/stable-vite.mjs` 在 5178 启动现有工程，`hmr:false`，忽略 `.shots/**` 与 `parts/reviews/**`；写审核文件不会刷新拍摄页面。所有脚本和夹具未提交，不改产品文件。

```bash
CHROME=/usr/bin/chromium PORT=5178 npm run shots3d -- src/art3d/parts/reviews/heroes-sp-weapons/poses.png 'ids=wei_simamiyi,shu_pangmiaotong,xian_changmiao&poses=idle,windup,strike&yaw=32&w=290'
CHROME=/usr/bin/chromium PORT=5178 npm run shots3d -- src/art3d/parts/reviews/heroes-sp-weapons/poses-190px.png 'ids=wei_simamiyi,shu_pangmiaotong,xian_changmiao&poses=idle,windup,strike&yaw=32&w=250'
CHROME=/usr/bin/chromium PORT=5178 npm run shots3d -- src/art3d/parts/reviews/heroes-sp-weapons/front.png 'ids=wei_simamiyi,shu_pangmiaotong,xian_changmiao&poses=idle,windup,strike&yaw=0&w=250'
CHROME=/usr/bin/chromium PORT=5178 npm run shots3d -- src/art3d/parts/reviews/heroes-sp-weapons/reverse.png 'ids=wei_simamiyi,shu_pangmiaotong,xian_changmiao&poses=idle,windup,strike&yaw=-32&w=250'
CHROME=/usr/bin/chromium PORT=5178 npm run shots3d -- src/art3d/parts/reviews/heroes-sp-weapons/back.png 'ids=wei_simamiyi,shu_pangmiaotong,xian_changmiao&poses=idle,windup,strike&yaw=148&w=250'
CHROME=/usr/bin/chromium PORT=5178 npm run shots3d -- src/art3d/parts/reviews/heroes-sp-weapons/bow-probes.png 'ids=shu_pangmiaotong&poses=thrust,castFwd,guard&yaw=32&w=250'
CHROME=/usr/bin/chromium PORT=5178 npm run shots3d -- src/art3d/parts/reviews/heroes-sp-weapons/family.png 'ids=wei_simamiyi,shu_zhugemiaoliang,shu_pangmiaotong,wu_sunxiangxiang,xian_changmiao,qun_huatuo&poses=idle&yaw=-32&w=250'
node .shots/sp-weapons/battle-stable.mjs 'r3d=1&seed=2&theme=meadow&a=wei_simamiyi,shu_pangmiaotong,xian_changmiao,wei_caomiaode,shu_liumiaobei&b=shu_zhugemiaoliang,wu_sunxiangxiang,qun_huatuo,qun_lvbuding,man_shamoke' .shots/sp-weapons/battle 0.25 12 3
```

`battle-stable.mjs` 沿用现有战斗步进拍摄流程，仅将 Chromium 路径设为 `/usr/bin/chromium`、端口设为 5178，并读取现有 actor 的实际装配名称；没有替换产品材质或姿势。所选第 00 帧时刻为 `3 + .25 = 3.25s`。

## 验证与实际边界

`aa9afd3` 上的 `npm run typecheck && npm test` 退出 0，**66 文件 / 987 测试通过**；合入最新主分支 `e6e89a9` 后再次通过，**67 文件 / 1011 测试**。该次主分支更新只涉及场景、文档与测试，`src/art3d / src/art / src/data / src/fx` 无变更；正式图与 QA 的冻结源码及相关引擎 SHA 不变。`git diff --check` 通过。

| 武器 | 逻辑网格 | 描边子 Mesh | 烘焙前实际 Mesh | 最大分段 |
| --- | --- | --- | --- | --- |
| 七羽扇 | 24 | 10 | 34 | sphere12×9 / cylinder10 / Tube16×8 |
| 凤羽弓 | 16 | 11 | 27 | cylinder12 / Tube20×8 |
| 月桂药枝 | 23 | 13 | 36 | sphere12×9 / cylinder10 / Tube10×8 |

预算按 BRIEF 的“带描边算 1 个”。每套直接构建三次，独立 root、零根变换、单位 scale，材质实例全部复用。负行列式 Mesh / 反向绕序均为 0；没有新增依赖、每帧对象分配或独立动画。

作者 CPU 自查显式三个 heroId 命中，14 姿势 × yaw0/-32/32/148，旧新各 168 组合全部有限；真实蒙皮顶点 FRAME 没有新增或加重越界。74 个非目标英雄 / 杂兵签名、77 个 stock 装配签名全部相同。完整临时报告为 `/tmp/sp-selfcheck-7656746361b4/sp-source-selfcheck-summary.json`。

独立 fresh 源码快照检查三 SP ×（14 静态姿势 + 三姿势各 12 个动画时刻，t=0～8s），共 150 例：新增眼部样本 ID、鼻口样本 ID、裁切增幅、非有限坐标均为 0；每眼至少 110 个真实眼芯三角有效样本。基线的庞统 `thrust / castFwd / guard` 仍分别有 25 / 19 / 29 个旧眼样本遮挡，`thrust` 的一个旧鼻样本也保持一致。另按显式 heroId 覆盖全部 77 单位，三个 SP 命中、74 非目标几何属性和索引字节相同。这些结论对应有限姿势、时刻、方向与采样。

现有 `tests/art3d.test.ts:36` 调用 `buildCat3D(lookOf(id))`，没有传 heroId，普通测试通过不能代替上述专属装配与实际战斗核验。

既有空间边界：windup 的掌心及握段进入后颅体积，正常截图主要是头后遮挡；既有 cast 类、guard、victory 也有持握交叠。司马 `strike / thrust / hurt / dash` 的下身旧裁切四方向共 16 组保持原幅度；嫦喵 `victory` 冠顶四方向共 4 组旧裁切也保持原幅度。未通过修改姿势或 FRAME 掩盖这些旧问题。

最不满意：七羽扇在 strike 的斜侧方向仍偏薄，190px 下扇骨细节较弱；低梢小金羽贴弓后细节较小，主识别由完整金卷梢承担。月桂的节点珠在 190px 下只有少量像素，实际识别主要靠宽叶、连枝与 Y 形留白。
