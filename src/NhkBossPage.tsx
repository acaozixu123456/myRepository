import {useEffect, useMemo, useState} from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  MessageCircle,
  Mic2,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {
  NhkRecordingCoach,
  NhkSpeechReviewPanel,
  type NhkSpeechReview,
} from './NhkSpeechCoach';
import {
  finalizeNhkBossSession,
  nextNhkBossTurnIndex,
  recordNhkBossTurn,
  type NhkBossRegister,
  type NhkBossSession,
} from './nhkBoss';

const registerLabel = (register: NhkBossRegister): string => {
  if (register === 'work') return '工作表达';
  if (register === 'polite') return '礼貌表达';
  return '日常表达';
};

const formatPeriod = (start: string, end: string): string => {
  const label = (value: string) => {
    const [, month, day] = value.split('-');
    return `${Number(month)}/${Number(day)}`;
  };
  return `${label(start)}—${label(end)}`;
};

export default function NhkBossPage({
  session,
  onBack,
  onUpdate,
}: {
  session: NhkBossSession;
  onBack: () => void;
  onUpdate: (session: NhkBossSession) => void;
}) {
  const initialIndex = Math.max(0, nextNhkBossTurnIndex(session));
  const [current, setCurrent] = useState(session);
  const [displayIndex, setDisplayIndex] = useState(initialIndex < session.turns.length ? initialIndex : session.turns.length - 1);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  useEffect(() => {
    setCurrent(session);
    const next = nextNhkBossTurnIndex(session);
    setDisplayIndex(next >= 0 ? next : Math.max(0, session.turns.length - 1));
    setRecordingSeconds(0);
  }, [session.id]);

  const turn = current.turns[displayIndex];
  const completedCount = current.turns.filter(item => item.completedAt).length;
  const sourceTitles = useMemo(() => Array.from(new Set(current.turns.map(item => item.sourceTitle))).slice(0, 3), [current.turns]);
  const nextTurn = current.turns[displayIndex + 1];

  const saveReview = (review: NhkSpeechReview) => {
    const next = recordNhkBossTurn(current, displayIndex, review, recordingSeconds);
    setCurrent(next);
    onUpdate(next);
  };

  const finishBoss = () => {
    const next = finalizeNhkBossSession(current);
    setCurrent(next);
    onUpdate(next);
  };

  if (current.outcome) {
    return (
      <section className="nhk-page nhk-flow nhk-boss-page">
        <header className="nhk-flow-header">
          <button aria-label="返回" onClick={onBack}><ArrowLeft size={20} /></button>
          <div><small>WEEKLY BOSS</small><strong>本周对话完成</strong></div>
          <span />
        </header>
        <div className="nhk-boss-complete">
          <div className="nhk-boss-trophy"><Trophy size={29} /></div>
          <span>3 MINUTES · NO CHOICES</span>
          <h1>你没有提前看到答案，还是完成了五轮对话。</h1>
          <div className="nhk-boss-result-grid">
            <div><small>完成轮数</small><strong>5/5</strong></div>
            <div><small>成功使用本周表达</small><strong>{current.outcome.usedExpressionCount}/5</strong></div>
            <div><small>平均表达完成度</small><strong>{current.outcome.averageContentScore}分</strong></div>
          </div>
          <div className="nhk-boss-final-reaction">
            <MessageCircle size={18} />
            <div>
              <small>田中最后的反应</small>
              <strong>{current.outcome.characterReactionJa}</strong>
              <p>{current.outcome.characterReactionZh}</p>
            </div>
          </div>
          <div className="nhk-boss-next-week">
            <Sparkles size={18} />
            <div><small>下周剧情种子</small><strong>{current.outcome.nextWeekHookZh}</strong></div>
          </div>
          <button className="nhk-boss-back" onClick={onBack}>保存结果，回到今朝</button>
        </div>
      </section>
    );
  }

  if (!turn) return null;
  const turnComplete = Boolean(turn.completedAt && turn.review);

  return (
    <section className="nhk-page nhk-flow nhk-boss-page">
      <header className="nhk-flow-header">
        <button aria-label="返回" onClick={onBack}><ArrowLeft size={20} /></button>
        <div><small>WEEKLY BOSS · {formatPeriod(current.weekStartKey, current.weekEndKey)}</small><strong>{displayIndex + 1}/5</strong></div>
        <span />
      </header>

      <div className="nhk-boss-progress">{current.turns.map(item => (
        <i key={item.id} className={item.completedAt ? 'done' : item.index === displayIndex ? 'current' : ''} />
      ))}</div>

      <div className="nhk-boss-stage">
        <div className="nhk-boss-intro">
          <span><Mic2 size={14} />约 3 分钟</span>
          <strong>没有选择题，也不提前告诉你会考哪句话。</strong>
          <small>系统会从本周至少 5 个真实表达中逐轮抽取。</small>
        </div>

        <div className="nhk-boss-sources">
          <small>来自本周真实输入</small>
          <div>{sourceTitles.map(title => <span key={title}>{title}</span>)}</div>
        </div>

        <div className={`nhk-boss-turn nhk-boss-${turn.register}`}>
          <span>{registerLabel(turn.register)}</span>
          <h1>{turn.promptZh}</h1>
          <blockquote>{turn.promptJa}</blockquote>
          <small>目标表达已隐藏。先直接回答，之后才看反馈。</small>
        </div>

        {!turnComplete ? (
          <NhkRecordingCoach
            key={turn.id}
            label="30～40秒回答"
            mode="world"
            referenceText={turn.promptJa}
            summary={current.sourceSummaryJa}
            question={turn.promptJa}
            targetExpression={turn.targetExpression}
            onDuration={setRecordingSeconds}
            onReview={saveReview}
          />
        ) : (
          <>
            <NhkSpeechReviewPanel review={turn.review!} />
            <div className="nhk-boss-hidden-target">
              <small>这一轮实际回收</small>
              <strong>{turn.targetExpression}</strong>
              <span>{turn.review!.metrics.targetExpressionUsed ? '已自然使用' : '这次没有用出来，下次会再次回收'}</span>
            </div>
            {nextTurn ? (
              <button className="nhk-boss-next" onClick={() => {
                setDisplayIndex(displayIndex + 1);
                setRecordingSeconds(0);
              }}>
                听田中继续追问<ChevronRight size={17} />
              </button>
            ) : (
              <button className="nhk-boss-next complete" onClick={finishBoss}>
                <Check size={17} />查看本周结果
              </button>
            )}
          </>
        )}

        <div className="nhk-boss-counter"><span>{completedCount}</span>/5 轮已完成</div>
      </div>
    </section>
  );
}
