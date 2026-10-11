import ts from 'typescript';
import { HEROES } from '../src/data/heroes';
import { SKILLS, type SkillDef, type SkillKind } from '../src/data/skills';
import { KITS } from '../src/data/kits';
import type { Kit } from '../src/engine/types';

export interface SkillConsistencySources {
  heroes: readonly { id: string; name: string }[];
  skills: Readonly<Record<string, readonly SkillDef[]>>;
  kits: Readonly<Record<string, Kit>>;
  skillsSource: string;
}
export interface SkillConsistencyFinding {
  severity: 'error' | 'review';
  rule: 'coverage' | 'duplicate' | 'kind' | 'empty' | 'upgrade' | 'source' | 'text';
  heroId: string;
  field: string;
  message: string;
  expected?: string;
  actual?: string;
  line?: number;
  column?: number;
}
export interface SkillConsistencyReport {
  heroes: number;
  fromKit: number;
  legacy: number;
  errors: number;
  reviews: number;
  findings: SkillConsistencyFinding[];
}
type Origin = { kind: 'from-kit' | 'legacy'; line: number; column: number };
const KINDS: readonly SkillKind[] = ['basic', 'ultimate', 'passive', 'awaken'];
// 仅这六个现存手写摘要待人工评审；稀有度不构成豁免条件。
const LEGACY_IDS = new Set([
  'wei_caomiaode', 'shu_liumiaobei', 'wu_zhoumiaoyu',
  'qun_lvbuding', 'man_mengmiaohuo', 'xian_zuoci',
]);

function unwrap(node: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
  return node;
}
function propertyName(node: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  if (ts.isComputedPropertyName(node) && ts.isStringLiteral(node.expression)) return node.expression.text;
  return undefined;
}
function sourceOrigins(sourceText: string, findings: SkillConsistencyFinding[]): Map<string, Origin> {
  const source = ts.createSourceFile('src/data/skills.ts', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const origins = new Map<string, Origin>();
  let declarations = 0;
  const error = (heroId: string, field: string, message: string, node: ts.Node): void => {
    const position = source.getLineAndCharacterOfPosition(node.getStart(source));
    findings.push({ severity: 'error', rule: 'source', heroId, field, message, line: position.line + 1, column: position.character + 1 });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'SKILLS') {
      declarations++;
      if (declarations > 1) error('', 'SKILLS', 'SKILLS 声明重复。', node);
      const initializer = node.initializer && unwrap(node.initializer);
      if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
        error('', 'SKILLS', '当前检查仅支持直接声明的 SKILLS 对象，请评审新的来源格式。', node);
        return;
      }
      const seen = new Set<string>();
      for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property)) {
          error('', 'SKILLS', '无法定位的属性或展开项，请评审来源格式。', property);
          continue;
        }
        const id = propertyName(property.name);
        if (id === undefined) { error('', 'SKILLS', '英雄键必须能静态定位。', property); continue; }
        if (seen.has(id)) error(id, `SKILLS.${id}`, '源码中的英雄键重复，运行时覆盖不能隐藏此错误。', property);
        seen.add(id);
        const value = unwrap(property.initializer);
        const position = source.getLineAndCharacterOfPosition(property.getStart(source));
        const location = { line: position.line + 1, column: position.character + 1 };
        if (ts.isCallExpression(value) && ts.isIdentifier(value.expression) && value.expression.text === 'FROM_KIT') {
          const argument = value.arguments[0] && unwrap(value.arguments[0]);
          const referencedId = argument && ts.isPropertyAccessExpression(argument) ? argument.name.text
            : argument && ts.isElementAccessExpression(argument) && ts.isStringLiteral(argument.argumentExpression) ? argument.argumentExpression.text : undefined;
          if (referencedId !== id) error(id, `SKILLS.${id}`, 'FROM_KIT 引用的英雄键与展示键不一致或无法静态定位。', property);
          origins.set(id, { kind: 'from-kit', ...location });
        } else if (ts.isArrayLiteralExpression(value) && LEGACY_IDS.has(id)) {
          origins.set(id, { kind: 'legacy', ...location });
        } else {
          error(id, `SKILLS.${id}`, '未登记的展示来源；不能按稀有度或文本相似度自动豁免。', property);
        }
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!declarations) findings.push({ severity: 'error', rule: 'source', heroId: '', field: 'SKILLS', message: '未找到 SKILLS 声明。' });
  return origins;
}

/** 仅比对数据覆盖和声明的展示字符串；不推断自然语言与 effects 等价。 */
export function checkSkillConsistency(sources: SkillConsistencySources): SkillConsistencyReport {
  const findings: SkillConsistencyFinding[] = [];
  const origins = sourceOrigins(sources.skillsSource, findings);
  const ids = new Set<string>();
  const skillIds = new Map<string, string>();
  const add = (rule: SkillConsistencyFinding['rule'], heroId: string, field: string, message: string): void => {
    findings.push({ severity: 'error', rule, heroId, field, message });
  };
  const nonempty = (value: unknown, heroId: string, field: string): boolean => {
    if (typeof value === 'string' && value.trim()) return true;
    add('empty', heroId, field, '字段必须是非空白字符串。');
    return false;
  };
  for (const hero of sources.heroes) {
    nonempty(hero.id, hero.id, 'HEROES.id');
    if (ids.has(hero.id)) add('duplicate', hero.id, 'HEROES.id', '英雄 id 重复。');
    ids.add(hero.id);
  }
  for (const [label, keys] of [
    ['SKILLS', Object.keys(sources.skills)], ['KITS', Object.keys(sources.kits)], ['SKILLS.source', [...origins.keys()]],
  ] as const) {
    for (const id of keys) if (!ids.has(id)) add('coverage', id, `${label}.${id}`, '存在未注册英雄的条目。');
  }
  let fromKit = 0;
  let legacy = 0;
  for (const id of ids) {
    const display = Object.hasOwn(sources.skills, id) ? sources.skills[id] : undefined;
    const kit = Object.hasOwn(sources.kits, id) ? sources.kits[id] : undefined;
    const origin = origins.get(id);
    if (!origin) add('coverage', id, `SKILLS.source.${id}`, '缺少可确认的展示来源。');
    else if (origin.kind === 'from-kit') fromKit++;
    else legacy++;
    const byKind = new Map<SkillKind, SkillDef>();
    if (!Array.isArray(display)) add('coverage', id, `SKILLS.${id}`, '缺少四技能展示数组。');
    else {
      if (display.length !== 4) add('kind', id, `SKILLS.${id}`, '必须恰有四个技能。');
      for (const [index, skill] of display.entries()) {
        if (!skill || !KINDS.includes(skill.kind)) { add('kind', id, `SKILLS.${id}[${index}].kind`, '未知技能 kind。'); continue; }
        if (byKind.has(skill.kind)) add('duplicate', id, `SKILLS.${id}.${skill.kind}`, '技能 kind 重复。');
        else byKind.set(skill.kind, skill);
        nonempty(skill.name, id, `SKILLS.${id}.${skill.kind}.name`);
        nonempty(skill.desc, id, `SKILLS.${id}.${skill.kind}.desc`);
      }
      for (const kind of KINDS) if (!byKind.has(kind)) add('kind', id, `SKILLS.${id}.${kind}`, '缺少此类技能。');
    }
    if (!kit) { add('coverage', id, `KITS.${id}`, '缺少战斗技能组。'); continue; }
    if (kit.heroId !== id) add('coverage', id, `KITS.${id}.heroId`, '技能组 heroId 与注册键不一致。');
    for (const kind of ['basic', 'ultimate', 'passive'] as const) {
      const skill = kit[kind];
      if (!skill) { add('coverage', id, `KITS.${id}.${kind}`, '缺少战斗技能。'); continue; }
      const field = `KITS.${id}.${kind}`;
      if (nonempty(skill.id, id, `${field}.id`)) {
        if (skillIds.has(skill.id)) add('duplicate', id, `${field}.id`, `战斗技能 id 已被 ${skillIds.get(skill.id)} 使用。`);
        else skillIds.set(skill.id, `${id}.${kind}`);
      }
      nonempty(skill.name, id, `${field}.name`);
      nonempty(skill.desc, id, `${field}.desc`);
    }
    const rawMods = kit.ultimate?.levelMods;
    const mods = Array.isArray(rawMods) ? rawMods : [];
    if (!Array.isArray(rawMods) || mods.length !== 3 || mods.some((mod, index) => !mod || mod.lv !== [3, 6, 9][index])) {
      add('upgrade', id, `KITS.${id}.ultimate.levelMods`, '绝技升级必须依次且仅为 Lv3、Lv6、Lv9。');
    }
    for (const mod of mods) if (mod) nonempty(mod.desc, id, `KITS.${id}.ultimate.levelMods.${mod.lv}.desc`);
    for (const branch of ['A', 'B'] as const) {
      const choice = kit.awaken?.[branch];
      if (!choice) { add('coverage', id, `KITS.${id}.awaken.${branch}`, '缺少觉醒路线。'); continue; }
      nonempty(choice.name, id, `KITS.${id}.awaken.${branch}.name`);
      nonempty(choice.desc, id, `KITS.${id}.awaken.${branch}.desc`);
    }
    if (!origin) continue;
    const compare = (kind: SkillKind, field: 'name' | 'desc', expected: string): void => {
      const actual = byKind.get(kind)?.[field];
      if (actual === undefined || actual === expected) return;
      findings.push({
        severity: origin.kind === 'legacy' ? 'review' : 'error', rule: 'text', heroId: id,
        field: `SKILLS.${id}.${kind}.${field}`, message: origin.kind === 'legacy'
          ? '旧手写摘要与完整 KITS 展示不同，需 Claude 评审。' : '与当前 FROM_KIT 拼接结果不一致。',
        expected, actual, line: origin.line, column: origin.column,
      });
    };
    for (const kind of ['basic', 'ultimate', 'passive'] as const) {
      const skill = kit[kind];
      if (!skill) continue;
      compare(kind, 'name', skill.name);
      compare(kind, 'desc', kind === 'ultimate'
        ? [skill.desc, ...mods.filter(Boolean).map((mod) => `【${mod.lv}级】${mod.desc}`)].join(' ')
        : skill.desc);
    }
    if (kit.awaken?.A && kit.awaken.B) {
      const { A, B } = kit.awaken;
      compare('awaken', 'name', `${A.name} / ${B.name}`);
      compare('awaken', 'desc', `路线甲「${A.name}」：${A.desc} 路线乙「${B.name}」：${B.desc}`);
    }
  }
  return { heroes: ids.size, fromKit, legacy, errors: findings.filter((f) => f.severity === 'error').length,
    reviews: findings.filter((f) => f.severity === 'review').length, findings };
}

export function realSkillSources(skillsSource: string): SkillConsistencySources {
  return { heroes: HEROES, skills: SKILLS, kits: KITS, skillsSource };
}
export function parseSkillConsistencyArgs(args: readonly string[]): { strict: boolean; json: boolean; help: boolean } {
  const options = { strict: false, json: false, help: false };
  for (const arg of args) {
    if (arg === '--strict') options.strict = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }
  return options;
}
export function skillConsistencyExitCode(report: SkillConsistencyReport, strict: boolean): 0 | 1 {
  return report.errors > 0 || (strict && report.reviews > 0) ? 1 : 0;
}
export function renderSkillConsistency(report: SkillConsistencyReport): string {
  const lines = [
    `技能展示一致性：${report.heroes} 只猫，FROM_KIT ${report.fromKit}，旧手写 ${report.legacy}。`,
    `错误 ${report.errors}；待审核差异 ${report.reviews}。`,
    '仅验证覆盖及声明的展示文本；不证明描述与战斗 effects 语义一致。',
  ];
  const preview = (value: string): string => JSON.stringify(value.length > 180 ? `${value.slice(0, 180)}…` : value);
  for (const finding of report.findings) {
    lines.push(`[${finding.severity}] ${finding.heroId || '全表'} ${finding.field}${finding.line ? `（src/data/skills.ts:${finding.line}:${finding.column}）` : ''}：${finding.message}`);
    if (finding.actual !== undefined) lines.push(`  展示：${preview(finding.actual)}`);
    if (finding.expected !== undefined) lines.push(`  期望：${preview(finding.expected)}`);
  }
  return lines.join('\n') + '\n';
}
export function runSkillConsistencyCli(args: readonly string[], sources: SkillConsistencySources): number {
  try {
    const options = parseSkillConsistencyArgs(args);
    if (options.help) {
      console.log('npm run lint:skills -- [--strict] [--json]\n默认：结构与 FROM_KIT 文本错误退出 1；旧摘要仅报告。\n--strict：旧摘要待审核差异也退出 1。\n--json：输出完整机器可读字段与原文。');
      return 0;
    }
    const report = checkSkillConsistency(sources);
    process.stdout.write(options.json ? JSON.stringify(report, null, 2) + '\n' : renderSkillConsistency(report));
    return skillConsistencyExitCode(report, options.strict);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}
