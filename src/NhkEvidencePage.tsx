import {
  ArrowLeft,
  BookOpen,
  Check,
  Mic2,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type {
  NhkEvidenceComparison,
  NhkEvidenceValue,
  NhkWeeklyEvidence,
} from './nhkEvidence';

const displayValue = (metric: NhkEvidenceValue, suffix: string, digits = 0): string => {
  if (metric.value === null) return '—';
  return `${digits ? metric.value.toFixed(digits) : Math.round(metric.value)}${suffix}`;
};

const comparisonValue = (value: number, unit: string): string =>
  `${unit === '字/秒' ? value.toFixed(1) : Math.round(value)}${unit}`;

const changeState = (comparison: NhkEvidenceComparison): 'better' | 'worse' | 'same' => {
  const improvement = comparison.lowerIsBetter ? -comparison.delta : comparison.delta;
  if (improvement > 0) return 'better';
  if (improvement < 0) return 'worse';
  return 'same';
};

const changeCopy = (comparison: NhkEvidenceComparison): string => {
  const state = changeState(comparison);
  if (state === 'same') return '持平';
  const amount = Math.abs(comparison.delta);
  const formatted = comparison.unit === '字/秒' ? amount.toFixed(1) : Math.round(amount).toString();
  return `${state === 'better' ? '改善' : '波动'} ${formatted}${comparison.unit}`;
};

const minutesCopy = (seconds: number): string => {
  if (seconds < 60) return `${seconds}秒`;
  return `${Math.round(seconds / 60)}分钟`;
};

function MetricCard({label, value, note}: {label: string; value: string; note: string}) {
  return (
    <div className="nhk-evidence-metric">
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{note}</span>
    </div>
  );
}

export default function NhkEvidencePage({
  evidence,
  onBack,
}: {
  evidence: NhkWeeklyEvidence;
  onBack: () => void;
}) {
  const quietActivity = evidence.studyModes.quietCompletedInputs
    + evidence.studyModes.quietReviews
    + evidence.studyModes.quietRecallAttempts;

  return (
    <section className="nhk-page nhk-flow nhk-evidence-page">
      <header className="nhk-flow-header">
        <button aria-label="返回" onClick={onBack}><ArrowLeft size={22} /></button>
        <div><small>WEEKLY EVIDENCE</small><strong>本周学习证据</strong></div>
        <span />
      </header>

      <div className="nhk-evidence-hero">
        <div><TrendingUp size={23} /><small>{evidence.periodLabel}</small></div>
        <h1>{evidence.headlineZh}</h1>
        <p>开口练习和静音学习分开记录。不会把打字冒充口语，也不会因为今天不方便说话就抹掉学习。</p>
      </div>

      <div className="nhk-evidence-week-grid">
        <div><small>真实输入</small><strong>{evidence.completedInputs}</strong><span>篇完成训练</span></div>
        <div><small>开口完成</small><strong>{evidence.studyModes.voiceCompletedInputs}</strong><span>{evidence.analyzedResponses} 次语音分析</span></div>
        <div><small>静音学习</small><strong>{quietActivity}</strong><span>学习、复习与回忆</span></div>
        <div><small>开口时间</small><strong>{minutesCopy(evidence.speakingSeconds)}</strong><span>只计真实录音</span></div>
      </div>

      <section className="nhk-evidence-section">
        <div className="nhk-evidence-title"><Mic2 size={20} /><div><strong>开口表现</strong><small>{evidence.analyzedResponses ? '本周平均' : '等待语音证据'}</small></div></div>
        <div className="nhk-evidence-metrics">
          <MetricCard
            label="跟读文本一致度"
            value={displayValue(evidence.current.shadowAccuracy, '分')}
            note={`${evidence.current.shadowAccuracy.count} 次影子跟读`}
          />
          <MetricCard
            label="跟读漏词率"
            value={displayValue(evidence.current.omissionRate, '%')}
            note="越低越好"
          />
          <MetricCard
            label="脱稿表达完成度"
            value={displayValue(evidence.current.outputScore, '分')}
            note={`${evidence.current.outputScore.count} 次复述或观点`}
          />
          <MetricCard
            label="目标表达使用率"
            value={displayValue(evidence.current.targetUseRate, '%')}
            note="是否真正迁移出来"
          />
          <MetricCard
            label="表达密度"
            value={displayValue(evidence.current.speakingDensity, '字/秒', 1)}
            note="只和自己纵向比较"
          />
        </div>
      </section>

      <section className="nhk-evidence-section">
        <div className="nhk-evidence-title"><BookOpen size={20} /><div><strong>静音学习</strong><small>不计语音分，但保留真实学习轨迹</small></div></div>
        <div className="nhk-quiet-evidence-grid">
          <div><small>静音完成</small><strong>{evidence.studyModes.quietCompletedInputs}</strong><span>次完整训练</span></div>
          <div><small>随时复习</small><strong>{evidence.studyModes.quietReviews}</strong><span>次主动回想</span></div>
          <div><small>静音回忆</small><strong>{evidence.studyModes.quietRecallAttempts}</strong><span>次到期回收</span></div>
        </div>
      </section>

      <section className="nhk-evidence-section">
        <div className="nhk-evidence-title"><Sparkles size={20} /><div><strong>以前的你 vs 最近的你</strong><small>只比较同类语音证据</small></div></div>
        {evidence.comparisons.length ? (
          <div className="nhk-evidence-comparisons">
            {evidence.comparisons.map(item => (
              <div key={item.key}>
                <div><strong>{item.label}</strong><small>{item.sampleCount} 次证据</small></div>
                <span>{comparisonValue(item.baseline, item.unit)}</span>
                <i>→</i>
                <b>{comparisonValue(item.recent, item.unit)}</b>
                <em className={changeState(item)}>{changeCopy(item)}</em>
              </div>
            ))}
          </div>
        ) : (
          <div className="nhk-evidence-empty">
            <TrendingUp size={22} />
            <strong>语音基线正在建立</strong>
            <p>静音学习已经正常记录；同一种开口训练再完成一次分析后，就能开始比较。</p>
          </div>
        )}
      </section>

      <section className="nhk-evidence-section">
        <div className="nhk-evidence-title"><RotateCcw size={20} /><div><strong>延迟回忆</strong><small>第 1、3、7 天，语音与静音自评分开保留</small></div></div>
        <div className="nhk-recall-evidence">
          {evidence.recall.map(item => (
            <div key={item.intervalDay}>
              <span>第{item.intervalDay}天</span>
              <div><i style={{width: `${item.masteryPercent || 0}%`}} /></div>
              <strong>{item.masteryPercent === null ? '尚未回收' : `${item.masteryPercent}%`}</strong>
              <small>{item.attempts
                ? `${item.attempts} 次 · 开口 ${item.voiceAttempts} · 静音 ${item.quietAttempts}${item.averageScore === null ? '' : ` · 口语 ${item.averageScore}分`}`
                : '等待到期'}
              </small>
            </div>
          ))}
        </div>
      </section>

      <div className="nhk-evidence-privacy">
        <Check size={18} />
        <p><strong>只保存结果，不保存原始录音。</strong><span>静音记录不进入口语分数；表达密度也不是发音、音调或反应时间评分。</span></p>
      </div>
    </section>
  );
}
