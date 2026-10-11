# 内容契约运行时守卫（Issue #57）

`tools/content-guards.ts` 提供只读、纯函数形式的 `unknown → 类型` 守卫，按当前 `src/content/types.ts` 与 `src/engine/types.ts` 实现。它不加载内容目录，不修补输入，不依赖 DOM、文件系统或新依赖，也不增加游戏入口。

```ts
import { isStageDef } from '../tools/content-guards';

function inspect(raw: unknown) {
  if (!isStageDef(raw)) return '关卡结构不符合契约';
  // 这里 raw 已收窄为 StageDef，无需 as 强转。
  return `${raw.name}：${raw.waves.length} 波`;
}
```

| 契约 | 导出守卫 | 嵌套检查 |
| --- | --- | --- |
| ItemDef | isItemDef | 品质、道具类型、可选 stack |
| StatBlock | isStatBlock | 10 个已声明属性的可选有限数值 |
| RewardDef | isRewardDef | 三种资源、items、equips、heroShards 的每条记录 |
| EquipDef | isEquipDef | 部位、品质、base、growth、可选 setId |
| EquipSetDef | isEquipSetDef | 可选阵营、两件/四件效果面板、四件 note |
| EnemySpawn / WaveDef | isEnemySpawn / isWaveDef | 词缀数组、每个敌人 |
| StageDef / ChapterDef | isStageDef / isChapterDef | 波次、两种奖励、剧情字段、规则与动作、焦点阵营、每关 |
| MobDef | isMobDef | 阵营、中文职业、倍率、说明与外观提示 |
| DialogueLine / StoryDef | isDialogueLine / isStoryDef | 表情联合类型、每句台词 |
| QuestDef | isQuestDef | 周期、目标 type/target、奖励 |
| GachaPoolDef | isGachaPoolDef | 池类型、阵营、三档 rates、pity、UP 列表、单抽/十连成本 |
| ShopItemDef | isShopItemDef | 商店类型、商品数量、价格、可选周限购 |
| RuleTo / RuleAct / RuleFx | isRuleTo / isRuleAct / isRuleFx | 精确选择器、8 种动作、16 种规则及所有声明字段 |

规则分支包括开场/整轮状态、开场护盾/元气、伤害/承伤/治疗倍率、首次治疗相关倍率、首次普攻元气、整轮最低元气、事件、预告、暴击/命中/闪避附加。所有规则都检查 `side` 与公共可选 `needFactions`。`on.act` 是一个动作对象；8 个动作分别是 energy、status、cleanse、removeStack、shield、heal、extend、totem。status 的 power/stacks/snapAtk、takenMul 的 needShield/needStatus、事件的每个筛选/限额字段和 telegraph.first 都检查，不只判断 t/k。

`RuleTo` 仅接受 all/front/back、六个精确 `faction:` 值和六个精确中文 `role:` 值。角色/阵营与规则/动作分支表使用当前类型约束；增加新规则或动作联合成员会令工具的分支表编译失败，提醒补齐校验。

守卫的边界是结构与有限数字：

- 所有已声明 number 字段拒绝 NaN、Infinity、-Infinity 和数值字符串。负数与小数不一律禁止，例如合法的元气扣减和附加属性修正。
- 对象类型要求非 null、非数组的对象。StatBlock 和 RewardDef 本来全为可选字段，因此空对象合法。
- 可选字段缺失或显式 undefined 合法，符合项目未启用 `exactOptionalPropertyTypes` 的现行 TypeScript 口径；存在其它值时必须符合声明类型，null 不能代替 undefined。
- 按 TypeScript 结构类型接受额外字段。只检查当前匹配联合分支声明的字段，例如 extend 没有声明 who；其额外 who 不改变结构合法性。额外字段即使是循环对象也不递归扫描。
- 数组逐个索引验证，稀疏洞会按 undefined 失败，不借助会跳过洞的 every 判断成员。合法的空数组继续接受，不自行添加最低波次/台词/敌人数。
- 不检查 id 格式与存在性、文本长度、站位整数/范围、正负数量/等级上限、概率和为一或其它曲线。它们继续由现有内容完整性测试负责；结构通过不等于数值设计或引用合法。

`tests/content-guards.test.ts` 以实际全部道具、装备、套装、关卡、章节、杂兵、剧情、任务、招募池、商品以及所有真实嵌套记录作为正例。另有覆盖全部联合分支与可选字段的固定完整样例：删除必填字段、替换每个深层原始类型、注入非有限数、错误联合值/记录/数组、稀疏成员和缺失动作字段均应失败；冻结输入和前后快照确认不修改原记录。

复算与门禁：

```sh
npx vitest run tests/content-guards.test.ts
npm run typecheck && npm test
npx tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --noUnusedLocals --noUnusedParameters --types node,vite/client tools/content-guards.ts tests/content-guards.test.ts
git diff --check
```

无需新增 package 脚本。当前 RuleFx 契约可以完整表达其结构检查，无需引擎或内容契约变更；未来若新增原语，需先读取新契约再补守卫与样例，不以强转放行。
