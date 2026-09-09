import './nhkGentleTeacher.css';
import {TopicDeck} from './nhkTopicDeck';
import {silentActivity,type VoiceActivity} from './nhkAudioActivity';
import NhkVoiceControls from './NhkVoiceControls';
import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {HandHelping,Mic,Shuffle,Volume2,X} from 'lucide-react';
import {buildSpeakingPlan,type SpeakingArticle} from './nhkSpeaking';
import {chatError,chatTopics,nextChatTopic,type ChatPlan} from './nhkChat';
import {NhkChatConnection,type ChatPhase} from './nhkChatConnection';
import './nhkSpeaking.css';
import './nhkChat.css';
import './nhkTurnSupport.css';
import {localTurnSupport,type TurnSupportFrame} from './nhkTurnSupport';
import {ChatExperienceStore,ChatExperienceSession} from './nhkChatExperience';
import {ChatExperienceSettings,ChatEffortCheck} from './NhkChatExperience';
type Props={article:SpeakingArticle;preferredSentence?:string};
export default function NhkSpeakingCoach({article,preferredSentence=''}:Props){
  const base=useMemo(()=>buildSpeakingPlan(article,preferredSentence),[article,preferredSentence]);
  const pool=useMemo(()=>chatTopics(base),[base]);
  const [topicId,setTopicId]=useState(()=>nextChatTopic(pool,[]).topic.id);/* topic history is owned by the per-article deck */
  const deck=useMemo(()=>new TopicDeck(base,pool),[base,pool]);const [,refreshTopics]=useState(0);
  const selected=deck.find(topicId)||pool[0];
  const [activity,setActivity]=useState<VoiceActivity>(silentActivity);
  useEffect(()=>()=>deck.dispose(),[deck]);
  const [open,setOpen]=useState(false),[phase,setPhase]=useState<ChatPhase>('connecting');
  const [assistant,setAssistant]=useState(''),[hint,setHint]=useState(''),[blocked,setBlocked]=useState(false),[error,setError]=useState(''),[turns,setTurns]=useState(0),[showHelp,setShowHelp]=useState(false),[retryUntil,setRetryUntil]=useState(0),[now,setNow]=useState(Date.now());
  const [pace,setPace]=useState(0.8);
  const [support,setSupport]=useState<TurnSupportFrame|null>(null),[supportVisible,setSupportVisible]=useState(true);
  const [experience]=useState(()=>new ChatExperienceStore());const session=useRef<ChatExperienceSession|null>(null);const shown=useRef(new Set<string>());
  const connection=useRef<NhkChatConnection|null>(null),sequence=useRef(0),dialog=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null),entryButton=useRef<HTMLButtonElement>(null);
  const plan=(id=selected.id):ChatPlan=>deck.plan(id);
  const shuffle=()=>{const topic=deck.choose(selected.id);const next={topic};setTopicId(topic.id);void deck.replenish(()=>refreshTopics(v=>v+1));setAssistant('');setSupport(null);setShowHelp(false);setTurns(0);setHint('不喜欢这个，也可以继续换。');connection.current?.changeTopic(plan(next.topic.id));};
  const dismiss=()=>{session.current?.finish();connection.current?.dispose();connection.current=null;sequence.current++;setOpen(false);};
  const start=()=>{
    if(Date.now()<retryUntil)return;session.current?.finish();connection.current?.dispose();session.current=new ChatExperienceSession(experience);shown.current.clear();setSupport(null);const seq=++sequence.current;setOpen(true);setActivity(silentActivity());setPhase('connecting');setPace(0.8);setAssistant('');setError('');setBlocked(false);setShowHelp(false);setTurns(0);setHint('它先问一句，你接一点就好。');
    const current=()=>sequence.current===seq;
    const next=new NhkChatConnection(plan(),{activity:v=>{if(current())setActivity(v);},pace:v=>{if(current())setPace(v);},support:f=>{if(current())setSupport(f);},metric:e=>{if(current())session.current?.mark(e);},phase:p=>{if(current()){if(p==='done'||p==='error')session.current?.finish();setPhase(p);}},assistant:s=>{if(current())setAssistant(s);},hint:s=>{if(current())setHint(s);},blocked:v=>{if(current())setBlocked(v);},shuffle:()=>{if(current())shuffle();},heard:()=>{if(current()){setTurns(t=>t+1);setShowHelp(false);}},error:(reason,seconds)=>{if(current()){setError(chatError(reason,seconds));const delay=Math.max(0,Math.min(3600,seconds||0));setRetryUntil(Date.now()+delay*1000);setNow(Date.now());}}});
    connection.current=next;next.setSupportEnabled(supportVisible);void next.start();
  };
  useEffect(()=>()=>{session.current?.finish();sequence.current++;connection.current?.dispose();},[]);
  useEffect(()=>{if(!open)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';closeButton.current?.focus();const hidden=()=>{if(document.hidden)connection.current?.end();};const pageHide=()=>connection.current?.dispose();document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',pageHide);return()=>{document.body.style.overflow=old;document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pageHide);entryButton.current?.focus();};},[open]);
  useEffect(()=>{if(!open||phase!=='error'||retryUntil<=Date.now())return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[open,phase,retryUntil]);
  const frame=support||(!turns&&!showHelp?localTurnSupport('opening',selected.questionJa):null);
  useEffect(()=>{if(open&&supportVisible&&frame&&(frame.words.length||frame.starter)&&!shown.current.has(frame.key)){shown.current.add(frame.key);session.current?.mark('hint_shown');}},[open,supportVisible,frame]);
  const toggleSupport=()=>{const on=!supportVisible;setSupportVisible(on);connection.current?.setSupportEnabled(on);if(!on)session.current?.mark('hint_hidden');};
  const running=!['done','error'].includes(phase),connected=running&&!['connecting','renewing'].includes(phase);const retrySeconds=Math.max(0,Math.ceil((retryUntil-now)/1000));
  const status=phase==='connecting'?'正在接通，暂不传声':phase==='renewing'?'正在续接，话题保留':phase==='coach'?'先听一句，暂不收音':phase==='thinking'?'正在接住你的话':phase==='listening'?(activity.micOn?'慢慢说，一个词也可以':'点麦克风开口，也可以先听听'):'麦克风已关闭';
  return <section className="nhk-speaking-entry nhk-chat-entry" aria-label="这篇新闻的轻松聊天" data-speaking-contract="nhk-chat-v2" data-turn-support="nhk-turn-support-v1" data-teacher="nhk-gentle-teacher-v1">
    <div className="nhk-speaking-entry-copy"><span className="nhk-speaking-eyebrow">从新闻出发，顺着你的话聊</span><h2>随机找个话头。</h2><p>不用准备答案。一个词也可以接下去。</p></div>
    <div className="nhk-chat-preview"><span>{selected.titleZh}{selected.id.startsWith('gen-')&&<small className="nhk-topic-generated">新话头</small>}</span><strong lang="ja">{selected.questionJa}</strong><button className="nhk-chat-shuffle" onClick={shuffle} aria-label="换个话题"><Shuffle size={18}/>换个话题</button><small className="nhk-topic-status" role="status">{deck.status||'换题时按文章补充新话头，不必每次重开聊天'}</small></div>
    <button ref={entryButton} className="nhk-speaking-start" onClick={start} disabled={!base.source.length||open}><Mic size={19}/>陪我说一句</button>
    <small className="nhk-speaking-consent">换题会按需用 OpenAI 生成一批新话头。进入聊天默认闭麦，点麦克风才授权收音，再点立即关闭；声音由 AI 生成，App 不保存录音。</small>
    <ChatExperienceSettings store={experience}/>
    {open&&createPortal(<div className="nhk-speaking-overlay"><div ref={dialog} className="nhk-speaking-dialog nhk-chat-dialog" role="dialog" aria-modal="true" aria-labelledby="nhk-chat-title" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();dismiss();}if(e.key==='Tab'){const controls=[...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary')||[])];const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
      <header className="nhk-speaking-header"><div><span className="nhk-speaking-eyebrow">简单聊两句</span><h2 id="nhk-chat-title">{selected.titleZh}</h2></div><button ref={closeButton} className="nhk-speaking-icon" aria-label="结束并关闭陪练" onClick={dismiss}><X size={23}/></button></header>
      <p className="nhk-speaking-article">{article.title}</p>
      <NhkVoiceControls activity={activity} disabled={!connected} toggle={()=>void connection.current?.toggleMic()}/>
      <p className="nhk-speaking-status" role="status" aria-live="polite">{status}</p>
      {running&&<>
        <div className="nhk-speaking-step nhk-chat-current"><small>{showHelp?'刚才聊到这里':'接一点，也可以'}</small><strong lang="ja">{showHelp&&frame?frame.question:assistant||(!turns?selected.questionJa:'正在接着你的话…')}</strong>
          <div className="nhk-turn-support" data-testid="turn-support" data-turn-key={frame?.key||''}>
            <div className="nhk-turn-support-label"><span>{supportVisible?'可以从这里接，不必照着说':'按自己的意思说就好'}</span><button onClick={toggleSupport} aria-expanded={supportVisible}>{supportVisible?'收起提示':'显示提示'}</button></div>
            {supportVisible&&frame&&<div className="nhk-turn-support-chips">{[...frame.words,frame.starter].filter(Boolean).slice(0,3).map((word,i)=><span lang="ja" key={i}>{word}</span>)}</div>}
            {showHelp&&(assistant||frame?.example)&&<div className="nhk-turn-support-example"><small>只是一个说法，可以换成你的意思</small><p lang="ja">{assistant||frame?.example}</p></div>}
          </div></div>
        <p className="nhk-speaking-hint" aria-live="polite">{hint}</p>
        {blocked&&<button className="nhk-speaking-start" onClick={()=>void connection.current?.unlockAudio()}><Volume2 size={19}/>播放声音</button>}
        <div className="nhk-chat-main-tools"><button onClick={shuffle}><Shuffle size={19}/>换个话题</button><button disabled={!connected} onClick={()=>{setShowHelp(true);connection.current?.help();}}><HandHelping size={19}/>帮我接</button></div>
        <div className="nhk-teacher-tools"><button disabled={!connected} onClick={()=>connection.current?.slowDown()} aria-pressed={pace<0.8}><Volume2 size={16}/>{pace<0.8?'慢速重听':'慢一点'}</button><button disabled={!connected} onClick={()=>{setShowHelp(false);connection.current?.simplify();}}>再简单点</button></div>
        <div className="nhk-chat-minor-tools"><button disabled={!connected} onClick={()=>connection.current?.repeat()}><Volume2 size={16}/>再听一次</button><button disabled={phase!=='listening'&&phase!=='thinking'} onClick={()=>connection.current?.finishUtterance()}>我说完了</button></div>
        <button className="nhk-speaking-end" onClick={()=>connection.current?.end()}>今天到这里</button>
      </>}
      {phase==='error'&&<div className="nhk-speaking-finish"><p role="alert">{error}</p><button className="nhk-speaking-start" disabled={retrySeconds>0} onClick={start}>{retrySeconds>0?`${retrySeconds} 秒后可重连`:'重新接上'}</button><button className="nhk-speaking-end" onClick={dismiss}>回到这篇新闻</button></div>}
      {phase==='done'&&<div className="nhk-speaking-finish"><h3>今天说到这里。</h3><p>{hint.includes('暂停')?hint:'说一点也是聊天，不必完成什么任务。'}</p><ChatEffortCheck session={session.current}/><button className="nhk-speaking-start" onClick={start}>接着这个话题聊</button><button className="nhk-speaking-end" onClick={dismiss}>回到这篇新闻</button></div>}
      <footer className="nhk-speaking-footer"><span>{running?'没有固定轮数，随时换、随时停':'不保存录音，不计入发音或掌握评分'}</span></footer>
    </div></div>,document.body)}
  </section>;
}
