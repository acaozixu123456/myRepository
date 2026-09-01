import {ArrowLeft, Check, ChevronRight, MessageCircle, Sparkles} from 'lucide-react';
import type {Story} from './content';
import EpisodeVisual from './EpisodeVisual';
import {NHK_CAUSAL_WORLD_VERSION, type NhkCausalWorldEvent} from './nhkCausalWorld';

const formatDate = (dateKey: string): string => {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
};

export default function NhkCausalWorld({
  event,
  story,
  onBack,
  onContinue,
}: {
  event: NhkCausalWorldEvent;
  story: Story | null;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="nhk-page nhk-flow nhk-causal-world" data-world-version={NHK_CAUSAL_WORLD_VERSION}>
      <header className="nhk-flow-header">
        <button aria-label="返回" onClick={onBack}><ArrowLeft size={20} /></button>
        <div>
          <small>{event.isCallback ? 'WORLD CALLBACK' : 'TODAY IN YOUR WORLD'}</small>
          <strong>{event.isCallback ? '这件事真的继续了' : '今天造成的变化'}</strong>
        </div>
        <span />
      </header>

      <div className="nhk-causal-hero">
        {story && <EpisodeVisual story={story} />}
        <div className="nhk-causal-badge"><Sparkles size={14} />{event.isCallback ? '第3天回收' : '独立剧情事件'}</div>
        <h1>{event.title}</h1>
        <p>{event.setupZh}</p>
      </div>

      <div className="nhk-causal-thread">
        <div className="nhk-causal-message character">
          <span>田中</span>
          <strong>{event.promptJa}</strong>
        </div>
        <div className="nhk-causal-message learner">
          <span>你的回答</span>
          <strong>{event.answerJa}</strong>
          {event.targetExpression && <small>使用目标：{event.targetExpression}</small>}
        </div>
        <div className="nhk-causal-message reaction">
          <span><MessageCircle size={13} />田中的反应</span>
          <strong>{event.reactionJa}</strong>
          <p>{event.reactionZh}</p>
        </div>
      </div>

      {event.isCallback ? (
        <div className="nhk-causal-consequence">
          <Check size={18} />
          <div>
            <small>{formatDate(event.sourceDateKey)} 的回答产生了后续</small>
            <strong>人物没有忘记你的选择，这件事会继续影响接下来的交流。</strong>
          </div>
        </div>
      ) : (
        <div className="nhk-causal-consequence pending">
          <Sparkles size={18} />
          <div>
            <small>{formatDate(event.callbackDueDateKey)} 再遇</small>
            <strong>三天后，田中会再次提起今天的这件事。</strong>
          </div>
        </div>
      )}

      <button className="nhk-primary-action" onClick={onContinue}>
        继续你的连续世界<ChevronRight size={18} />
      </button>
    </section>
  );
}
