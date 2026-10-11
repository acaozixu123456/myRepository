import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Kit } from '../src/engine/types';
import type { SkillDef } from '../src/data/skills';
import {
  checkSkillConsistency, parseSkillConsistencyArgs, realSkillSources, renderSkillConsistency,
  skillConsistencyExitCode, type SkillConsistencySources, type SkillConsistencyReport,
} from '../tools/skill-consistency';

const runner = fileURLToPath(new URL('../tools/run-skill-consistency.mjs', import.meta.url));
const sourcePath = fileURLToPath(new URL('../src/data/skills.ts', import.meta.url));

/** 文案是固定契约样例，不从工具的拼接器生成期望。 */
function fixture(): SkillConsistencySources {
  const kit: Kit = {
    heroId: 'test_cat',
    basic: { id: 'test_basic', name: '轻爪', desc: '造成 100% 攻击的伤害。', fx: 'melee.slash', effects: [] },
    ultimate: {
      id: 'test_ult', name: '圆桌午休', desc: '造成 200% 攻击的伤害。', fx: 'ult.generic', effects: [],
      levelMods: [
        { lv: 3, desc: '回复 8 点元气。', patch: { skill: 'ultimate', addEffects: [{ t: 'energy', amount: 8 }] } },
        { lv: 6, desc: '自身获得 10% 攻击的护盾。', patch: { skill: 'ultimate', addEffects: [{ t: 'shield', scale: { atk: 0.1 }, turns: 2 }] } },
        { lv: 9, desc: '治疗 20% 攻击的生命。', patch: { skill: 'ultimate', addEffects: [{ t: 'heal', scale: { atk: 0.2 } }] } },
      ],
    },
    passive: { id: 'test_passive', name: '安静等候', desc: '开战回复 5 点元气。', passive: [] },
    awaken: {
      A: { name: '早起', desc: '普攻回复 3 点元气。', patches: [] },
      B: { name: '晚睡', desc: '绝技治疗 30% 攻击的生命。', patches: [] },
    },
  };
  const skills: SkillDef[] = [
    { kind: 'basic', name: '轻爪', desc: '造成 100% 攻击的伤害。', target: '敌方', tags: [] },
    { kind: 'ultimate', name: '圆桌午休', desc: '造成 200% 攻击的伤害。 【3级】回复 8 点元气。 【6级】自身获得 10% 攻击的护盾。 【9级】治疗 20% 攻击的生命。', target: '敌方', tags: [] },
    { kind: 'passive', name: '安静等候', desc: '开战回复 5 点元气。', target: '自身', tags: [] },
    { kind: 'awaken', name: '早起 / 晚睡', desc: '路线甲「早起」：普攻回复 3 点元气。 路线乙「晚睡」：绝技治疗 30% 攻击的生命。', target: '五星择一路线', tags: [] },
  ];
  return { heroes: [{ id: 'test_cat', name: '试试喵' }], kits: { test_cat: kit }, skills: { test_cat: skills },
    skillsSource: 'export const SKILLS = { test_cat: FROM_KIT(KITS_SR.test_cat, [], []) };' };
}
function display(sources: SkillConsistencySources): SkillDef[] {
  return sources.skills[sources.heroes[0].id] as SkillDef[];
}
function legacyFixture(): SkillConsistencySources {
  const original = fixture();
  const id = 'wei_caomiaode';
  const kit = original.kits.test_cat;
  kit.heroId = id;
  return { heroes: [{ id, name: '曹喵德' }], kits: { [id]: kit }, skills: { [id]: original.skills.test_cat },
    skillsSource: `export const SKILLS = { ${id}: [S(), S(), S(), S()] };` };
}

describe('skill display consistency', () => {
  it('accepts the fixed FROM_KIT contract without mutating any source', () => {
    const sources = fixture();
    const before = structuredClone(sources);
    expect(checkSkillConsistency(sources)).toMatchObject({ heroes: 1, fromKit: 1, legacy: 0, errors: 0, reviews: 0, findings: [] });
    expect(sources).toEqual(before);
  });

  it.each([
    ['missing Lv6', (skills: SkillDef[]) => { skills[1].desc = skills[1].desc.replace(' 【6级】自身获得 10% 攻击的护盾。', ''); }, 'ultimate.desc'],
    ['changed percentage', (skills: SkillDef[]) => { skills[0].desc = '造成 101% 攻击的伤害。'; }, 'basic.desc'],
    ['changed upgrade number', (skills: SkillDef[]) => { skills[1].desc = skills[1].desc.replace('回复 8 点', '回复 9 点'); }, 'ultimate.desc'],
    ['lost B route', (skills: SkillDef[]) => { skills[3].desc = '路线甲「早起」：普攻回复 3 点元气。'; }, 'awaken.desc'],
    ['lost B name', (skills: SkillDef[]) => { skills[3].name = '早起'; }, 'awaken.name'],
    ['swapped awakening labels', (skills: SkillDef[]) => { skills[3].desc = skills[3].desc.replace('路线甲', '路线乙'); }, 'awaken.desc'],
    ['internal name space', (skills: SkillDef[]) => { skills[0].name = '轻 爪'; }, 'basic.name'],
    ['trailing whitespace', (skills: SkillDef[]) => { skills[2].desc += ' '; }, 'passive.desc'],
    ['split numeric text', (skills: SkillDef[]) => { skills[0].desc = '造成 10 0% 攻击的伤害。'; }, 'basic.desc'],
  ] as const)('detects %s while all four kinds remain', (_label, mutate, field) => {
    const sources = fixture();
    mutate(display(sources));
    expect(display(sources)).toHaveLength(4);
    const report = checkSkillConsistency(sources);
    expect(report.errors).toBe(1);
    expect(report.findings[0]).toMatchObject({ severity: 'error', rule: 'text', heroId: 'test_cat', field: `SKILLS.test_cat.${field}`, line: 1 });
    expect(report.findings[0].expected).toBeTruthy();
    expect(report.findings[0].actual).not.toBe(report.findings[0].expected);
    expect(skillConsistencyExitCode(report, false)).toBe(1);
  });

  it('detects duplicate kinds and a missing kind even with four entries', () => {
    const sources = fixture();
    display(sources)[3].kind = 'basic';
    const report = checkSkillConsistency(sources);
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'duplicate', field: 'SKILLS.test_cat.basic' }),
      expect.objectContaining({ rule: 'kind', field: 'SKILLS.test_cat.awaken' }),
    ]));
  });

  it('rejects an unknown kind and extra fifth entry', () => {
    const sources = fixture();
    display(sources).push({ ...display(sources)[0], kind: 'unknown' as SkillDef['kind'] });
    expect(checkSkillConsistency(sources).findings.filter((finding) => finding.rule === 'kind')).toHaveLength(2);
  });

  it.each(['skills', 'kits'] as const)('reports missing and extra %s hero ids', (table) => {
    const sources = fixture();
    const entries = sources[table] as Record<string, unknown>;
    entries.stranger = entries.test_cat;
    delete entries.test_cat;
    const report = checkSkillConsistency(sources);
    expect(report.findings.some((finding) => finding.rule === 'coverage' && finding.heroId === 'stranger')).toBe(true);
    expect(report.findings.some((finding) => finding.rule === 'coverage' && finding.heroId === 'test_cat')).toBe(true);
    expect(skillConsistencyExitCode(report, false)).toBe(1);
  });

  it('reports a duplicate HEROES id and mismatched kit heroId', () => {
    const sources = fixture();
    (sources.heroes as { id: string; name: string }[]).push({ ...sources.heroes[0] });
    sources.kits.test_cat.heroId = 'other_cat';
    expect(checkSkillConsistency(sources).findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'duplicate', field: 'HEROES.id' }),
      expect.objectContaining({ rule: 'coverage', field: 'KITS.test_cat.heroId' }),
    ]));
  });

  it('detects duplicate combat skill ids across otherwise valid cats', () => {
    const sources = fixture();
    const other = structuredClone(sources.kits.test_cat);
    other.heroId = 'other_cat'; other.basic.id = 'other_basic'; other.passive.id = 'other_passive';
    sources.kits = { ...sources.kits, other_cat: other };
    sources.skills = { ...sources.skills, other_cat: structuredClone(display(sources)) };
    sources.heroes = [...sources.heroes, { id: 'other_cat', name: '另只喵' }];
    sources.skillsSource = 'export const SKILLS = { test_cat: FROM_KIT(KITS_SR.test_cat), other_cat: FROM_KIT(KITS_SR.other_cat) };';
    expect(checkSkillConsistency(sources).findings).toEqual([
      expect.objectContaining({ rule: 'duplicate', heroId: 'other_cat', field: 'KITS.other_cat.ultimate.id' }),
    ]);
  });

  it.each([
    [3, 9], [3, 6, 6], [6, 3, 9], [3, 6, 9, 10],
  ])('rejects missing, duplicate or reordered upgrade levels %j', (...levels) => {
    const sources = fixture();
    const mod = sources.kits.test_cat.ultimate.levelMods![0];
    sources.kits.test_cat.ultimate.levelMods = levels.map((lv) => ({ ...mod, lv }));
    expect(checkSkillConsistency(sources).findings.some((finding) => finding.rule === 'upgrade')).toBe(true);
  });

  it('checks only the current ultimate upgrade display convention', () => {
    const sources = fixture();
    sources.kits.test_cat.basic.levelMods = [{ lv: 2, desc: '普攻特殊词条。', patch: { skill: 'basic', scaleMul: 1.1 } }];
    expect(checkSkillConsistency(sources).errors).toBe(0);
  });

  it('reports missing B and whitespace fields even for an allowlisted legacy cat', () => {
    const sources = legacyFixture();
    display(sources)[0].desc = '\n\t  ';
    sources.kits.wei_caomiaode.passive.name = ' ';
    delete (sources.kits.wei_caomiaode.awaken as Partial<Kit['awaken']>).B;
    const report = checkSkillConsistency(sources);
    expect(report.findings.filter((finding) => finding.severity === 'error')).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'empty', field: 'SKILLS.wei_caomiaode.basic.desc' }),
      expect.objectContaining({ rule: 'empty', field: 'KITS.wei_caomiaode.passive.name' }),
      expect.objectContaining({ rule: 'coverage', field: 'KITS.wei_caomiaode.awaken.B' }),
    ]));
    expect(skillConsistencyExitCode(report, false)).toBe(1);
  });

  it('keeps legacy text differences reviewable, with full expected and actual text', () => {
    const sources = legacyFixture();
    display(sources)[1].desc = '造成 180% 攻击的伤害。';
    const report = checkSkillConsistency(sources);
    expect(report).toMatchObject({ fromKit: 0, legacy: 1, errors: 0, reviews: 1 });
    expect(report.findings[0]).toMatchObject({ severity: 'review', field: 'SKILLS.wei_caomiaode.ultimate.desc', actual: '造成 180% 攻击的伤害。' });
    expect(report.findings[0].expected).toContain('【6级】');
    expect(skillConsistencyExitCode(report, false)).toBe(0);
    expect(skillConsistencyExitCode(report, true)).toBe(1);
    expect(renderSkillConsistency(report)).toContain('wei_caomiaode');
  });

  it('does not infer exemptions for newly handwritten cats', () => {
    const sources = fixture();
    sources.skillsSource = 'export const SKILLS = { test_cat: [S(), S(), S(), S()] };';
    expect(checkSkillConsistency(sources).findings.some((finding) => finding.rule === 'source' && finding.severity === 'error')).toBe(true);
  });

  it('detects source key duplication hidden by the runtime object and a wrong kit reference', () => {
    const sources = fixture();
    sources.skillsSource = 'export const SKILLS = { test_cat: FROM_KIT(KITS_SR.test_cat), test_cat: FROM_KIT(KITS_SR.other_cat) };';
    const report = checkSkillConsistency(sources);
    expect(report.findings.filter((finding) => finding.rule === 'source')).toHaveLength(2);
  });

  it('handles quoted keys and does not treat comments or literal strings as origins', () => {
    const sources = fixture();
    sources.skillsSource = '// ghost: FROM_KIT(KITS_SR.ghost)\nconst note = "FROM_KIT(fake)";\nexport const SKILLS = { "test_cat": (FROM_KIT(KITS_SR["test_cat"])) } satisfies Record<string, unknown>;';
    expect(checkSkillConsistency(sources)).toMatchObject({ fromKit: 1, errors: 0 });
  });

  it.each(['const OTHER = {};', 'export const SKILLS = makeSkills();', 'export const SKILLS = { ...OTHER };'])('rejects unsupported source %s', (skillsSource) => {
    const sources = fixture(); sources.skillsSource = skillsSource;
    expect(checkSkillConsistency(sources).findings.some((finding) => finding.rule === 'source')).toBe(true);
  });

  it('matches the real source, with review exemptions confined to the six old summaries', () => {
    const sources = realSkillSources(readFileSync(sourcePath, 'utf8'));
    const report = checkSkillConsistency(sources);
    expect(report.errors).toBe(0);
    expect(report.heroes).toBe(sources.heroes.length);
    expect(report.fromKit + report.legacy).toBe(report.heroes);
    const allowed = new Set([
      'wei_caomiaode', 'shu_liumiaobei', 'wu_zhoumiaoyu', 'qun_lvbuding', 'man_mengmiaohuo', 'xian_zuoci',
    ]);
    expect(report.legacy).toBeLessThanOrEqual(allowed.size);
    for (const finding of report.findings) expect(allowed.has(finding.heroId)).toBe(true);
  });
});

describe('real skill consistency CLI', () => {
  it('parses default, strict, JSON and help and refuses invalid flags', () => {
    expect(parseSkillConsistencyArgs([])).toEqual({ strict: false, json: false, help: false });
    expect(parseSkillConsistencyArgs(['--strict', '--json', '-h'])).toEqual({ strict: true, json: true, help: true });
    expect(() => parseSkillConsistencyArgs(['--strict=false'])).toThrow();
    expect(() => parseSkillConsistencyArgs(['--unknown'])).toThrow();
  });

  it('runs from another cwd, resolves actual files and returns full JSON', () => {
    const report = JSON.parse(execFileSync(process.execPath, [runner, '--json'], { cwd: tmpdir(), encoding: 'utf8' })) as SkillConsistencyReport;
    expect(report).toEqual(checkSkillConsistency(realSkillSources(readFileSync(sourcePath, 'utf8'))));
    for (const finding of report.findings) {
      expect(finding).toHaveProperty('expected');
      expect(finding).toHaveProperty('actual');
    }
  });

  it('returns strict failure while preserving parseable JSON for legacy review', () => {
    const result = spawnSync(process.execPath, [runner, '--json', '--strict'], { encoding: 'utf8' });
    const expected = checkSkillConsistency(realSkillSources(readFileSync(sourcePath, 'utf8')));
    expect(result.status).toBe(skillConsistencyExitCode(expected, true));
    expect(JSON.parse(result.stdout)).toEqual(expected);
    expect(result.stderr).toBe('');
  });

  it('prints a readable default report and supports help', () => {
    const expected = checkSkillConsistency(realSkillSources(readFileSync(sourcePath, 'utf8')));
    expect(execFileSync(process.execPath, [runner], { encoding: 'utf8' })).toBe(renderSkillConsistency(expected));
    const help = spawnSync(process.execPath, [runner, '--help'], { encoding: 'utf8' });
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('lint:skills');
    expect(help.stdout).not.toContain('[review]');
  });

  it('returns usage error 2 for unknown parameters', () => {
    const result = spawnSync(process.execPath, [runner, '--bad-flag'], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('--bad-flag');
  });
});
