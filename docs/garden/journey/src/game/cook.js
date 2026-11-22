// 路上摘的东西和营地里做的饭。
// 材料：十样，各长在各的地方（world/forage.js 摆在地上，走到跟前点互动按钮摘），第二天又长出来。
// 料理：在营地坐下点「做饭」，挑一到三样下锅。放的是哪几种决定做出什么（同一种多放是加料，更顶用）；
//       对不上菜谱的就是一锅杂烩。做出来过的菜谱记在手记的「行囊」页。
// 吃了回气力，有的还多出几格临时的气力（黄色的），或者一阵子的好处（BUFFS）。

export const ITEMS = [
  { id: 'berry', g: '莓', name: '野莓', verb: '摘', where: '出发的谷地、山路两边的矮丛里' },
  { id: 'mushroom', g: '菇', name: '蘑菇', verb: '采', where: '林荫小道和西岭松林的树底下' },
  { id: 'honey', g: '蜜', name: '蜜花', verb: '摘', where: '东坡花田，比别的花高出一头' },
  { id: 'herb', g: '葱', name: '溪葱', verb: '拔', where: '小溪两岸的湿地上' },
  { id: 'apple', g: '果', name: '野苹果', verb: '摘', where: '风车坡附近的矮树上' },
  { id: 'pine', g: '松', name: '松子', verb: '捡', where: '西岭松林的地上，掉下来的松塔里' },
  { id: 'chestnut', g: '栗', name: '栗子', verb: '捡', where: '红叶谷的落叶里' },
  { id: 'shoot', g: '笋', name: '竹笋', verb: '挖', where: '竹林山坳' },
  { id: 'shell', g: '贝', name: '海贝', verb: '捡', where: '西湾沙滩上' },
  { id: 'frost', g: '冰', name: '冰莓', verb: '摘', where: '雪原山口和冰湖边的雪地里' },
];
export const itemOf = id => ITEMS.find(i => i.id === id);

// 吃了以后一阵子的好处
export const BUFFS = {
  warm: { name: '暖和', sub: '雪地里气力照常回' },
  light: { name: '脚步轻', sub: '跑起来省一大半气力' },
  grip: { name: '抓得牢', sub: '攀爬省气力' },
  fin: { name: '水性好', sub: '游泳省气力' },
  wind: { name: '风顺', sub: '扇翅膀省气力' },
};
// 有这个好处的时候，对应的气力消耗乘多少
export const BUFF_K = { light: 0.35, grip: 0.55, fin: 0.5, wind: 0.5 };

// need：要哪几种（顺序无所谓，同一种放几个都行）；rest：回多少气力（一格 20）；extra：多出来的临时气力；buff：[[哪种, 几分钟]]
export const DISHES = [
  { id: 'skewer', name: '烤野莓串', need: ['berry'], rest: 40, sub: '酸酸甜甜，烤过更香' },
  { id: 'roastShroom', name: '烤蘑菇', need: ['mushroom'], rest: 50, sub: '撒一点盐就很好吃' },
  { id: 'honeyTea', name: '蜜花茶', need: ['honey'], rest: 30, extra: 20, sub: '一小壶，甜丝丝的' },
  { id: 'herbBroth', name: '溪葱清汤', need: ['herb'], rest: 40, buff: [['warm', 3]], sub: '清清淡淡，喝下去身上就热了' },
  { id: 'roastApple', name: '烤苹果', need: ['apple'], rest: 55, sub: '皮烤得皱皱的，里面烫嘴' },
  { id: 'pineRoast', name: '炒松子', need: ['pine'], rest: 40, buff: [['grip', 2]], sub: '一颗一颗嗑，手指头都有劲了' },
  { id: 'roastNut', name: '烤栗子', need: ['chestnut'], rest: 45, buff: [['warm', 3]], sub: '捧在手里就暖和' },
  { id: 'shootGrill', name: '烤笋', need: ['shoot'], rest: 45, sub: '剥开焦黑的壳，里面又白又嫩' },
  { id: 'shellGrill', name: '烤海贝', need: ['shell'], rest: 45, buff: [['fin', 2]], sub: '壳一张开就好了' },
  { id: 'frostJelly', name: '冰莓冻', need: ['frost'], rest: 40, buff: [['wind', 3]], sub: '凉得人一激灵，翅膀都轻了' },
  { id: 'soup', name: '溪葱蘑菇汤', need: ['mushroom', 'herb'], rest: 80, buff: [['warm', 6]], sub: '热乎乎的一碗，喝完手脚都暖了', clue: '蘑菇和溪葱一起煮' },
  { id: 'jam', name: '蜜渍野莓', need: ['berry', 'honey'], rest: 60, extra: 20, sub: '甜得眯眼睛', clue: '野莓拌上蜜花' },
  { id: 'applePie', name: '蜜烤苹果', need: ['apple', 'honey'], rest: 100, extra: 20, sub: '苹果芯里灌了蜜', clue: '野苹果和蜜花' },
  { id: 'candied', name: '糖炒栗子', need: ['chestnut', 'honey'], rest: 70, extra: 40, buff: [['warm', 4]], sub: '壳上亮晶晶的一层糖', clue: '栗子裹上蜜花' },
  { id: 'pineShroom', name: '松子焗蘑菇', need: ['pine', 'mushroom'], rest: 60, buff: [['grip', 6]], sub: '松林里的味道都在里面', clue: '松林里捡得到的两样' },
  { id: 'nutCake', name: '坚果酥', need: ['pine', 'chestnut'], rest: 50, extra: 20, buff: [['grip', 4]], sub: '又香又脆，掉一身渣', clue: '松子和栗子' },
  { id: 'herbCake', name: '溪葱松子饼', need: ['herb', 'pine'], rest: 60, buff: [['light', 5]], sub: '摊得薄薄的，边上焦脆', clue: '溪葱和松子' },
  { id: 'stirfry', name: '山珍小炒', need: ['shoot', 'mushroom'], rest: 70, buff: [['light', 6]], sub: '笋片和蘑菇，一大盘', clue: '竹笋和蘑菇' },
  { id: 'shellHerb', name: '葱烤海贝', need: ['shell', 'herb'], rest: 60, buff: [['fin', 6]], sub: '海的味道，加一把葱', clue: '海贝和溪葱' },
  { id: 'shellSoup', name: '笋片海贝汤', need: ['shell', 'shoot'], rest: 90, buff: [['fin', 4], ['warm', 4]], sub: '汤是奶白色的', clue: '海贝和竹笋' },
  { id: 'frostDew', name: '冰莓蜜露', need: ['frost', 'honey'], rest: 50, extra: 60, buff: [['wind', 5]], sub: '淡蓝色的，杯子外面挂着霜', clue: '冰莓和蜜花' },
  { id: 'fruit3', name: '三果羹', need: ['apple', 'berry', 'frost'], rest: 100, extra: 60, sub: '红的、紫的、蓝的煮在一起', clue: '三种果子都放进去' },
  { id: 'hotpot', name: '山野一锅鲜', need: ['shoot', 'herb', 'mushroom'], rest: 100, buff: [['warm', 8], ['light', 5]], sub: '锅盖一掀，香得隔壁山头都闻得见', clue: '竹笋、溪葱、蘑菇' },
];
const STEW = { id: 'stew', name: '旅人杂烩', need: [], rest: 30, sub: '什么都往锅里放，味道说不上来，不过能吃饱' };
export const dishOf = id => id === 'stew' ? STEW : DISHES.find(d => d.id === id);

// 锅里放了这几样（材料 id，可以重复），做出什么。返回 { id, s }：s 是分量（多放了几个同样的料，每个加三成）
export function cookDish(ings) {
  const kinds = [...new Set(ings)].sort().join('+');
  const D = DISHES.find(d => [...d.need].sort().join('+') === kinds);
  if (!D) return { id: 'stew', s: 1 + 0.34 * (ings.length - 1) };
  return { id: D.id, s: 1 + 0.3 * (ings.length - D.need.length) };
}
// 一份做好的菜吃下去有什么用：{ rest, extra, buff: [[k, 秒]] }
export function dishEffect(d) {
  const D = dishOf(d.id), s = d.s || 1;
  return { rest: Math.round(D.rest * s / 10) * 10, extra: Math.min(60, Math.round((D.extra || 0) * s / 10) * 10), buff: (D.buff || []).map(([k, m]) => [k, Math.round(m * 60 * s)]) };
}
// 写成一句话：回 2 格气力 · 多 1 格 · 暖和 6 分钟
export function effectText(d) {
  const e = dishEffect(d), out = [];
  const pips = v => { const n = v / 20; return (Number.isInteger(n) ? n : n.toFixed(1)) + ' 格'; };
  out.push('回 ' + pips(e.rest) + '气力');
  if (e.extra) out.push('多 ' + pips(e.extra) + '临时的');
  for (const [k, sec] of e.buff) out.push(`${BUFFS[k].name} ${Math.round(sec / 60)} 分钟`);
  return out.join(' · ');
}
export const mmss = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
