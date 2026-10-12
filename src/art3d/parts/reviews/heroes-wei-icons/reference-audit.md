# 魏族 SSR 专属首三位 · 只读造型核对

精确资料快照：913334948c16a0f9a9bb899edc943fb86c322337；固定队列 blob 15f2c9a6be0d04f7250b479d50e724289387d5c9。只依据该提交的真实源码 / 提示词 / 参考图；本文件是 scratch，不是生产进度或 Claude 审核。三张 JPG 均已实际打开查看，完整源哈希见 [机器记录](reference-audit.json)。

## 使用者与配色

| 英雄 / ID | 实际体型与头 | 毛色 / 眼 | 原装束 | pal |
| --- | --- | --- | --- | --- |
| 夏侯墩 `wei_xiahoudun` | build1.14；head未指定→headK1、当前整头scale1.14；pointy耳/long尾 | tabby base#a58b72、light#e9dccb、stripe#6f5846；fierce眼#c9a23a | helmetWei / armorHeavy / cape / spear / eyepatch | main#3f63ad / sub#26397a / trim#e6c25a / cloth#e8edf7 |
| 许虎痴 `wei_xuhuchi` | build1.28；head未指定→headK1、当前整头scale1.14；round耳/bushy尾、blush=true | solid base#c9a574、light#f3e6c8；round眼#6a4a22 | tigerHood / armorLight / none / mace / 无extra | 同夏侯魏蓝 / 深蓝 / 金 / 浅布色 |
| 张喵辽 `wei_zhangliao` | build0.97；headK0.98、当前整头scale1.1172；pointy耳/stub尾；fluffy=false、blush=false | solid base#738a9e、light#dce5eb；keen眼#76a994 | helmetGeneral / armorWei / none / dualBlades / 无extra | main#3f63ad / sub#26397a / **trim#c0d0db** / cloth#e8edf7 |

三位均为魏 SSR；按 ILLUST_PROGRESS 的 SSR 顺序为夏侯→许虎→张辽，共3英雄、0杂兵目标。三位没有已批准2D立绘，本轮不恢复2D制作。默认粉色为#f4a6b0；未指定字段保留原数据，不用文字推测补数据。

## 实看武器轮廓

### 夏侯墩 · wei_xiahoudun

参考：[实际 JPG](../../../../../assets/heroes/ref/wei_xiahoudun.jpg)（768×1024 RGB）。源码英雄行 50，ART_PROMPTS 分别为23 / 28 / 38行。

实际 JPG 为细长棕木杆、冷白柳叶枪头、浅蓝枪面内脊、金色枪座及短蓝穗；正面长杆偏身体一侧。

保留长矛纵向细长剪影，枪尖为圆钝收尖的厚柳叶形，做清楚的双侧面和中脊。小金座与短蓝穗区别于普通锥头；握段穿掌心，杆和枪头连接连续。优先检查举矛时枪座/穗的外侧位置，不缩整根或漂移根物体来规避握持。

WEAPON.spear 当前为长2.2木pole和四边锥枪头，未有该SSR专属override。

不变成大月牙偃月刀、双叉戟或整根银色短剑；不加入血痕或眼伤表现。

故事与性格：拔矢啖睛的传说猫。据说他为了追一颗滚走的毛线球，把一只眼睛“弄丢”了——从此戴上眼罩，凶名远扬。其实眼罩下面什么都没发生。

台词：一只眼，足够看穿你的小心思！；喜好：毛线球、铁头功、被曹喵德摸头。

### 许虎痴 · wei_xuhuchi

参考：[实际 JPG](../../../../../assets/heroes/ref/wei_xuhuchi.jpg)（768×1024 RGB）。源码英雄行 72，ART_PROMPTS 分别为23 / 28 / 38行。

实际 JPG 为偏长卵形棕木棒头、两道金箍、乳白短骨齿，棕木柄中段有蓝色握带；体格大而表情圆润。

拉出纵向木棒头的重量感，圆钝短骨齿沿两侧少量交错分布，两道金箍留明显间距，蓝握带沿pal.main，骨齿用暖白自然材色。棕木颈与柄连续；与孟喵获的短卵木头/双骨箍区分。宽头不能遮虎帽或碰耳。

WEAPON.mace 当前为长1.2的木pole和半径0.2棕灰球，UR孟喵获已另有独立weapon override。

不做通用球头小锤；不复制孟喵获七齿短棒；不把整武器涂成白骨或做尖长血腥狼牙。

故事与性格：曹喵德的贴身护卫，体型是同龄猫的两倍。总觉得自己是一只老虎，因此常年戴着虎头帽。能一口气吃掉三十条小鱼干，然后把骨头整整齐齐码好。

台词：嗷——本虎在此！谁敢动主公的鱼干！；喜好：虎头帽、大骨头、被叫“老虎”。

### 张喵辽 · wei_zhangliao

参考：[实际 JPG](../../../../../assets/heroes/ref/wei_zhangliao.jpg)（768×1024 RGB）。源码英雄行 119，ART_PROMPTS 分别为23 / 28 / 38行。

实际 JPG 是两把宽短、略弯的冷银刀，内侧浅蓝刀脊、深蓝短握柄及银色护口；服装点缀也为银蓝。

两把短刀在190px下靠宽度和短弧形刀尖识别，刀面保持厚度与银白/冷蓝两面区分。短护口不做宽十字护手，保持魏蓝握柄与pal.trim银蓝收口；主手、真正offhand均保留掌心握段，刀身微向各自肩外侧。

WEAPON.dualBlades 已在#91通过，使用refinedBladeObj左右各一并设userData.offhand；本批应新增该英雄weapon override，保持通用版及其基线安全握段。

不变成刘喵备长直双剑或大号战斧；不把两把刀都挂在handR；不额外改helmetGeneral。

ART_PROMPTS 将军盔写红缨，实际 JPG 为蓝缨；只记录差异，本批weapon范围内不改帽。

故事与性格：逍遥津的桥口只够几条尾巴并肩，他偏能从中寻出路来。点兵时话不多，总把最窄的一段留给自己；同伴少了，脚步反而更利落。凯旋后众猫夸他胆大，他却认真纠正：桥不宽，喊得太响会把睡着的船夫吵醒。

台词：跟紧这一步。桥口虽窄，回家的路总要留着。；喜好：窄桥上的风、利落的双刃、安静点兵。

## 现有专属与挂接事实

基线 HERO_PARTS 只有6条UR：曹headgear caomaoCrown、刘weapon liubeiDualSwords、周headgear zhouyuCrown、吕weapon lvbuHalberd、孟weapon menghuoMace、左weapon zuociStaff。这三位SSR无条目；SP107由外部owner负责，未在本批引入其未合并源码。#118已在queue明确通过并合并，原进度表“待审”长段是提交历史；六条UR应保持。周喵瑜琴尚未实现，最新队列要求先不做。

真实cat3d attach优先按heroId命中HERO_PARTS[group]，再回退通用REGISTRY；weapon根挂handR，副手只由userData.offhand挂handL。主根保持掌心原点与identity transform；杆沿+y、刀面朝+z，不直接改手骨。双刀两件须都被QA枚举；预算<=24逻辑网格、球柱分段<=24，使用缓存toon/outline，物理描边数另外记录。

需由另外两位helper和root验证：三姿势190px、反向/侧视、真实十猫战斗、眼/耳/头清晰性、掌心握段、长杆连接、有限帧裁切与预算，及非目标UR/通用部件/全体用户/PET保护。baseline旧接触或裁切必须精确披露，不能把根/握段豁免扩大为全部武器无相交。当前尚无候选最终数据，不预填网格、截图、QA通过、测试通过或PR编号。

## 草稿

最小认领段落（私有历史模板 `drafts/ART3D_PROGRESS-claim.md`）保持制作中0；送审段落（私有历史模板 `drafts/ART3D_PROGRESS-ready.md`）仅为待审1模板，需要root提供实际源码hash/预算/正式图/QA/检查再定稿。旧全部历史保持，不以这些段落覆盖整表。

上述草稿为参考审计时的私有历史，未收入本PR；当前定稿见[最新进度](../../../../../docs/ART3D_PROGRESS.md)和[交付说明](README.md)。公开副本仅改链接，使参考图可在仓库打开；原文、出处与原SHA保持于冻结私有记录。
