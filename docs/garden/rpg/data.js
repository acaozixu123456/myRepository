// 游戏内容：职业、技能、怪物、地图、道具、任务。全部原创。

// 属性相克：草克水，水克火，火克草
export const ELEMENTS = { none: '无', grass: '草', water: '水', fire: '火' };
export const BEATS = { grass: 'water', water: 'fire', fire: 'grass' };
export const EL_ICON = { none: '⚪', grass: '🍃', water: '💧', fire: '🔥' };

// 技能。kind: phys 物理 / magic 法术 / heal 治疗 / buff 增益 / debuff 减益
// target: one 单体敌人 / all 全体敌人 / ally 我方一人（自动选血最少的）/ party 我方全体
export const SKILLS = {
  // 影爪（猫）
  doubleClaw: { name: '连爪', mp: 4, kind: 'phys', target: 'one', power: 0.75, hits: 2, desc: '快速抓两下。' },
  rend:       { name: '破甲', mp: 6, kind: 'phys', target: 'one', power: 1.1, effect: { type: 'defDown', turns: 3 }, desc: '造成伤害并让对方防御下降三回合。' },
  whirl:      { name: '旋风扫', mp: 10, kind: 'phys', target: 'all', power: 0.9, desc: '攻击所有敌人。' },
  critical:   { name: '会心一击', mp: 14, kind: 'phys', target: 'one', power: 2.3, desc: '蓄力后的全力一击。' },
  // 灵火（狐）
  spark:      { name: '火花', mp: 4, kind: 'magic', el: 'fire', target: 'one', power: 1.45, desc: '一小团狐火。' },
  flameRing:  { name: '烈焰环', mp: 10, kind: 'magic', el: 'fire', target: 'all', power: 1.0, desc: '火环扫过所有敌人。' },
  scorch:     { name: '灼烧', mp: 8, kind: 'magic', el: 'fire', target: 'one', power: 0.9, effect: { type: 'burn', turns: 3 }, desc: '点燃对方，持续三回合。' },
  meteor:     { name: '狐火流星', mp: 18, kind: 'magic', el: 'fire', target: 'one', power: 2.6, desc: '从天而降的大火球。' },
  // 月愈（兔）
  moonlight:  { name: '月光', mp: 5, kind: 'heal', target: 'ally', power: 1.6, desc: '为血量最少的同伴疗伤。' },
  waterShot:  { name: '水弹', mp: 4, kind: 'magic', el: 'water', target: 'one', power: 1.35, desc: '凝出一颗水弹打出去。' },
  ward:       { name: '护佑', mp: 8, kind: 'buff', target: 'party', effect: { type: 'defUp', turns: 3 }, desc: '我方全体防御上升三回合。' },
  fullMoon:   { name: '满月', mp: 16, kind: 'heal', target: 'party', power: 1.3, desc: '治疗我方全体。' },
  tide:       { name: '潮涌', mp: 12, kind: 'magic', el: 'water', target: 'all', power: 1.05, desc: '一道浪打向所有敌人。' },
  // 怪物和伙伴用的
  tackle:     { name: '冲撞', mp: 0, kind: 'phys', target: 'one', power: 1.2 },
  leafCut:    { name: '飞叶', mp: 3, kind: 'magic', el: 'grass', target: 'one', power: 1.35 },
  bubble:     { name: '水泡', mp: 3, kind: 'magic', el: 'water', target: 'one', power: 1.35 },
  ember:      { name: '火星', mp: 3, kind: 'magic', el: 'fire', target: 'one', power: 1.35 },
  roar:       { name: '怒吼', mp: 5, kind: 'debuff', target: 'all', effect: { type: 'defDown', turns: 3 } },
  stomp:      { name: '震地', mp: 6, kind: 'phys', target: 'all', power: 0.95 },
  nap:        { name: '打盹', mp: 4, kind: 'heal', target: 'self', power: 1.2 },
};

// 职业。grow: 每级自动成长；另有 3 点自由点
export const CLASSES = {
  cat:    { name: '影爪', model: 'x:cat', scale: 2.0, icon: '🐱', blurb: '动作快、出手重，靠爪子说话。', base: { str: 6, vit: 5, int: 2, agi: 6 }, grow: { str: 1.2, vit: 0.8, int: 0.2, agi: 0.8 }, skills: [[1, 'doubleClaw'], [5, 'rend'], [10, 'whirl'], [16, 'critical']] },
  fox:    { name: '灵火', model: 'x:fox', scale: 1.9, icon: '🦊', blurb: '操纵狐火的法师，怕被近身。', base: { str: 2, vit: 4, int: 8, agi: 5 }, grow: { str: 0.2, vit: 0.6, int: 1.4, agi: 0.8 }, skills: [[1, 'spark'], [6, 'flameRing'], [11, 'scorch'], [17, 'meteor']] },
  rabbit: { name: '月愈', model: 'x:rabbit', scale: 2.0, icon: '🐰', blurb: '会疗伤也会水法，打得慢但很稳。', base: { str: 3, vit: 6, int: 7, agi: 3 }, grow: { str: 0.3, vit: 1.0, int: 1.2, agi: 0.5 }, skills: [[1, 'waterShot'], [2, 'moonlight'], [8, 'ward'], [13, 'tide'], [15, 'fullMoon']] },
};
export const ATTR_NAME = { str: '力量', vit: '体质', int: '灵力', agi: '敏捷' };
export const ATTR_DESC = { str: '提高物理伤害', vit: '提高生命和防御', int: '提高法术、治疗和灵气上限', agi: '提高出手速度和闪避' };

// 怪物。数值倍率相对同级标准值；tint 给方块模型换色
export const MONSTERS = {
  chirp:   { name: '啾啾团', model: 'animal-chick', el: 'none', hp: 0.8, atk: 0.8, def: 0.7, spd: 1.2, skill: null, desc: '圆滚滚的小鸟，看见什么都想啄一下。' },
  mudpig:  { name: '泥泥猪', model: 'animal-pig', el: 'grass', hp: 1.2, atk: 0.9, def: 1.0, spd: 0.7, skill: 'nap', desc: '在泥里打滚打出了一身硬壳。' },
  leafbug: { name: '叶叶虫', model: 'animal-caterpillar', el: 'grass', hp: 0.9, atk: 1.0, def: 0.8, spd: 0.9, skill: 'leafCut', desc: '把自己吃过的叶子都记在身上的节里。' },
  hopcube: { name: '蹦蹦方', model: 'animal-bunny', el: 'none', hp: 0.9, atk: 1.0, def: 0.8, spd: 1.4, skill: 'tackle', desc: '停不下来，连睡觉都在蹦。' },
  tusk:    { name: '獠牙大王', model: 'animal-hog', el: 'grass', hp: 4.2, atk: 1.25, def: 1.1, spd: 0.9, skill: 'stomp', boss: true, scale: 1.7, desc: '青草坡的老大，脾气和牙一样硬。' },

  gnawer:  { name: '啃木匠', model: 'animal-beaver', el: 'water', hp: 1.2, atk: 1.0, def: 1.2, spd: 0.8, skill: 'tackle', desc: '把整片林子都当成了自己的工地。' },
  pincer:  { name: '钳钳', model: 'animal-crab', el: 'water', hp: 0.9, atk: 1.2, def: 1.3, spd: 0.8, skill: 'bubble', desc: '横着走，夹人的时候倒是很直接。' },
  bubfish: { name: '泡泡鱼', model: 'animal-fish', el: 'water', hp: 0.8, atk: 1.1, def: 0.7, spd: 1.3, skill: 'bubble', desc: '离了水也能游，靠的是一肚子泡泡。' },
  prank:   { name: '捣蛋猴', model: 'animal-monkey', el: 'none', hp: 1.0, atk: 1.1, def: 0.8, spd: 1.5, skill: 'roar', desc: '偷过所有旅人的午饭。' },
  spout:   { name: '喷泉象', model: 'animal-elephant', el: 'water', hp: 4.6, atk: 1.3, def: 1.2, spd: 0.7, skill: 'stomp', boss: true, scale: 1.8, desc: '溪水林的守林者，鼻子一甩就是一场雨。' },

  embertail:{ name: '火尾方', model: 'animal-fox', el: 'fire', hp: 0.9, atk: 1.2, def: 0.8, spd: 1.4, skill: 'ember', desc: '尾巴尖上永远有一点没灭的火。' },
  stripe:  { name: '斑斑虎', model: 'animal-tiger', el: 'fire', hp: 1.2, atk: 1.3, def: 0.9, spd: 1.1, skill: 'tackle', desc: '条纹是晒太阳晒出来的，它自己这么说。' },
  echo:    { name: '学舌鸟', model: 'animal-parrot', el: 'none', hp: 0.8, atk: 1.1, def: 0.7, spd: 1.6, skill: 'roar', desc: '会把你喊的招式名原样喊回来。' },
  antler:  { name: '红叶鹿', model: 'animal-deer', el: 'grass', hp: 1.1, atk: 1.0, def: 1.0, spd: 1.2, skill: 'leafCut', desc: '角上挂着去年的红叶，舍不得摘。' },
  mane:    { name: '烈鬃王', model: 'animal-lion', el: 'fire', hp: 5.0, atk: 1.4, def: 1.1, spd: 1.1, skill: 'roar', boss: true, scale: 1.8, desc: '红叶谷的王，鬃毛像一圈落日。' },

  slider:  { name: '滑滑鹅', model: 'animal-penguin', el: 'water', hp: 1.0, atk: 1.1, def: 1.0, spd: 1.3, skill: 'bubble', desc: '走路靠滑，刹车靠撞。' },
  snowbear:{ name: '雪团熊', model: 'animal-polar', el: 'water', hp: 1.5, atk: 1.3, def: 1.2, spd: 0.7, skill: 'stomp', desc: '睡着的时候和雪堆分不出来。' },
  inkball: { name: '墨团', model: 'animal-panda', el: 'grass', hp: 1.4, atk: 1.1, def: 1.3, spd: 0.6, skill: 'nap', desc: '黑的地方是墨，白的地方也是墨，只是还没干。' },
  dozer:   { name: '抱树懒', model: 'animal-koala', el: 'grass', hp: 1.2, atk: 0.9, def: 1.4, spd: 0.5, skill: 'leafCut', desc: '一年里醒着的时间加起来不到一顿饭。' },
  starneck:{ name: '摘星兽', model: 'animal-giraffe', el: 'none', hp: 6.0, atk: 1.5, def: 1.25, spd: 1.0, skill: 'stomp', boss: true, scale: 1.9, desc: '霜星岭顶上的巨兽，据说脖子够得着星星。' },
};

// 地图。每张图是一座浮岛。pal: 草地颜色；trees: 用哪些树；wild: 野怪；lv: 等级范围
export const ZONES = [
  { id: 'home', name: '北坡小岛', home: true, light: 'day', pal: [0x6aa83a, 0x4f8f34, 0x9cc24e], trees: ['CommonTree_1', 'CommonTree_3'], flowers: ['Flower_3_Group', 'Flower_4_Group', 'Plant_7_Big'], desc: '你的家。回到这里会恢复体力。' },
  { id: 'meadow', name: '青草坡', lv: [1, 5], light: 'day', pal: [0x7cba42, 0x5c9c38, 0xb4d45a], trees: ['CommonTree_2', 'CommonTree_5'], flowers: ['Flower_3_Group', 'Clover_1', 'Grass_Common_Short'], wild: ['chirp', 'mudpig', 'leafbug', 'hopcube'], boss: 'tusk', desc: '离家最近的草坡，适合练手。' },
  { id: 'brook', name: '溪水林', lv: [5, 10], light: 'dawn', pal: [0x4f9a55, 0x3b7f4c, 0x7fbf7a], trees: ['Pine_1', 'Pine_3', 'CommonTree_1'], flowers: ['Fern_1', 'Plant_1', 'Mushroom_Common'], wild: ['gnawer', 'pincer', 'bubfish', 'prank'], boss: 'spout', pond: true, desc: '林子里到处是水声。' },
  { id: 'maple', name: '红叶谷', lv: [10, 15], light: 'dusk', pal: [0xa9a23c, 0x8a7f30, 0xd0b050], trees: ['TwistedTree_1', 'TwistedTree_3', 'CommonTree_3'], flowers: ['Flower_4_Group', 'Mushroom_Laetiporus', 'Grass_Wispy_Short'], wild: ['embertail', 'stripe', 'echo', 'antler'], boss: 'mane', desc: '一年四季都是秋天。' },
  { id: 'frost', name: '霜星岭', lv: [15, 20], light: 'night', pal: [0x7fa7a0, 0x5f8a8f, 0xb8d6d0], trees: ['Pine_4', 'Pine_1', 'DeadTree_1'], flowers: ['Plant_7', 'Grass_Wispy_Short', 'Mushroom_Common'], wild: ['slider', 'snowbear', 'inkball', 'dozer'], boss: 'starneck', desc: '离星星最近的地方，夜里很亮。' },
];

// 道具
export const ITEMS = {
  pill:   { name: '草药丸', icon: '🌿', price: 12, desc: '恢复一名同伴 45% 生命。', use: 'hp', amount: 0.45 },
  dew:    { name: '灵泉露', icon: '💧', price: 18, desc: '恢复自己 50% 灵气。', use: 'mp', amount: 0.5 },
  seed:   { name: '灵种', icon: '🌰', price: 25, desc: '丢向虚弱的野怪，有机会让它变成伙伴。', use: 'capture' },
};

// 装备。按地图档位随机生成，名字由前缀 + 部位组成
export const GEAR_SLOTS = { weapon: '武器', armor: '护甲', charm: '饰物' };
export const GEAR_BASE = {
  weapon: [['木枝', '🪵'], ['溪石刃', '🗡️'], ['红叶杖', '🍁'], ['霜星刺', '❄️']],
  armor:  [['草编衣', '🥻'], ['苔藓披风', '🧥'], ['枫纹甲', '🛡️'], ['星霜袍', '🌌']],
  charm:  [['野花环', '💐'], ['水滴坠', '📿'], ['火纹铃', '🔔'], ['星屑戒', '💍']],
};
export const GEAR_PREFIX = [['', 1], ['结实的', 1.15], ['精巧的', 1.3], ['发光的', 1.5]];

// 任务，按顺序接。type: kill 打败若干 / capture 抓到伙伴 / boss 打败首领 / level 到达等级
export const QUESTS = [
  { id: 'q1', title: '第一步', text: '石灯里的灯灵醒了。它说岛外的草坡上野怪变多了，让你先去打败 3 只试试身手。', type: 'kill', n: 3, reward: { gold: 30, items: { seed: 3, pill: 3 } }, done: '「不错。拿着这些灵种，看到合眼缘的，就带回来作伴。」' },
  { id: 'q2', title: '一个伙伴', text: '灯灵说一个人走不远。把野怪打到虚弱，丢出灵种，带回你的第一个伙伴。', type: 'capture', n: 1, reward: { gold: 40, items: { pill: 3 } }, done: '「它看你的眼神不一样了。好好待它。」' },
  { id: 'q3', title: '獠牙大王', text: '青草坡深处有个大家伙，把过路的小兽都赶跑了。去会会它。', type: 'boss', boss: 'tusk', reward: { gold: 120, items: { dew: 3 }, gear: 1 }, done: '「草坡安静了。往东的溪水林，雾散开了。」' },
  { id: 'q4', title: '水声', text: '溪水林里的水系野怪多得反常。打败 6 只水系野怪，看看是怎么回事。', type: 'kill', el: 'water', n: 6, reward: { gold: 150, items: { seed: 3, pill: 4 } }, done: '「是守林的喷泉象在发脾气，水才漫得到处都是。」' },
  { id: 'q5', title: '喷泉象', text: '去溪水林深处，让喷泉象冷静下来。', type: 'boss', boss: 'spout', reward: { gold: 260, items: { dew: 4 }, gear: 2 }, done: '「它其实只是想有人陪它玩水。红叶谷的路通了。」' },
  { id: 'q6', title: '再走远一点', text: '灯灵觉得你还得再练练，升到 12 级再来找它。', type: 'level', n: 12, reward: { gold: 300, items: { seed: 4, pill: 5 } }, done: '「现在的你，可以去见红叶谷的王了。」' },
  { id: 'q7', title: '烈鬃王', text: '红叶谷的烈鬃王不许任何人上霜星岭。去说服它，用它听得懂的方式。', type: 'boss', boss: 'mane', reward: { gold: 500, items: { dew: 5 }, gear: 3 }, done: '「它让路了。岭上很冷，多带点药。」' },
  { id: 'q8', title: '摘星', text: '霜星岭顶上有只够得着星星的巨兽。灯灵说，它的灯芯就是很久以前那只兽摘下来的一颗星。去见见它。', type: 'boss', boss: 'starneck', reward: { gold: 1000, items: { seed: 5 }, gear: 4 }, done: '「它记得我。谢谢你带回了它的问候。往后这几座岛，你想去哪就去哪。」' },
];
