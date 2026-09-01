from pathlib import Path
import json
import re

verification = Path('docs/verification/NHK_BOSS_WORLD_BRIDGE_V1.json')
if verification.exists():
    try:
        if json.loads(verification.read_text(encoding='utf-8')).get('result') == 'PASS':
            Path('/tmp/boss_world_bridge_already_verified').write_text('1')
            raise SystemExit(0)
    except json.JSONDecodeError:
        pass

Path('src/nhkBossWorldBridge.ts').write_text(r'''import type {NhkMorningSession} from './nhkMorning';
import {shiftDateKey} from './nhkMorning';
import type {NhkSpeechReview} from './nhkSpeech';
import {
  buildNhkWeeklyBoss,
  type NhkWeeklyBossPlan,
  type NhkWeeklyBossRecord,
  type NhkWeeklyBossRound,
} from './nhkWeeklyBoss';

export type NhkBossWorldTarget = {
  version: 1;
  id: string;
  bossWeekKey: string;
  bossPlanId: string;
  hookJa: string;
  hookZh: string;
  speaker: string;
  situationZh: string;
  promptJa: string;
  targetExpression: string;
  expectedAnswerJa: string;
  sourceTitle: string;
};

export type NhkBossWorldResult = {
  version: 1;
  targetId: string;
  bossWeekKey: string;
  bossPlanId: string;
  transcript: string;
  characterReactionJa: string;
  characterReactionZh: string;
  targetExpressionUsed: boolean;
  contentScore: number;
  completedAt: number;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const BOSS_STORAGE_KEY = 'nihongo-nhk-weekly-boss-v1';
const BRIDGE_STORAGE_KEY = 'nihongo-nhk-boss-world-bridge-v1';
const MAX_RESULTS = 16;

const resolveStorage = (storage?: StorageLike): StorageLike | null => {
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? null : localStorage;
};

const weekStartFor = (todayKey: string): string => {
  const [year, month, day] = todayKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  return shiftDateKey(todayKey, weekday === 0 ? -6 : 1 - weekday);
};

const isBossRecord = (value: unknown): value is NhkWeeklyBossRecord => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<NhkWeeklyBossRecord>;
  return record.version === 1
    && typeof record.weekKey === 'string'
    && typeof record.planId === 'string'
    && typeof record.startedAt === 'number'
    && Array.isArray(record.results);
};

const isBridgeResult = (value: unknown): value is NhkBossWorldResult => {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<NhkBossWorldResult>;
  return result.version === 1
    && typeof result.targetId === 'string'
    && typeof result.bossPlanId === 'string'
    && typeof result.completedAt === 'number';
};

const parseArray = <T>(storage: StorageLike, key: string, guard: (value: unknown) => value is T): T[] => {
  try {
    const value = JSON.parse(storage.getItem(key) || '[]') as unknown;
    return Array.isArray(value) ? value.filter(guard) : [];
  } catch {
    return [];
  }
};

const roundForRecord = (
  sessions: NhkMorningSession[],
  record: NhkWeeklyBossRecord,
): {plan: NhkWeeklyBossPlan; round: NhkWeeklyBossRound} | null => {
  const lastDay = shiftDateKey(record.weekKey, 6);
  const plan = buildNhkWeeklyBoss(sessions, lastDay);
  if (!plan || plan.id !== record.planId) return null;
  const missedResult = record.results.find(result => !result.targetExpressionUsed);
  const round = missedResult
    ? plan.rounds.find(item => item.id === missedResult.roundId)
    : plan.rounds[plan.rounds.length - 1];
  return round ? {plan, round} : null;
};

export const pendingNhkBossWorldTarget = (
  sessions: NhkMorningSession[],
  todayKey: string,
  storage?: StorageLike,
): NhkBossWorldTarget | null => {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return null;
  const currentWeek = weekStartFor(todayKey);
  const completedBridgeIds = new Set(
    parseArray(targetStorage, BRIDGE_STORAGE_KEY, isBridgeResult).map(item => item.targetId),
  );
  const records = parseArray(targetStorage, BOSS_STORAGE_KEY, isBossRecord)
    .filter(record => Boolean(record.completedAt) && record.weekKey < currentWeek)
    .sort((left, right) => right.weekKey.localeCompare(left.weekKey));
  for (const record of records) {
    const resolved = roundForRecord(sessions, record);
    if (!resolved) continue;
    const {plan, round} = resolved;
    const id = `${record.planId}-next-week-world`;
    if (completedBridgeIds.has(id)) continue;
    const hookJa = record.nextWeekHookJa || '先週の話を覚えています。今週は、実際の行動について聞かせてください。';
    const hookZh = record.nextWeekHookZh || '田中记得你上周的回答，这次要追问实际行动。';
    return {
      version: 1,
      id,
      bossWeekKey: record.weekKey,
      bossPlanId: record.planId,
      hookJa,
      hookZh,
      speaker: '田中',
      situationZh: `上周 Boss 结束后，田中真的记住了你的回答。现在他把“${round.sourceTitle}”带回本周的现实场景。`,
      promptJa: '先週の話を受けて、今週実際に一つ行動するとしたら、何をしますか。理由も一緒に話してください。',
      targetExpression: round.targetExpression,
      expectedAnswerJa: round.expectedAnswerJa,
      sourceTitle: round.sourceTitle,
    };
  }
  return null;
};

export const acceptNhkBossWorldResult = (
  target: NhkBossWorldTarget,
  review: NhkSpeechReview,
  storage?: StorageLike,
  now = Date.now(),
): NhkBossWorldResult => {
  const result: NhkBossWorldResult = {
    version: 1,
    targetId: target.id,
    bossWeekKey: target.bossWeekKey,
    bossPlanId: target.bossPlanId,
    transcript: review.transcript,
    characterReactionJa: review.characterReactionJa,
    characterReactionZh: review.characterReactionZh,
    targetExpressionUsed: review.metrics.targetExpressionUsed,
    contentScore: review.metrics.contentScore,
    completedAt: now,
  };
  const targetStorage = resolveStorage(storage);
  if (targetStorage) {
    const existing = parseArray(targetStorage, BRIDGE_STORAGE_KEY, isBridgeResult)
      .filter(item => item.targetId !== target.id);
    targetStorage.setItem(BRIDGE_STORAGE_KEY, JSON.stringify([result, ...existing].slice(0, MAX_RESULTS)));
  }
  return result;
};

export const loadNhkBossWorldResults = (storage?: StorageLike): NhkBossWorldResult[] => {
  const targetStorage = resolveStorage(storage);
  return targetStorage ? parseArray(targetStorage, BRIDGE_STORAGE_KEY, isBridgeResult) : [];
};
''', encoding='utf-8')

Path('src/nhkBossWorldBridge.test.ts').write_text(r'''import {describe, expect, it} from 'vitest';
import {createNhkSession} from './nhkMorning';
import type {NhkSpeechReview} from './nhkSpeech';
import {
  acceptNhkWeeklyBossReview,
  buildNhkWeeklyBoss,
  createNhkWeeklyBossRecord,
  saveNhkWeeklyBossRecord,
} from './nhkWeeklyBoss';
import {
  acceptNhkBossWorldResult,
  loadNhkBossWorldResults,
  pendingNhkBossWorldTarget,
} from './nhkBossWorldBridge';

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
};

const completedSession = (day: number) => ({
  ...createNhkSession(`2026-09-0${day}`),
  id: `session-${day}`,
  title: `ニュース${day}`,
  keyExpression: `〜表現${day}`,
  shadowText: `ニュース${day}の原文です。`,
  dailyVersion: `日常で表現${day}を使います。`,
  workVersion: `会議で表現${day}を使って報告します。`,
  completedAt: day,
});

const review = (id: string, used: boolean) => ({
  id,
  mode: 'world',
  transcript: '今週は確認手順を見直します。',
  summaryZh: '回答完成',
  strengthsZh: [],
  omissions: [],
  substitutions: [],
  particles: [],
  pauseAdviceZh: [],
  minimalRevisionJa: '今週は確認手順を見直します。',
  naturalVersionJa: '今週は確認手順を見直す予定です。',
  characterReactionJa: 'では、金曜日に結果を教えてください。',
  characterReactionZh: '田中约定周五再确认结果。',
  metrics: {
    textAccuracy: 0,
    contentScore: 82,
    omissionRate: 0,
    substitutionCount: 0,
    particleIssueCount: 0,
    targetExpressionUsed: used,
    charactersPerSecond: 2,
  },
  analyzedAt: 100,
  transcriptionModel: 'test',
  feedbackModel: 'test',
} as NhkSpeechReview);

describe('weekly Boss to causal world bridge', () => {
  it('returns the first unconsumed next-week hook and consumes it after speech review', () => {
    const sessions = [1, 2, 3, 4, 5].map(completedSession);
    const plan = buildNhkWeeklyBoss(sessions, '2026-09-05')!;
    let record = createNhkWeeklyBossRecord(plan, 10);
    plan.rounds.forEach((roundItem, index) => {
      record = acceptNhkWeeklyBossReview(record, plan, roundItem, review(`boss-${index}`, index !== 2), 20 + index);
    });
    const targetStorage = storage();
    saveNhkWeeklyBossRecord(record, targetStorage);
    const target = pendingNhkBossWorldTarget(sessions, '2026-09-08', targetStorage);
    expect(target?.targetExpression).toBe(plan.rounds[2].targetExpression);
    expect(target?.hookZh).toContain('下周');
    acceptNhkBossWorldResult(target!, review('bridge', true), targetStorage, 200);
    expect(loadNhkBossWorldResults(targetStorage)).toHaveLength(1);
    expect(pendingNhkBossWorldTarget(sessions, '2026-09-08', targetStorage)).toBeNull();
  });

  it('does not expose a hook during the same week', () => {
    const sessions = [1, 2, 3, 4, 5].map(completedSession);
    const plan = buildNhkWeeklyBoss(sessions, '2026-09-05')!;
    let record = createNhkWeeklyBossRecord(plan, 10);
    plan.rounds.forEach((roundItem, index) => {
      record = acceptNhkWeeklyBossReview(record, plan, roundItem, review(`boss-${index}`, true), 20 + index);
    });
    const targetStorage = storage();
    saveNhkWeeklyBossRecord(record, targetStorage);
    expect(pendingNhkBossWorldTarget(sessions, '2026-09-05', targetStorage)).toBeNull();
  });
});
''', encoding='utf-8')

Path('src/NhkBossWorldCallback.tsx').write_text(r'''import {useState} from 'react';
import {ArrowLeft, Check, ChevronRight, Sparkles} from 'lucide-react';
import {NhkRecordingCoach} from './NhkSpeechCoach';
import type {NhkSpeechReview} from './nhkSpeech';
import {acceptNhkBossWorldResult, type NhkBossWorldTarget} from './nhkBossWorldBridge';

type Props = {
  target: NhkBossWorldTarget;
  onClose: () => void;
  onCompleted: () => void;
};

export default function NhkBossWorldCallback({target, onClose, onCompleted}: Props) {
  const [review, setReview] = useState<NhkSpeechReview | null>(null);
  const [completed, setCompleted] = useState(false);

  const accept = () => {
    if (!review) return;
    acceptNhkBossWorldResult(target, review);
    setCompleted(true);
    onCompleted();
  };

  if (completed && review) {
    return (
      <section className="nhk-page nhk-flow">
        <header className="nhk-flow-header"><button aria-label="返回" onClick={onClose}><ArrowLeft size={20} /></button><div><small>BOSS CALLBACK</small><strong>已经进入本周剧情</strong></div><span /></header>
        <div className="nhk-boss-world-complete">
          <div><Check size={27} /></div>
          <small>田中记住了你的行动</small>
          <h1>这不是一句总结，而是剧情已经继续。</h1>
          <blockquote>「{review.characterReactionJa || 'では、また結果を聞かせてください。'}」</blockquote>
          {review.characterReactionZh && <p>{review.characterReactionZh}</p>}
          <button onClick={onClose}>回到今天的世界</button>
        </div>
      </section>
    );
  }

  return (
    <section className="nhk-page nhk-flow">
      <header className="nhk-flow-header"><button aria-label="返回" onClick={onClose}><ArrowLeft size={20} /></button><div><small>BOSS CALLBACK</small><strong>上周的回答回来了</strong></div><span /></header>
      <div className="nhk-boss-world-stage">
        <div className="nhk-boss-world-hook"><Sparkles size={18} /><div><small>上周 Boss 留下的因果</small><strong>{target.hookZh}</strong><p>{target.hookJa}</p></div></div>
        <small>{target.sourceTitle}</small>
        <p>{target.situationZh}</p>
        <strong className="nhk-boss-world-question">田中：「{target.promptJa}」</strong>
        <NhkRecordingCoach
          key={target.id}
          mode="world"
          label="告诉田中你这周会怎么做"
          referenceText={target.expectedAnswerJa}
          summary={target.situationZh}
          question={target.promptJa}
          targetExpression={target.targetExpression}
          initialReview={null}
          onDuration={() => undefined}
          onReview={setReview}
        />
        {review && (
          <div className="nhk-boss-world-reaction">
            <small>田中的真实反应</small>
            <strong>「{review.characterReactionJa || '分かりました。では、結果を教えてください。'}」</strong>
            {review.characterReactionZh && <p>{review.characterReactionZh}</p>}
            <div><span>重新回收的表达</span><b>{target.targetExpression}</b></div>
            <button onClick={accept}>让这个回答改变本周剧情<ChevronRight size={17} /></button>
          </div>
        )}
      </div>
    </section>
  );
}
''', encoding='utf-8')

page_path = Path('src/NhkMorningPage.tsx')
css_path = Path('src/nhkMorning.css')
page = page_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)

if "from './NhkBossWorldCallback'" not in page:
    marker = "import EpisodeVisual from './EpisodeVisual';\n"
    page = replace_once(page, marker, marker + "import NhkBossWorldCallback from './NhkBossWorldCallback';\nimport {pendingNhkBossWorldTarget} from './nhkBossWorldBridge';\n", 'boss world imports')

page = re.sub(
    r"type PageView = ([^;]+);",
    lambda match: match.group(0) if "'boss-world'" in match.group(1) else f"type PageView = {match.group(1)} | 'boss-world';",
    page,
    count=1,
)

if 'const [bossWorldRevision, setBossWorldRevision]' not in page:
    possible = [
        "  const [bossRevision, setBossRevision] = useState(0);\n",
        "  const [shareCopyStatus, setShareCopyStatus] = useState('');\n",
    ]
    for marker in possible:
        if marker in page:
            page = replace_once(page, marker, marker + "  const [bossWorldRevision, setBossWorldRevision] = useState(0);\n", 'boss world revision')
            break
    else:
        raise SystemExit('state insertion anchor missing')

if 'const bossWorldTarget = useMemo(' not in page:
    anchor_candidates = [
        "  const weeklyBossSummary = useMemo(\n",
        "  const weeklyEvidence = useMemo(\n",
        "  const streak = useMemo(\n",
    ]
    positions = [(page.find(marker), marker) for marker in anchor_candidates if page.find(marker) >= 0]
    if not positions:
        raise SystemExit('memo insertion anchor missing')
    position, marker = min(positions)
    if marker == "  const weeklyBossSummary = useMemo(\n":
        end = page.find("  );\n", position) + len("  );\n")
    else:
        end = page.find(";\n", position) + 2
    insertion = "  const bossWorldTarget = useMemo(\n    () => pendingNhkBossWorldTarget(sessions, todayKey),\n    [sessions, todayKey, bossWorldRevision],\n  );\n"
    page = page[:end] + insertion + page[end:]

if "if (view === 'boss-world'" not in page:
    anchors = ["  if (view === 'boss')", "  if (view === 'recall'", "  if (view === 'causal'"]
    positions = [page.find(marker) for marker in anchors if page.find(marker) >= 0]
    if not positions:
        raise SystemExit('view render anchor missing')
    position = min(positions)
    block = "  if (view === 'boss-world' && bossWorldTarget) {\n    return (\n      <NhkBossWorldCallback\n        target={bossWorldTarget}\n        onClose={() => setView('home')}\n        onCompleted={() => setBossWorldRevision(value => value + 1)}\n      />\n    );\n  }\n\n"
    page = page[:position] + block + page[position:]

if 'nhk-boss-world-card' not in page:
    anchors = ["      {weeklyBossPlan && (", "      {recallSession && (", "      {todaySession?.completedAt && ("]
    positions = [page.find(marker) for marker in anchors if page.find(marker) >= 0]
    if not positions:
        raise SystemExit('home card anchor missing')
    position = min(positions)
    card = "      {bossWorldTarget && (\n        <button className=\"nhk-boss-world-card\" onClick={() => setView('boss-world')}>\n          <Sparkles size={19} />\n          <div><small>上周 Boss 的后续</small><strong>田中真的记得你的回答</strong><span>{bossWorldTarget.hookZh}</span></div>\n          <ChevronRight size={18} />\n        </button>\n      )}\n\n"
    page = page[:position] + card + page[position:]

css_addition = r'''
.nhk-boss-world-card{width:100%;border:1px solid #d8c5ef;background:linear-gradient(135deg,#f8f1ff,#eee4fa);border-radius:20px;min-height:78px;margin-top:9px;padding:11px 13px;display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:9px;text-align:left;color:#41354d}.nhk-boss-world-card>svg:first-child{color:#75538d}.nhk-boss-world-card>div{display:grid;gap:2px}.nhk-boss-world-card small{font-size:8px;color:#8e75a0;font-weight:900}.nhk-boss-world-card strong{font-size:12px}.nhk-boss-world-card span{font-size:8px;color:#776b80;line-height:1.45}.nhk-boss-world-stage,.nhk-boss-world-complete{border:1px solid #e2d8ea;border-radius:27px;background:#fff;padding:19px;box-shadow:0 13px 30px #4625580b}.nhk-boss-world-hook{display:grid;grid-template-columns:27px 1fr;gap:8px;border-radius:18px;background:#f6effb;padding:13px}.nhk-boss-world-hook>svg{color:#75538d}.nhk-boss-world-hook>div{display:grid;gap:3px}.nhk-boss-world-hook small{font-size:7px;color:#9677aa}.nhk-boss-world-hook strong{font-size:11px;line-height:1.5}.nhk-boss-world-hook p{margin:1px 0 0;font-size:9px;color:#76677f;line-height:1.55}.nhk-boss-world-stage>small{display:block;margin-top:14px;font-size:8px;color:#9276a3;font-weight:900}.nhk-boss-world-stage>p{font-size:10px;color:#68616d;line-height:1.65}.nhk-boss-world-question{display:block;border-radius:17px;background:#35283e;color:#fff;padding:14px;font-size:13px;line-height:1.65}.nhk-boss-world-reaction{margin-top:12px;border-radius:18px;background:#f6effb;padding:14px}.nhk-boss-world-reaction>small{font-size:8px;color:#8f72a1}.nhk-boss-world-reaction>strong{display:block;font-size:13px;line-height:1.6;margin-top:4px}.nhk-boss-world-reaction>p{font-size:9px;color:#716579}.nhk-boss-world-reaction>div{display:grid;gap:2px;padding-top:9px;border-top:1px solid #ddcce8}.nhk-boss-world-reaction>div span{font-size:7px;color:#9a7cac}.nhk-boss-world-reaction>div b{font-size:11px}.nhk-boss-world-reaction>button,.nhk-boss-world-complete>button{width:100%;min-height:46px;margin-top:11px;border:0;border-radius:13px;background:#35283e;color:#f1ddff;display:flex;align-items:center;justify-content:center;gap:5px;font-size:9px;font-weight:900}.nhk-boss-world-complete>div:first-child{width:62px;height:62px;border-radius:21px;background:#eadbf5;color:#6d4e82;display:grid;place-items:center}.nhk-boss-world-complete>small{display:block;margin-top:13px;font-size:8px;color:#9276a3}.nhk-boss-world-complete h1{font-size:21px;line-height:1.45;margin:6px 0}.nhk-boss-world-complete blockquote{margin:12px 0;padding:13px;border-left:3px solid #9d78b5;border-radius:13px;background:#f6effb;font-size:12px;line-height:1.6}.nhk-boss-world-complete>p{font-size:9px;color:#716579}
'''
if '.nhk-boss-world-card{' not in css:
    css = css.rstrip() + '\n' + css_addition.lstrip()

page_path.write_text(page, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
