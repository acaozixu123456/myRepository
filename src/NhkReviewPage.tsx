import {useMemo, useState} from 'react';
import {ArrowLeft, BookOpen, BriefcaseBusiness, ChevronRight, RotateCcw, Sparkles} from 'lucide-react';
import {
  primaryNhkTrainingSentence,
  shiftDateKey,
  type NhkMorningSession,
  type NhkRecallTarget,
  type NhkWorldCallbackTarget,
} from './nhkMorning';
import type {NhkStudyMode} from './nhkStudyMode';

const formatDate = (dateKey: string): string => {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
};

export default function NhkReviewPage({
  sessions,
  todayKey,
  studyMode,
  recallTarget,
  callbackTarget,
  onBack,
  onOpenRecall,
  onOpenCallback,
}: {
  sessions: NhkMorningSession[];
  todayKey: string;
  studyMode: NhkStudyMode;
  recallTarget: NhkRecallTarget | null;
  callbackTarget: NhkWorldCallbackTarget | null;
  onBack: () => void;
  onOpenRecall: () => void;
  onOpenCallback: (session: NhkMorningSession) => void;
}) {
  const [openId, setOpenId] = useState('');
  const recent = useMemo(() => sessions
    .filter(session => Boolean(session.completedAt))
    .sort((left, right) => right.dateKey.localeCompare(left.dateKey))
    .slice(0, 12), [sessions]);
  const weeklyExpressions = useMemo(() => {
    const start = shiftDateKey(todayKey, -6);
    const seen = new Set<string>();
    const values: Array<{id: string; expression: string; daily: string; work: string}> = [];
    for (const session of recent) {
      if (session.dateKey < start) continue;
      for (const item of session.dailyInput?.selectedTrainingSentences || []) {
        const expression = item.expression.trim();
        if (!expression || seen.has(expression)) continue;
        seen.add(expression);
        values.push({id: item.id, expression, daily: item.dailyVersion, work: item.workVersion});
        if (values.length >= 8) return values;
      }
    }
    return values;
  }, [recent, todayKey]);

  return (
    <section className="nhk-page nhk-flow nhk-review-page">
      <header className="nhk-flow-header">
        <button aria-label="返回" onClick={onBack}><ArrowLeft size={22} /></button>
        <div><small>随时复习</small><strong>{studyMode === 'quiet' ? '安静学习，不需要开口' : '回看并重新组织表达'}</strong></div>
        <span />
      </header>

      <div className="nhk-review-intro">
        <BookOpen size={22} />
        <div>
          <strong>{studyMode === 'quiet' ? '现在不方便说话，也可以继续。' : '先看旧内容，再决定是否开口。'}</strong>
          <p>默读、回忆和书面回答都会保存学习进度，但不会伪装成口语分析成绩。</p>
        </div>
      </div>

      {(recallTarget || callbackTarget) && (
        <section className="nhk-review-section due">
          <div className="nhk-review-section-title"><RotateCcw size={18} /><div><strong>现在最值得复习</strong><small>到期内容优先</small></div></div>
          <div className="nhk-review-due-list">
            {recallTarget && (
              <button onClick={onOpenRecall}>
                <div><small>第 {recallTarget.intervalDay} 天 · {recallTarget.register === 'work' ? '工作迁移' : recallTarget.register === 'daily' ? '日常迁移' : '核心重建'}</small><strong>{recallTarget.titleZh}</strong><span>{recallTarget.promptZh}</span></div>
                <ChevronRight size={19} />
              </button>
            )}
            {callbackTarget && (
              <button onClick={() => onOpenCallback(callbackTarget.session)}>
                <div><small>连续世界回访</small><strong>田中又提起了「{callbackTarget.session.title || '前几天的话题'}」</strong><span>可以直接用日语书面回答。</span></div>
                <ChevronRight size={19} />
              </button>
            )}
          </div>
        </section>
      )}

      {weeklyExpressions.length > 0 && (
        <section className="nhk-review-section">
          <div className="nhk-review-section-title"><Sparkles size={18} /><div><strong>本周表达</strong><small>安静模式下可先熟悉，不计入 Weekly Boss 成绩</small></div></div>
          <div className="nhk-weekly-expression-list">
            {weeklyExpressions.map(item => (
              <article key={item.id}>
                <strong lang="ja">{item.expression}</strong>
                {item.daily && <p><span>平时</span><b lang="ja">{item.daily}</b></p>}
                {item.work && <p><span>工作</span><b lang="ja">{item.work}</b></p>}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="nhk-review-section">
        <div className="nhk-review-section-title"><BriefcaseBusiness size={18} /><div><strong>最近学过</strong><small>{recent.length ? `${recent.length} 条可随时回看` : '完成一次今朝训练后会出现在这里'}</small></div></div>
        {recent.length ? (
          <div className="nhk-review-history">
            {recent.map(session => {
              const primary = primaryNhkTrainingSentence(session.dailyInput);
              const open = openId === session.id;
              return (
                <article key={session.id} className={open ? 'open' : ''}>
                  <button onClick={() => setOpenId(open ? '' : session.id)} aria-expanded={open}>
                    <span>{formatDate(session.dateKey)}</span>
                    <div><strong>{session.title || session.keyExpression || '日语复习'}</strong><small>{session.keyExpression || primary?.expression}</small></div>
                    <ChevronRight size={18} />
                  </button>
                  {open && (
                    <div className="nhk-review-detail">
                      <small>核心原句</small>
                      <strong lang="ja">{primary?.sourceSentence || session.shadowText.split('\n')[0]}</strong>
                      <div><span>表达</span><b lang="ja">{session.keyExpression || primary?.expression}</b></div>
                      <div><span>平时</span><b lang="ja">{session.dailyVersion || primary?.dailyVersion}</b></div>
                      <div><span>工作</span><b lang="ja">{session.workVersion || primary?.workVersion}</b></div>
                      {session.recapText && <p><span>上次复述</span>{session.recapText}</p>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="nhk-review-empty">还没有已完成的内容。先从一篇 MOJi / NHK 文章开始。</div>
        )}
      </section>
    </section>
  );
}
