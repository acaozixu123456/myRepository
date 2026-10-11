# 技能展示一致性检查（Issue #56）

运行 `npm run lint:skills` 检查当前仓库的 `HEROES`、`SKILLS` 和 `KITS`，不生成文件、不改技能或战斗数值。runner 使用现有 esbuild 在内存打包，并从自身位置读取真实 `src/data/skills.ts`；从其他工作目录调用绝对路径 runner 也能复算。

```sh
npm run lint:skills
npm run lint:skills -- --strict
npm run lint:skills -- --json
node tools/run-skill-consistency.mjs --strict --json
```

默认模式遇到结构错误或 `FROM_KIT` 文本差异退出 1；旧手写摘要的差异列为 `review`，默认退出 0，`--strict` 将这些待审核差异也作为退出 1 的条件。`--json` 输出完整展示原文、期望原文、英雄 id、字段路径及展示源码行列；普通报告将长文本预览截至 180 个 UTF-16 码元。非法参数或加载失败退出 2；`--help` / `-h` 显示用法。

## 检查范围

- 英雄 id 唯一，`SKILLS` / `KITS` / 可确认的展示来源各自覆盖全部英雄，没有陌生条目。
- 每猫展示恰有 `basic`、`ultimate`、`passive`、`awaken` 四种技能，各一次；名字和描述非空白。战斗组三技能 id 全表唯一，注册键与 `kit.heroId` 相同。
- 绝技升级依次且仅有 Lv3、Lv6、Lv9，升级描述非空白；觉醒 A/B 均存在且名字、描述非空白。
- TypeScript AST 确认 `SKILLS` 属性的实际来源，捕获源码重复键和错误的 `FROM_KIT` 英雄引用。未知生成方式、展开项和未登记手写来源会报错，不能自动当作旧摘要豁免。

`FROM_KIT` 的字符串按当前真实格式逐字比较，保留全部空格、标点和数字。只在检测空字段时使用 `trim()`，比较不归一空白。

| 字段 | 当前拼接格式 |
|---|---|
| 普攻 / 被动 name、desc | 直接取对应 KITS 字段 |
| 绝技 name | 直接取 `kit.ultimate.name` |
| 绝技 desc | 基础描述后依 levelMods 顺序拼接 `【等级级】描述`，各段之间一个空格 |
| 觉醒 name | `A.name / B.name` |
| 觉醒 desc | `路线甲「A.name」：A.desc 路线乙「B.name」：B.desc` |

普攻、被动没有额外升级拼接规则。target、tags、FX、patch/effects 的执行语义不属于本工具的文本一致性检查；即使展示与 KITS 完全相同，也仍需 Claude 评审它们是否准确描述战斗行为。

## 当前基线与待审核摘要

基于主线 `92646fc`：27 英雄、108 条展示技能、27 个战斗技能组。21 只通过 `FROM_KIT`，结构及文本错误为 **0**。以下六只旧 UR 使用手写数组，存在 **30** 个待审核字段差异；每猫各 5 项，均为 `basic.desc`、`ultimate.desc`、`passive.desc`、`awaken.name`、`awaken.desc`。

| 英雄 id | 猫猫 |
|---|---|
| wei_caomiaode | 曹喵德 |
| shu_liumiaobei | 刘喵备 |
| wu_zhoumiaoyu | 周喵瑜 |
| qun_lvbuding | 吕布丁 |
| man_mengmiaohuo | 孟喵获 |
| xian_zuoci | 左慈喵 |

仅这六个 id 的实际手写数组来源可以列为 `review`；不是按 UR 稀有度或 `KITS_UR` 白名单跳过检查。它们仍须满足全部结构检查；若改为 `FROM_KIT`，文本差异即恢复 `error`。旧绝技摘要缺升级拼接，旧单条觉醒与战斗组的双路线也不能简单一一对应。报告列出原文供 Claude 决定展示改法，不自动改数据，不把自然语言差异推断为战斗实现错误。

## 验证

固定 fixture 分别检验丢 Lv6、改百分比 / 升级数字、丢路线 B / 名称、交换路线标签、内部空格、尾随空格、重复 kind、缺 / 多英雄、重复战斗技能 id、错误升级次序、旧摘要的空字段与缺路线、未登记来源及源码覆盖。真实 CLI 验证普通报告、JSON、严格退出、帮助、非法参数和外部工作目录；测试不固定未来的英雄总数。

```sh
npm run typecheck && npm test
npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler \
  --strict --noUnusedLocals --noUnusedParameters --skipLibCheck \
  --types node,vitest/globals tools/skill-consistency.ts tests/skill-consistency.test.ts
git diff --check
```

本次门禁通过：`typecheck`、34 个测试文件共 431 项（新增 35 项）、新工具及测试的独立 strict / noUnused 检查、diff 检查。真实 CLI 当前默认退出 0，严格模式退出 1，JSON 报告为 0 error / 30 review。
