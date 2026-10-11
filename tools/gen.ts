// 由数据生成设定文档 + 导出立绘 SVG：npx esbuild tools/gen.ts --bundle --platform=node --format=esm --outfile=.shots/gen.mjs && node .shots/gen.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { catSvg } from '../src/art/cat';
import { FACTIONS, FACTION_ORDER } from '../src/data/factions';
import { HEROES, HERO_BY_ID } from '../src/data/heroes';
import { SKILLS, SKILL_KIND_NAME } from '../src/data/skills';
import { STATUSES } from '../src/data/statuses';
import { BONDS, COUNTER_REASON, COUNTER_RING, ROLES, baseStats } from '../src/data/systems';

mkdirSync('assets/heroes/svg', { recursive: true });
for (const h of HEROES) writeFileSync(`assets/heroes/svg/${h.id}.svg`, catSvg(h.look, { width: 480, height: 540, uid: h.id.replace(/_/g, '') }));

let md = '# 六大阵营\n\n> 本文件由 `tools/gen.ts` 根据 `src/data` 自动生成，请改数据而不是改文档。\n\n';
md += '## 克制环\n\n' + COUNTER_RING.map((id, i) => `- **${FACTIONS[id].name}** 克制 **${FACTIONS[COUNTER_RING[(i + 1) % 6]].name}**：${COUNTER_REASON[id]}`).join('\n') + '\n\n克制方伤害 +20%，被克制方 -20%。\n\n';
for (const id of FACTION_ORDER) {
  const f = FACTIONS[id];
  md += `## ${f.name} · ${f.full}\n\n- 口号：${f.motto}\n- 领地：${f.land}\n- 定位：${f.role}\n- 代表猫种：${f.breeds}\n- 主题色：\`${f.color}\`\n- 气质：${f.vibe}\n- 机制「${f.mechanic}」：${f.mechanicDesc}\n- 克制：${FACTIONS[f.counters].name}\n- 成员：${HEROES.filter((h) => h.faction === id).map((h) => `${h.name}(${h.rarity})`).join('、')}\n\n`;
}
writeFileSync('docs/01-factions.md', md);

md = '# 猫猫图鉴（首批 24 只）\n\n> 由 `tools/gen.ts` 自动生成。立绘 SVG 见 `assets/heroes/svg/`。\n\n';
md += '| 猫猫 | 原型 | 称号 | 阵营 | 稀有度 | 定位 | 猫种 | 生命 | 攻击 | 防御 | 速度 |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
for (const h of HEROES) {
  const s = baseStats(h.role, h.rarity);
  md += `| ${h.name} | ${h.origin} | ${h.title} | ${FACTIONS[h.faction].name} | ${h.rarity} | ${h.role} | ${h.breed} | ${s.hp} | ${s.atk} | ${s.def} | ${s.spd} |\n`;
}
md += '\n';
for (const id of FACTION_ORDER) {
  md += `---\n\n## ${FACTIONS[id].name} · ${FACTIONS[id].full}\n\n`;
  for (const h of HEROES.filter((x) => x.faction === id)) {
    md += `### ${h.name}（${h.rarity} · ${h.role}）\n\n![${h.name}](../assets/heroes/${h.id}.png)\n\n- 称号：${h.title}　原型：${h.origin}\n- 猫种：${h.breed}　体型：${h.age}\n- 背景：${h.lore}\n- 台词：“${h.quote}”\n- 喜好：${h.likes}\n\n`;
    for (const s of SKILLS[h.id]) md += `- **${SKILL_KIND_NAME[s.kind]}·${s.name}**（${s.target}）：${s.desc}\n`;
    md += '\n';
  }
}
md += '---\n\n## 羁绊\n\n' + BONDS.map((b) => `- **${b.name}**（${b.heroes.map((i) => HERO_BY_ID[i].name).join('、')}）：${b.desc}`).join('\n') + '\n';
writeFileSync('docs/02-heroes.md', md);

md = '# 战斗语言：状态效果与职业\n\n## 状态效果\n\n| 名称 | 类型 | 说明 | 备注 |\n|---|---|---|---|\n';
for (const s of STATUSES) md += `| ${s.name} | ${s.kind === 'buff' ? '增益' : '减益'} | ${s.desc} | ${s.note ?? ''} |\n`;
md += '\n## 职业\n\n| 职业 | 站位 | 说明 | 基础生命 | 攻击 | 防御 | 速度 |\n|---|---|---|---|---|---|---|\n';
for (const r of Object.values(ROLES)) md += `| ${r.role} | ${r.row} | ${r.desc} | ${r.base.hp} | ${r.base.atk} | ${r.base.def} | ${r.base.spd} |\n`;
md += '\n稀有度系数：SR ×0.82，SSR ×1.0，UR ×1.2（速度系数更平缓）。\n';
writeFileSync('docs/03-battle-language.md', md);
console.log('docs generated');
