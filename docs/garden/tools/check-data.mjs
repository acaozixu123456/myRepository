// 构建前检查内容数据里的引用是否都对得上，写错一个 id 就让构建失败。
import { SKILLS, CLASSES, MONSTERS, ZONES, ITEMS, QUESTS, GEAR_BASE, GEAR_SLOTS, ELEMENTS } from '../src/data/index.js';
const errs = [], need = (ok, msg) => { if (!ok) errs.push(msg); };
for (const [k, c] of Object.entries(CLASSES)) { for (const [, id] of c.skills) need(SKILLS[id], `职业 ${k} 的技能 ${id} 不存在`); need(ELEMENTS[c.el], `职业 ${k} 的元素 ${c.el} 不存在`); }
for (const [k, m] of Object.entries(MONSTERS)) { need(!m.skill || SKILLS[m.skill], `怪物 ${k} 的技能 ${m.skill} 不存在`); need(ELEMENTS[m.el], `怪物 ${k} 的元素 ${m.el} 不存在`); }
for (const z of ZONES) { for (const id of z.wild || []) need(MONSTERS[id], `地图 ${z.id} 的野怪 ${id} 不存在`); need(!z.boss || MONSTERS[z.boss]?.boss, `地图 ${z.id} 的首领 ${z.boss} 不对`); }
for (const s of Object.values(SKILLS)) need(!s.el || ELEMENTS[s.el], `技能 ${s.name} 的元素 ${s.el} 不存在`);
const ids = new Set();
for (const q of QUESTS) { need(!ids.has(q.id), `委托 id 重复：${q.id}`); ids.add(q.id); for (const k in q.reward.items || {}) need(ITEMS[k], `委托 ${q.id} 奖励的道具 ${k} 不存在`); need(q.type !== 'boss' || MONSTERS[q.boss]?.boss, `委托 ${q.id} 的首领 ${q.boss} 不对`); }
for (const slot in GEAR_SLOTS) need(GEAR_BASE[slot]?.length === 4, `装备部位 ${slot} 应该有 4 档`);
if (errs.length) { console.error('数据检查没通过：\n' + errs.join('\n')); process.exit(1); }
console.log(`数据检查通过：${Object.keys(CLASSES).length} 职业，${Object.keys(SKILLS).length} 技能，${Object.keys(MONSTERS).length} 怪物，${ZONES.length} 张地图，${QUESTS.length} 个委托`);
