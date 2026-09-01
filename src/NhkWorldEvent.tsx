import {useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  MessageCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import NhkPracticeModeSwitch from './NhkPracticeModeSwitch';
import NhkQuietResponseCard from './NhkQuietResponseCard';
import {NhkRecordingCoach, type NhkSpeechReview} from './NhkSpeechCoach';
import {
  applyNhkWorldCallbackReview,
  completeNhkWorldCallback,
  primaryNhkTrainingSentence,
  type NhkMorningSession,
} from './nhkMorning';
import type {NhkPracticeMode} from './nhkPracticeMode';

export type NhkWorldEventMode = 'event' | 'callback';

const formatDate = (dateKey: string): string => {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
};

export default function NhkWorldEvent({
  session,
  mode,
  worldTitle,
  practiceMode,
  onPracticeModeChange,
  onBack,
  onUpdate,
  onContinueStory,
}: {
  session: NhkMorningSession;
  mode: NhkWorldEventMode;
  worldTitle?: string;
  practiceMode: NhkPracticeMode;
  onPracticeModeChange: (mode: NhkPracticeMode) => void;
  onBack: () => void;
  onUpdate: (session: NhkMorningSession) => void;
  onContinueStory: () => void;
}) {
  const [current, setCurrent] = useState(session);
  const [answer, setAnswer] = useState(session.dailyInput?.world.callback.answer || '');
  const [recordingSeconds, setRecordingSeconds] = useState(session.dailyInput?.world.callback.recordingSeconds || 0);
  const [fallback, setFallback] = useState(false);
  const [review, setReview] = useState<NhkSpeechReview | undefined>(session.dailyInput?.world.callback.review);
  const recordingSecondsRef = useRef(session.dailyInput?.world.callback.recordingSeconds || 0);

  useEffect(() => {
    setCurrent(session);
    setAnswer(session.dailyInput?.world.callback.answer || '');
    const nextSeconds = session.dailyInput?.world.callback.recordingSeconds || 0;
    recordingSecondsRef.current = nextSeconds;
    setRecordingSeconds(nextSeconds);
    setReview(session.dailyInput?.world.callback.review);
    setFallback(false);
  }, [session, mode]);

  const input = current.dailyInput;
  const primary = useMemo(() => primaryNhkTrainingSentence(input), [input]);
  if (!input) return null;

  const world = input.world;
  const callback = world.callback;
  const callbackComplete = Boolean(callback.completedAt);
  const originalReactionJa = world.characterReactionJa || 'なるほど。その考え方は覚えておきます。';
  const originalReactionZh = world.characterReactionZh || '田中记住了你的回答，这件事会在几天后再次出现。';
  const callbackReactionJa = callback.characterReactionJa || review?.characterReactionJa;
  const callbackReactionZh = callback.characterReactionZh || review?.characterReactionZh;

  const updateRecordingSeconds = (seconds: number) => {
    recordingSecondsRef.current = seconds;
    setRecordingSeconds(seconds);
  };

  const saveReview = (nextReview: NhkSpeechReview) => {
    const next = applyNhkWorldCallbackReview(current, nextReview, recordingSecondsRef.current);
    setCurrent(next);
    setAnswer(nextReview.transcript);
    setReview(nextReview);
    onUpdate(next);
  };

  const finishCallback = () => {
    const currentSeconds = practiceMode === 'voice' ? recordingSecondsRef.current : 0;
    const activeReview = practiceMode === 'voice' ? review : undefined;
    const canFinish = answer.trim()
      && (practiceMode === 'quiet' || Boolean(currentSeconds || fallback || activeReview));
    if (!canFinish) return;
    const next = completeNhkWorldCallback(
      current,
      answer,
      currentSeconds,
      activeReview,
      Date.now(),
      practiceMode,
    );
    setCurrent(next);
    onUpdate(next);
  };

  return (
    <section className="nhk-page nhk-flow nhk-world-event-page">
      <header className="nhk-flow-header">
        <button aria-label="返回" onClick={onBack}><ArrowLeft size={22} /></button>
        <div>
          <small>{mode === 'callback' ? 'WORLD CALLBACK' : 'TODAY IN MY WORLD'}</small>
          <strong>{mode === 'callback' ? '几天后的回响' : '今天的因果事件'}</strong>
        </div>
        <span />
      </header>

      {mode === 'callback' && !callbackComplete && (
        <NhkPracticeModeSwitch compact value={practiceMode} onChange={onPracticeModeChange} />
      )}

      <div className="nhk-causal-event">
        <div className="nhk-causal-character">
          <span>田</span>
          <div><small>{worldTitle || '在日本生活和工作的我'}</small><strong>{world.characterName}</strong></div>
        </div>

        {mode === 'event' ? (
          <>
            <span className="nhk-kicker">NEWS BECAME AN EVENT</span>
            <h1>今天的新闻，真的进入了你的世界。</h1>
            <p className="nhk-causal-setup">{world.setupZh}</p>
            <div className="nhk-causal-dialogue">
              <small>{world.characterName}</small>
              <strong>「{world.promptJa}」</strong>
            </div>
            <div className="nhk-causal-answer">
              <small>你当时的回答 · {current.completedMode === 'quiet' ? '静音学习' : '开口练习'}</small>
              <strong>{world.answer || current.worldAnswer}</strong>
            </div>
            {(typeof world.contentScore === 'number' || typeof world.targetExpressionUsed === 'boolean') && (
              <div className="nhk-causal-metrics">
                {typeof world.contentScore === 'number' && <span>表达完成度 <b>{world.contentScore}</b></span>}
                {world.targetExpressionUsed === true && <span>已用上今日表达</span>}
              </div>
            )}
            <div className="nhk-causal-reaction">
              <MessageCircle size={20} />
              <div><strong>{originalReactionJa}</strong><p>{originalReactionZh}</p></div>
            </div>
            <div className="nhk-causal-consequence">
              <RotateCcw size={19} />
              <div>
                <small>{formatDate(callback.dueDateKey)} 回收</small>
                <strong>田中会记住这次回答，并再次追问。</strong>
              </div>
            </div>
            {primary && (
              <div className="nhk-causal-expression">
                <small>这件事留下的表达</small>
                <strong>{primary.expression}</strong>
                <p>{primary.workVersion}</p>
              </div>
            )}
            <div className="nhk-world-event-actions">
              <button onClick={onBack}>回到今朝</button>
              <button className="primary" onClick={onContinueStory}>继续原来的连续剧情<ChevronRight size={18} /></button>
            </div>
          </>
        ) : callbackComplete ? (
          <>
            <span className="nhk-kicker">CALLBACK COMPLETE</span>
            <h1>这件事已经产生了后续。</h1>
            <p className="nhk-causal-setup">{callback.setupZh}</p>
            <div className="nhk-causal-answer">
              <small>你现在的回答 · {callback.responseMode === 'quiet' ? '静音学习' : '开口练习'}</small>
              <strong>{callback.answer}</strong>
            </div>
            {(typeof callback.contentScore === 'number' || typeof callback.targetExpressionUsed === 'boolean') && (
              <div className="nhk-causal-metrics">
                {typeof callback.contentScore === 'number' && <span>这次完成度 <b>{callback.contentScore}</b></span>}
                {callback.targetExpressionUsed === true && <span>成功迁移目标表达</span>}
              </div>
            )}
            {(callbackReactionJa || callbackReactionZh) && (
              <div className="nhk-causal-reaction">
                <Check size={20} />
                <div>{callbackReactionJa && <strong>{callbackReactionJa}</strong>}{callbackReactionZh && <p>{callbackReactionZh}</p>}</div>
              </div>
            )}
            <div className="nhk-world-event-actions">
              <button onClick={onBack}>回到今朝</button>
              <button className="primary" onClick={onContinueStory}>继续连续剧情<ChevronRight size={18} /></button>
            </div>
          </>
        ) : (
          <>
            <span className="nhk-kicker">THREE DAYS LATER</span>
            <h1>田中真的又提起了那件事。</h1>
            <p className="nhk-causal-setup">{callback.setupZh}</p>
            <div className="nhk-prior-world-answer">
              <small>上次你的回答</small>
              <strong>{world.answer}</strong>
              <p>{originalReactionZh}</p>
            </div>
            <div className="nhk-causal-dialogue">
              <small>{world.characterName}</small>
              <strong>「{callback.promptJa}」</strong>
            </div>

            {practiceMode === 'voice' ? (
              <>
                <NhkRecordingCoach
                  label="不看旧答案，再回答一次"
                  mode="world"
                  referenceText={callback.promptJa}
                  summary={input.coach.summaryJa}
                  question={callback.promptJa}
                  targetExpression={primary?.expression || current.keyExpression}
                  review={review}
                  onDuration={updateRecordingSeconds}
                  onReview={saveReview}
                  onUnavailable={() => setFallback(true)}
                />
                <label className="nhk-callback-answer">系统转写（可修正）
                  <textarea
                    value={answer}
                    onChange={event => setAnswer(event.target.value)}
                    placeholder="录音分析后自动填写；设备不支持时可手动输入"
                    rows={4}
                  />
                </label>
              </>
            ) : (
              <NhkQuietResponseCard
                title="静音回答这次追问"
                description="不用开口，但要重新组织一次，不要照抄上次答案。"
                prompt={callback.promptJa}
                value={answer}
                onChange={setAnswer}
                placeholder="用 1～3 句日语回答田中"
                rows={5}
              />
            )}

            {practiceMode === 'quiet' && (
              <div className="nhk-mode-note"><BookOpen size={18} /><span>这次会记为静音回访，不计入语音分数和开口时长。</span></div>
            )}

            <button
              className="nhk-callback-complete"
              disabled={!answer.trim() || (practiceMode === 'voice' && !recordingSeconds && !fallback && !review)}
              onClick={finishCallback}
            >
              <Sparkles size={18} />让这段后续留在世界里
            </button>
          </>
        )}
      </div>
    </section>
  );
}
