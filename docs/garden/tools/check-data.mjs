// 构建前检查内容数据里的引用是否都对得上，写错一个 id 就让构建失败。
import { SKILLS, CLASSES, MONSTERS, ZONES, ITEMS, QUESTS, GEAR_BASE, GEAR_SLOTS, ELEMENTS, STATUS, COMBO, COMBO_STYLE } from '../src/data/index.js';
const errs = [], need = (ok, msg) => { if (!ok) errs.push(msg); };
for (const [k, c] of Object.entries(CLASSES)) { for (const [, id] of c.skills) need(SKILLS[id], `职业 ${k} 的技能 ${id} 不存在`); need(ELEMENTS[c.el], `职业 ${k} 的元素 ${c.el} 不存在`); }
for (const [k, m] of Object.entries(MONSTERS)) {
  for (const id of m.skills || []) need(SKILLS[id], `怪物 ${k} 的技能 ${id} 不存在`);
  need(ELEMENTS[m.el], `怪物 ${k} 的元素 ${m.el} 不存在`); need(COMBO[m.fam], `怪物 ${k} 的科别 ${m.fam} 没有连携技`);
  for (const p of m.phases || []) { need(p.at > 0 && p.at < 1, `首领 ${k} 的阶段门槛不对`); for (const id of p.skills || []) need(SKILLS[id], `首领 ${k} 阶段技能 ${id} 不存在`); for (const id of p.summon || []) need(MONSTERS[id], `首领 ${k} 召唤的 ${id} 不存在`); for (const f of p.fx || []) need(STATUS[f], `首领 ${k} 的状态 ${f} 不存在`); need(!p.el || ELEMENTS[p.el], `首领 ${k} 阶段元素不对`); }
}
const fxOk = (list, where) => { for (const f of list || []) need(STATUS[f.type], `${where} 的状态 ${f.type} 不存在`); };
for (const [id, k] of Object.entries(SKILLS)) { fxOk(k.fx, `技能 ${id}`); for (const lv in k.up || {}) fxOk(k.up[lv].fx, `技能 ${id} ${lv} 级`); }
for (const [id, k] of Object.entries(COMBO)) { fxOk(k.fx, `连携 ${id}`); fxOk(k.party, `连携 ${id}`); }
for (const c of Object.keys(CLASSES)) need(COMBO_STYLE[c], `职业 ${c} 没有连携风格`);
for (const z of ZONES) { for (const id of z.wild || []) need(MONSTERS[id], `地图 ${z.id} 的野怪 ${id} 不存在`); need(!z.boss || MONSTERS[z.boss]?.boss, `地图 ${z.id} 的首领 ${z.boss} 不对`); }
for (const s of Object.values(SKILLS)) need(!s.el || ELEMENTS[s.el], `技能 ${s.name} 的元素 ${s.el} 不存在`);
const ids = new Set();
for (const q of QUESTS) { need(!ids.has(q.id), `委托 id 重复：${q.id}`); ids.add(q.id); for (const k in q.reward.items || {}) need(ITEMS[k], `委托 ${q.id} 奖励的道具 ${k} 不存在`); need(q.type !== 'boss' || MONSTERS[q.boss]?.boss, `委托 ${q.id} 的首领 ${q.boss} 不对`); }
for (const slot in GEAR_SLOTS) need(GEAR_BASE[slot]?.length === 4, `装备部位 ${slot} 应该有 4 档`);
if (errs.length) { console.error('数据检查没通过：\n' + errs.join('\n')); process.exit(1); }
console.log(`数据检查通过：${Object.keys(CLASSES).length} 职业，${Object.keys(SKILLS).length} 技能，${Object.keys(STATUS).length} 状态，${Object.keys(COMBO).length} 连携，${Object.keys(MONSTERS).length} 怪物，${ZONES.length} 张地图，${QUESTS.length} 个委托`);
