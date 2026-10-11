# 3D 小猫架构（Three.js）

| 模块 | 职责 |
| --- | --- |
| `src/art3d/toon.ts` | 卡通材质（四档色阶）、反向外壳描边（支持蒙皮）、顶点色合批材质 |
| `src/art3d/cat3d.ts` | `buildCat3D(look, heroId?)`：由 `CatLook` 生成真关节小猫（FK 骨骼：髋 → 躯干 → 脖 → 头 / 耳，肩 → 肘 → 爪，髋 → 膝，尾巴 7 节链）；`bakeCat` 把所有静态网格烘成几个 `SkinnedMesh`（每只 ~11 次绘制） |
| `src/art3d/parts/*` | 头饰 / 衣服 / 披挂 / 武器 / 配饰部件库（`PartBuilder`，注册表见 `parts/index.ts`）；`src/art3d/heroes.ts` 放英雄专属覆盖 |
| `src/art3d/patterns.ts` | 毛色花纹贴图（头 / 身两套） |
| `src/art3d/pose.ts` | 把战斗里的关节姿势（`POSES`：armR / armL / torso / head / legL / legR）映射到 3D 关节，叠加待机动画（呼吸 / 摆头 / 甩尾 / 耳朵抖动 / 眨眼） |
| `src/art3d/renderer.ts` | 共享离屏 WebGL 渲染器 + 正交相机 + 光色氛围（按场景主题） |
| `src/art3d/portrait.ts` | UI 立绘图（卡牌 / 头像 / 全身）：渲染一次转 webp 缓存 |
| `src/art3d/mode.ts` | 开关：`spriteMode.cat3d`（设置里「3D 猫猫」，默认开；没有 WebGL 时自动退回） |
| `src/fx/actor.ts` | `rig.cat3d` 存在时，`drawBody` 走 3D：套姿势 → 渲染到离屏 → `drawImage` 贴回战场；血条 / 特效 / 残影 / 闪白仍是 2D |
| `src/ui/live.ts` | 详情页动态立绘：3D 模式下盖一块实时 3D 画布，点一下挥手 |

**为什么不重写战斗回放**：`choreo` / `skills` 只通过 `POSES` 与锚点（`actor.anchor`）和猫交互；3D 猫提供同样的姿势入口和 3D 投影出来的锚点（头 / 胸 / 手），所以全部招式特效原样可用。

**性能**：软件渲染（SwiftShader）下 10 只猫同屏一帧 ≈ 8ms（未合批时 ≈ 200ms）。每帧 10 次 `render + drawImage`；新增部件不会增加绘制调用（合批后按材质合并），但会增加顶点数——单个部件控制在 24 个网格以内。

**调试**：`npm run dev` 后打开 `/cat3d.html?ids=…&poses=…`（或 `npm run shots3d`）；战斗里加 `?r3d=1` 看 `/battle.html`。
