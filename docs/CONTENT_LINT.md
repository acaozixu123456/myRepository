# 内容文案检查

`npm run lint:content` 用已安装的 TypeScript 解析源码，递归扫描当前工作目录的 `src/content/**` 与 `src/data/**`。支持 TypeScript、JavaScript 及其 JSX、模块扩展名；不执行内容模块，不读注释中的“字符串”，不改写历史文案，也不新增依赖。

```sh
npm run lint:content
npm run lint:content -- --max-sentence-length 60
npm run lint:content -- --strict
npm run lint:content -- --strict --max=60
npm run lint:content -- --help
```

默认单句阈值为 50。参数接受正安全整数；`--max` 是 `--max-sentence-length` 的别名，两者都支持空格或等号传值。未知开关、缺值、零、负数、小数、非数值与不安全整数会拒绝执行。

默认报告警示并返回 0；`--strict` 有警示时返回 1，无警示时返回 0。参数错误、目录缺失或读取失败返回 2。帮助模式不扫描目录。入口在内存中编译工具，TypeScript 作为外部模块由 Node 正常加载，不产生构建文件。

## 规则与报告

每条报告给出相对文件路径、从 1 开始的源码行列、规则、文本及修改建议。长度按 Unicode 码点计算；源码列按 TypeScript 的 UTF-16 坐标计算。转义序列解码后检查，坐标仍指向原始源码，例如转义写出的“金币”定位到第一个反斜杠。

| 规则 | 判断方式 | 建议 |
| --- | --- | --- |
| sentence-length | 按“。！？”、英文“!?.”及换行拆句，数字间的小数点保留；不计句末标点和两端空白 | 超过阈值时拆短句 |
| english | 检查各英文词，只豁免精确词与合法技术上下文 | 用中文表述或核实技术用途 |
| violence | 检查“血、杀、死”，仅遮蔽明确白名单词中的对应字 | 改为睡着、生命等软萌表达，并人工复核 |
| terminology | 金币、钻石、怒气 | 分别统一为小鱼干、金铃铛、元气 |

显示英文白名单为 SR、SSR、UR、SP、HP、ATK、DEF、PVP、PVE、DOT、UP、Boss、Lv 及 Lv 后接数字，大小写不敏感。它只放行完整词，`helloSSR` 仍会报告。

战斗与非暴力常用词白名单为：击杀、斩杀、死亡、免死、濒死、血量、血条、血线、回血、满血、残血、低血、吸血、热血、心血。只遮蔽该词；“击杀后头破血流”仍会报告“血”。“流血、苍天已死、笑死”等现存写法保留警示，交 Claude 判断语境。

聊天占位符只识别已有的 `{me}`、`{stage}`、`{hero}`、`{hero2}`、`{faction}`、`{who}`，其中的变量名不当英文词检查。“hi @{me}”仍报告 hi。

## 技术白名单

豁免同时要求明确 AST 上下文与适合该用途的取值；不以“都是英文”或“没有汉字”作为放行依据。

- 导入、导出模块路径、类型字面量、索引类型与标识符形式的记录键。
- id、heroId、unit、item、setId、storyId 等引用字段及对应赋值，要求小写下划线标识或关卡数字格式；技术模板片段也沿用所在字段。
- 技能 fx 要求点分标识；计数器 key、perCounter 使用标识符格式。kind、t、c、on、ev、pick、side、who、elem、阵营、品质等使用源码内逐项列出的枚举。
- `to` 的 all/front/back、六阵营选择器与六职业选择器；未知“role:勇者”仍报告英文前缀。
- 色值只在 color、main、sub、trim、cloth、base、light、accent、stripe、pink 等色字段接受完整十六进制格式。美术枚举只在 look/outfit/coat/eye 或明确杂兵外观数据内豁免，覆盖当前实际款式。
- 技术变量与带明确枚举类型的表达式使用有限名单；SHOP_OFFERS 只把每个三元组第一个元素当道具 id，SHOP_CURRENCY 当货币映射。
- enemy/ally/status/counter/factionAllies/pal/S/quest 的指定第一个参数按各自 DSL 用途判断，其他名称和说明参数继续扫描。

name、desc、lore、quote、text、intro、bossNote、rule、flavor 等文案字段及 pieces/names/flavors/pieceFlavors 文案结构优先检查。同名 head/weapon 出现在装备风味表时不会继承立绘枚举豁免；纯英文或混合英文的文案也不会整段跳过。

报告末尾的 `scanned` 是访问的所有字符串及模板文本节点数，包含空片段和技术节点；`allowlisted` 只计整节点技术豁免。词级英文、战斗词与聊天占位符豁免不计作整节点豁免。报告还列出文件数和各规则警示数。

## 纯函数与验证

`tools/lint-content.ts` 导出：

- `lintSource(sourceText, filePath, { maxSentenceLength? })` → `{ findings, scanned, allowlisted }`。
- `resolveOptions(args)` → `{ maxSentenceLength, strict, help }`；非法参数抛错。
- `lintExitCode(findings, strict)` → 0 或 1。

每条 finding 包含 rule、message、text、line、column。英文、禁字和术语的 text 是命中的词；长度规则的 text 是超长句。

固定源码测试覆盖技术上下文、文案中的英文、句长边界、多句小传、Unicode、禁字局部豁免、术语、三种模板片段、插值中的字面量、转义源码位置、参数校验。真实 CLI 测试在临时双目录中验证默认/strict、阈值传递与非法参数退出码；帮助模式另已手动验收。

```sh
npm run typecheck && npm test
npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --strict --noUnusedLocals --noUnusedParameters --skipLibCheck tools/lint-content.ts tests/lint-content.test.ts
```

工具和测试另做严格类型检查，因为既有 tsconfig 的 include 没有包含此工具；本任务不修改配置或 CI。

## 当前历史警示

基线 e88de83：25 个文件、6389 个字符串片段、4001 个整节点技术豁免、126 条警示。其中句长 110、英文 6、禁字 10、术语 0。完整逐条位置和建议可直接运行命令查看；以下是待人工裁决的文字，本任务保留原文。

| 位置 | 文案及警示 |
| --- | --- |
| src/data/chatlines.ts:40:73 | hi @{me}，今天也要加油：hi |
| src/data/chatlines.ts:39:88、44:51 | 笑死：死 |
| src/data/heroes.ts:173:27 | 决一死战：死 |
| src/data/heroes.ts:514:16 | 苍天已死：死 |
| src/data/heroes.ts:581:13 | 熬死了三任主公：死 |
| src/data/heroes.ts:625:73 | 头破血流：血 |
| src/data/kits/remaining-man-xian.ts:165:19 | 苍天已死：死 |
| src/data/kits/ur.ts:56:28 | 誓同生死：死 |
| src/data/statuses.ts:25:68 | 流血状态说明：血 |
| src/data/systems.ts:17:45 | 专杀后排脆皮：杀 |
| src/data/units.ts:29:28、29:36 | 开发异常消息 unknown unit：unknown、unit |
| src/data/units.ts:39:20、39:28、39:32 | 开发异常消息 missing mob look：missing、mob、look |
| src/content/campaign.ts:56:16 等 | 关卡首领说明、技能机制说明中 110 句超过默认 50 字；由作者判断拆句或使用适当阈值 |

开发异常消息同样属于源码字符串，未以异常调用为理由整段放行；其警示不表示必须改成玩家文案。文字中的“死”等单字也不等于已经认定真实暴力，最终由 Claude 按语境评审。

这是静态片段检查。模板 Head/Middle/Tail 分别扫描，插值表达式里的字符串也扫描；不推测运行时插值内容，不合并多个字面量或动态 join 的结果，因此不保证拼接后完整句子的长度、跨节点英文词或术语均已检查。它不能判断角色是否 OOC、冷幽默是否自然，也不能替代类型检查和人工读稿。
