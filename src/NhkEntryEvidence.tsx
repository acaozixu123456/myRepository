import {useMemo} from 'react';
import {Clock3, DatabaseZap} from 'lucide-react';
import {recentNhkEntryMetrics, summarizeNhkEntryMetrics} from './nhkEntryCost';

const seconds = (value: number | null): string => value === null ? '—' : `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}秒`;

export default function NhkEntryEvidence() {
  const summary = useMemo(() => summarizeNhkEntryMetrics(recentNhkEntryMetrics(undefined, 14)), []);
  if (!summary.sampleCount || summary.averageReadyMs === null) return null;
  const targetRate = Math.round(summary.withinTenSecondsCount / Math.max(1, summary.sampleCount) * 100);

  return (
    <section className="nhk-entry-evidence" aria-label="开始训练速度">
      <div className="nhk-entry-evidence-head">
        <div><Clock3 size={16} /><strong>开始训练速度</strong></div>
        <small>最近 {summary.sampleCount} 次</small>
      </div>
      <div className="nhk-entry-evidence-grid">
        <div><span>链接到可开始</span><strong>{seconds(summary.averageReadyMs)}</strong></div>
        <div><span>10秒内完成</span><strong>{targetRate}%</strong></div>
        <div><span>本机缓存命中</span><strong>{summary.cachedCount}次</strong></div>
      </div>
      <p><DatabaseZap size={13} />文章候选句只缓存在这台设备 7 天，不上传学习记录。</p>
    </section>
  );
}
