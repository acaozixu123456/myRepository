// 生成“AI 立绘参考包”：每只猫一张参考图（现有程序化造型的高清渲染，用于锁定配色与服装）+ 一份可直接喂给图像模型的提示词文档。
// node tools/gen-art-pack.mjs   →  assets/heroes/ref/<id>.jpg  与  docs/ART_PROMPTS.md
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const bundled = await build({
  stdin: { contents: "export { catSvg } from './src/art/cat'; export { HEROES } from './src/data/heroes'; export { FACTIONS } from './src/data/factions';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', target: 'node22', write: false,
});
const { catSvg, HEROES, FACTIONS } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

const HEAD = { none: '无头饰', helmetWei: '玄甲盔', helmetGeneral: '将军盔（红缨）', scholarCap: '纶巾', taoistCrown: '束发道冠', pheasant: '雉尾冠', yellowBand: '黄巾', boneCrown: '南蛮骨冠', featherHeaddress: '羽冠', flowerPin: '步摇花簪', emperorCrown: '冕旒', rattanHelm: '藤甲盔', sailorBandana: '锦帆头巾', fortuneHat: '算命先生帽', lotusCrown: '莲冠', tigerHood: '虎头帽', ratCap: '圆帽', hood: '兜帽', leafHat: '叶帽' };
const BODY = { none: '无', armorWei: '玄甲', armorHeavy: '重甲', armorLight: '轻甲', robeScholar: '文士袍', robeTaoist: '道袍', robeSilk: '华服', dress: '长裙', tribal: '兽皮', rattan: '藤甲', vest: '短褂' };
const WEAPON = { none: '空手', sword: '长剑', dualSwords: '双股剑', glaive: '青龙鱼骨刀', spear: '长矛', halberd: '方天画戟', fan: '羽扇', qin: '古琴', bow: '长弓', staff: '法杖', mace: '狼牙骨棒', whip: '铁鞭', knives: '飞刀', scroll: '卷轴', talisman: '符箓', brush: '巨笔', drum: '兽鼓', coins: '铜钱', herbs: '药草', axe: '长柄大斧', hooks: '双钩', whisk: '拂尘', dualBlades: '双短刀' };
const PATTERN = { solid: '纯色', tabby: '虎斑', tuxedo: '燕尾服（深色加白胸白爪）', calico: '三花', point: '重点色', spots: '豹纹玫瑰斑', cow: '奶牛花斑', shaded: '渐层', tortie: '玳瑁', butterfly: '蝶斑' };
const EXTRA = { eyepatch: '独眼眼罩', scar: '脸上刀疤', beardLong: '美髯', beardGoat: '山羊须', bell: '铃铛颈圈', scarf: '围巾', redFace: '红脸', warPaint: '战纹', monocle: '单片眼镜', earring: '耳环', glowEyes: '', tassel: '流苏' };
const BACK = { none: '', cape: '披风', capeLong: '长披风', banner: '背旗', wings: '羽翼', scrollBack: '背卷轴', gourd: '葫芦', furCloak: '毛皮斗篷', ribbons: '飘带' };

mkdirSync('assets/heroes/ref', { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 });
let doc = `# AI 立绘提示词包

> 用法：每只猫一段提示词 + 一张参考图（\`assets/heroes/ref/<id>.jpg\`，由现有造型渲染，**锁定配色和服装**）。在图像模型里用“参考图 + 提示词”生成，再把成品放到 \`assets/heroes/illust/<id>.png\`（透明背景或纯色背景均可）。

## 全局风格（每次都带上）

- 画风：二次元手游 Q 版角色立绘，**2.5 头身**，厚涂 + 清晰干净的描边，柔和的赛璐璐阴影，色彩明快饱和，像《三国志幻想大陆》《阴阳师》的 Q 版卡面。
- 主体：**拟人站立的猫猫**（猫头猫尾猫爪，人形身体穿古风服装），全身，正面偏 3/4 角度，**动态姿势**（重心偏一侧、武器自然入画），脸朝向镜头。
- **手部**：画出完整的猫爪手——有拇指、指节和肉垫，手握武器的姿势要自然；手臂与肩膀连接自然，有衣袖。
- 背景：纯白或透明，脚下一小块柔和投影。
- 不要：写实毛发、血腥、文字水印、多余的人类皮肤、真人五官。

## 每只猫

`;
for (const h of HEROES) {
  const svg = catSvg(h.look, { width: 768, height: 1024, viewBox: '-40 20 480 640', uid: 'r' + h.id });
  await p.setContent(`<body style="margin:0;background:#fff">${svg}</body>`);
  await p.screenshot({ path: `assets/heroes/ref/${h.id}.jpg`, type: 'jpeg', quality: 86 });
  const l = h.look, o = l.outfit, f = FACTIONS[h.faction];
  const ex = (o.extra ?? []).map((x) => EXTRA[x] ?? x).filter(Boolean).join('、');
  doc += `### ${h.name}（\`${h.id}\`，${h.rarity}，${f.name}·${f.full}，${h.role}）

- 参考图：\`assets/heroes/ref/${h.id}.jpg\`
- 提示词：\`${h.breed}，${PATTERN[l.coat.pattern] ?? l.coat.pattern}毛色（主色 ${l.coat.base}，浅色 ${l.coat.light}${l.coat.accent ? '，辅色 ' + l.coat.accent : ''}），${l.eye.color} 色眼睛；头戴${HEAD[o.head ?? 'none']}，身穿${BODY[o.body ?? 'none']}${BACK[o.back ?? 'none'] ? '，背后' + BACK[o.back] : ''}，手持${WEAPON[o.weapon ?? 'none']}${ex ? '，' + ex : ''}；服装主色 ${o.pal.main}、辅色 ${o.pal.sub}、点缀 ${o.pal.trim}；气质：${h.title}，${h.age}。台词感：“${h.quote}”\`

`;
}
writeFileSync('docs/ART_PROMPTS.md', doc);
await b.close();
console.log(`已生成 ${HEROES.length} 张参考图与 docs/ART_PROMPTS.md`);
