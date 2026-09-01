import {Activity, ArrowDownRight, ArrowUpRight, Minus, RotateCcw, Sparkles, Target} from 'lucide-react';
import type {NhkMorningSession} from './nhkMorning';
import {
  buildNhkWeeklyEvidence,
  NHK_WEEKLY_EVIDENCE_VERSION,
  type NhkEvidenceMetric,
  type NhkEvidenceTrend,
} from './nhkLearningEvidence';

const valueCopy = (metric: NhkEvidenceMetric): string => {
  if (metric.current === null) return '—';
  return metric.unit === '%' ? `${metric.current}%` : `${metric.current}/100`;
};

const trendCopy = (metric: NhkEvidenceMetric): string => {
  if (metric.trend === 'building' || metric.delta === null) return metric.current === null ? '还没有记录' : '建立比较基线';
  if (metric.trend === 'steady') return '与前一周接近';
  const magnitude = Math.abs(metric.delta);
  if (metric.key === 'shadowOmission') {
    return metric.trend === 'improved' ? `少 ${magnitude} 个百分点` : `多 ${magnitude} 个百分点`;
  }
  return metric.trend === 'improved' ? `提高 ${magnitude} 个百分点` : `下降 ${magnitude} 个百分点`;
};

const TrendIcon = ({trend}: {trend: NhkEvidenceTrend}) => {
  if (trend === 'improved') return <ArrowUpRight size={14} />;
  if (trend === 'declined') return <ArrowDownRight size={14} />;
  return <Minus size={14} />;
};

const sourceCopy = (metric: NhkEvidenceMetric): string => {
  if (!metric.currentCount) return '等待第一次分析';
  return `${metric.currentCount} 次实际记录`;
};

export default function NhkWeeklyEvidence({
  sessions,
  todayKey,
}: {
  sessions: NhkMorningSession[];
  todayKey: string;
}) {
  const evidence = buildNhkWeeklyEvidence(sessions, todayKey);
  const recallHasData = evidence.current.recallByInterval.some(item => item.attempts > 0);

  return (
    <section className={`nhk-weekly-evidence ${evidence.evidenceCount ? '' : 'empty'}`.trim()} data-evidence-version={NHK_WEEKLY_EVIDENCE_VERSION}>
      <header>
        <div>
          <small>WEEKLY EVIDENCE</small>
          <strong>以前的你 vs 现在的你</strong>
        </div>
        <span><Activity size={14} />{evidence.current.completedDays} 天</span>
      </header>

      <div className="nhk-evidence-headline">
        <Sparkles size={17} />
        <div><strong>{evidence.headline}</strong><p>{evidence.detailZh}</p></div>
      </div>

      <div className="nhk-evidence-grid">
        {evidence.metrics.map(metric => (
          <article key={metric.key} className={metric.trend}>
            <div>
              {metric.key === 'worldTransfer' ? <Target size={15} /> : metric.key === 'recallSuccess' ? <RotateCcw size={15} /> : <Activity size={15} />}
              <small>{metric.label}</small>
            </div>
            <strong>{valueCopy(metric)}</strong>
            <span><TrendIcon trend={metric.trend} />{trendCopy(metric)}</span>
            <em>{sourceCopy(metric)}</em>
          </article>
        ))}
      </div>

      <div className="nhk-recall-evidence">
        <div><small>第 1 / 3 / 7 天主动回忆</small><strong>{recallHasData ? '按间隔分别证明' : '完成回忆后自动出现'}</strong></div>
        <div>
          {evidence.current.recallByInterval.map(item => (
            <span key={item.intervalDay} className={item.attempts ? 'ready' : ''}>
              <b>D{item.intervalDay}</b>
              <strong>{item.successRate === null ? '—' : `${item.successRate}%`}</strong>
              <small>{item.attempts ? `${item.good}/${item.attempts}` : '未到期'}</small>
            </span>
          ))}
        </div>
      </div>

      <footer>
        <span>本周证据：{evidence.current.speechReviewCount} 次语音分析 · {evidence.current.recallAttemptCount} 次延迟回忆</span>
        <small>这里只比较转写、任务完成和主动回忆，不把它冒充成口音或声学发音评分。</small>
      </footer>
    </section>
  );
}
