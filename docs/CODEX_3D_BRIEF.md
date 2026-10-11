# 3D 小猫外包说明（给 Codex 的长期工作单）

游戏的猫猫改成 **Three.js 程序化 3D 卡通小猫**（真关节，手臂与手天然相连）。
**Claude** 负责：渲染器、骨架 / 关节、姿势映射、战斗接入、性能、五官 / 耳朵 / 尾巴、画风基调、最终评审与合并。
**Codex（你）** 负责：把 41 只英雄 + 杂兵身上穿的、拿的、戴的**全部做成精致的 3D 部件**（头饰 19 种、衣服 11 种、披挂 9 种、武器 28 种、配饰 12 种、毛色花纹 8 种），再给 SP / UR 英雄做专属造型。
每个部件都是一个独立函数，互不影响，可以并行、小步提交。

## 0. 先读这些
- `AGENTS.md`：分支 / PR 规则、专有名词、文案红线（没有血腥）。
- `docs/ART3D_PROGRESS.md`：部件进度表（每轮更新）。「使用者」列告诉你这个部件是谁在用；先做高稀有度英雄用到的。
- `src/art3d/parts/types.ts`：**坐标与插槽约定**（必读，下面第 2 节是摘要）。
- `src/art3d/parts/*.ts`：现在的「底版」实现，认得出来但粗糙，你的工作就是把它们逐个换成精致版本。
- `src/art/types.ts`：`CatLook` / `Outfit` / `HeadGear` / `WeaponKind` 等契约（**不要改**）。每只猫穿什么用什么，以及配色（`pal.main/sub/trim/cloth`）都来自它。
- `assets/heroes/ref/<id>.jpg` 与 `docs/ART_PROMPTS.md`：每只猫的设定参考（配色、服装、武器类型）；3D 版保持同样的设定，不用照抄画风。
- 已有的 5 张 AI 立绘 `src/art/illust/*.full.webp`（曹喵德、刘喵备、庞喵统、司马喵懿、嫦喵）是**造型参考**：衣领、袖口、腰带、冠饰的样子可以参考它们，3D 里做成同样的设定。

## 1. 看效果
```
npm run dev                                     # 另开一个终端，默认 5173
npm run shots3d -- .shots/a.png "ids=wei_caomiaode,shu_guanyunmiao&poses=idle,windup,strike"
```
- 可用姿势：`idle ready windup windupLow strike thrust cast castUp castFwd guard hurt dash victory slump`，`yaw=32` 改朝向，`w=300` 改单格宽度。
- 战斗里的真实效果（10 只猫同屏、190px 高）才是最终标准：
  `node tools/battle-shots.mjs "r3d=1&a=<我方5只id>&b=<敌方5只id>" .shots/bt 0.25 12 3` （先开 `npm run dev`；这个脚本要给 chromium 加 `--use-angle=swiftshader --enable-unsafe-swiftshader` 才有 WebGL，已经加好了）。

## 2. 部件契约（摘要）
一个部件 = `(c: PartCtx) => THREE.Object3D`，在 `src/art3d/parts/<组>.ts` 的注册表里按种类 id 登记。
世界单位：猫总高约 3，颅骨半径 ≈0.62，脚底 y=0，面朝 +z，+x 是猫的左手边，+y 向上。

| 组 | 挂在哪个插槽 | 插槽原点 / 方向 |
| --- | --- | --- |
| `headgear` | `headTop` | 头顶中心，向上 +y 生长；头盔内径 ≈0.64，下沿可到 y≈-0.4（包住额头，**不能遮住眼睛**，眼睛在 y≈-0.45~-0.15 的 z 前方） |
| `body` | `torso` | 髋部原点；肩在 (±0.52, 1.0, 0)，脖子根 (0, 1.3, 0)，背面 z≈-0.45；袖子由手臂自带（颜色取 `pal.main`），衣服只做躯干 / 下摆 / 肩甲 / 腰带 |
| `back` | `back` | torso 内 (0, 0.95, -0.45)，向后 -z；披风、旗、翅膀、葫芦 |
| `weapon` | `handR`（掌心） | 杆沿 +y，刀面朝 +z，握把在原点；**双持**武器把第二件放到 `obj.userData.offhand`（会挂到左手） |
| `extra` | `head` | 头部局部坐标，脸朝 +z；眼罩、刀疤、胡须、铃铛、围巾 |

可用工具（`src/art3d/toon.ts`）：
- `toon(color)`：卡通材质（四档色阶，按颜色缓存）；`solid(geometry, material, outline)`：带反向外壳描边的网格（默认描边 0.028，小件用 0.01~0.02，五官 / 薄片用 0）。
- `sphere / capsule`；其余用 three 自带几何体（`LatheGeometry` 做袍子 / 盔 / 冠，`ExtrudeGeometry` 做刀 / 叶 / 旗，`TubeGeometry` 做飘带 / 弓）。

## 3. 质量标准（审核会看）
1. **剪影第一**：缩到 190px 高还能一眼认出是什么（青龙偃月刀的月牙刃、方天画戟的双月牙、羽扇的扇骨、冕旒的珠帘）。细节是加分，剪影是及格线。
2. **画风统一**：同一套卡通渲染（`toon` + `solid`），圆润、微夸张、Q 版比例；不要写实、不要尖锐的硬边；金属用冷白 + 一点高光色块表现，不要用 PBR 材质。
3. **配色来自 `PartCtx.pal`**：阵营主色 / 辅色 / 镶边 / 布料；同一阵营的猫看起来是一套的。头饰 / 武器的点缀色用 `pal.trim`。
4. **不穿模、不遮脸**：头饰不挡眼睛；武器贴着身体侧面，举起 / 挥动时不穿过头；披风不要盖住尾巴根部太多。
5. **性能预算**（10 只猫同屏，手机要跑）：一个部件 ≤ 24 个网格（含描边算 1 个）；球 / 圆柱分段 ≤ 24；**材质一律用 `toon()` / `outlineMat()` 缓存，不要在构建里 `new` 一堆材质**；不要在每帧里分配对象。
6. **只动 `src/art3d/parts/**`、`src/art3d/patterns.ts`、`src/art3d/heroes.ts` 与 `docs/ART3D_PROGRESS.md`**。不要改 `cat3d.ts / pose.ts / renderer.ts / toon.ts / parts/types.ts / parts/index.ts`（那是 Claude 的引擎）；需要改契约时在 PR 里提出。
7. `npm run typecheck && npm test` 必须通过（`tests/art3d.test.ts` 会检查：每个契约取值都有部件、全员能生成、包围盒在取景框内、网格数 < 420）。

## 4. 工作流（每一轮）
1. 在 `docs/ART3D_PROGRESS.md` 里挑状态为「返修」的优先，否则取下一批「底版」（顺序：武器 → 头饰 → 衣服 → 披挂 → 配饰 → 花纹 → 专属造型；同组按表中顺序）。
2. 一个 PR 做同一文件里的 3~6 个相关部件；分支名 `codex/3d-<组>-<简短英文>`，base 为 `claude/awesome-babbage-ygba4h`，PR 描述写 `Closes #…`（若有 issue）。
3. **PR 描述里贴图**：用 `shots3d` 截两张——① 这批部件在使用者身上的 `idle,windup,strike` 三个姿势；② 战斗里同屏的一张。写明：参考了什么、最不满意的一处。
4. 更新 `ART3D_PROGRESS.md` 里对应行：状态 `待审`，轮次 +1。
5. 等 Claude 审核：**通过**（合并、改状态）/ **返修**（编号清单，只改被点名的问题）/ **换思路**（连续 3 轮没解决，给新参考）。每个部件最多 4 轮，仍不过就写卡点跳过，别卡住队列。

## 5. 毛色花纹（`patterns.ts`）
`coatTexture(look)` 返回一张 256×256 的画布贴图，贴在头 / 手臂 / 小腿 / 尾巴的球面 UV 上（上方是头顶，中间是脸）。现在只有最简版，要做的是：虎斑（额头 M 纹 + 脸颊纹 + 尾巴环纹）、燕尾服（白胸 / 白爪 / 白口鼻）、三花、重点色（暹罗：脸、耳、爪、尾深色）、豹纹玫瑰斑、奶牛、玳瑁、蝶斑。**注意球面 UV 会拉伸**，在贴图上画时要考虑（可以在 `shots3d` 里直接看效果）。

## 6. 专属造型（`heroes.ts`）
`HERO_PARTS[heroId] = { weapon: (c) => …, headgear: (c) => … }`：只覆盖这只猫的某一组，契约同上。SP / UR 的招牌物件要有辨识度（关云喵的青龙偃月刀、吕布丁的方天画戟与雉尾冠、周喵瑜的古琴、诸葛喵亮的羽扇与纶巾、曹喵德的冕旒、嫦喵的灵草与莲冠、庞喵统的凤羽弓与花簪、司马喵懿的羽扇）。

## 7. 不要做的事
- 不要引入新依赖、不要加贴图文件（全部程序化生成）、不要改引擎文件。
- 不要为了「更精致」把网格数堆爆；精致靠造型与配色，不靠面数。
- 拿不准的地方（比如某个武器挥动时怎么摆）写在 PR 里问，不要硬猜。
