import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintExitCode, lintSource, resolveOptions } from '../tools/lint-content';

const file = 'src/data/fixture.ts';
const prose = (text: string) => `const cat = { lore: ${JSON.stringify(text)} };`;
const matching = (source: string, rule: 'sentence-length' | 'english' | 'violence' | 'terminology', maxSentenceLength = 50) =>
  lintSource(source, file, { maxSentenceLength }).findings.filter((finding) => finding.rule === rule);

describe('内容检查：源码技术上下文', () => {
  it('注释中的引号、禁字和英文不是字符串节点，不计入总量', () => {
    const source = [
      '// const desc = "hello，金币，杀猫。";',
      '/* `血流成河 ${"死了"}` */',
      'const count = 1;',
    ].join('\n');
    expect(lintSource(source, file)).toMatchObject({ findings: [], scanned: 0, allowlisted: 0 });
  });

  it('路径、类型字面量、id、色值和 DSL 明确豁免；中文文案仍计为扫描节点', () => {
    const source = [
      "import type { Kit } from '../engine/types';",
      "type Side = 'A' | 'B';",
      "type Mode = 'basic' | 'ultimate';",
      'const cat = {',
      "  id: 'miao_test', heroId: 'shu_guanyunmiao', color: '#c0ffee', fx: 'ult.catFan',",
      "  effects: [{ t: 'damage', elem: 'phys', to: { side: 'enemy', pick: 'all' } }],",
      "  desc: '请伸爪。',",
      '};',
    ].join('\n');
    expect(lintSource(source, file)).toMatchObject({ findings: [], scanned: 14, allowlisted: 13 });
  });

  it('相同 id 形态出现在 desc 时必须检查，不能按字符串外形整体跳过', () => {
    const source = "const cat = { id: 'cat_sleep', desc: 'cat_sleep' };";
    const r = lintSource(source, file);
    expect(r.scanned).toBe(2);
    expect(r.allowlisted).toBe(1);
    expect(r.findings.some((finding) => finding.rule === 'english')).toBe(true);
    expect(r.findings.every((finding) => finding.column > 30)).toBe(true);
  });

  it('quoted property names 是技术上下文，不能替它们的文案值放行', () => {
    const r = lintSource("const cat = { 'id': 'miao_test', 'desc': 'hello' };", file);
    expect(r.scanned).toBe(4);
    expect(r.allowlisted).toBe(3);
    expect(r.findings.map((finding) => ({ rule: finding.rule, text: finding.text }))).toEqual([{ rule: 'english', text: 'hello' }]);
  });

  it('文案字段即使是英文、枚举或纯色值，也不能误判为技术节点', () => {
    const source = [
      'const cat = {',
      "  desc: 'cat_sleep',",
      "  name: 'magic',",
      "  quote: '#abcdef',",
      "  lore: 'helloKitty 猫猫不加班。',",
      '};',
    ].join('\n');
    const r = lintSource(source, file);
    expect(r.scanned).toBe(4);
    expect(r.allowlisted).toBe(0);
    for (const line of [2, 3, 4, 5]) expect(r.findings.some((finding) => finding.rule === 'english' && finding.line === line)).toBe(true);
  });

  it('未声明技术用途的数组元素和普通变量也要检查，不能仅扫描 desc', () => {
    const source = "const slogan = 'hello'; const lines = ['kitty'];";
    expect(matching(source, 'english').map((finding) => finding.text)).toEqual(['hello', 'kitty']);
  });

  it('明确英文词白名单可用于文案，但不把整段文案计为技术豁免', () => {
    const source = prose('sr SSR ur SP HP ATK DEF PVP PVE DOT UP Boss Lv Lv3。');
    const r = lintSource(source, file, { maxSentenceLength: 200 });
    expect(r).toMatchObject({ findings: [], scanned: 1, allowlisted: 0 });
  });

  it('白名单只豁免完整词，不能吞掉混在词中的英文', () => {
    const source = prose('helloSSR 来吃饭。');
    expect(matching(source, 'english').map((finding) => finding.text)).toEqual(['helloSSR']);
  });

  it('文案占位符只豁免其中的变量名，不能连同周围英文整体放行', () => {
    const r = lintSource(prose('hi @{me}，来吃饭。'), file);
    expect(r.scanned).toBe(1);
    expect(r.allowlisted).toBe(0);
    expect(r.findings.map(({ rule, text }) => ({ rule, text }))).toEqual([{ rule: 'english', text: 'hi' }]);
  });

  it('pieceFlavors 的 head/weapon 是文案，不能继承 CatLook outfit 的枚举豁免', () => {
    const source = [
      "const pieceFlavors = { head: 'helmetGeneral', weapon: 'spear' };",
      "const hero = { look: { outfit: { head: 'helmetGeneral', weapon: 'spear' } } };",
    ].join('\n');
    const r = lintSource(source, file);
    expect(r.scanned).toBe(4);
    expect(r.allowlisted).toBe(2);
    expect(r.findings.map(({ rule, text, line }) => ({ rule, text, line }))).toEqual([
      { rule: 'english', text: 'helmetGeneral', line: 1 },
      { rule: 'english', text: 'spear', line: 1 },
    ]);
  });
});

describe('内容检查：逐句长度', () => {
  it('默认50字边界：恰好50不报，51字报告该句', () => {
    const fifty = '猫'.repeat(50);
    expect(matching(prose(`${fifty}。`), 'sentence-length')).toEqual([]);
    const long = matching(prose(`${fifty}猫。`), 'sentence-length');
    expect(long).toHaveLength(1);
    expect(long[0].text).toBe(`${fifty}猫`);
  });

  it.each(['。', '！', '？', '!', '?', '.', '\n'])('按 %j 分句，不把多句 lore 全文算作一句', (separator) => {
    const r = lintSource(prose(`${'猫'.repeat(30)}${separator}${'喵'.repeat(30)}`), file);
    expect(r.scanned).toBe(1);
    expect(r.findings.filter((finding) => finding.rule === 'sentence-length')).toEqual([]);
  });

  it('按 Unicode 码点计数，两个猫表情不当作四个字', () => {
    expect(matching(prose('🐱🐱。'), 'sentence-length', 2)).toEqual([]);
    const r = matching(prose('🐱🐱🐱。'), 'sentence-length', 2);
    expect(r).toHaveLength(1);
    expect(r[0].text).toBe('🐱🐱🐱');
  });

  it('句末标点与两端空白不占警示长度', () => {
    expect(matching(prose('  猫猫！？  '), 'sentence-length', 2)).toEqual([]);
  });

  it('小数点不是句末，长句中的1.25不能把长句拆短', () => {
    const text = `${'猫'.repeat(25)}1.25${'喵'.repeat(25)}`;
    const r = matching(prose(`${text}。`), 'sentence-length');
    expect(r).toHaveLength(1);
    expect(r[0].text).toBe(text);
  });

  it('自定义阈值改变真实文案结果，短句仍不误报', () => {
    const source = prose('猫猫猫猫猫猫。喵喵。');
    expect(matching(source, 'sentence-length')).toEqual([]);
    expect(matching(source, 'sentence-length', 5).map((finding) => finding.text)).toEqual(['猫猫猫猫猫猫']);
  });
});

describe('内容检查：禁字、战斗词白名单与统一术语', () => {
  it('头破血流、杀猫、死了分别报告禁字', () => {
    const r = matching(prose('头破血流，杀猫，死了。'), 'violence');
    expect(r.map((finding) => finding.text)).toEqual(['血', '杀', '死']);
    expect(r.every((finding) => finding.message.length > 0)).toBe(true);
  });

  it('击杀等明确战斗词可用于规则描述，不按单字误报', () => {
    const text = '击杀、斩杀、击杀数、死亡、免死、濒死、血量、血条、回血、满血、残血、低血、吸血、热血、心血。';
    expect(matching(prose(text), 'violence', 200)).toEqual([]);
  });

  it('同句含白名单词仍检查其余禁字，不能全句豁免', () => {
    const text = '击杀后不能杀猫，血量足也不能血流成河，免死不是死了。';
    expect(matching(prose(text), 'violence').map((finding) => finding.text)).toEqual(['杀', '血', '死']);
  });

  it('金币、钻石、怒气分别给出项目术语建议', () => {
    const r = matching(prose('金币和钻石用完了，再攒怒气。'), 'terminology');
    expect(r.map((finding) => finding.text)).toEqual(['金币', '钻石', '怒气']);
    for (const [old, correct] of [['金币', '小鱼干'], ['钻石', '金铃铛'], ['怒气', '元气']]) {
      expect(r.find((finding) => finding.text === old)?.message).toContain(correct);
    }
  });

  it('正式猫式术语与睡着描述不产生警示', () => {
    const r = lintSource(prose('小鱼干、金铃铛、猫薄荷、毛线球、招福符、猫爪印和元气，睡着后再慢慢数。'), file);
    expect(r.findings).toEqual([]);
  });
});

describe('内容检查：模板片段与源码位置', () => {
  it('位置从1起，指向违规词而非引号或所在对象', () => {
    const source = [
      'const docs = [',
      "  { text: '金币' },",
      "  { text: '猫猫 hello。' },",
      '];',
    ].join('\n');
    const positions = lintSource(source, 'src/content/fixture.ts').findings.map(({ rule, text, line, column }) => ({ rule, text, line, column }));
    expect(positions).toEqual([
      { rule: 'terminology', text: '金币', line: 2, column: 12 },
      { rule: 'english', text: 'hello', line: 3, column: 15 },
    ]);
  });

  it('Template Head、Middle、Tail 全检查，行列跟随实际源码换行', () => {
    const source = [
      "const name = '军师';",
      'const lore = `金币${name}',
      '猫 hello${name}钻石！`;',
    ].join('\n');
    const r = lintSource(source, file);
    expect(r.scanned).toBe(4);
    expect(r.allowlisted).toBe(0);
    expect(r.findings.map(({ rule, text, line, column }) => ({ rule, text, line, column }))).toEqual([
      { rule: 'terminology', text: '金币', line: 2, column: 15 },
      { rule: 'english', text: 'hello', line: 3, column: 3 },
      { rule: 'terminology', text: '钻石', line: 3, column: 15 },
    ]);
  });

  it('模板插值中的字符串也检查，表达式不被当成文本重复检查', () => {
    const source = 'const text = `头${"金币"}中${"hello"}尾${"钻石"}末`;';
    const r = lintSource(source, file);
    expect(r.scanned).toBe(7);
    expect(r.findings.map(({ rule, text }) => ({ rule, text }))).toEqual([
      { rule: 'terminology', text: '金币' },
      { rule: 'english', text: 'hello' },
      { rule: 'terminology', text: '钻石' },
    ]);
  });

  it('解码转义后的词仍定位原始源码，不把转义换行算作文件换行', () => {
    const source = String.raw`const desc = '喵\n金币\u0020hello';`;
    expect(lintSource(source, file).findings.map(({ rule, text, line, column }) => ({ rule, text, line, column }))).toEqual([
      { rule: 'terminology', text: '金币', line: 1, column: 18 },
      { rule: 'english', text: 'hello', line: 1, column: 26 },
    ]);
  });

  it('完全用 Unicode 转义写出的非统一术语仍报告，并指向首个转义', () => {
    const source = String.raw`const desc = '\u91d1\u5e01';`;
    expect(lintSource(source, file).findings.map(({ rule, text, line, column }) => ({ rule, text, line, column }))).toEqual([
      { rule: 'terminology', text: '金币', line: 1, column: 15 },
    ]);
  });
});

describe('内容检查：命令行参数与退出码', () => {
  it('默认警示阈值50且不启用strict或help', () => {
    expect(resolveOptions([])).toEqual({ maxSentenceLength: 50, strict: false, help: false });
  });

  it.each([
    ['--max', '5'], ['--max=5'], ['--max-sentence-length', '5'], ['--max-sentence-length=5'],
  ])('%j 解析阈值后实际改变检查结果，并保留strict开关', (...args) => {
    const options = resolveOptions([...args, '--strict']);
    expect(options).toEqual({ maxSentenceLength: 5, strict: true, help: false });
    const r = lintSource(prose('猫猫猫猫猫猫。'), file, options);
    expect(r.findings.map((finding) => finding.rule)).toEqual(['sentence-length']);
    expect(lintExitCode(r.findings, options.strict)).toBe(1);
  });

  it('help与短参数-h可识别，strict不影响阈值', () => {
    expect(resolveOptions(['--help']).help).toBe(true);
    expect(resolveOptions(['-h']).help).toBe(true);
    expect(resolveOptions(['--strict'])).toEqual({ maxSentenceLength: 50, strict: true, help: false });
  });

  it('非法阈值、缺值、未知开关与意外位置参数均拒绝', () => {
    const invalid = [
      ['--max'], ['--max-sentence-length'], ['--max', '--strict'],
      ['--max=0'], ['--max=-1'], ['--max=1.5'], ['--max=NaN'], ['--max=Infinity'],
      ['--max=9007199254740992'], ['--max=abc'], ['--max='], ['--max=5=1'],
      ['--unknown'], ['--strict=true'], ['src/content/fixture.ts'],
    ];
    for (const args of invalid) expect(() => resolveOptions(args), args.join(' ')).toThrow();
  });

  it('有警示时默认仍成功，只有strict失败；空报告始终成功', () => {
    const flagged = lintSource(prose('金币。'), file).findings;
    const clean = lintSource(prose('小鱼干。'), file).findings;
    expect(flagged).not.toEqual([]);
    expect(clean).toEqual([]);
    expect(lintExitCode(flagged, false)).toBe(0);
    expect(lintExitCode(flagged, true)).toBe(1);
    expect(lintExitCode(clean, false)).toBe(0);
    expect(lintExitCode(clean, true)).toBe(0);
  });
});

const runner = fileURLToPath(new URL('../tools/run-lint-content.mjs', import.meta.url));
function withCliFixture(data: string, verify: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'cat-content-lint-'));
  try {
    mkdirSync(join(directory, 'src', 'content'), { recursive: true });
    mkdirSync(join(directory, 'src', 'data'), { recursive: true });
    writeFileSync(join(directory, 'src', 'content', 'quiet.ts'), "const quiet = { desc: '好。' };", 'utf8');
    writeFileSync(join(directory, 'src', 'data', 'fixture.ts'), data, 'utf8');
    verify(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
function cli(directory: string, args: string[] = []) {
  const result = spawnSync(process.execPath, [runner, ...args], { cwd: directory, encoding: 'utf8', timeout: 10_000 });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return { status: result.status, output: result.stdout + result.stderr };
}

describe('内容检查：真实 CLI 与固定源码目录', () => {
  it('默认报告成功，strict对同一警示报告退出1，并包含相对源码位置', () => {
    withCliFixture("const cat = { desc: '金币。' };", (directory) => {
      const warning = cli(directory);
      const strict = cli(directory, ['--strict']);
      expect(warning.status).toBe(0);
      expect(strict.status).toBe(1);
      for (const result of [warning, strict]) {
        expect(result.output).toContain('src/data/fixture.ts:1:');
        expect(result.output).toContain('[terminology]');
        expect(result.output).toContain('小鱼干');
        expect(result.output).toContain('terminology=1');
      }
    });
  }, 20_000);

  it('strict对无问题固定源码也成功，报告保留零警示计数', () => {
    withCliFixture("const cat = { desc: '请收好小鱼干。' };", (directory) => {
      const result = cli(directory, ['--strict']);
      expect(result.status).toBe(0);
      for (const rule of ['sentence-length', 'english', 'violence', 'terminology']) expect(result.output).toContain(`${rule}=0`);
    });
  }, 20_000);

  it('真实 --max 参数改变报告及strict退出码，不能只解析后丢掉阈值', () => {
    withCliFixture("const cat = { desc: '猫猫猫猫。' };", (directory) => {
      const ordinary = cli(directory, ['--strict']);
      const short = cli(directory, ['--strict', '--max', '3']);
      expect(ordinary.status).toBe(0);
      expect(ordinary.output).toContain('sentence-length=0');
      expect(short.status).toBe(1);
      expect(short.output).toContain('[sentence-length]');
      expect(short.output).toContain('sentence-length=1');
    });
  }, 20_000);

  it('真实 CLI拒绝非法阈值与未知开关，不能静默退回默认值', () => {
    withCliFixture("const cat = { desc: '请伸爪。' };", (directory) => {
      expect(cli(directory, ['--max-sentence-length=0']).status).toBe(2);
      expect(cli(directory, ['--unknown']).status).toBe(2);
    });
  }, 20_000);
});
