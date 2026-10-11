import { rnd, worldFeed } from '../src/game/npc';
import type { ChatMsg } from '../src/game/npc';

export const WEEK_START_UTC = Date.UTC(2026, 9, 5);
export const WEEK_END_UTC = WEEK_START_UTC + 7 * 86400000 - 1;
export const SAMPLE_SEED = 20261005;
export const REPEAT_WINDOW_MS = 10 * 60000;

export interface RepeatedChatline {
  previous: ChatMsg;
  repeated: ChatMsg;
}
export interface ChatlineWeekReport {
  from: number;
  to: number;
  sampleSeed: number;
  messages: number;
  nonSystemMessages: number;
  uniqueAll: number;
  uniqueNonSystem: number;
  rolling10MinuteDuplicates: number;
  rolling10MinuteRepeatRate: number;
  repeatExamples: RepeatedChatline[];
  samples: ChatMsg[];
}

/** 完整渲染文本按全频道统计；系统公告不计重复率，跨作者重复仍计。 */
export function summarizeChatFeed(
  messages: readonly ChatMsg[], from: number, to: number, sampleSeed = SAMPLE_SEED,
): ChatlineWeekReport {
  if (![from, to, sampleSeed].every(Number.isSafeInteger) || to < from) {
    throw new Error('时间范围和样本种子须为安全整数，结束时间不能早于开始时间。');
  }
  const rows = messages.filter((m) => m.t >= from && m.t <= to)
    .sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const chat = rows.filter((m) => m.kind !== 'sys');
  const last = new Map<string, ChatMsg>();
  const repeatExamples: RepeatedChatline[] = [];
  let duplicates = 0;
  for (const m of chat) {
    const previous = last.get(m.text);
    if (previous && m.t - previous.t <= REPEAT_WINDOW_MS) {
      duplicates++;
      if (repeatExamples.length < 10) repeatExamples.push({ previous, repeated: m });
    }
    last.set(m.text, m);
  }
  // 固定种子对实际消息 id 评分，取最小的 20 条；不按内容挑选。
  const samples = [...chat].sort((a, b) =>
    rnd('issue50-sample', sampleSeed, a.id) - rnd('issue50-sample', sampleSeed, b.id)
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  ).slice(0, 20).sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
  return {
    from, to, sampleSeed, messages: rows.length, nonSystemMessages: chat.length,
    uniqueAll: new Set(rows.map((m) => m.text)).size,
    uniqueNonSystem: new Set(chat.map((m) => m.text)).size,
    rolling10MinuteDuplicates: duplicates,
    rolling10MinuteRepeatRate: chat.length ? duplicates / chat.length : 0,
    repeatExamples, samples,
  };
}

/** 调用方须在加载模块前将 TZ 设为 UTC；worldFeed 的作息与开服日使用本地时区。 */
export function simulateChatlineWeek(): ChatlineWeekReport {
  return summarizeChatFeed(worldFeed(WEEK_START_UTC, WEEK_END_UTC), WEEK_START_UTC, WEEK_END_UTC);
}

export function renderChatlineWeek(report: ChatlineWeekReport): string {
  const lines = [
    '# 世界频道七日复算',
    '',
    '时间：' + new Date(report.from).toISOString() + ' 至 ' + new Date(report.to).toISOString() + '；TZ=UTC。',
    '采样种子：' + report.sampleSeed + '。数据来自真实 worldFeed，完整文本已替换占位符。',
    '',
    '| 指标 | 结果 |',
    '|---|---:|',
    '| 全部消息 | ' + report.messages + ' |',
    '| 非系统消息 | ' + report.nonSystemMessages + ' |',
    '| 不同完整文本（含系统） | ' + report.uniqueAll + ' |',
    '| 不同完整文本（非系统） | ' + report.uniqueNonSystem + ' |',
    '| 滚动十分钟重复条数 | ' + report.rolling10MinuteDuplicates + ' |',
    '| 滚动十分钟重复率 | ' + (report.rolling10MinuteRepeatRate * 100).toFixed(3) + '% |',
    '',
    '重复：同一句非系统完整文本的相邻两次出现相隔不超过十分钟；分母为全部非系统消息。',
    '不同作者说同一句仍计重复。当前随机取池没有去重历史，统计值不承诺每个十分钟窗口零重复。',
    '未接入的章节/装备/塔/秘境/竞技/克制/天气/节日主题、NPC_LINES、REPLY_RULES不计此模拟。',
    '',
    '## 二十条固定种子随机样本',
    '',
    '| UTC时间 | 模拟玩家 | 完整聊天文本 |',
    '|---|---|---|',
  ];
  for (const m of report.samples) {
    lines.push('| ' + new Date(m.t).toISOString() + ' | ' + m.name + ' | ' + m.text.replace(/\|/g, '\\|') + ' |');
  }
  if (report.repeatExamples.length) {
    lines.push('', '## 十分钟重复观察', '', '| 首次UTC | 再次UTC | 完整文本 |', '|---|---|---|');
    for (const { previous, repeated } of report.repeatExamples) {
      lines.push('| ' + new Date(previous.t).toISOString() + ' | ' + new Date(repeated.t).toISOString()
        + ' | ' + repeated.text.replace(/\|/g, '\\|') + ' |');
    }
  }
  return lines.join('\n') + '\n';
}
