import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowRight,ArrowUp,ChevronDown,Check,Headphones,Leaf,Mic,MicOff,MoreHorizontal,RotateCcw,Shuffle,SlidersHorizontal,Volume2,X,MessageCircle,BookOpen,ChevronRight} from 'lucide-react';
import {CompanionConnection,type Phase} from './connection';
import {chooseSeed,LOCAL_SEEDS,readLearning,writeLearning,eraseLearning,freshPolicy,type Seed,type Policy,type Lane,type Line} from './model';
import {fetchTopics,friendlyError} from './api';
import type {VoiceActivity} from '../nhkAudioActivity';
const LANES:Record<Lane,{name:string;note:string}>={mix:{name:'随意聊聊',note:'从日常，聊到一点小想象'},interests:{name:'兴趣与想象',note:'喜欢的事，和没试过的可能'},work:{name:'工作中的一句话',note:'把真正想说的意思说顺'},curiosity:{name:'一点好奇心',note:'换个角度，想想有趣的小问题'},news:{name:'世界的新鲜事',note:'有来源的真实新闻，轻轻聊一点'}};
const silent:VoiceActivity={micOn:false,input:'off',output:'idle',inputLevel:0,outputLevel:0,meterReady:false};
type Sheet='topics'|'settings'|'write'|'sources'|null;
function Sprig(){return <svg width="28" height="32" viewBox="0 0 28 32" fill="none" aria-hidden="true"><path d="M10 29C13 20 14 13 21 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M14 20C5 19 3 13 5 10c7 0 10 4 9 10Zm3-7c-2-7 2-11 7-11 2 5-1 10-7 11Z" fill="currentColor" opacity=".8"/></svg>;}
function StillLife(){return <svg className="kc-still-life" viewBox="0 0 250 170" fill="none" aria-hidden="true"><path d="M40 149h166" stroke="#b6bdae" strokeWidth="1.2"/><path d="m144 89-5 48c-1 10-47 11-49-1l-5-47" fill="#dfc8b3"/><ellipse cx="114" cy="90" rx="30" ry="7" fill="#f3e8d9" stroke="#af8d72" strokeWidth="1.2"/><path d="M144 98c26-8 24 27-3 24" stroke="#b08e73" strokeWidth="5"/><path d="M50 148c20-34 19-77 48-111" stroke="#73876b" strokeWidth="2" strokeLinecap="round"/><path d="M74 99C45 94 47 76 48 69 66 71 75 83 74 99Z" fill="#9ca68c"/><path d="M78 81c-4-28 12-37 23-40 7 22-4 36-23 40Z" fill="#718568"/><path d="M64 124c-22-4-32-14-31-26 21-3 35 12 31 26Z" fill="#b0b89d"/><path d="M99 60c9-19 25-21 37-14-8 17-21 20-37 14Z" fill="#9cae8b"/><circle cx="185" cy="38" r="19" fill="#e9d58e" opacity=".67"/><path d="M112 69c-7-7 7-12 1-21" stroke="#c0b9a5" strokeWidth="1.5" strokeLinecap="round"/><path d="m169 142 13 4 23-10" stroke="#a9af9d" strokeWidth="1.5" strokeLinecap="round"/></svg>;}
function Bars({level,active}:{level:number;active:boolean}){return <span className="kc-bars" aria-hidden="true">{[.4,.7,1,.65,.85,.5,.3].map((weight,i)=><i key={i} style={{height:`${2+(active?Math.min(1,level)*weight*20:0)}px`}}/>)}</span>;}
export default function CompanionApp(){
  const [seed,setSeed]=useState<Seed>(()=>LOCAL_SEEDS[0]);const [lane,setLane]=useState<Lane>('mix');const [pool,setPool]=useState(LOCAL_SEEDS);const seen=useRef<string[]>([LOCAL_SEEDS[0].id]);const avoided=useRef<string[]>([LOCAL_SEEDS[0].title]);
  const [view,setView]=useState<'home'|'chat'|'end'>('home'),[phase,setPhase]=useState<Phase>('ready'),[lines,setLines]=useState<Line[]>([]),[activity,setActivity]=useState<VoiceActivity>(silent),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const [sheet,setSheet]=useState<Sheet>(null),[busyTopics,setBusyTopics]=useState(false),[topicNote,setTopicNote]=useState(''),[draft,setDraft]=useState(''),[speed,setSpeed]=useState(.8),[showText,setShowText]=useState(true);
  const [memory,setMemory]=useState(false),[protectedMemory,setProtectedMemory]=useState(false);const policy=useRef<Policy>(freshPolicy());const memoryRef=useRef(false);
  const conn=useRef<CompanionConnection|null>(null),generation=useRef(0),dialog=useRef<HTMLDialogElement>(null),scroller=useRef<HTMLDivElement>(null),topicAbort=useRef<AbortController|null>(null),topicSeq=useRef(0),lastFetch=useRef(0);
  useEffect(()=>{const stored=readLearning(localStorage);policy.current=stored.policy;setMemory(stored.enabled);memoryRef.current=stored.enabled;setProtectedMemory(stored.protected);return()=>{generation.current++;conn.current?.dispose();topicAbort.current?.abort();};},[]);
  useEffect(()=>{if(sheet){dialog.current?.showModal();}else dialog.current?.close();},[sheet]);
  useEffect(()=>{const hidden=()=>{if(document.hidden)conn.current?.end();};const pagehide=()=>conn.current?.dispose();document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',pagehide);return()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pagehide);};},[]);
  useEffect(()=>{if(scroller.current)scroller.current.scrollTop=scroller.current.scrollHeight;},[lines,phase]);
  const begin=()=>{conn.current?.dispose();const id=++generation.current;setView('chat');setPhase('connecting');setLines([]);setActivity(silent);setError('');setNotice('');
    const current=()=>generation.current===id;const c=new CompanionConnection(seed,policy.current,{phase:p=>{if(current()){setPhase(p);if(p==='closed')setView('end');}},lines:l=>{if(current())setLines(l);},activity:a=>{if(current())setActivity(a);},notice:s=>{if(current())setNotice(s);},error:s=>{if(current())setError(friendlyError(s));},policy:p=>{if(current()){policy.current=p;if(memoryRef.current)try{writeLearning(localStorage,p);}catch{setNotice('这次的练习节奏没有保存，聊天不受影响。');}}}});
    conn.current=c;c.setPace(speed);void c.start();
  };
  const finish=()=>{setSheet(null);conn.current?.end();setLines([]);};
  const useSeed=(next:Seed)=>{setSeed(next);seen.current=[...seen.current,next.id].slice(-100);avoided.current=[...avoided.current,next.title].slice(-24);if(view==='chat'&&!['error','closed'].includes(phase))conn.current?.setTopic(next);};
  const replenish=async(wanted:Lane,selectWhenReady=false)=>{
    if(busyTopics)return;if(Date.now()-lastFetch.current<15000&&!selectWhenReady)return;
    lastFetch.current=Date.now();const seq=++topicSeq.current;topicAbort.current?.abort();const abort=topicAbort.current=new AbortController();setBusyTopics(true);setTopicNote('');
    try{const fresh=await fetchTopics(wanted,avoided.current,abort.signal);if(seq!==topicSeq.current||abort.signal.aborted)return;setPool(p=>[...p,...fresh].slice(-80));if(selectWhenReady&&fresh[0])useSeed(fresh[0]);else setTopicNote('又准备了几个新话头。下次换时见。');}
    catch(e){if(!abort.signal.aborted&&seq===topicSeq.current)setTopicNote(wanted==='news'?'暂时没找到可靠的新消息，先聊别的也好。':'新话头稍后再来，现有的话题照样能聊。');}finally{if(seq===topicSeq.current)setBusyTopics(false);}
  };
  const shuffle=()=>{const choices=pool.filter(s=>(lane==='mix'||s.lane===lane)&&s.expiresAt>Date.now());if(choices.length)useSeed(chooseSeed(choices,seen.current,lane));else{void replenish(lane,true);return;}if(choices.filter(s=>!seen.current.includes(s.id)).length<5||!choices.some(s=>s.signature))void replenish(lane);};
  const chooseLane=(next:Lane)=>{setLane(next);setSheet(null);setTopicNote('');const choices=pool.filter(s=>(next==='mix'||s.lane===next)&&s.expiresAt>Date.now());if(choices.length)useSeed(chooseSeed(choices,seen.current,next));if(next==='news'||!choices.length)void replenish(next,true);else void replenish(next);};
  const toggleMemory=()=>{if(memory){eraseLearning(localStorage);memoryRef.current=false;setMemory(false);return;}if(protectedMemory)return;try{writeLearning(localStorage,policy.current);memoryRef.current=true;setMemory(true);}catch{setNotice('这个浏览器暂时无法保存，下次也可以重新认识你的节奏。');}};
  const act=(action:'help'|'repeat'|'simpler'|'repair')=>{setSheet(null);conn.current?.action(action);};
  const micLabel=!activity.micOn?'点一下，开麦说':activity.input==='requesting'?'正在打开麦克风':activity.input==='device-muted'?'麦克风暂时不可用':'已开麦 · 再点闭麦';
  const liveState=phase==='connecting'?'正在接通声音':activity.output==='blocked'?'声音等待播放':activity.output==='playing'?'听一句，慢慢来':phase==='thinking'?'正在接你的话':activity.micOn?'我在听，你慢慢说':'先听也好，准备好再开口';
  const visible=lines.filter(l=>l.text).slice(-5);const lastId=visible.at(-1)?.id;
  return <div className="kc-root" data-companion="native-v3">
    <div className="kc-shell">
      <header className="kc-header">
        {view==='chat'?<button className="kc-icon" onClick={finish} aria-label="结束聊天"><X size={22}/></button>:<span className="kc-brand"><Sprig/><span>ひとこと</span></span>}
        {view==='chat'?<div className="kc-chat-heading"><span>日语，慢慢聊</span><button onClick={()=>setSheet('topics')}>{seed.title}<ChevronDown size={13}/></button></div>:<span className="kc-edition">日语陪聊 · 试用</span>}
        {view==='chat'&&<button className="kc-icon" aria-label="换个话题" onClick={shuffle}><Shuffle size={19}/></button>}
      </header>
      {view==='home'&&<main className="kc-home">
        <div className="kc-intro"><p className="kc-kicker">今日も、ひとこと。</p><h1>从一句，<br/>慢慢聊开。</h1><p className="kc-intro-note">不用准备好。<br/>一起找到，你想说的话。</p></div>
        <section className="kc-topic-card" aria-label="聊天话题"><div className="kc-card-top"><button className="kc-lane" onClick={()=>setSheet('topics')}>{LANES[lane].name}<ChevronDown size={13}/></button><span className="kc-topic-number">話のたね</span></div><StillLife/><div className="kc-card-copy"><h2>{seed.title}</h2><p lang="ja">{seed.opening}</p></div><div className="kc-card-bottom"><span>{seed.sources.length?'有来源的小消息':'从一个小想法开始'}</span><button onClick={shuffle} aria-label="换个话题"><Shuffle size={16}/>换一个</button></div></section>
        {topicNote&&<p className="kc-topic-note" role="status">{topicNote}</p>}
        {busyTopics&&<p className="kc-topic-note" role="status">在找新的话头，不耽误现在开聊。</p>}
        {seed.sources.length>0&&<button className="kc-source-link" onClick={()=>setSheet('sources')}>看看消息来源<ArrowRight size={13}/></button>}
        <div className="kc-start-area"><button className="kc-start" onClick={begin}><span>聊一会儿</span><ArrowRight size={21}/></button><p>先听一句，点麦克风后才收音。</p></div>
        <footer className="kc-home-footer"><a href="/">我的 NHK 文章<BookOpen size={14}/></a><button onClick={()=>setSheet('settings')}>偏好<SlidersHorizontal size={14}/></button></footer><p className="kc-disclosure">AI 语音由 OpenAI 提供 · 不保存录音</p>
      </main>}
      {view==='chat'&&<>
        <main className="kc-conversation" ref={scroller} aria-label="当前对话">
          {visible.length===0&&<div className="kc-awaiting"><span className="kc-small-sprig"><Sprig/></span><p>{phase==='connecting'?'把声音接过来…':'给你递一个话头…'}</p><span>不着急，先听一句。</span></div>}
          {showText&&visible.map((line,index)=><article key={line.id} className={`kc-line ${line.role} ${line.id===lastId?'latest':''} ${index<visible.length-2?'earlier':''}`}><span className="kc-line-label">{line.role==='assistant'?'ひとこと':'你'}</span><p lang={line.role==='assistant'?'ja':undefined}>{line.text}</p>{line.interrupted&&<small>刚才这一句已打断</small>}</article>)}
          {!showText&&visible.length>0&&<div className="kc-listen-only"><Sprig/><h2>听着聊，也很好。</h2><p>需要文字时，在「更多」里打开。</p></div>}
          {phase==='thinking'&&visible.length>0&&<p className="kc-thinking" role="status"><span/><span/><span/><em>正在接话</em></p>}
          {error&&<div className="kc-inline-error" role="alert"><p>{error}</p><button onClick={begin}>重新接上<ArrowRight size={16}/></button></div>}
        </main>
        <footer className="kc-chat-bottom">
          {notice&&<p className="kc-notice" role="status">{notice}</p>}
          {activity.output==='blocked'&&<button className="kc-unlock" onClick={()=>void conn.current?.unlock()}><Volume2 size={16}/>点一下听声音</button>}
          <div className="kc-audio-status"><span className={`kc-person-meter ${activity.micOn?'on':''}`}><small>你</small><Bars level={activity.inputLevel} active={activity.micOn}/></span><p role="status">{liveState}</p><span className="kc-person-meter"><Bars level={activity.outputLevel} active={activity.output==='playing'}/><small>对方</small></span></div>
          <div className="kc-dock"><button className="kc-dock-side" disabled={phase==='connecting'||phase==='error'} onClick={()=>act('help')}><MessageCircle size={21}/><span>接不上</span></button><button className={`kc-mic ${activity.micOn?'on':''}`} style={{'--input':activity.inputLevel} as CSSProperties} onClick={()=>void conn.current?.toggleMic()} disabled={phase==='connecting'||phase==='error'} aria-label={activity.micOn?'关闭麦克风':'开启麦克风'} aria-pressed={activity.micOn}>{activity.micOn?<Mic size={29}/>:<MicOff size={28}/>}</button><button className="kc-dock-side" onClick={()=>setSheet('settings')}><MoreHorizontal size={25}/><span>更多</span></button></div>
          <p className="kc-mic-label">{micLabel}</p>
        </footer>
      </>}
      {view==='end'&&<main className="kc-ending"><Sprig/><p className="kc-kicker">今日は、ここまで。</p><h1>说了一点，<br/>就很好。</h1><p>不用复盘，也不用交作业。<br/>下次，从想说的那一句继续。</p><button className="kc-start" onClick={()=>{setView('home');setLines([]);}}><span>回去看看</span><ArrowRight size={20}/></button><small>麦克风已关闭</small></main>}
    </div>
    <dialog className="kc-sheet" ref={dialog} onCancel={()=>setSheet(null)} onClick={e=>{if(e.target===e.currentTarget)setSheet(null);}} aria-labelledby="kc-sheet-title"><div className="kc-sheet-inner"><div className="kc-sheet-handle"/><header><h2 id="kc-sheet-title">{sheet==='topics'?'今天，想往哪儿聊？':sheet==='write'?'先用文字说也可以':sheet==='sources'?'这则消息的出处':'按你的节奏来'}</h2><button className="kc-icon" aria-label="关闭面板" onClick={()=>setSheet(null)}><X size={21}/></button></header>
      {sheet==='topics'&&<div className="kc-option-list">{(Object.keys(LANES) as Lane[]).map(value=><button key={value} onClick={()=>chooseLane(value)}><span><strong>{LANES[value].name}</strong><small>{LANES[value].note}</small></span>{lane===value?<Check size={18}/>:<ChevronRight size={17}/>}</button>)}<p className="kc-sheet-footnote">话题只是开场。聊起来之后，跟着你走。</p></div>}
      {sheet==='settings'&&<>
        {view==='chat'&&<div className="kc-quick-help"><button onClick={()=>act('repeat')}><RotateCcw size={18}/><span>再听一遍</span></button><button onClick={()=>{setSpeed(.7);conn.current?.setPace(.7);act('repeat');}}><Headphones size={18}/><span>慢一点</span></button><button onClick={()=>{conn.current?.changeDifficulty(-1);act('simpler');}}><Leaf size={18}/><span>简单一点</span></button><button onClick={()=>{conn.current?.changeDifficulty(1);setSheet(null);setNotice('接下来，轻轻多说一点。语速不变。');}}><ArrowUp size={18}/><span>多说一点</span></button></div>}
        <div className="kc-option-list">
          {view==='chat'&&<><button onClick={()=>setSheet('write')}><span><strong>用文字接一句</strong><small>中文、日语都可以</small></span><ChevronRight size={17}/></button><button onClick={()=>act('repair')}><span><strong>刚才没接上我的意思</strong><small>让对方停下来，重新听懂你</small></span><ChevronRight size={17}/></button><button onClick={()=>setShowText(v=>!v)} aria-pressed={showText}><span><strong>显示对话文字</strong></span><span className={`kc-switch ${showText?'checked':''}`}/></button></>}
          <button onClick={toggleMemory} disabled={protectedMemory} aria-pressed={memory}><span><strong>记住我的练习节奏</strong><small>仅本机保存引导进度，不保存聊天</small></span><span className={`kc-switch ${memory?'checked':''}`}/></button>
          {protectedMemory&&<button onClick={()=>{eraseLearning(localStorage);setProtectedMemory(false);}}><span><strong>清除无法读取的旧节奏记录</strong><small>只清除新陪聊记录，不影响文章和收藏</small></span><ChevronRight size={17}/></button>}
        </div><p className="kc-sheet-footnote">可以随时用中文问“什么意思”或“怎么说”。<br/>语音由 AI 生成；开启麦克风后，声音会传给 OpenAI。</p>
      </>}
      {sheet==='write'&&<form className="kc-write" onSubmit={e=>{e.preventDefault();conn.current?.sendText(draft);setDraft('');setSheet(null);}}><textarea autoFocus value={draft} onChange={e=>setDraft(e.target.value)} maxLength={700} placeholder="我想说……" aria-label="要说的话"/><button type="submit" className="kc-start" disabled={!draft.trim()}><span>递过去</span><ArrowRight size={19}/></button></form>}
      {sheet==='sources'&&<div className="kc-option-list">{seed.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span><strong>{source.title}</strong><small>检索于 {new Date(source.retrievedAt).toLocaleDateString('zh-CN')}，不是发布日期</small></span><ArrowRight size={17}/></a>)}<p className="kc-sheet-footnote">开场经过了简化。涉及具体事实，以原报道为准。</p></div>}
    </div></dialog>
  </div>;
}
