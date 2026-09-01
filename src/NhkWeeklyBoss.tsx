import {ArrowLeft, Check, ChevronRight, RotateCcw, Sparkles, Target} from 'lucide-react';
import {NhkRecordingCoach, type NhkSpeechReview} from './NhkSpeechCoach';
import {
  advanceNhkWeeklyBoss,
  bossReviewPassed,
  bossTurnNeedsRecovery,
  completeNhkWeeklyBoss,
  createNhkWeeklyBossProgress,
  loadNhkWeeklyBossProgress,
  NHK_WEEKLY_BOSS_VERSION,
  recordNhkWeeklyBossReview,
  reviewsForBossTurn,
  saveNhkWeeklyBossProgress,
  type NhkWeeklyBossPlan,
  type NhkWeeklyBossProgress,
} from './nhkWeeklyBoss';

const registerCopy = (register: 'daily' | 'polite' | 'business'): string =>
  register === 'business' ? '工作会议' : register === 'polite' ? '礼貌说明' : '日常讨论';

export default function NhkWeeklyBoss({
  plan,
  onBack,
  onComplete,
}: {
  plan: NhkWeeklyBossPlan;
  onBack: () => void;
  onComplete: (progress: NhkWeeklyBossProgress) => void;
}) {
  const [progress, setProgress] = useStateWithPlan(plan);

  if (!plan.ready || !plan.turns.length) {
    return (
      <section className="nhk-page nhk-flow nhk-weekly-boss" data-boss-version={NHK_WEEKLY_BOSS_VERSION}>
        <header className="nhk-flow-header">
          <button aria-label="返回" onClick={onBack}><ArrowLeft size={20} /></button>
          <div><small>WEEKLY BOSS</small><strong>本周综合对话</strong></div>
          <span />
        </header>
        <div className="nhk-boss-empty">
          <Target size={23} />
          <h1>还差 {Math.max(0, plan.requiredExpressionCount - plan.availableExpressionCount)} 个不同表达</h1>
          <p>本周积累到 5 个真实 NHK 表达后，会生成一段没有选择题的语音对话。</p>
        </div>
      </section>
    );
  }

  if (progress.completedAt && progress.outcome) {
    return (
      <section className="nhk-page nhk-flow nhk-weekly-boss" data-boss-version={NHK_WEEKLY_BOSS_VERSION}>
        <header className="nhk-flow-header">
          <button aria-label="返回" onClick={onBack}><ArrowLeft size={20} /></button>
          <div><small>WEEKLY BOSS COMPLETE</small><strong>本周综合对话完成</strong></div>
          <span />
        </header>
        <div className="nhk-boss-result">
          <div className="nhk-boss-result-icon"><Check size={25} /></div>
          <h1>{progress.outcome.usedExpressionCount}/5 个表达主动说出来了</h1>
          <p>平均表达完成度 {progress.outcome.averageContentScore}/100；补救后找回 {progress.outcome.recoveredExpressionCount} 个表达。</p>
          <div className="nhk-boss-result-grid">
            <span><small>主动使用</small><strong>{progress.outcome.usedExpressionCount}</strong></span>
            <span><small>补救成功</small><strong>{progress.outcome.recoveredExpressionCount}</strong></span>
            <span><small>仍需回收</small><strong>{progress.outcome.weakExpressions.length}</strong></span>
          </div>
          {progress.outcome.weakExpressions.length > 0 && (
            <div className="nhk-boss-weak">
              <small>下周优先再遇</small>
              {progress.outcome.weakExpressions.map(expression => <strong key={expression}>{expression}</strong>)}
            </div>
          )}
          <button className="nhk-primary-action" onClick={() => onComplete(progress)}>返回今日首页<ChevronRight size={18} /></button>
        </div>
      </section>
    );
  }

  const turn = plan.turns[Math.min(progress.currentTurnIndex, plan.turns.length - 1)];
  const attempts = reviewsForBossTurn(progress, turn.turnId);
  const recovery = bossTurnNeedsRecovery(attempts);
  const latestReview = attempts[attempts.length - 1];
  const prompt = recovery ? turn.recoveryPromptJa : turn.promptJa;
  const canAdvance = Boolean(latestReview) && !recovery;

  const recordReview = (review: NhkSpeechReview) => {
    setProgress(current => recordNhkWeeklyBossReview(current, turn.turnId, review));
  };

  const advance = () => {
    if (!canAdvance) return;
    if (progress.currentTurnIndex >= plan.turns.length - 1) {
      setProgress(current => completeNhkWeeklyBoss(current, plan));
      return;
    }
    setProgress(current => advanceNhkWeeklyBoss(current, plan));
  };

  return (
    <section className="nhk-page nhk-flow nhk-weekly-boss" data-boss-version={NHK_WEEKLY_BOSS_VERSION}>
      <header className="nhk-flow-header">
        <button aria-label="返回" onClick={onBack}><ArrowLeft size={20} /></button>
        <div><small>WEEKLY BOSS · 3 MIN</small><strong>{progress.currentTurnIndex + 1}/5</strong></div>
        <span />
      </header>
      <div className="nhk-boss-progress">{plan.turns.map((item, index) => <i key={item.turnId} className={index <= progress.currentTurnIndex ? 'active' : ''} />)}</div>

      <div className="nhk-boss-card">
        <div className="nhk-boss-meta">
          <span>{registerCopy(turn.register)}</span>
          <small>{recovery ? '上一遍没有稳定用出目标表达，问题已缩小' : '不提前显示要考的表达'}</small>
        </div>
        <h1>{prompt}</h1>
        <p>{recovery ? '这不是判错重来，而是同一个表达的即时补救。' : '用 20～40 秒回答；对方会根据结果决定追问还是补救。'}</p>

        <NhkRecordingCoach
          key={`${turn.turnId}-${attempts.length}`}
          label={recovery ? '补救回答' : '直接回答'}
          mode="world"
          referenceText={turn.referenceAnswerJa}
          summary={turn.sourceTitle}
          question={prompt}
          targetExpression={turn.targetExpression}
          review={latestReview}
          onDuration={() => undefined}
          onReview={recordReview}
        />

        {latestReview && (
          <div className={`nhk-boss-reveal ${bossReviewPassed(latestReview) ? 'passed' : 'recovery'}`}>
            <small>{bossReviewPassed(latestReview) ? '这次成功带出了' : '下一遍要找回'}</small>
            <strong>{turn.targetExpression}</strong>
            <span>来源：{turn.sourceTitle}</span>
          </div>
        )}

        {canAdvance && (
          <button className="nhk-primary-action" onClick={advance}>
            {progress.currentTurnIndex >= plan.turns.length - 1 ? '完成本周 Boss' : '听下一位追问'}<ChevronRight size={18} />
          </button>
        )}
        {recovery && <div className="nhk-boss-recovery-note"><RotateCcw size={14} />请按上面的新追问再录一次。</div>}
      </div>
    </section>
  );
}

function useStateWithPlan(plan: NhkWeeklyBossPlan): [NhkWeeklyBossProgress, React.Dispatch<React.SetStateAction<NhkWeeklyBossProgress>>] {
  const [progress, setProgress] = React.useState<NhkWeeklyBossProgress>(() =>
    loadNhkWeeklyBossProgress(plan.planId) || createNhkWeeklyBossProgress(plan));
  React.useEffect(() => {
    setProgress(loadNhkWeeklyBossProgress(plan.planId) || createNhkWeeklyBossProgress(plan));
  }, [plan.planId]);
  React.useEffect(() => saveNhkWeeklyBossProgress(progress), [progress]);
  return [progress, setProgress];
}
