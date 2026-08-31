import {useEffect, useState} from 'react';
import {ChevronRight, Mic2, Volume2} from 'lucide-react';
import {Story} from './content';
import EpisodeVisual from './EpisodeVisual';
import {buildPlayPlan, PlayClipId} from './playPlan';
import {resolveStep2Cue} from './playSemantics';

type ClipState = 'ready' | 'pending' | 'failed';
type RecallResult = 'good' | 'close' | 'miss';
export type Weakness = 'meaning' | 'reply' | 'register' | 'transfer' | 'recall';

const STAGE_LABELS = ['听一句猜意思', '现场怎么回', '平时怎么说', '敬语怎么说', '商务怎么说', '换个情景', '自己说一遍'];
const SCENARIO_TASKS = ['跟上新情景', '看提示说一句', '只看场景说', '只听一次说', '直接说出来'];
const stripCuePrefix = (cue: string) => cue.replace(/^(剧情|迁移)｜/, '');

export default function PracticeLane({
  story,
  clipStatus,
  playClip,
  onComplete,
  onSfx,
  onMistake,
  memoryEcho,
  contextLine,
}: {
  story: Story;
  clipStatus: Partial<Record<PlayClipId, ClipState>>;
  playClip: (storyId: string, clipId: PlayClipId, rate?: number) => Promise<boolean>;
  onComplete: (result: RecallResult) => void;
  onSfx: (kind: 'correct' | 'wrong' | 'next') => void;
  onMistake: (kind: Weakness) => void;
  memoryEcho?: {label: string; term: string} | null;
  contextLine?: string;
}) {
  const plan = buildPlayPlan(story);
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [heard, setHeard] = useState(false);
  const [busy, setBusy] = useState<PlayClipId | null>(null);
  const [said, setSaid] = useState(false);
  const [slow, setSlow] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [scenarioShown, setScenarioShown] = useState(false);
  const [scenarioHeard, setScenarioHeard] = useState(false);

  useEffect(() => {
    setStep(0);
    setAnswer(null);
    setHeard(false);
    setBusy(null);
    setSaid(false);
    setSlow(false);
    setScenarioIndex(0);
    setScenarioShown(false);
    setScenarioHeard(false);
  }, [story.id]);

  if (!plan) return <section className="play-empty">这个主题还没有完整玩法。</section>;

  const ready = (id: PlayClipId) => clipStatus[id] === 'ready';
  const rate = slow ? 0.82 : 1;
  const play = async (id: PlayClipId, mark = false) => {
    if (!ready(id) || busy) return false;
    setBusy(id);
    const ok = await playClip(story.id, id, rate);
    setBusy(null);
    if (ok && mark) setHeard(true);
    return ok;
  };
  const auto = (id: PlayClipId) => { if (ready(id)) void play(id); };

  const next = () => {
    const n = step + 1;
    if (n > 6) return;
    onSfx('next');
    setStep(n);
    setAnswer(null);
    setHeard(false);
    setScenarioShown(false);
    setScenarioHeard(false);
    if (n === 1) auto('replyPrompt');
    if (n === 5) {
      setScenarioIndex(0);
      if (ready('scene0')) void play('scene0', true);
    }
  };

  const registerData = step === 2
    ? {choices: [{text: plan.daily, id: 'daily' as PlayClipId}, {text: plan.business, id: 'business' as PlayClipId}, {text: plan.polite, id: 'polite' as PlayClipId}], correct: 0, correctClip: 'daily' as PlayClipId, feedback: plan.daily}
    : step === 3
      ? {choices: [{text: plan.business, id: 'business' as PlayClipId}, {text: plan.polite, id: 'polite' as PlayClipId}, {text: plan.daily, id: 'daily' as PlayClipId}], correct: 1, correctClip: 'polite' as PlayClipId, feedback: plan.polite}
      : {choices: [{text: plan.polite, id: 'polite' as PlayClipId}, {text: plan.daily, id: 'daily' as PlayClipId}, {text: plan.business, id: 'business' as PlayClipId}], correct: 2, correctClip: 'business' as PlayClipId, feedback: `${plan.businessNote}｜${plan.business}`};

  const chooseRegister = (i: number) => {
    if (answer !== null) return;
    onSfx(i === registerData.correct ? 'correct' : 'wrong');
    if (i !== registerData.correct) onMistake('register');
    setAnswer(i);
    auto(registerData.correctClip);
  };

  const choice = (choices: string[], correct: number, feedback: string, mistake: Weakness, onPick?: (i: number) => void) => (
    <>
      <div className="play-choices">{choices.map((c, i) => (
        <button key={`${i}-${c}`} className={answer === i ? (i === correct ? 'correct' : 'wrong') : ''} onClick={() => {
          if (answer !== null) return;
          onSfx(i === correct ? 'correct' : 'wrong');
          if (i !== correct) onMistake(mistake);
          setAnswer(i);
          onPick?.(i);
        }}>{c}</button>
      ))}</div>
      {answer !== null && <div className="play-feedback"><strong>{answer === correct ? '对了' : '听正确版本'}</strong><small>{feedback}</small></div>}
    </>
  );

  const top = (
    <>
      <div className="play-progress">{[0, 1, 2, 3, 4, 5, 6].map(i => <i key={i} className={i <= step ? 'active' : ''} />)}</div>
      <div className="play-step-title">
        <span>{step + 1}/7</span>
        <div className="play-title-actions">
          <button className={slow ? 'active' : ''} onClick={() => setSlow(v => !v)}>0.8×</button>
          <strong>{STAGE_LABELS[step]}</strong>
        </div>
      </div>
      {contextLine && step === 0 && <p className="play-context">{contextLine}</p>}
      {memoryEcho && step === 0 && <p className="memory-echo">{memoryEcho.label} · {memoryEcho.term}</p>}
    </>
  );

  if (step === 0) {
    return (
      <section className="core-play">
        {top}
        <EpisodeVisual story={story} compact />
        <h1>这句话最接近什么意思？</h1>
        {ready('listen') && !heard ? (
          <button className="listen-first" disabled={!!busy} onClick={() => void play('listen', true)}><Volume2 size={22} /><span>{busy === 'listen' ? '播放中…' : '先听'}</span></button>
        ) : (
          <>
            <strong className="scene-line">{plan.scenarios[0].jp}</strong>
            {clipStatus.listen !== 'ready' && <small className="audio-pending">声音准备中</small>}
          </>
        )}
        {(!ready('listen') || heard) && choice([plan.scenarios[0].cn, plan.scenarios[1].cn, plan.scenarios[2].cn], 0, `${plan.scenarios[0].jp} · ${plan.scenarios[0].cn}`, 'meaning')}
        {answer !== null && <div className="after-audio"><button disabled={!ready('listen') || !!busy} onClick={() => void play('listen')}><Volume2 size={16} /> 再听</button><button className="next-audio" onClick={next}>下一关 <ChevronRight size={17} /></button></div>}
      </section>
    );
  }

  if (step === 1) {
    const step2Cue = resolveStep2Cue(story);
    return (
      <section className="core-play">
        {top}
        <h1>{story.use.prompt}</h1>
        <p className="play-cue">{step2Cue}</p>
        <div className="inline-listen">
          {ready('replyPrompt') ? <button disabled={!!busy} onClick={() => void play('replyPrompt')}><Volume2 size={17} /> 听提示句</button> : <small>提示语音准备中</small>}
        </div>
        {choice(story.use.choices, story.use.correct, story.use.feedback, 'reply', () => auto('reply'))}
        {answer !== null && <div className="after-audio"><button disabled={!ready('reply') || !!busy} onClick={() => void play('reply')}><Volume2 size={16} /> 听回应</button><button className="next-audio" onClick={next}>下一关 <ChevronRight size={17} /></button></div>}
      </section>
    );
  }

  if (step >= 2 && step <= 4) {
    return (
      <section className="core-play">
        {top}
        <div className="register-list">{registerData.choices.map((c, i) => (
          <div className={`register-row ${answer === i ? (i === registerData.correct ? 'correct' : 'wrong') : ''}`} key={`${i}-${c.text}`}>
            <button className="register-answer" onClick={() => chooseRegister(i)} disabled={answer !== null}>{c.text}</button>
            {ready(c.id) && <button className="register-audio" aria-label={`播放 ${c.text}`} disabled={!!busy} onClick={() => void play(c.id)}><Volume2 size={17} /></button>}
          </div>
        ))}</div>
        {answer !== null && <div className="play-feedback"><strong>{answer === registerData.correct ? '对了' : '听正确版本'}</strong><small>{registerData.feedback}</small></div>}
        {answer !== null && <div className="after-audio"><button disabled={!ready(registerData.correctClip) || !!busy} onClick={() => void play(registerData.correctClip)}><Volume2 size={16} /> 再听</button><button className="next-audio" onClick={next}>下一关 <ChevronRight size={17} /></button></div>}
      </section>
    );
  }

  if (step === 5) {
    const scene = plan.scenarios[scenarioIndex];
    const id = `scene${scenarioIndex}` as PlayClipId;
    const isAudioOnly = scenarioIndex === 3 && ready(id);
    const goScene = () => {
      if (scenarioIndex < plan.scenarios.length - 1) {
        onSfx('next');
        setScenarioIndex(v => v + 1);
        setScenarioShown(false);
        setScenarioHeard(false);
      } else next();
    };
    const reveal = (gaveUp = false) => {
      if (gaveUp) onMistake('transfer');
      onSfx(gaveUp ? 'wrong' : 'next');
      setScenarioShown(true);
      if (!gaveUp && ready(id)) auto(id);
    };
    const task = SCENARIO_TASKS[Math.min(scenarioIndex, SCENARIO_TASKS.length - 1)];
    return (
      <section className="core-play">
        {top}
        <div className="scenario-counter">{scenarioIndex + 1}/{plan.scenarios.length}</div>
        {scenarioIndex > 0 && scenarioIndex < 3 && <p className="play-cue">{stripCuePrefix(scene.cue)}</p>}
        <h1>{task}</h1>
        {scenarioIndex === 0 && !scenarioShown && (ready(id) ? (
          <button className="listen-first" disabled={!!busy} onClick={async () => { const ok = await play(id); if (ok) setScenarioShown(true); }}><Volume2 size={22} /><span>{busy === id ? '播放中…' : '先听'}</span></button>
        ) : <button className="text-reveal" onClick={() => setScenarioShown(true)}>看文字</button>)}
        {scenarioIndex > 0 && !scenarioShown && (
          <>
            {scenarioIndex === 1 && <small className="audio-pending">{scene.cn}</small>}
            {isAudioOnly && !scenarioHeard ? (
              <button className="listen-first" disabled={!!busy} onClick={async () => { const ok = await play(id); if (ok) setScenarioHeard(true); }}><Volume2 size={22} /><span>{busy === id ? '播放中…' : '只听一次'}</span></button>
            ) : (
              <div className="speak-actions">
                <button className="speak-first" disabled={isAudioOnly && !scenarioHeard} onClick={() => reveal(false)}><Mic2 size={18} /> 我说好了</button>
                <button onClick={() => reveal(true)}>想不出</button>
              </div>
            )}
          </>
        )}
        {scenarioShown && (
          <div className="scenario-reveal">
            <strong>{scene.jp}</strong>
            <small>{scene.cn}</small>
            {ready(id) && <button onClick={() => void play(id)}><Volume2 size={16} /> 听参考</button>}
            <button className="next-audio" onClick={goScene}>{scenarioIndex < plan.scenarios.length - 1 ? '下一个' : '最后一关'} <ChevronRight size={17} /></button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="core-play">
      {top}
      <h1>{story.review.cloze}</h1>
      <p className="play-cue">{story.review.prompt}</p>
      {!said ? (
        <button className="speak-first" onClick={() => { onSfx('next'); setSaid(true); auto('recall'); }}><Mic2 size={19} /> 我说好了</button>
      ) : (
        <div className="speak-stage">
          <strong>{plan.clips.recall.text}</strong>
          <small>{story.review.feedback}</small>
          {ready('recall') ? <button className="reference-audio" disabled={!!busy} onClick={() => void play('recall')}><Volume2 size={17} /> 听参考</button> : <small className="audio-pending">参考音频准备中</small>}
          <div className="speak-actions three">
            <button onClick={() => onComplete('miss')}>完全不会</button>
            <button onClick={() => onComplete('close')}>有点不同</button>
            <button onClick={() => onComplete('good')}>差不多</button>
          </div>
        </div>
      )}
    </section>
  );
}
