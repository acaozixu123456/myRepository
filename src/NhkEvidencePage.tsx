import {
  ArrowLeft,
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
  return (
    <section className="nhk-page nhk-flow nhk-evidence-page">
      <header className="nhk-flow-header">
        <button aria-label="返回" onClick={onBack}><ArrowLeft size={20} /></button>
        <div><small>WEEKLY EVIDENCE</small><strong>本周真实进步</strong></div>
        <span />
      </header>

      <div className="nhk-evidence-hero">
        <div><TrendingUp size={21} /><small>{evidence.periodLabel}</small></div>
        <h1>{evidence.headlineZh}</h1>
        <p>这里不统计金币和做题数，只看你真正说出来以后留下的证据。</p>
      </div>

      <div className="nhk-evidence-week-grid">
        <div><small>真实输入</small><strong>{evidence.completedInputs}</strong><span>篇完成训练</span></div>
        <div><small>语音证据</small><strong>{evidence.analyzedResponses}</strong><span>次本周分析</span></div>
        <div><small>开口时间</small><strong>{minutesCopy(evidence.speakingSeconds)}</strong><span>只计已录音部分</span></div>
      </div>

      <section className="nhk-evidence-section">
        <div className="nhk-evidence-title"><Mic2 size={17} /><div><strong>现在的表现</strong><small>{evidence.analyzedResponses ? '本周平均' : '最近可用证据'}</small></div></div>
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
            note="仅用于和自己纵向比较"
          />
        </div>
      </section>

      <section className="nhk-evidence-section">
        <div className="nhk-evidence-title"><Sparkles size={17} /><div><strong>以前的你 vs 最近的你</strong><small>最早与最近的同类语音证据</small></div></div>
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
            <TrendingUp size={20} />
            <strong>基线正在建立</strong>
            <p>同一种训练再完成一次语音分析后，就能开始比较“以前”和“最近”。</p>
          </div>
        )}
      </section>

      <section className="nhk-evidence-section">
        <div className="nhk-evidence-title"><RotateCcw size={17} /><div><strong>延迟回忆</strong><small>第 1、3、7 天主动说出来</small></div></div>
        <div className="nhk-recall-evidence">
          {evidence.recall.map(item => (
            <div key={item.intervalDay}>
              <span>第{item.intervalDay}天</span>
              <div>
                <i style={{width: `${item.masteryPercent || 0}%`}} />
              </div>
              <strong>{item.masteryPercent === null ? '尚未回收' : `${item.masteryPercent}%`}</strong>
              <small>{item.attempts ? `${item.attempts} 次${item.averageScore === null ? '' : ` · 表达 ${item.averageScore}分`}` : '等待到期'}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="nhk-evidence-privacy">
        <Check size={16} />
        <p><strong>只保存结果，不保存原始录音。</strong><span>这里的数据来自本机保存的转写、反馈和指标；表达密度不是反应时间，也不代表发音或音调评分。</span></p>
      </div>
    </section>
  );
}
