import {ArrowLeft, Check, ChevronRight, RotateCcw, Target} from 'lucide-react';
import {useState} from 'react';
import {NhkRecordingCoach, type NhkSpeechReview} from './NhkSpeechCoach';
import type {NhkRecallRating} from './nhkMorning';
import {
  NHK_RECOVERY_QUEUE_VERSION,
  recoveryRatingForReview,
  type NhkRecoveryQueueItem,
} from './nhkRecoveryQueue';

const registerCopy = (register: 'daily' | 'polite' | 'business'): string =>
  register === 'business' ? '工作场景' : register === 'polite' ? '礼貌场景' : '日常场景';

const ratingCopy = (rating: NhkRecallRating): string =>
  rating === 'good' ? '这次稳定说出来了' : rating === 'close' ? '已经找回一部分' : '今天先留下薄弱点';

export default function NhkRecoveryQueue({
  item,
  onBack,
  onRecord,
}: {
  item: NhkRecoveryQueueItem;
  onBack: () => void;
  onRecord: (review?: NhkSpeechReview, fallbackRating?: NhkRecallRating) => void;
}) {
  const [review, setReview] = useState<NhkSpeechReview>();
  const [fallback, setFallback] = useState(false);
  const [fallbackRating, setFallbackRating] = useState<NhkRecallRating>();
  const rating = review ? recoveryRatingForReview(review) : fallbackRating;

  return (
    <section className="nhk-page nhk-flow nhk-recovery-page" data-recovery-version={NHK_RECOVERY_QUEUE_VERSION}>
      <header className="nhk-flow-header">
        <button aria-label="返回" onClick={onBack}><ArrowLeft size={20} /></button>
        <div><small>RECOVERY</small><strong>把薄弱表达找回来</strong></div>
        <span />
      </header>

      <div className="nhk-recovery-card">
        <div className="nhk-recovery-meta">
          <span><Target size={13} />{registerCopy(item.scenario.register)}</span>
          <small>{item.reasonZh}</small>
        </div>
        <h1>{item.scenario.situationZh}</h1>
        <div className="nhk-recovery-prompt">
          <small>对方问</small>
          <strong>{item.scenario.promptJa}</strong>
        </div>
        <p>{item.scenario.cueZh}</p>

        {!fallback ? (
          <NhkRecordingCoach
            label="换个场景再说一次"
            mode="recall"
            referenceText={item.scenario.referenceAnswerJa}
            summary={item.sourceTitle}
            question={item.scenario.promptJa}
            targetExpression={item.targetExpression}
            review={review}
            onDuration={() => undefined}
            onReview={setReview}
            onUnavailable={() => setFallback(true)}
          />
        ) : (
          <div className="nhk-recovery-fallback">
            <RotateCcw size={17} />
            <strong>当前浏览器不能完成语音分析</strong>
            <p>先自己说完，再展开参考表达并如实自评。</p>
            {!fallbackRating ? (
              <div>
                <button onClick={() => setFallbackRating('miss')}>没想起</button>
                <button onClick={() => setFallbackRating('close')}>差一点</button>
                <button onClick={() => setFallbackRating('good')}>说出来了</button>
              </div>
            ) : null}
          </div>
        )}

        {rating && (
          <div className={`nhk-recovery-result ${rating}`}>
            <small>{ratingCopy(rating)}</small>
            <strong>{item.targetExpression}</strong>
            <p>{item.scenario.referenceAnswerJa}</p>
            {review && <span>表达完成度 {review.metrics.contentScore}/100 · {review.metrics.targetExpressionUsed ? '已用出目标表达' : '目标表达还没有稳定出现'}</span>}
          </div>
        )}

        {rating && (
          <button className="nhk-primary-action" onClick={() => onRecord(review, fallbackRating)}>
            <Check size={17} />记录这次找回<ChevronRight size={18} />
          </button>
        )}
      </div>
    </section>
  );
}
