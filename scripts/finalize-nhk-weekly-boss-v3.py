from __future__ import annotations

import base64
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_BLOB = "cb2c01f0a631149f3685df38a3a1b9e003c62e09"


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.rstrip() + "\n", encoding="utf-8")


def fetch_model() -> str:
    request = urllib.request.Request(
        f"https://api.github.com/repos/acaozixu123456/myRepository/git/blobs/{MODEL_BLOB}",
        headers={"Accept": "application/vnd.github+json", "User-Agent": "nihongo-weekly-boss-finalizer"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    return base64.b64decode(payload["content"]).decode("utf-8")


write("src/nhkBoss.ts", fetch_model())

write("src/NhkWeeklyBossPage.tsx", r'''import {useMemo, useState} from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  LockKeyhole,
  MessageCircleMore,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {NhkRecordingCoach} from './NhkSpeechCoach';
import {
  advanceNhkWeeklyBoss,
  applyNhkWeeklyBossReview,
  loadNhkWeeklyBosses,
  nhkWeeklyBossTargetUsed,
  patchNhkWeeklyBossTurn,
  resolveNhkWeeklyBoss,
  saveNhkWeeklyBosses,
  startNhkWeeklyBoss,
  type NhkWeeklyBoss,
} from './nhkBoss';
import {loadNhkSessions, toDateKey} from './nhkMorning';
import './nhkMorning.css';

const formatDate = (dateKey: string): string => {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
};

const returnToApp = (): void => {
  const url = new URL(window.location.href);
  url.searchParams.delete('weekly_boss');
  window.location.assign(`${url.pathname}${url.search}${url.hash}` || '/');
};

export default function NhkWeeklyBossPage() {
  const todayKey = toDateKey();
  const sessions = useMemo(() => loadNhkSessions(), []);
  const [boss, setBoss] = useState<NhkWeeklyBoss>(() =>
    resolveNhkWeeklyBoss(sessions, todayKey, loadNhkWeeklyBosses()),
  );

  const persist = (next: NhkWeeklyBoss): void => {
    saveNhkWeeklyBosses([next, ...loadNhkWeeklyBosses().filter(item => item.id !== next.id)]);
    setBoss(next);
  };

  const currentTurn = boss.turns[boss.currentTurnIndex];
  const isFinalTurn = boss.currentTurnIndex === boss.turns.length - 1;
  const turnReady = Boolean(currentTurn?.review || (!isFinalTurn && currentTurn?.answer.trim()));

  if (boss.status === 'locked') {
    return (
      <main className="nhk-boss-page">
        <header className="nhk-boss-header">
          <button aria-label="返回日语世界" onClick={returnToApp}><ArrowLeft size={20} /></button>
          <div><small>WEEKLY BOSS</small><strong>本周综合对话</strong></div><span />
        </header>
        <section className="nhk-boss-card nhk-boss-locked">
          <div className="nhk-boss-emblem"><LockKeyhole size={28} /></div>
          <span>还在收集本周表达</span>
          <h1>先完成足够的真实输入，再进入 Boss。</h1>
          <p>Boss 不使用随机题库。它只会从你本周亲自选择、跟读并用进世界的表达中抽取 5 个。</p>
          <div className="nhk-boss-unlock-progress">
            <div><i style={{width: `${Math.min(100, boss.availability.availableExpressions / boss.availability.requiredExpressions * 100)}%`}} /></div>
            <strong>{boss.availability.availableExpressions}/{boss.availability.requiredExpressions} 个可回收表达</strong>
            <small>已完成 {boss.availability.completedInputs} 次 NHK 输入</small>
          </div>
          <button className="nhk-boss-primary" onClick={returnToApp}>继续今天的训练<ChevronRight size={18} /></button>
        </section>
      </main>
    );
  }

  if (boss.status === 'completed' && boss.summary) {
    return (
      <main className="nhk-boss-page">
        <header className="nhk-boss-header">
          <button aria-label="返回日语世界" onClick={returnToApp}><ArrowLeft size={20} /></button>
          <div><small>WEEKLY BOSS</small><strong>{formatDate(boss.weekStartKey)}～{formatDate(boss.weekEndKey)}</strong></div><span />
        </header>
        <section className="nhk-boss-card nhk-boss-complete">
          <div className="nhk-boss-emblem"><Trophy size={29} /></div>
          <span>本周对话完成</span>
          <h1>这次不是“做了几题”，而是你现场说出了多少。</h1>
          <div className="nhk-boss-result-grid">
            <div><strong>{boss.summary.recoveredExpressions}/{boss.summary.totalExpressions}</strong><small>目标表达主动出现</small></div>
            <div><strong>{boss.summary.averageContentScore ?? '—'}</strong><small>平均表达完成度</small></div>
            <div><strong>{boss.summary.totalSpeakingSeconds}s</strong><small>本周 Boss 开口时长</small></div>
          </div>
          <div className="nhk-boss-reaction">
            <small>田中的反应</small><strong>{boss.summary.reactionJa}</strong><p>{boss.summary.reactionZh}</p>
          </div>
          <div className="nhk-boss-expression-list">
            {boss.turns.map(turn => {
              const used = nhkWeeklyBossTargetUsed(turn);
              return <div key={turn.id}><span className={used ? 'used' : 'missed'}>{used ? <Check size={14} /> : turn.order + 1}</span><div><small>{turn.registerLabelZh} · {turn.sourceTitle}</small><strong>{turn.targetExpression}</strong></div></div>;
            })}
          </div>
          <div className="nhk-boss-next-hook"><Sparkles size={18} /><p>{boss.summary.nextWeekHookZh}</p></div>
          <button className="nhk-boss-primary" onClick={returnToApp}>回到日语世界<ChevronRight size={18} /></button>
        </section>
      </main>
    );
  }

  if (boss.status === 'ready') {
    return (
      <main className="nhk-boss-page">
        <header className="nhk-boss-header">
          <button aria-label="返回日语世界" onClick={returnToApp}><ArrowLeft size={20} /></button>
          <div><small>WEEKLY BOSS</small><strong>{formatDate(boss.weekStartKey)}～{formatDate(boss.weekEndKey)}</strong></div><span />
        </header>
        <section className="nhk-boss-card nhk-boss-intro">
          <div className="nhk-boss-emblem"><Trophy size={29} /></div>
          <span>约 3 分钟 · 5 轮追问</span>
          <h1>田中会把本周的新闻、观点和剧情混在一起。</h1>
          <p>没有选择题，也不会提前告诉你要回收哪一句。请像真实对话一样回答；你的回答会改变下一问和下周剧情。</p>
          <div className="nhk-boss-rules">
            <div><MessageCircleMore size={18} /><span><strong>现场回答</strong><small>日常、礼貌、工作表达混合出现</small></span></div>
            <div><Sparkles size={18} /><span><strong>动态追问</strong><small>说得具体会继续深入，表达模糊会被追问理由</small></span></div>
            <div><LockKeyhole size={18} /><span><strong>答案隐藏</strong><small>录音分析完成前不显示目标表达</small></span></div>
          </div>
          <button className="nhk-boss-primary" onClick={() => persist(startNhkWeeklyBoss(boss))}>开始本周 Boss<ChevronRight size={18} /></button>
        </section>
      </main>
    );
  }

  if (!currentTurn) {
    return <main className="nhk-boss-page"><section className="nhk-boss-card"><p>本周对话数据不完整，请返回后重新进入。</p><button className="nhk-boss-primary" onClick={returnToApp}>返回</button></section></main>;
  }

  return (
    <main className="nhk-boss-page">
      <header className="nhk-boss-header">
        <button aria-label="暂时退出" onClick={returnToApp}><ArrowLeft size={20} /></button>
        <div><small>WEEKLY BOSS</small><strong>{boss.currentTurnIndex + 1}/5 · {currentTurn.registerLabelZh}</strong></div>
        <span>{Math.round((boss.currentTurnIndex + 1) / boss.turns.length * 100)}%</span>
      </header>
      <div className="nhk-boss-progress">{boss.turns.map((turn, index) => <i key={turn.id} className={index <= boss.currentTurnIndex ? 'active' : ''} />)}</div>
      <section className="nhk-boss-card nhk-boss-active">
        <div className="nhk-boss-turn-meta"><span>{currentTurn.registerLabelZh}</span><small>来自 {formatDate(currentTurn.sourceDateKey)} 的真实输入</small></div>
        <p className="nhk-boss-setup">{currentTurn.setupZh}</p>
        <div className="nhk-boss-prompt"><small>田中</small><strong>「{currentTurn.promptJa}」</strong></div>
        <p className="nhk-boss-hint">先直接回答，不要回看本周笔记。系统会在分析后判断核心表达有没有自然出现。</p>
        <NhkRecordingCoach
          key={currentTurn.id}
          label="回答田中"
          mode="world"
          referenceText={currentTurn.promptJa}
          summary={currentTurn.sourceSummaryJa}
          question={currentTurn.promptJa}
          targetExpression={currentTurn.targetExpression}
          review={currentTurn.review}
          onDuration={seconds => persist(patchNhkWeeklyBossTurn(boss, {recordingSeconds: seconds}))}
          onReview={review => persist(applyNhkWeeklyBossReview(boss, review))}
        />
        <label className="nhk-boss-manual-answer">
          <span>{isFinalTurn ? '最后一轮需要完成语音分析后结算' : '系统听到的内容可在这里修正'}</span>
          <textarea value={currentTurn.answer} onChange={event => persist(patchNhkWeeklyBossTurn(boss, {answer: event.target.value}))} placeholder="麦克风不可用时，也可以手动写下你实际说出的日语" rows={4} />
        </label>
        {currentTurn.review && <div className={`nhk-boss-target ${nhkWeeklyBossTargetUsed(currentTurn) ? 'used' : 'missed'}`}><small>本轮回收表达</small><strong>{currentTurn.targetExpression}</strong><span>{nhkWeeklyBossTargetUsed(currentTurn) ? '已经自然用出来了' : '这次还没主动出现，下周会换场景再回来'}</span></div>}
        <button className="nhk-boss-primary" disabled={!turnReady} onClick={() => persist(advanceNhkWeeklyBoss(boss))}>{isFinalTurn ? '查看本周结果' : '进入下一问'}<ChevronRight size={18} /></button>
      </section>
    </main>
  );
}
''')

write("src/main.tsx", r'''import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import NhkEvidencePage from './NhkEvidencePage';
import NhkWeeklyBossPage from './NhkWeeklyBossPage';
import {buildNhkWeeklyEvidence} from './nhkEvidence';
import {loadNhkSessions} from './nhkMorning';
import {captureSharedMojiUrl, stripShareParameters} from './shareTarget';
import './index.css';

const sharedUrl = captureSharedMojiUrl(window.location.href, window.localStorage);
if (sharedUrl) window.history.replaceState({}, document.title, stripShareParameters(window.location.href));
if ('serviceWorker' in navigator) window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => {}); }, {once: true});

const clearRoute = (parameter: string): void => {
  const url = new URL(window.location.href);
  url.searchParams.delete(parameter);
  window.location.assign(`${url.pathname}${url.search}${url.hash}` || '/');
};
const params = new URL(window.location.href).searchParams;
const weeklyBossRequested = params.get('weekly_boss') === '1';
const weeklyEvidenceRequested = params.get('weekly_evidence') === '1';
const evidence = weeklyEvidenceRequested ? buildNhkWeeklyEvidence(loadNhkSessions()) : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {weeklyBossRequested ? <NhkWeeklyBossPage /> : evidence ? <NhkEvidencePage evidence={evidence} onBack={() => clearRoute('weekly_evidence')} /> : <App />}
  </StrictMode>,
);
''')

write("src/nhkBoss.test.ts", r'''import {describe, expect, it} from 'vitest';
import type {NhkSpeechReview} from './NhkSpeechCoach';
import {advanceNhkWeeklyBoss, applyNhkWeeklyBossReview, buildNhkWeeklyBoss, loadNhkWeeklyBosses, patchNhkWeeklyBossTurn, saveNhkWeeklyBosses, startNhkWeeklyBoss, type NhkWeeklyBoss} from './nhkBoss';
import {applyNhkDailyInput, buildNhkDailyInput, createNhkSession, type NhkMorningSession} from './nhkMorning';
import type {NhkCoachLabel, NhkCoachResult} from './nhkCoach';
const labels: NhkCoachLabel[] = ['核心', '跟读', '迁移'];
const makeSession = (dateKey: string, expressions: string[]): NhkMorningSession => {
  const sentences = expressions.map((_, index) => `${dateKey} の例文 ${index + 1}。`);
  const coach: NhkCoachResult = {summaryJa: `${dateKey} のニュース概要です。`, summaryZh: `${dateKey} 的新闻概要。`, recommendations: expressions.map((expression, index) => ({sentenceIndex: index, sentence: sentences[index], label: labels[index % labels.length], reasonZh: '测试推荐理由', chunks: [sentences[index]], expression, meaningZh: '测试意思', dailyVersion: `${expression} を日常で使います。`, workVersion: `${expression} を会議で使います。`})), opinionQuestion: 'このニュースについて、どう考えますか。', worldSetupZh: '田中正在等你的回答。', worldPromptJa: '仕事への影響も含めて、考えを教えてください。'};
  const base: NhkMorningSession = {...createNhkSession(dateKey), sourceUrl: `https://www.mojidict.com/article/test-${dateKey}`, title: `${dateKey} のニュース`, opinion: '必要だと思います。', worldAnswer: '仕事への影響も確認したほうがいいと思います。', completedAt: Date.parse(`${dateKey}T08:00:00+09:00`)};
  const dailyInput = buildNhkDailyInput({session: base, coach, selectedSentences: sentences, candidateSentences: sentences, coachModel: 'test', generatedAt: base.completedAt});
  dailyInput.world.callback.promptJa = 'この前の話ですが、今も同じ考えですか。';
  return applyNhkDailyInput(base, dailyInput);
};
const makeReview = (id: string, targetExpressionUsed: boolean, contentScore = 80): NhkSpeechReview => ({id, mode: 'world', transcript: targetExpressionUsed ? `理由があります。${id}。` : '理由と具体例を説明します。', summaryZh: '内容已转写。', strengthsZh: ['主要意思说清楚了'], omissions: [], substitutions: [], particles: [], pauseAdviceZh: [], minimalRevisionJa: '理由と具体例を説明します。', naturalVersionJa: '理由と具体例をもう少し具体的に説明します。', characterReactionJa: targetExpressionUsed ? 'よく分かりました。' : 'もう少し具体的に教えてください。', characterReactionZh: targetExpressionUsed ? '田中听懂了。' : '田中希望你再具体一点。', metrics: {textAccuracy: 82, contentScore, omissionRate: 4, substitutionCount: 0, particleIssueCount: 0, targetExpressionUsed, charactersPerSecond: 2.1}, analyzedAt: 1, transcriptionModel: 'test-transcribe', feedbackModel: 'test-feedback'});
const readyBoss = (): NhkWeeklyBoss => buildNhkWeeklyBoss([makeSession('2026-08-31', ['表現1', '表現2', '表現3']), makeSession('2026-09-01', ['表現4', '表現5'])], '2026-09-04', 100);
describe('weekly NHK Boss', () => {
  it('builds five hidden-expression turns across all registers', () => { const boss = readyBoss(); expect(boss.status).toBe('ready'); expect(boss.turns).toHaveLength(5); expect(boss.turns.map(turn => turn.register)).toEqual(['daily', 'polite', 'work', 'callback', 'synthesis']); expect(boss.turns.map(turn => turn.targetExpression)).toEqual(['表現1', '表現2', '表現3', '表現4', '表現5']); });
  it('stays locked until five unique expressions exist', () => { const boss = buildNhkWeeklyBoss([makeSession('2026-08-31', ['表現1', '表現2', '表現3']), makeSession('2026-09-01', ['表現4'])], '2026-09-04', 100); expect(boss.status).toBe('locked'); expect(boss.turns).toEqual([]); expect(boss.availability.availableExpressions).toBe(4); });
  it('makes the next prompt more concrete after a miss', () => { let boss = startNhkWeeklyBoss(readyBoss(), 200); boss = patchNhkWeeklyBossTurn(boss, {recordingSeconds: 18}, 210); boss = applyNhkWeeklyBossReview(boss, makeReview('first', false), 220); boss = advanceNhkWeeklyBoss(boss, 230); expect(boss.currentTurnIndex).toBe(1); expect(boss.turns[1].promptJa).toContain('理由と具体例'); expect(boss.turns[1].setupZh).toContain('再具体一点'); });
  it('finishes five turns and recycles a missed expression next week', () => { let boss = startNhkWeeklyBoss(readyBoss(), 200); for (let index = 0; index < 5; index += 1) { boss = patchNhkWeeklyBossTurn(boss, {recordingSeconds: 20 + index}, 300 + index); boss = applyNhkWeeklyBossReview(boss, makeReview(`review-${index}`, index !== 2, 78 + index), 400 + index); boss = advanceNhkWeeklyBoss(boss, 500 + index); } expect(boss.status).toBe('completed'); expect(boss.summary?.recoveredExpressions).toBe(4); expect(boss.summary?.totalSpeakingSeconds).toBe(110); expect(boss.summary?.averageContentScore).toBe(80); expect(boss.summary?.nextWeekHookZh).toContain('表現3'); });
  it('strips injected audio fields before local persistence', () => { const values = new Map<string, string>(); const storage = {getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }}; const boss = readyBoss(); const injected = {...boss, audioBase64: 'data:audio/webm;base64,SECRET', turns: boss.turns.map((turn, index) => index === 0 ? {...turn, blobUrl: 'blob:https://example.test/SECRET', review: {...makeReview('safe-review', true), audioUrl: 'data:audio/mp3;base64,SECRET'}} : turn)} as unknown as NhkWeeklyBoss; saveNhkWeeklyBosses([injected], storage); const raw = values.get('nihongo-nhk-weekly-boss-v1') || ''; expect(raw).not.toContain('audioBase64'); expect(raw).not.toContain('blobUrl'); expect(raw).not.toContain('audioUrl'); expect(raw).not.toContain('SECRET'); expect(loadNhkWeeklyBosses(storage)).toHaveLength(1); });
});
''')

# Add a real route from the NHK home to the weekly evidence view.
home_path = ROOT / "src/NhkMorningPage.tsx"
home = home_path.read_text(encoding="utf-8")
match = re.search(r"import \{(?P<body>.*?)\} from 'lucide-react';", home, flags=re.S)
if not match:
    raise RuntimeError("lucide import block not found")
if "TrendingUp" not in match.group("body"):
    body = match.group("body").rstrip() + "\n  TrendingUp,\n"
    home = home[:match.start("body")] + body + home[match.end("body"):]
if 'className="nhk-weekly-evidence-card"' not in home:
    anchor = "      {recent.length > 0 && (\n"
    if anchor not in home:
        raise RuntimeError("NHK recent-history anchor not found")
    card = '''      <a className="nhk-weekly-evidence-card" href="?weekly_evidence=1">\n        <TrendingUp size={19} />\n        <div><small>WEEKLY EVIDENCE</small><strong>以前的你 vs 现在的你</strong><span>查看第 1、3、7 天回忆和本周 Boss</span></div>\n        <ChevronRight size={18} />\n      </a>\n\n'''
    home = home.replace(anchor, card + anchor, 1)
home_path.write_text(home, encoding="utf-8")

# Add a Boss entry to the already implemented evidence page without replacing its calculations.
evidence_path = ROOT / "src/NhkEvidencePage.tsx"
evidence = evidence_path.read_text(encoding="utf-8")
icon_match = re.search(r"import \{(?P<body>.*?)\} from 'lucide-react';", evidence, flags=re.S)
if not icon_match:
    raise RuntimeError("evidence icon import block not found")
icon_body = icon_match.group("body")
missing = [name for name in ("ChevronRight", "Trophy") if name not in icon_body]
if missing:
    icon_body = icon_body.rstrip() + "\n" + "".join(f"  {name},\n" for name in missing)
    evidence = evidence[:icon_match.start("body")] + icon_body + evidence[icon_match.end("body"):]
if "import './nhkMorning.css';" not in evidence:
    first_type_import = "} from './nhkEvidence';"
    if first_type_import in evidence:
        evidence = evidence.replace(first_type_import, first_type_import + "\nimport './nhkMorning.css';", 1)
if 'className="nhk-weekly-boss-entry"' not in evidence:
    anchor = '      <div className="nhk-evidence-week-grid">\n'
    if anchor not in evidence:
        raise RuntimeError("evidence grid anchor not found")
    entry = '''      <a className="nhk-weekly-boss-entry" href="?weekly_boss=1">\n        <Trophy size={19} />\n        <div><small>WEEKLY BOSS</small><strong>5 轮无选择动态对话</strong><span>混合日常、礼貌、工作和剧情追问；答完才揭晓回收表达</span></div>\n        <ChevronRight size={18} />\n      </a>\n\n'''
    evidence = evidence.replace(anchor, entry + anchor, 1)
evidence_path.write_text(evidence, encoding="utf-8")

css_path = ROOT / "src/nhkMorning.css"
css = css_path.read_text(encoding="utf-8")
start = "/* weekly-boss-v3:start */"
end = "/* weekly-boss-v3:end */"
boss_css = r'''/* weekly-boss-v3:start */
.nhk-boss-page{width:min(100%,470px);min-height:100vh;margin:auto;background:#fbfaf6;padding:14px 15px max(28px,env(safe-area-inset-bottom));color:#17221c}.nhk-boss-header{height:52px;display:grid;grid-template-columns:42px 1fr 42px;align-items:center;margin-bottom:8px}.nhk-boss-header>button{border:0;background:transparent;width:40px;height:40px;display:grid;place-items:center;color:#314137}.nhk-boss-header>div{text-align:center;display:grid;gap:1px}.nhk-boss-header small{font-size:8px;color:#8b938d;letter-spacing:.8px}.nhk-boss-header strong{font-size:13px}.nhk-boss-header>span{font-size:8px;text-align:right;color:#718051}.nhk-boss-progress{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin:0 4px 13px}.nhk-boss-progress i{height:5px;border-radius:99px;background:#e2e5df}.nhk-boss-progress i.active{background:#718f43}.nhk-boss-card{background:#fff;border:1px solid #e1e4dd;border-radius:28px;padding:19px;box-shadow:0 12px 30px #17221c0b}.nhk-boss-card>span{display:block;font-size:8px;font-weight:900;letter-spacing:1px;color:#718051;text-align:center;margin-top:8px}.nhk-boss-card>h1{font-size:22px;line-height:1.38;letter-spacing:-.45px;text-align:center;margin:7px 0}.nhk-boss-card>p{font-size:10px;line-height:1.7;color:#69746c;text-align:center;margin:0}.nhk-boss-emblem{width:62px;height:62px;border-radius:21px;margin:4px auto 0;background:#dff08a;color:#17221c;display:grid;place-items:center}.nhk-boss-locked .nhk-boss-emblem{background:#eef0ea;color:#738078}.nhk-boss-primary{width:100%;min-height:52px;border:0;border-radius:16px;background:#17221c;color:#dff08a;margin-top:17px;display:flex;align-items:center;justify-content:center;gap:7px;font-size:11px;font-weight:900}.nhk-boss-primary:disabled{opacity:.35}.nhk-boss-rules{display:grid;gap:8px;margin-top:17px}.nhk-boss-rules>div{border-radius:16px;background:#f2f4ee;padding:11px;display:grid;grid-template-columns:32px 1fr;gap:8px;align-items:center;color:#516146}.nhk-boss-rules>div>span{display:grid;gap:2px}.nhk-boss-rules strong{font-size:10px}.nhk-boss-rules small{font-size:8px;line-height:1.5;color:#808981}.nhk-boss-unlock-progress{margin-top:18px;border-radius:17px;background:#f2f4ee;padding:13px;text-align:center}.nhk-boss-unlock-progress>div{height:7px;border-radius:99px;background:#dfe3dc;overflow:hidden}.nhk-boss-unlock-progress i{display:block;height:100%;border-radius:inherit;background:#718f43}.nhk-boss-unlock-progress strong{display:block;font-size:11px;margin-top:9px}.nhk-boss-unlock-progress small{display:block;font-size:8px;color:#848d86;margin-top:3px}.nhk-boss-turn-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.nhk-boss-turn-meta span{border-radius:999px;background:#eaf1d9;color:#5e7539;padding:6px 9px;font-size:8px;font-weight:900}.nhk-boss-turn-meta small{font-size:8px;color:#8a938c;text-align:right}.nhk-boss-setup{font-size:10px;line-height:1.65;color:#69746c;margin:0 2px 11px}.nhk-boss-prompt{border-radius:20px;background:#17221c;color:#fff;padding:15px}.nhk-boss-prompt small{display:block;font-size:8px;color:#b9c5bc;margin-bottom:7px}.nhk-boss-prompt strong{display:block;font-size:14px;line-height:1.65}.nhk-boss-hint{font-size:8px;line-height:1.6;color:#849087;margin:9px 3px 0}.nhk-boss-manual-answer{display:grid;gap:6px;margin-top:13px}.nhk-boss-manual-answer>span{font-size:8px;font-weight:800;color:#68756c}.nhk-boss-manual-answer textarea{width:100%;border:1px solid #dfe3dc;background:#fafaf7;border-radius:14px;color:#26352c;padding:12px;font:inherit;font-size:11px;line-height:1.6;resize:vertical}.nhk-boss-target{margin-top:12px;border-radius:16px;padding:12px;display:grid;gap:3px}.nhk-boss-target.used{background:#eef5dc;color:#3f542b}.nhk-boss-target.missed{background:#f7eeee;color:#714e47}.nhk-boss-target small,.nhk-boss-target span{font-size:8px}.nhk-boss-target strong{font-size:12px;line-height:1.5}.nhk-boss-result-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:17px}.nhk-boss-result-grid>div{border-radius:16px;background:#f2f4ee;padding:12px 6px;text-align:center;display:grid;gap:3px}.nhk-boss-result-grid strong{font-size:20px}.nhk-boss-result-grid small{font-size:7px;color:#7f8981}.nhk-boss-reaction{margin-top:12px;border-radius:18px;background:#17221c;color:#fff;padding:14px}.nhk-boss-reaction small{font-size:8px;color:#b7c2b9}.nhk-boss-reaction strong{display:block;font-size:12px;line-height:1.6;margin-top:6px}.nhk-boss-reaction p{font-size:9px;line-height:1.6;color:#d7ded9;margin:7px 0 0}.nhk-boss-expression-list{display:grid;gap:7px;margin-top:13px}.nhk-boss-expression-list>div{border:1px solid #e1e4dd;border-radius:15px;padding:10px;display:grid;grid-template-columns:27px 1fr;gap:8px;align-items:center}.nhk-boss-expression-list>div>span{width:25px;height:25px;border-radius:9px;background:#ecefe9;color:#7b847d;display:grid;place-items:center;font-size:8px}.nhk-boss-expression-list>div>span.used{background:#718f43;color:#fff}.nhk-boss-expression-list>div>span.missed{background:#f0dfdc;color:#82534b}.nhk-boss-expression-list>div>div{display:grid;gap:3px;min-width:0}.nhk-boss-expression-list small{font-size:7px;color:#8a938c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nhk-boss-expression-list strong{font-size:10px;line-height:1.5}.nhk-boss-next-hook{margin-top:12px;border-radius:16px;background:#eef4dc;padding:12px;display:grid;grid-template-columns:24px 1fr;gap:7px;color:#546d31}.nhk-boss-next-hook p{font-size:9px;line-height:1.6;margin:0}.nhk-weekly-evidence-card,.nhk-weekly-boss-entry{width:100%;border:1px solid #d8e2bf;background:#f2f7e6;border-radius:19px;min-height:72px;margin:0 0 13px;padding:11px 13px;display:grid;grid-template-columns:38px 1fr auto;align-items:center;gap:9px;text-align:left;color:#2f3f35;text-decoration:none}.nhk-weekly-evidence-card>svg:first-child,.nhk-weekly-boss-entry>svg:first-child{width:38px;height:38px;border-radius:13px;padding:9px;background:#17221c;color:#dff08a}.nhk-weekly-evidence-card>div,.nhk-weekly-boss-entry>div{display:grid;gap:2px}.nhk-weekly-evidence-card small,.nhk-weekly-boss-entry small{font-size:8px;color:#718051;font-weight:900}.nhk-weekly-evidence-card strong,.nhk-weekly-boss-entry strong{font-size:12px}.nhk-weekly-evidence-card span,.nhk-weekly-boss-entry span{font-size:8px;color:#7b857d}.nhk-recording-coach{margin-top:13px}
/* weekly-boss-v3:end */'''
if start in css and end in css:
    css = re.sub(re.escape(start) + r".*?" + re.escape(end), boss_css, css, flags=re.S)
else:
    css = css.rstrip() + "\n\n" + boss_css + "\n"
css_path.write_text(css, encoding="utf-8")

for obsolete in (
    "src/NhkBossPage.tsx",
    ".github/workflows/verify-nhk-weekly-boss-v1.yml",
    "scripts/patch-nhk-weekly-boss-v1.py",
):
    path = ROOT / obsolete
    if path.exists():
        path.unlink()
