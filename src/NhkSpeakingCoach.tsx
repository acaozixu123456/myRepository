import {useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Check, HandHelping, LoaderCircle, Mic, MicOff, Volume2, X} from 'lucide-react';
import {buildSpeakingPlan, newSpeakingProgress, speakingErrorMessage, type SpeakingArticle, type SpeakingProgress} from './nhkSpeaking';
import {NhkSpeakingConnection, type SpeakingPhase} from './nhkSpeakingConnection';
import './nhkSpeaking.css';
type Props={article:SpeakingArticle;preferredSentence?:string};
export default function NhkSpeakingCoach({article,preferredSentence=''}:Props){
  const plan=useMemo(()=>buildSpeakingPlan(article,preferredSentence),[article,preferredSentence]);
  const [open,setOpen]=useState(false),[phase,setPhase]=useState<SpeakingPhase>('connecting');
  const [progress,setProgress]=useState<SpeakingProgress>(newSpeakingProgress);
  const [assistant,setAssistant]=useState(''),[hint,setHint]=useState('只说一点也可以，不用组织整篇新闻。'),[blocked,setBlocked]=useState(false),[error,setError]=useState(''),[model,setModel]=useState(''),[showHelp,setShowHelp]=useState(false);
  const connection=useRef<NhkSpeakingConnection|null>(null),activeId=useRef(0),dialog=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null),entryButton=useRef<HTMLButtonElement>(null);
  const frozenPlan=useRef(plan);
  const end=()=>connection.current?.end();
  const dismiss=()=>{connection.current?.dispose();connection.current=null;activeId.current++;setOpen(false);};
  const start=()=>{
    connection.current?.dispose();const id=++activeId.current;frozenPlan.current=plan;
    setOpen(true);setPhase('connecting');setProgress(newSpeakingProgress());setAssistant('');setError('');setBlocked(false);setShowHelp(false);setModel('');setHint('接通后会先递给你一个词。只说这一点就好。');
    const current=()=>activeId.current===id;
    const next=new NhkSpeakingConnection(plan,{onPhase:v=>{if(current())setPhase(v);},onProgress:v=>{if(current()){setProgress(v);setShowHelp(v.lastKind==='help'||v.lastKind==='chinese');}},onAssistant:v=>{if(current())setAssistant(v);},onHint:v=>{if(current())setHint(v);},onBlocked:v=>{if(current())setBlocked(v);},onModel:v=>{if(current())setModel(v);},onError:v=>{if(current())setError(speakingErrorMessage(v));}});
    connection.current=next;void next.start();
  };
  useEffect(()=>()=>{activeId.current++;connection.current?.dispose();},[]);
  useEffect(()=>{if(!open)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';closeButton.current?.focus();const hidden=()=>{if(document.hidden)connection.current?.end();};const pageHide=()=>connection.current?.dispose();document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',pageHide);return()=>{document.body.style.overflow=old;document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pageHide);entryButton.current?.focus();};},[open]);
  const step=frozenPlan.current.steps[Math.min(progress.turn,2)];
  const running=!['done','error'].includes(phase),connected=running&&phase!=='connecting';
  const phaseText=phase==='connecting'?'正在接通，麦克风尚未传声':phase==='coach'?'先听一句，暂不收音':phase==='thinking'?'正在接住你的话':phase==='listening'?'我在听，慢慢说':'麦克风已关闭';
  return <section className="nhk-speaking-entry" aria-label="这篇新闻的语音陪练" data-speaking-contract="nhk-speaking-v1">
    <div className="nhk-speaking-entry-copy"><span className="nhk-speaking-eyebrow">不用准备，先接一句</span><h2>说一点，就好。</h2><p>只聊这篇新闻。卡住有人接，三个短来回就收尾。</p></div>
    <button ref={entryButton} className="nhk-speaking-start" onClick={start} disabled={!plan.source.length||open}><Mic size={19}/>陪我说一句</button>
    <small className="nhk-speaking-consent">点开始即同意将声音实时传给 OpenAI；声音由 AI 生成。App 不保存录音，随时可以结束。</small>
    {open&&createPortal(<div className="nhk-speaking-overlay"><div ref={dialog} className="nhk-speaking-dialog" role="dialog" aria-modal="true" aria-labelledby="nhk-speaking-title" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();dismiss();}if(e.key==='Tab'){const controls=[...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary')||[])];const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
      <header className="nhk-speaking-header"><div><span className="nhk-speaking-eyebrow">一句陪练</span><h2 id="nhk-speaking-title">不用说得完整。</h2></div><button ref={closeButton} className="nhk-speaking-icon" aria-label="结束并关闭陪练" onClick={dismiss}><X size={23}/></button></header>
      <p className="nhk-speaking-article" title={frozenPlan.current.title}>{frozenPlan.current.title}</p>
      <div className={`nhk-speaking-orb ${phase}`} aria-hidden="true">{phase==='connecting'||phase==='thinking'?<LoaderCircle size={27} className="nhk-speaking-spin"/>:running?<Mic size={29}/>:<MicOff size={29}/>}</div>
      <p className="nhk-speaking-status" role="status" aria-live="polite">{phaseText}</p>
      {running&&<><div className="nhk-speaking-step"><p>{step.cueZh}</p>{step.targetJa?<strong lang="ja">{step.targetJa}</strong>:<div className="nhk-speaking-choices" aria-label="可以借用的表达">{step.choices.map(choice=><span lang="ja" key={choice}>{choice}</span>)}</div>}{step.sourceQuote&&<details><summary>看看它在原文里怎么说</summary><blockquote lang="ja">{step.sourceQuote}</blockquote></details>}</div>
      <p className="nhk-speaking-hint" aria-live="polite">{hint}</p>
      {showHelp&&<div className="nhk-speaking-help-text"><span>借用这一句也可以</span><strong lang="ja">{step.targetJa||step.choices[1]}</strong></div>}
      {assistant&&<details className="nhk-speaking-caption"><summary>刚才说了什么</summary><p lang="ja">{assistant}</p></details>}
      {blocked&&<button className="nhk-speaking-start" onClick={()=>void connection.current?.unlockAudio()}><Volume2 size={19}/>播放声音</button>}
      <div className="nhk-speaking-tools"><button disabled={!connected} onClick={()=>{setShowHelp(true);connection.current?.help();}}><HandHelping size={19}/>帮我接</button><button disabled={!connected} onClick={()=>connection.current?.repeat()}><Volume2 size={19}/>再听一次</button></div>
      <button className="nhk-speaking-finished-saying" disabled={phase!=='listening'&&phase!=='thinking'} onClick={()=>connection.current?.finishUtterance()}>我说完了</button><button className="nhk-speaking-end" onClick={end}>今天到这里</button></>}
      {phase==='error'&&<div className="nhk-speaking-finish"><p role="alert">{error}</p><button className="nhk-speaking-start" onClick={start}>重新接一句</button><button className="nhk-speaking-end" onClick={dismiss}>回到这篇新闻</button></div>}
      {phase==='done'&&<div className="nhk-speaking-finish"><span className="nhk-speaking-finish-check"><Check size={25}/></span><h3>{progress.turn?'你已经开口了。':'今天到这里，也没关系。'}</h3><p>{progress.turn>=3?'三个短来回，今天就练到这里。不打分，也不用继续解释。':progress.turn?`刚才尝试回应了 ${progress.turn} 次。这一点点，也算开始。`:'下次还是从这一篇、这一小句开始。'}</p><button className="nhk-speaking-start" onClick={dismiss}>回到这篇新闻</button></div>}
      <footer className="nhk-speaking-footer"><span>{running?'只做三个短来回，随时可以停':'不保存录音，不计入发音或掌握评分'}</span>{model&&<small>{model}</small>}</footer>
    </div></div>,document.body)}
  </section>;
}
