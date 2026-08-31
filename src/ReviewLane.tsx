import {useState} from 'react';
import {Mic2, Volume2} from 'lucide-react';
import {Story} from './content';
import {buildPlayPlan, PlayClipId} from './playPlan';
import type {Weakness} from './PracticeLane';

type ClipState = 'ready' | 'pending' | 'failed';
type RecallResult = 'good' | 'close' | 'miss';
type MemoryRecord = {
  strength: number;
  nextReviewAt: number;
  lastSeen: number;
  weaknesses?: Partial<Record<Weakness, number>>;
};

export default function ReviewLane({
  story,
  clipStatus,
  playClip,
  memory,
  onComplete,
  onMistake,
}: {
  story: Story;
  clipStatus: Partial<Record<PlayClipId, ClipState>>;
  playClip: (storyId: string, clipId: PlayClipId, rate?: number) => Promise<boolean>;
  memory: MemoryRecord;
  onComplete: (result: RecallResult) => void;
  onMistake: (kind: Weakness) => void;
}) {
  const plan = buildPlayPlan(story);
  const [revealed, setRevealed] = useState(false);
  const [heard, setHeard] = useState(false);
  const [busy, setBusy] = useState<PlayClipId | null>(null);

  if (!plan) return <section className="play-empty">这个主题还没有完整复习玩法。</section>;

  const ready = (id: PlayClipId) => clipStatus[id] === 'ready';
  const ranked = (Object.entries(memory.weaknesses || {}) as [Weakness, number][])
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);
  const weakness = ranked[0]?.[0];
  const sceneIndex = Math.min(4, Math.max(1, memory.strength));
  const scene = plan.scenarios[sceneIndex];
  const sceneId = `scene${sceneIndex}` as PlayClipId;
  const variant = weakness === 'register'
    ? 'register'
    : ((weakness === 'meaning' || memory.strength <= 1) && ready(sceneId))
      ? 'audio'
      : memory.strength >= 4
        ? 'open'
        : 'scene';
  const label = variant === 'audio'
    ? '听力辨认'
    : variant === 'register'
      ? '语域换说法'
      : variant === 'scene'
        ? '场景召回'
        : '开放输出';
  const targetClip = variant === 'register' ? 'business' as PlayClipId : sceneId;
  const targetText = variant === 'register' ? plan.business : scene.jp;

  const play = async (id: PlayClipId) => {
    if (!ready(id) || busy) return false;
    setBusy(id);
    const ok = await playClip(story.id, id, 1);
    setBusy(null);
    return ok;
  };

  const rate = (result: RecallResult) => {
    if (result !== 'good') {
      onMistake(variant === 'register' ? 'register' : variant === 'audio' ? 'meaning' : variant === 'scene' ? 'transfer' : 'recall');
    }
    onComplete(result);
  };

  return (
    <section className="core-play">
      <div className="play-step-title">
        <span>复习</span>
        <div className="play-title-actions"><strong>{label}</strong></div>
      </div>
      <div className="play-emoji">{variant === 'register' ? '💼' : scene.emoji}</div>

      {variant === 'audio' && !revealed && (
        <>
          <h1>只听一次，说出这里的意思</h1>
          {!heard ? (
            <button className="listen-first" disabled={!!busy} onClick={async () => {
              const ok = await play(sceneId);
              if (ok) setHeard(true);
            }}>
              <Volume2 size={22} />
              <span>{busy === sceneId ? '播放中…' : '只听一次'}</span>
            </button>
          ) : (
            <div className="speak-actions">
              <button onClick={() => setRevealed(true)}>我想好了</button>
              <button onClick={() => setRevealed(true)}>想不出</button>
            </div>
          )}
        </>
      )}

      {variant === 'register' && !revealed && (
        <>
          <h1>对客户或上司，你会怎么说？</h1>
          <div className="speak-actions">
            <button className="speak-first" onClick={() => setRevealed(true)}><Mic2 size={18} /> 我说好了</button>
            <button onClick={() => setRevealed(true)}>想不出</button>
          </div>
        </>
      )}

      {(variant === 'scene' || variant === 'open') && !revealed && (
        <>
          <p className="play-cue">{scene.cue}</p>
          {variant === 'scene' && <small className="audio-pending">{scene.cn}</small>}
          <h1>{variant === 'scene' ? '用日语说一句' : '直接说出来'}</h1>
          <div className="speak-actions">
            <button className="speak-first" onClick={() => setRevealed(true)}><Mic2 size={18} /> 我说好了</button>
            <button onClick={() => setRevealed(true)}>想不出</button>
          </div>
        </>
      )}

      {revealed && (
        <div className="speak-stage">
          <strong>{targetText}</strong>
          <small>{variant === 'register' ? plan.businessNote : scene.cn}</small>
          {ready(targetClip) ? (
            <button className="reference-audio" disabled={!!busy} onClick={() => void play(targetClip)}><Volume2 size={17} /> 听参考</button>
          ) : (
            <small className="audio-pending">参考音频准备中</small>
          )}
          <div className="speak-actions three">
            <button onClick={() => rate('miss')}>完全不会</button>
            <button onClick={() => rate('close')}>有点不同</button>
            <button onClick={() => rate('good')}>说出来了</button>
          </div>
        </div>
      )}
    </section>
  );
}
