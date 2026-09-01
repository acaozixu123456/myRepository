import {ArrowLeft, BookOpen, Check, Eye, RotateCcw} from 'lucide-react';
import {useMemo, useState} from 'react';
import {NhkSentencePlayer} from './NhkSpeechCoach';
import {
  primaryNhkTrainingSentence,
  type NhkMorningSession,
  type NhkRecallRating,
} from './nhkMorning';

const formatDate = (dateKey: string): string => {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
};

export default function NhkQuietReview({
  session,
  onBack,
  onComplete,
}: {
  session: NhkMorningSession;
  onBack: () => void;
  onComplete: (rating: NhkRecallRating, note: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [note, setNote] = useState('');
  const primary = useMemo(() => primaryNhkTrainingSentence(session.dailyInput), [session.dailyInput]);
  const sourceSentence = primary?.sourceSentence
    || session.selectedSentences[0]
    || session.shadowText.split(/\n+/).find(Boolean)
    || session.keyExpression;
  const chunks = primary?.chunks?.length ? primary.chunks : sourceSentence ? [sourceSentence] : [];

  return (
    <section className="nhk-page nhk-flow nhk-quiet-review-page">
      <header className="nhk-flow-header">
        <button aria-label="返回" onClick={onBack}><ArrowLeft size={22} /></button>
        <div><small>QUIET REVIEW</small><strong>静音复习</strong></div>
        <span />
      </header>

      <div className="nhk-quiet-review-shell">
        <div className="nhk-quiet-review-lead">
          <BookOpen size={22} />
          <div>
            <small>{formatDate(session.dateKey)} · {session.title || '最近学过的内容'}</small>
            <h1>先别看答案，回想新闻重点和那句核心表达。</h1>
            <p>不需要开口，也不会调用麦克风。可以只在心里组织，也可以记下关键词。</p>
          </div>
        </div>

        {!revealed ? (
          <>
            <label className="nhk-quiet-note">
              <span>可选：写下你还记得的内容</span>
              <textarea
                value={note}
                onChange={event => setNote(event.target.value)}
                placeholder="例如：この変更を受けて…"
                rows={4}
              />
            </label>
            <button className="nhk-primary-action" onClick={() => setRevealed(true)}>
              <Eye size={18} />已经回想过，查看答案
            </button>
          </>
        ) : (
          <>
            {sourceSentence && <NhkSentencePlayer sentence={sourceSentence} chunks={chunks} />}
            <div className="nhk-quiet-review-answer">
              <small>核心表达</small>
              <strong>{session.keyExpression || sourceSentence}</strong>
              {primary?.meaningZh && <p>{primary.meaningZh}</p>}
              <div><span>日常</span><b>{session.dailyVersion || sourceSentence}</b></div>
              <div><span>工作</span><b>{session.workVersion || session.dailyVersion || sourceSentence}</b></div>
            </div>
            {session.dailyInput?.coach.summaryZh && (
              <div className="nhk-quiet-summary">
                <small>新闻重点</small>
                <p>{session.dailyInput.coach.summaryZh}</p>
              </div>
            )}
            <div className="nhk-quiet-rating">
              <span>这次回想得怎么样？</span>
              <div>
                <button onClick={() => onComplete('miss', note)}><RotateCcw size={16} />没想起</button>
                <button onClick={() => onComplete('close', note)}>有点模糊</button>
                <button className="good" onClick={() => onComplete('good', note)}><Check size={16} />想起来了</button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
