import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {HandHelping,LoaderCircle,Mic,MicOff,Shuffle,Volume2,X} from 'lucide-react';
import {buildSpeakingPlan,type SpeakingArticle} from './nhkSpeaking';
import {chatError,chatTopics,nextChatTopic,type ChatPlan} from './nhkChat';
import {NhkChatConnection,type ChatPhase} from './nhkChatConnection';
import './nhkSpeaking.css';
type Props={article:SpeakingArticle;preferredSentence?:string};
export default function NhkSpeakingCoach({article,preferredSentence=''}:Props){
  const base=useMemo(()=>buildSpeakingPlan(article,preferredSentence),[article,preferredSentence]);
  const pool=useMemo(()=>chatTopics(base),[base]);
  const [topicId,setTopicId]=useState(()=>nextChatTopic(pool,[]).topic.id);const seen=useRef<string[]>([topicId]);
  const selected=pool.find(t=>t.id===topicId)||pool[0];
  const [open,setOpen]=useState(false),[phase,setPhase]=useState<ChatPhase>('connecting');
  const [assistant,setAssistant]=useState(''),[hint,setHint]=useState(''),[blocked,setBlocked]=useState(false),[error,setError]=useState(''),[turns,setTurns]=useState(0),[showHelp,setShowHelp]=useState(false),[retryUntil,setRetryUntil]=useState(0),[now,setNow]=useState(Date.now());
  const connection=useRef<NhkChatConnection|null>(null),sequence=useRef(0),dialog=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null),entryButton=useRef<HTMLButtonElement>(null);
  const plan=(id=selected.id):ChatPlan=>({...base,chatMode:true,topicId:id});
  const shuffle=()=>{const next=nextChatTopic(pool,seen.current);seen.current=next.seen;setTopicId(next.topic.id);setAssistant('');setShowHelp(false);setTurns(0);setHint('不喜欢这个，也可以继续换。');connection.current?.changeTopic(plan(next.topic.id));};
  const dismiss=()=>{connection.current?.dispose();connection.current=null;sequence.current++;setOpen(false);};
  const start=()=>{
    if(Date.now()<retryUntil)return;connection.current?.dispose();const seq=++sequence.current;setOpen(true);setPhase('connecting');setAssistant('');setError('');setBlocked(false);setShowHelp(false);setTurns(0);setHint('它先问一句，你接一点就好。');
    const current=()=>sequence.current===seq;
    const next=new NhkChatConnection(plan(),{phase:p=>{if(current())setPhase(p);},assistant:s=>{if(current())setAssistant(s);},hint:s=>{if(current())setHint(s);},blocked:v=>{if(current())setBlocked(v);},shuffle:()=>{if(current())shuffle();},heard:()=>{if(current()){setTurns(t=>t+1);setShowHelp(false);}},error:(reason,seconds)=>{if(current()){setError(chatError(reason,seconds));const delay=Math.max(0,Math.min(3600,seconds||0));setRetryUntil(Date.now()+delay*1000);setNow(Date.now());}}});
    connection.current=next;void next.start();
  };
  useEffect(()=>()=>{sequence.current++;connection.current?.dispose();},[]);
  useEffect(()=>{if(!open)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';closeButton.current?.focus();const hidden=()=>{if(document.hidden)connection.current?.end();};const pageHide=()=>connection.current?.dispose();document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',pageHide);return()=>{document.body.style.overflow=old;document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pageHide);entryButton.current?.focus();};},[open]);
  useEffect(()=>{if(!open||phase!=='error'||retryUntil<=Date.now())return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[open,phase,retryUntil]);
  const running=!['done','error'].includes(phase),connected=running&&!['connecting','renewing'].includes(phase);const retrySeconds=Math.max(0,Math.ceil((retryUntil-now)/1000));
  const status=phase==='connecting'?'正在接通，暂不传声':phase==='renewing'?'正在续接，话题保留':phase==='coach'?'先听一句，暂不收音':phase==='thinking'?'正在接住你的话':phase==='listening'?'我在听，慢慢说':'麦克风已关闭';
  return <section className="nhk-speaking-entry nhk-chat-entry" aria-label="这篇新闻的轻松聊天" data-speaking-contract="nhk-chat-v2">
    <div className="nhk-speaking-entry-copy"><span className="nhk-speaking-eyebrow">只聊这篇，也可以聊到你的生活</span><h2>随机找个话头。</h2><p>不用准备答案。一个词也可以接下去。</p></div>
    <div className="nhk-chat-preview"><span>{selected.titleZh}</span><strong lang="ja">{selected.questionJa}</strong><button className="nhk-chat-shuffle" onClick={shuffle} aria-label="换个话题"><Shuffle size={18}/>换个话题</button></div>
    <button ref={entryButton} className="nhk-speaking-start" onClick={start} disabled={!base.source.length||open}><Mic size={19}/>陪我说一句</button>
    <small className="nhk-speaking-consent">挑话题不需要开麦。点开始即同意将声音实时传给 OpenAI，声音由 AI 生成；App 不保存录音。</small>
    {open&&createPortal(<div className="nhk-speaking-overlay"><div ref={dialog} className="nhk-speaking-dialog nhk-chat-dialog" role="dialog" aria-modal="true" aria-labelledby="nhk-chat-title" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();dismiss();}if(e.key==='Tab'){const controls=[...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary')||[])];const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
      <header className="nhk-speaking-header"><div><span className="nhk-speaking-eyebrow">简单聊两句</span><h2 id="nhk-chat-title">{selected.titleZh}</h2></div><button ref={closeButton} className="nhk-speaking-icon" aria-label="结束并关闭陪练" onClick={dismiss}><X size={23}/></button></header>
      <p className="nhk-speaking-article">{article.title}</p>
      <div className={`nhk-speaking-orb ${phase}`} aria-hidden="true">{['connecting','renewing','thinking'].includes(phase)?<LoaderCircle size={26} className="nhk-speaking-spin"/>:running?<Mic size={27}/>:<MicOff size={27}/>}</div>
      <p className="nhk-speaking-status" role="status" aria-live="polite">{status}</p>
      {running&&<>
        <div className="nhk-speaking-step nhk-chat-current"><small>{showHelp?'借用这一句，再说成自己的':'现在只接这一句'}</small><strong lang="ja">{assistant||(!turns?selected.questionJa:'我在接着你的话想一句…')}</strong>{!turns&&!showHelp&&<div className="nhk-chat-suggestions">{selected.answersJa.map(a=><span lang="ja" key={a}>{a}</span>)}</div>}</div>
        <p className="nhk-speaking-hint" aria-live="polite">{hint}</p>
        {blocked&&<button className="nhk-speaking-start" onClick={()=>void connection.current?.unlockAudio()}><Volume2 size={19}/>播放声音</button>}
        <div className="nhk-chat-main-tools"><button onClick={shuffle}><Shuffle size={19}/>换个话题</button><button disabled={!connected} onClick={()=>{setShowHelp(true);connection.current?.help();}}><HandHelping size={19}/>帮我接</button></div>
        <div className="nhk-chat-minor-tools"><button disabled={!connected} onClick={()=>connection.current?.repeat()}><Volume2 size={16}/>再听一次</button><button disabled={phase!=='listening'&&phase!=='thinking'} onClick={()=>connection.current?.finishUtterance()}>我说完了</button></div>
        <button className="nhk-speaking-end" onClick={()=>connection.current?.end()}>今天到这里</button>
      </>}
      {phase==='error'&&<div className="nhk-speaking-finish"><p role="alert">{error}</p><button className="nhk-speaking-start" disabled={retrySeconds>0} onClick={start}>{retrySeconds>0?`${retrySeconds} 秒后可重连`:'重新接上'}</button><button className="nhk-speaking-end" onClick={dismiss}>回到这篇新闻</button></div>}
      {phase==='done'&&<div className="nhk-speaking-finish"><h3>今天说到这里。</h3><p>{hint.includes('暂停')?hint:'说一点也是聊天，不必完成什么任务。'}</p><button className="nhk-speaking-start" onClick={start}>接着这个话题聊</button><button className="nhk-speaking-end" onClick={dismiss}>回到这篇新闻</button></div>}
      <footer className="nhk-speaking-footer"><span>{running?'没有固定轮数，随时换、随时停':'不保存录音，不计入发音或掌握评分'}</span></footer>
    </div></div>,document.body)}
  </section>;
}
