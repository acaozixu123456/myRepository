// 构建前检查内容数据里的引用是否都对得上，写错一个 id 就让构建失败。
import { SKILLS, CLASSES, MONSTERS, ZONES, ITEMS, QUESTS, GEAR, GEAR_SLOTS, ELEMENTS, STATUS, COMBO, COMBO_STYLE, PETS } from '../src/data/index.js';
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
for (const slot in GEAR_SLOTS) need(GEAR.names[slot]?.length === 8 && GEAR.main[slot], `装备部位 ${slot} 的名字或主属性不全`);
for (const [k, c] of Object.entries(CLASSES)) { for (const [, id] of [...(c.passives || []), ...Object.values(c.routes || {}).flatMap(r => r.skills)]) need(SKILLS[id], `职业 ${k} 的技能 ${id} 不存在`); }
for (const z of ZONES) { for (const m of z.mats || []) need(ITEMS[m], `地图 ${z.id} 的材料 ${m} 不存在`); need(!z.set || (GEAR.sets[z.set] && ITEMS['bp_' + z.set]), `地图 ${z.id} 的套装或图纸不对`); }
// 伙伴：每种野怪都有两段进化，进化材料、技能、天赋、技能书都存在
for (const z of ZONES) for (const id of z.wild || []) { const e = PETS.evo[id]; need(e?.length === 2, `野怪 ${id} 没有两段进化`); for (const s of e || []) { need(SKILLS[s.skill], `${id} 进化技能 ${s.skill} 不存在`); for (const k in s.need) need(ITEMS[k], `${id} 进化材料 ${k} 不存在`); } need(PETS.famTalents[MONSTERS[id].fam]?.every(t => PETS.talents[t]), `野怪 ${id} 的科别没有天赋`); }
for (const id of PETS.books) need(SKILLS[id] && ITEMS['book_' + id]?.skill === id, `技能书 ${id} 不对`);
for (const n of Object.values(PETS.natures)) need(n.up !== n.down, `性格 ${n.name} 增减同一项`);
if (errs.length) { console.error('数据检查没通过：\n' + errs.join('\n')); process.exit(1); }
console.log(`数据检查通过：${Object.keys(CLASSES).length} 职业，${Object.keys(SKILLS).length} 技能，${Object.keys(STATUS).length} 状态，${Object.keys(COMBO).length} 连携，${Object.keys(MONSTERS).length} 怪物，${ZONES.length} 张地图，${QUESTS.length} 个委托`);
