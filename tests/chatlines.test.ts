import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as L from '../src/data/chatlines';
import { NPCS } from '../src/game/npc';
import type { ChatMsg } from '../src/game/npc';
import { renderChatlineWeek, SAMPLE_SEED, summarizeChatFeed, WEEK_END_UTC, WEEK_START_UTC } from '../tools/chatlines-week';
import type { ChatlineWeekReport } from '../tools/chatlines-week';

interface Pool { name: string; lines: string[] }
const pools: Pool[] = [];
for (const [name, value] of Object.entries(L)) {
  if (name === 'REPLY_RULES') continue; // 规则引用已有池，不复制计数。
  if (Array.isArray(value)) pools.push({ name, lines: value as string[] });
  else {
    for (const [key, lines] of Object.entries(value)) pools.push({ name: name + '.' + key, lines: lines as string[] });
  }
}
const lines = pools.flatMap((p) => p.lines);
const replies = pools.filter((p) => p.name.startsWith('REPLY_'));

describe('世界频道手写语料', () => {
  it('四时段问候各至少12句，其余公开普通池各至少25句', () => {
    expect(pools.filter((p) => p.name.startsWith('GREET_'))).toHaveLength(4);
    for (const pool of pools.filter((p) => !p.name.startsWith('REPLY_') && !p.name.startsWith('NPC_LINES.'))) {
      expect(pool.lines.length, pool.name).toBeGreaterThanOrEqual(pool.name.startsWith('GREET_') ? 12 : 25);
    }
  });
  it('六阵营齐全，每个阵营至少25句', () => {
    expect(Object.keys(L.FACTION_TALK).sort()).toEqual(['man', 'qun', 'shu', 'wei', 'wu', 'xian']);
    Object.values(L.FACTION_TALK).forEach((pool) => expect(pool.length).toBeGreaterThanOrEqual(25));
  });
  it('逐章心得覆盖当前六章，各至少25句', () => {
    expect(Object.keys(L.CHAPTER_TALK)).toEqual(['1', '2', '3', '4', '5', '6']);
    Object.values(L.CHAPTER_TALK).forEach((pool) => expect(pool.length).toBeGreaterThanOrEqual(25));
  });
  it('全部原回应池保留，新回应池每类也至少15句', () => {
    for (const name of ['REPLY_GENERIC', 'REPLY_GREET', 'REPLY_HELP', 'REPLY_GACHA', 'REPLY_WHALE', 'REPLY_LAUGH', 'REPLY_ARENA']) {
      expect(replies.some((pool) => pool.name === name), name).toBe(true);
    }
    expect(replies).toHaveLength(11);
    replies.forEach((pool) => expect(pool.lines.length, pool.name).toBeGreaterThanOrEqual(15));
  });
  it('20位NPC每人4至6句，没有额外虚构NPC', () => {
    expect(Object.keys(L.NPC_LINES).sort()).toEqual(NPCS.map((n) => n.id).sort());
    for (const npc of NPCS) {
      expect(L.NPC_LINES[npc.id].length, npc.name).toBeGreaterThanOrEqual(4);
      expect(L.NPC_LINES[npc.id].length, npc.name).toBeLessThanOrEqual(6);
    }
  });
  it('每句非空且不超过40个Unicode码点', () => {
    for (const pool of pools) for (const text of pool.lines) {
      expect(typeof text, pool.name).toBe('string');
      expect(text.trim().length, pool.name).toBeGreaterThan(0);
      expect(Array.from(text).length, pool.name + ': ' + text).toBeLessThanOrEqual(40);
    }
  });
  it('全表无重复句，不用空白或标点差异凑新句', () => {
    expect(new Set(lines).size).toBe(lines.length);
    const normalized = lines.map((text) => text.replace(/[\s，。！？、；：,.!?;:“”‘’]/gu, ''));
    expect(new Set(normalized).size).toBe(lines.length);
  });
  it('占位符仅六种且花括号配对，没有英文玩家文案', () => {
    const allowed = new Set(['stage', 'hero', 'hero2', 'faction', 'me', 'who']);
    for (const text of lines) {
      for (const match of text.matchAll(/\{([^{}]*)\}/g)) expect(allowed.has(match[1]), text).toBe(true);
      const plain = text.replace(/\{(?:stage|hero2?|faction|me|who)\}/g, '');
      expect(plain, text).not.toMatch(/[{}]/);
      expect(plain, text).not.toMatch(/[a-z]/i);
    }
  });
  it('无血腥辱骂与网络烂梗，资源称呼统一', () => {
    const forbidden = /血|杀|死|屠|戮|虐待|砍头|傻逼|笨蛋|废物|垃圾|滚开|欧皇|欧气|笑死|土豪|膝盖|躺平|绝绝子|破防|233|yyds|金币|钻石|怒气/i;
    for (const text of lines) expect(text, text).not.toMatch(forbidden);
  });
  it('不宣称钟点改变概率或下一次必出，也不限制福利领取频率', () => {
    for (const text of lines) {
      expect(text, text).not.toMatch(/(?:凌晨|深夜|半夜).{0,8}(?:概率|出货).{0,4}(?:最高|更高|提升)|必出|必抽到|下次一定出|每天只能领一次|每日免费一抽/);
    }
    expect(L.NPC_LINES.n14.filter((text) => /概率/.test(text))).toHaveLength(1);
  });
  it('六条克制方向与现有克制环一致', () => {
    for (const direction of ['魏克制群', '群遇上蜀', '蜀克制蛮', '蛮克制吴', '吴克制仙', '仙克制魏']) {
      expect(L.COUNTER_TALK.some((text) => text.includes(direction)), direction).toBe(true);
    }
  });
});

describe('回应意图关键词数据（尚未替换repliesTo）', () => {
  it('恰好六类、引用公开池，正则没有跨次调用状态', () => {
    expect(L.REPLY_RULES).toHaveLength(6);
    for (const rule of L.REPLY_RULES) {
      expect(rule.test).toBeInstanceOf(RegExp);
      expect(rule.test.global).toBe(false);
      expect(rule.test.sticky).toBe(false);
      expect(replies.some((pool) => pool.lines === rule.pool)).toBe(true);
    }
  });
  it.each([
    ['这个阵容怎么换？', L.REPLY_HELP],
    ['关卡过不去，有点发愁', L.REPLY_COMPLAINT],
    ['抽到新同伴，今天好消息！', L.REPLY_BRAG],
    ['你的猫真好看，谢谢分享', L.REPLY_PRAISE],
    ['今晚先下了，明天见', L.REPLY_FAREWELL],
    ['大家好，来广场坐坐', L.REPLY_GREET],
  ])('能区分意图：%s', (text, pool) => {
    expect(L.REPLY_RULES.find((rule) => rule.test.test(text))?.pool).toBe(pool);
  });
  it('多意图优先求助，晚安不落入问候，陌生内容留给消费端回退', () => {
    expect(L.REPLY_RULES.find((r) => r.test.test('抽到了，但怎么搭配？'))?.pool).toBe(L.REPLY_HELP);
    expect(L.REPLY_RULES.find((r) => r.test.test('晚安，我去睡啦'))?.pool).toBe(L.REPLY_FAREWELL);
    expect(L.REPLY_RULES.find((r) => r.test.test('窗台的花开了一朵'))).toBeUndefined();
  });
});

const msg = (id: string, t: number, text: string, kind: ChatMsg['kind'] = 'chat', from = 'n01'): ChatMsg =>
  ({ id, t, text, kind, from, name: from });

describe('真实一周统计口径', () => {
  it('按完整文本判同句，跨作者计重复；边界含十分钟，不含十分钟加1毫秒', () => {
    const fixture = [
      msg('c', 1_200_001, '窗台有猫。'),
      msg('b', 600_000, '窗台有猫。', 'reply', 'n02'),
      msg('a', 0, '窗台有猫。'),
      msg('sys', 300_000, '窗台有猫。', 'sys'),
      msg('different', 100, '窗台有猫，叫阿团。'),
      msg('outside', 2_000_000, '窗外有鸟。'),
    ];
    const before = structuredClone(fixture);
    const report = summarizeChatFeed(fixture, 0, 1_200_001);
    expect(report.messages).toBe(5);
    expect(report.nonSystemMessages).toBe(4);
    expect(report.uniqueNonSystem).toBe(2);
    expect(report.rolling10MinuteDuplicates).toBe(1);
    expect(report.rolling10MinuteRepeatRate).toBe(0.25);
    expect(report.repeatExamples[0].previous.id).toBe('a');
    expect(report.repeatExamples[0].repeated.id).toBe('b');
    expect(fixture).toEqual(before);
  });
  it('无消息与仅系统消息都给0重复率，范围非法则拒绝', () => {
    const empty = summarizeChatFeed([], 0, 1);
    expect(empty.uniqueNonSystem).toBe(0);
    expect(empty.rolling10MinuteRepeatRate).toBe(0);
    const system = summarizeChatFeed([msg('s', 0, '午间提醒', 'sys')], 0, 1);
    expect(system.uniqueAll).toBe(1);
    expect(system.nonSystemMessages).toBe(0);
    expect(() => summarizeChatFeed([], 2, 1)).toThrow();
    expect(() => summarizeChatFeed([], NaN, 1)).toThrow();
  });
  it('20条样本由真实消息id固定随机选，打乱输入不变且不引入新句', () => {
    const fixture = Array.from({ length: 50 }, (_, i) => msg('m' + i, i, '第' + i + '张猫垫。'));
    const report = summarizeChatFeed(fixture, 0, 49);
    expect(report.samples).toHaveLength(20);
    expect(report.samples).toEqual(summarizeChatFeed([...fixture].reverse(), 0, 49).samples);
    expect(new Set(report.samples.map((m) => m.id)).size).toBe(20);
    report.samples.forEach((m) => expect(fixture).toContain(m));
    expect(report.samples).not.toEqual(summarizeChatFeed(fixture, 0, 49, SAMPLE_SEED + 1).samples);
  });
  it('runner固定UTC，真实worldFeed七天完整非系统台词至少600条，样本已填充', () => {
    const runner = fileURLToPath(new URL('../tools/run-chatlines-week.mjs', import.meta.url));
    const report = JSON.parse(execFileSync(process.execPath, [runner, '--json'], {
      encoding: 'utf8', env: { ...process.env, TZ: 'Asia/Shanghai' },
    })) as ChatlineWeekReport;
    expect(report.from).toBe(WEEK_START_UTC);
    expect(report.to).toBe(WEEK_END_UTC);
    expect(report.to - report.from + 1).toBe(7 * 86400000);
    expect(report.uniqueNonSystem).toBeGreaterThanOrEqual(600);
    expect(report.nonSystemMessages).toBeGreaterThan(report.uniqueNonSystem);
    expect(report.uniqueAll).toBeGreaterThanOrEqual(report.uniqueNonSystem);
    expect(report.rolling10MinuteRepeatRate).toBe(report.rolling10MinuteDuplicates / report.nonSystemMessages);
    expect(report.samples).toHaveLength(20);
    for (const m of report.samples) {
      expect(m.kind).not.toBe('sys');
      expect(m.t).toBeGreaterThanOrEqual(report.from);
      expect(m.t).toBeLessThanOrEqual(report.to);
      expect(m.text).not.toMatch(/[{}]/);
    }
    const rendered = renderChatlineWeek(report);
    expect(rendered).toContain('TZ=UTC');
    expect(rendered).toContain('未接入');
    report.samples.forEach((m) => expect(rendered).toContain(m.text));
  });
});
