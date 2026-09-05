import {useEffect, useRef, useState, type ReactNode} from 'react';
import {isSentenceAnalysis, findSentenceAnalysis, sentenceRequest, type SentenceAnalysis} from './nhkSentenceAnalysis';
import {type NhkCoachRecommendation} from './nhkCoach';
import {type NhkArticleRecord} from './nhkLibrary';
import {type PracticeHistory, articlePracticeSessions} from './nhkPracticeHistory';
import {type NhkMorningSession} from './nhkMorning';

export function NhkSentenceInsight({article, recommendation, onSave, children}: {
  article: NhkArticleRecord; recommendation: NhkCoachRecommendation;
  onSave: (articleId: string, analysis: SentenceAnalysis) => void;
  children: (value: NhkCoachRecommendation) => ReactNode;
}) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const cached = findSentenceAnalysis(article.sentenceAnalyses,recommendation.sentence,recommendation.sentenceIndex);
  const alreadyExplained = cached || (article.coachModel && article.coachModel !== 'local-fallback' && article.coach?.recommendations.some(r => r.sentence === recommendation.sentence));
  const generate = async () => {
    if (busy) return;
    setBusy(true);setError('');
    const abort = new AbortController();controller.current = abort;
    const timeout = window.setTimeout(()=>abort.abort(),60000);
    try {
      const input = sentenceRequest(article.title,article.sentences,recommendation.sentenceIndex);
      const response = await fetch('/api/nhk-sentence', {method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:abort.signal});
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(response.status === 429 ? '请求较多，请稍后重试。原文和记录都保留。' : body.reason === 'sentence_too_long' ? '这句过长，暂不能一次分析；原文完整保留。' : '这次精讲没有完成，可以重试。');
      if (!isSentenceAnalysis(body.analysis) || body.analysis.recommendation.sentence !== input.sentence || body.analysis.recommendation.sentenceIndex !== input.sentenceIndex) throw new Error('讲解与当前原句未能正确对应，没有保存。');
      if (!abort.signal.aborted) onSave(article.id,body.analysis);
    } catch(e) {if (controller.current === abort) setError(e instanceof Error && e.name !== 'AbortError' ? e.message : '精讲已中断或超时。原文保留，可以重试。');}
    finally {window.clearTimeout(timeout); if (controller.current === abort) setBusy(false);}
  };
  return <>
    {alreadyExplained ? children(cached?.recommendation || recommendation) : <section className="nhk-deep-analysis-card"><span className="calm-eyebrow">原文 · 这句尚未精讲</span><h2 lang="ja">{recommendation.sentence}</h2><p>可以带着前后文，单独讲解这一句。不会把基础模板当作已完成的 AI 精讲。</p></section>}
    <div className="nhk-sentence-tools"><button disabled={busy} className={alreadyExplained ? 'calm-text-button' : 'calm-primary'} onClick={() => void generate()}>{busy ? '正在讲解这一句…' : alreadyExplained ? '重新讲解这句' : '生成这句精讲'}</button>
      {error && <p role="alert">{error}</p>}
      <details><summary>看看前后文</summary><div className="nhk-context-text">{article.sentences.slice(Math.max(0,recommendation.sentenceIndex-2),recommendation.sentenceIndex+3).map((s,i) => <p lang="ja" key={i}>{s}</p>)}</div></details>
    </div>
  </>;
}
export function NhkHistoryPanel({article, history, sessions}: {article:NhkArticleRecord; history:PracticeHistory; sessions:NhkMorningSession[]}) {
  const attempts = history.attempts.filter(a=>a.articleId===article.id).sort((a,b)=>b.updatedAt-a.updatedAt);
  const outputs = articlePracticeSessions(sessions,article.sourceUrl);
  const date = (n: number) => new Date(n).toLocaleString('zh-CN');
  return <details className="nhk-history-panel"><summary>我的练习记录 · {attempts.length + outputs.length} 次</summary><p>回想结果是自评，不代表系统已验证掌握。这里只显示最近 20 条，完整记录保存在备份中。</p>
    {attempts.slice(0,20).map(a => <article key={a.id}><small>{date(a.updatedAt)} · {a.completedAt ? a.rating === 'good' ? '自评：想起来了' : '自评：还有点模糊' : '尚未提交'}</small><blockquote lang="ja">{a.sentence}</blockquote><p>{a.answer || '没有文字回答，可能只在心里回想。'}</p></article>)}
    {outputs.slice(0,Math.max(0,20-attempts.length)).map(s => <article key={s.id}><small>{s.dateKey} · {s.completedAt ? '表达练习' : '表达草稿'}</small><p lang="ja">{s.recapText}</p>{s.opinion && <p lang="ja">{s.opinion}</p>}</article>)}
    {!attempts.length && !outputs.length && <p>这篇文章还没有练习回答。</p>}
  </details>;
}
