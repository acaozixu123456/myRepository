import {useEffect, useMemo, useState} from 'react';
import {ArrowLeft, Check, ChevronRight, MessageCircle, RotateCcw} from 'lucide-react';
import {
  completeNhkWorldCallback,
  primaryNhkTrainingSentence,
  recordNhkQuietWorldAnswer,
  type NhkMorningSession,
} from './nhkMorning';
import type {NhkWorldEventMode} from './NhkWorldEvent';

const formatDate = (dateKey: string): string => {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
};

export default function NhkQuietWorld({
  session,
  mode,
  worldTitle,
  onBack,
  onUpdate,
  onContinueStory,
}: {
  session: NhkMorningSession;
  mode: NhkWorldEventMode;
  worldTitle?: string;
  onBack: () => void;
  onUpdate: (session: NhkMorningSession) => void;
  onContinueStory: () => void;
}) {
  const world = session.dailyInput?.world;
  const primary = primaryNhkTrainingSentence(session.dailyInput);
  const initialAnswer = mode === 'callback' ? world?.callback.answer || '' : world?.answer || session.worldAnswer;
  const alreadyComplete = mode === 'callback'
    ? Boolean(world?.callback.completedAt)
    : Boolean(world?.answeredAt && world.responseMode === 'quiet');
  const [answer, setAnswer] = useState(initialAnswer);
  const [complete, setComplete] = useState(alreadyComplete);

  useEffect(() => {
    setAnswer(mode === 'callback' ? world?.callback.answer || '' : world?.answer || session.worldAnswer);
    setComplete(mode === 'callback'
      ? Boolean(world?.callback.completedAt)
      : Boolean(world?.answeredAt && world.responseMode === 'quiet'));
  }, [session.id, mode]);

  const prompt = mode === 'callback'
    ? world?.callback.promptJa || 'この前の話について、今はどう考えていますか。'
    : world?.promptJa || 'このニュースについて、どう思いますか。';
  const setup = mode === 'callback'
    ? world?.callback.setupZh || '田中再次提起了前几天的话题。'
    : world?.setupZh || '田中在休息时间问起了今天的新闻。';
  const reference = useMemo(() => {
    if (mode === 'callback') return primary?.dailyVersion || session.dailyVersion || session.keyExpression;
    return primary?.workVersion || session.workVersion || session.keyExpression;
  }, [mode, primary, session.dailyVersion, session.keyExpression, session.workVersion]);

  if (!world) return null;

  const submit = () => {
    const value = answer.trim();
    if (!value) return;
    const completedAt = Date.now();
    const next = mode === 'callback'
      ? completeNhkWorldCallback(session, value, 0, undefined, completedAt, 'quiet')
      : recordNhkQuietWorldAnswer(session, value, completedAt);
    onUpdate(next);
    setComplete(true);
  };

  return (
    <section className="nhk-page nhk-flow nhk-quiet-world">
      <header className="nhk-flow-header">
        <button aria-label="返回" onClick={onBack}><ArrowLeft size={22} /></button>
        <div>
          <small>{mode === 'callback' ? `回访 · ${formatDate(world.callback.dueDateKey)}` : '安静进入世界'}</small>
          <strong>{worldTitle || '在日本生活和工作的我'}</strong>
        </div>
        <span />
      </header>

      <div className="nhk-quiet-world-card">
        <span className="nhk-quiet-badge">无需开口</span>
        <h1>{mode === 'callback' ? '田中又想起了你的回答。' : '把今天学到的表达写进这次对话。'}</h1>
        <p>{setup}</p>

        <div className="nhk-quiet-dialogue">
          <MessageCircle size={20} />
          <div><small>田中</small><strong lang="ja">{prompt}</strong></div>
        </div>

        <div className="nhk-quiet-reference">
          <small>可以参考，但不必照抄</small>
          <strong lang="ja">{reference}</strong>
        </div>

        <label className="nhk-quiet-answer">
          <span>用日语写下你的回答</span>
          <textarea
            value={answer}
            onChange={event => {
              setAnswer(event.target.value);
              setComplete(false);
            }}
            rows={5}
            placeholder="在心里组织好后，写一到三句即可"
          />
        </label>

        {!complete ? (
          <button className="nhk-primary-action" disabled={!answer.trim()} onClick={submit}>
            <Check size={18} />保存这次回答
          </button>
        ) : (
          <div className="nhk-quiet-saved">
            <Check size={19} />
            <div>
              <strong>已保存到你的连续世界</strong>
              <p>{mode === 'callback' ? '这次书面回访已经完成，不会计入口语成绩。' : '田中会记住这段回答，几天后可能再次提起。'}</p>
            </div>
          </div>
        )}

        <div className="nhk-quiet-world-actions">
          {mode === 'callback' && <button onClick={onBack}><RotateCcw size={17} />回到复习</button>}
          {mode === 'event' && <button onClick={onContinueStory}>继续原来的连续剧情<ChevronRight size={17} /></button>}
        </div>
      </div>
    </section>
  );
}
