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

## 冻结源码与当前引擎

当前交付固定在 `claude/awesome-babbage-ygba4h` 的 `e777d58f3b0e9965f7af25ded73948a84e68d219`，使用当前整颗头缩放、张嘴/眯眼表情和前举持握姿势。武器源码仍为同一 `7656746361b4…` 候选；当前九图全部重新捕获，不沿用旧引擎图作为本轮结果。

| 文件 | SHA-256 |
| --- | --- |
| `heroes.ts` | `7656746361b4bc97b70d28b4d7f2d256a5afaa5040e21057620cb58612c71e46` |
| 当前 `cat3d.ts` | `39b82bcb153baf7a1c0131fc39b1b42dccddce44d69a1724ccbcd04535a62aa4` |
| 当前 `pose.ts` | `3abe84b540c541d2637a36e7291c599d9b5a52318d4524662f122ce803e6431c` |
| 当前 `actor.ts` / POSES | `268bc636c0ea4271432c0b0428105e66c204cb6fb5c3739ccb7c0aabb38f238f` |
| `toon.ts` | `bcb0fcfb3a9011e43d4720e5f2ec6b87f6a931fd7ad31be72c277520968bb837` |
| 真实 e777 基线 `weapons.ts` | `513389ac1938782b32361ad2f2f8fcf673b04c8209145a4cdd9110564e66015a` |

维护者使用唯一临时模块路径和浏览器 SHA 哨兵重新运行独立审核方法。18 个相关源文件的前后 SHA 核对一致，完整列表见 [当前机器报告](current-e777/qa-summary.json) 的 `sourceSHAs`；正式拍图另有 `.shots/sp-weapons/current-e777/source-before.json / source-after.json`，两份相同。临时引用真实 skull / paw 几何用于只读检测，没有改几何、关节变换、材质或产品渲染。

## 当前交付图与真实装配

三 SP 行序为司马喵懿、庞喵统、嫦喵，每行 `idle / windup / strike` 从左到右。当前调试页显式调用 `buildCat3D(lookOf(id), id)`，正常 bake 与共享 Renderer3D；phase=0、t=.4。w=290 的原生单格为290×254，w=250 为250×219；没有以图片缩放模拟190px检查。

| 文件 | 内容 | 原生尺寸 | 字节数 |
| --- | --- | --- | ---: |
| [poses.png](current-e777/poses.png) | 三 SP 三姿势，yaw=32°，w=290 | 1000×796 | 267861 |
| [poses-190px.png](current-e777/poses-190px.png) | 同上，w=250，角色约190px | 1000×700 | 217507 |
| [front.png](current-e777/front.png) | 三 SP 三姿势，yaw=0°，w=250 | 1000×700 | 216230 |
| [reverse.png](current-e777/reverse.png) | 三 SP 三姿势，yaw=-32°，w=250 | 1000×700 | 218694 |
| [back.png](current-e777/back.png) | 三 SP 三姿势，yaw=148°，w=250 | 1000×700 | 177528 |
| [bow-probes.png](current-e777/bow-probes.png) | 庞统 thrust / castFwd / guard，yaw=32° | 1000×700 | 78833 |
| [family.png](current-e777/family.png) | 三专属及三位泛用使用者 idle，yaw=-32° | 1000×1360 | 168852 |
| [battle.webp](current-e777/battle.webp) | 真实十猫战斗，frame00 / t=3.25s | 948×593 | 405420 |
| [before-after.png](current-e777/before-after.png) | 同英雄左旧右新，正常 bake，idle / yaw32° | 530×836 | 112278 |

`family.png` 六行是 `wei_simamiyi / shu_zhugemiaoliang / shu_pangmiaotong / wu_sunxiangxiang / xian_changmiao / qun_huatuo`，展示三个专属和三个泛用 fan / bow / herbs 的真实装配。不同英雄的家族图不作为同英雄前后比较；[before-after.png](current-e777/before-after.png) 才是同英雄左真实基线 / 右候选，单格250×219、idle t=.4 / phase0 / yaw32°，正常 bake，没有 noBake 或材质替换。

七次 shots3d 与真实战斗十二帧已完成，页面脚本错误0。战斗从 `window.__demo.player.actors` 读取实际装配，10/10 actor 都有 `rig.cat3d`，三个 SP 各命中 `sp-simayi-seven-feather-fan / sp-pangtong-phoenix-bow / sp-changmiao-moon-laurel`。没有用省略 heroId 的 stock 构建代替专属验证。

战斗 A 阵容为三 SP、曹喵德、刘喵备；B 为诸葛喵亮、孙香香、华佗喵、吕布丁、沙摩柯。取十二帧中的 frame00，t=3+.25=3.25s，保留真实 HUD 与日志。实际装配见 [机器报告](current-e777/qa-summary.json) 的 `currentBattleRuntime`，原始截图和装配日志保留在 `.shots/sp-weapons/current-e777/`。外部 Google Fonts 请求失败后回退系统中文字体，产品名称和状态文字实际正常显示。

九张图都原尺寸无损、单文件小于500000 B：PNG重编码与 battle lossless WebP 对原图完整解码 RGBA 字节一致，差0，无裁切或缩放。各图 SHA、尺寸与字节数见机器报告的 `currentFigures`；临时 `figure-manifest.json` 同步记录。正常前后图也包含在九图中。

### 当前拍摄命令

临时 `.shots/sp-weapons/stable-vite.mjs` 使用5178端口、`hmr:false`，忽略 `.shots/**` 与 `parts/reviews/**`，不改产品文件。原图先输出到当前临时目录，再无损重编码到 `current-e777/`。

```bash
CHROME=/usr/bin/chromium PORT=5178 npm run shots3d -- .shots/sp-weapons/current-e777/poses.png 'ids=wei_simamiyi,shu_pangmiaotong,xian_changmiao&poses=idle,windup,strike&yaw=32&w=290'
CHROME=/usr/bin/chromium PORT=5178 npm run shots3d -- .shots/sp-weapons/current-e777/poses-190px.png 'ids=wei_simamiyi,shu_pangmiaotong,xian_changmiao&poses=idle,windup,strike&yaw=32&w=250'
CHROME=/usr/bin/chromium PORT=5178 npm run shots3d -- .shots/sp-weapons/current-e777/front.png 'ids=wei_simamiyi,shu_pangmiaotong,xian_changmiao&poses=idle,windup,strike&yaw=0&w=250'
CHROME=/usr/bin/chromium PORT=5178 npm run shots3d -- .shots/sp-weapons/current-e777/reverse.png 'ids=wei_simamiyi,shu_pangmiaotong,xian_changmiao&poses=idle,windup,strike&yaw=-32&w=250'
CHROME=/usr/bin/chromium PORT=5178 npm run shots3d -- .shots/sp-weapons/current-e777/back.png 'ids=wei_simamiyi,shu_pangmiaotong,xian_changmiao&poses=idle,windup,strike&yaw=148&w=250'
CHROME=/usr/bin/chromium PORT=5178 npm run shots3d -- .shots/sp-weapons/current-e777/bow-probes.png 'ids=shu_pangmiaotong&poses=thrust,castFwd,guard&yaw=32&w=250'
CHROME=/usr/bin/chromium PORT=5178 npm run shots3d -- .shots/sp-weapons/current-e777/family.png 'ids=wei_simamiyi,shu_zhugemiaoliang,shu_pangmiaotong,wu_sunxiangxiang,xian_changmiao,qun_huatuo&poses=idle&yaw=-32&w=250'
node .shots/sp-weapons/current-e777/battle-stable.mjs 'r3d=1&seed=2&theme=meadow&a=wei_simamiyi,shu_pangmiaotong,xian_changmiao,wei_caomiaode,shu_liumiaobei&b=shu_zhugemiaoliang,wu_sunxiangxiang,qun_huatuo,qun_lvbuding,man_shamoke' .shots/sp-weapons/current-e777/battle 0.25 12 3
```

`battle-stable.mjs` 沿用逐帧步进流程，仅设置 Chromium路径、端口并核对现有 actor 命名组。当前测试和实际命令的运行证据分别保留于 `.shots/sp-weapons/current-e777/tests.log / battle.log`；正常前后图由同引擎审核夹具拍摄。

## 当前验证与实际边界

固定 e777 下 `npm run typecheck && npm test` 退出0，**68文件 / 1019测试通过**。这是 e777 的实测记录；主分支随后日期修订的同步与合并后提交前复检由维护者另行记录，不把本次结果记成尚未运行的检查。源码候选 SHA 未变，没有新增依赖或产品测试。

| 武器 | 逻辑 Mesh（描边随父计1） | 含描边实际 Mesh | 最大分段 |
| --- | ---: | ---: | ---: |
| 七羽扇 | 24 | 34 | 16 |
| 凤羽弓 | 16 | 27 | 20 |
| 月桂药枝 | 23 | 36 | 12 |

每套独立构建三次，root不共享，position/rotation为0，scale为1，内部尺度均为正。Toon/outline材质复用缓存，没有每帧新对象或独立动画。

显式 id/look 覆盖当前全 **89位**，含77英雄/杂兵与12宠物：三个目标旧/新各命中1次，共6次；其余 **86位** 正常 bake 的属性名、TypedArray类型、itemSize、normalized、原始数组字节及index字节完全一致。不能把历史仅77位的范围当作当前全员结论。

[当前审核](current-e777/qa-summary.md) 和 [机器报告](current-e777/qa-summary.json) 保留三目标 ×〔14静态姿势 + idle/windup/strike各12时刻〕，共150例，yaw32° / phase0，静态t=.4，动画t=i×8/11。

- 实际 baked eye 核心三角12×12投影格点按具体sample ID差集比较：新增眼ID0，有效格点不一致0，最低有效数静态68 / 动画104。庞统 thrust 与 castFwd 各有30个原有保守眼深度命中，旧/新ID相同；当前guard为0。这些深度命中不直接等于可见像素。
- 原方法5个固定鼻口/口鼻点新增ID0；另对正常 bake 当前活跃 smile/mouthO骨所属真实表面三角做3×3投影depth采样，全部150例新增ID0、有效ID不一致0，每例至少4个有效点。动态嘴表面补充当前张嘴/微笑，未用固定旧嘴位置代替。
- 武器实体及展开描边出FRAME、新增整猫裁切、四侧裁幅增加、非有限顶点均0。FRAME为x=[-2.2,2.2]、y=[-.25,3.6]；整猫既有静态5 / 动画12例裁切保持旧/新相同。司马披风下沿最大下裁 .1119077，嫦喵victory冠顶上裁 .014626。

windup t=.4 下真实颅骨1120三角半空间和顶点检查，三目标旧/新右掌均336/336点位于后颅内部、左掌0。武器壳内顶点旧/新为司马5183/5477、庞统1446/4228、嫦喵4746/3964。不同网格密度的点数不代表穿插体积、严重程度或可见像素，更不能证明完整三角没有交叉。当前正常图片与面部采样没有新增眼鼻口遮挡，但不声称所有持握动作或武器与头完全无交叉。根、握段和既有姿势契约未改，细节见当前审核说明。

现有 `tests/art3d.test.ts` 调用 `buildCat3D(lookOf(id))`，没有传heroId，普通测试通过不能替代专属装配和真实战斗核验。以上均为有限姿势/时刻/采样结果，不是连续动画或逐像素光栅证明。

最不满意：strike七羽扇仍是窄斜面，190px下扇骨细节较弱；前举侧弓饰和月桂叶脉/月珠较小，主要识别仍靠金卷梢、宽叶、连枝和Y形留白。

## 历史记录

父目录原 [八张交付图说明与独立审核](qa-summary.md)、[原机器报告](qa-summary.json)、[原前后图](before-after.png) 及原三姿势/方向/家族/战斗图，来自 `aa9afd3 / e6e89a9`。随后 `fecef9e` 的 [复核](latest-engine-check.md)、[机器报告](latest-engine-check.json)、[家族图](family-latest.png) 与 [战斗图](battle-latest.webp) 也保留。这些文件均为历史，不删除、不作为当前 e777 引擎的交付证据；旧眼格点和装配覆盖数字只在对应历史报告中适用。当前交付统一使用上面的 `current-e777/` 链接。
