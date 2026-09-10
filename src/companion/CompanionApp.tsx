import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowRight,ArrowUp,ChevronDown,Check,Headphones,Leaf,Mic,MicOff,MoreHorizontal,RotateCcw,Shuffle,SlidersHorizontal,Volume2,X,MessageCircle,BookOpen,ChevronRight,Keyboard,Home,Briefcase,Compass,AudioLines} from 'lucide-react';
import {CompanionConnection,type Phase} from './connection';
import {NeonHero,NeonMark,NeonStage,voiceVisual} from './NeonStage';
import {chooseSeed,LOCAL_SEEDS,readLearning,writeLearning,eraseLearning,freshPolicy,type Seed,type Policy,type Lane,type Line} from './model';
import {fetchTopics,friendlyError} from './api';
import {WrittenNoteCard} from './WrittenNoteCard';
import type {WrittenNote} from './writtenFeedback';
import {noteStillApplies} from './writtenLane';
import type {VoiceActivity} from '../nhkAudioActivity';
const LANES:Record<Lane,{name:string;note:string}>={mix:{name:'随意聊聊',note:'从日常，聊到一点小想象'},interests:{name:'兴趣与想象',note:'喜欢的事，和没试过的可能'},work:{name:'工作中的一句话',note:'把真正想说的意思说顺'},curiosity:{name:'一点好奇心',note:'换个角度，想想有趣的小问题'},news:{name:'世界的新鲜事',note:'有来源的真实新闻，轻轻聊一点'}};
const silent:VoiceActivity={micOn:false,input:'off',output:'idle',inputLevel:0,outputLevel:0,meterReady:false};
type Sheet='topics'|'settings'|'write'|'sources'|null;
function Bars({level,active}:{level:number;active:boolean}){return <span className="kc-bars" aria-hidden="true">{[.4,.7,1,.65,.85,.5,.3].map((weight,i)=><i key={i} style={{height:`${2+(active?Math.min(1,level)*weight*20:0)}px`}}/>)}</span>;}
export default function CompanionApp(){
  const [seed,setSeed]=useState<Seed>(()=>chooseSeed(LOCAL_SEEDS,[]));const [lane,setLane]=useState<Lane>('mix');const [pool,setPool]=useState(LOCAL_SEEDS);const seen=useRef<string[]>([seed.id]);const avoided=useRef<string[]>([seed.title]);
  const [view,setView]=useState<'home'|'chat'|'end'>('home'),[phase,setPhase]=useState<Phase>('ready'),[lines,setLines]=useState<Line[]>([]),[activity,setActivity]=useState<VoiceActivity>(silent),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const [sheet,setSheet]=useState<Sheet>(null),[busyTopics,setBusyTopics]=useState(false),[topicNote,setTopicNote]=useState(''),[draft,setDraft]=useState(''),[speed,setSpeed]=useState(.8),[showText,setShowText]=useState(true);
  const [notes,setNotes]=useState<WrittenNote[]>([]),[expandedNote,setExpandedNote]=useState(''),[writtenEnabled,setWrittenEnabled]=useState(true),[notePending,setNotePending]=useState(false);
  const readingNote=useRef(false),followBottom=useRef(true),lastLearner=useRef('');
  const [noteError,setNoteError]=useState(''),[unreadNote,setUnreadNote]=useState('');
  const [motionOn,setMotionOn]=useState(()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [memory,setMemory]=useState(false),[protectedMemory,setProtectedMemory]=useState(false);const policy=useRef<Policy>(freshPolicy());const memoryRef=useRef(false);
  const conn=useRef<CompanionConnection|null>(null),generation=useRef(0),dialog=useRef<HTMLDialogElement>(null),scroller=useRef<HTMLDivElement>(null),topicAbort=useRef<AbortController|null>(null),topicSeq=useRef(0),lastFetch=useRef(0),topicBusy=useRef(false);
  useEffect(()=>{const stored=readLearning(localStorage);policy.current=stored.policy;setMemory(stored.enabled);memoryRef.current=stored.enabled;setProtectedMemory(stored.protected);return()=>{generation.current++;conn.current?.dispose();topicAbort.current?.abort();};},[]);
  useEffect(()=>{if(sheet){dialog.current?.showModal();}else dialog.current?.close();},[sheet]);
  useEffect(()=>{const hidden=()=>{if(document.hidden)conn.current?.end();};const pagehide=()=>conn.current?.dispose();document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',pagehide);return()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pagehide);};},[]);
  useEffect(()=>{const el=scroller.current;if(el&&followBottom.current&&!readingNote.current)el.scrollTop=el.scrollHeight;},[lines,phase,notes]);
  useEffect(()=>{conn.current?.setWrittenEnabled(writtenEnabled&&showText);},[writtenEnabled,showText]);
  const begin=()=>{conn.current?.dispose();const id=++generation.current;setView('chat');setPhase('connecting');setLines([]);setNotes([]);setExpandedNote('');setNotePending(false);setNoteError('');setUnreadNote('');lastLearner.current='';readingNote.current=false;followBottom.current=true;setActivity(silent);setError('');setNotice('');
    const current=()=>generation.current===id;const c=new CompanionConnection(seed,policy.current,{phase:p=>{if(current()){setPhase(p);if(p==='closed')setView('end');}},lines:l=>{if(current()){const latest=[...l].reverse().find(v=>v.role==='user')?.id||'';if(latest&&latest!==lastLearner.current){lastLearner.current=latest;readingNote.current=false;followBottom.current=true;}setLines(l);}},activity:a=>{if(current())setActivity(a);},notice:s=>{if(current())setNotice(s);},error:s=>{if(current())setError(friendlyError(s));},written:n=>{if(current()){setNotes(old=>[...old.filter(x=>x.anchorId!==n.anchorId),n].slice(-24));setUnreadNote(n.id);if(n.mode!=='auto')setShowText(true);if(!readingNote.current)setExpandedNote(n.id);}},writtenPending:v=>{if(current())setNotePending(v);},writtenError:s=>{if(current())setNoteError(s);},policy:p=>{if(current()){policy.current=p;if(memoryRef.current)try{writeLearning(localStorage,p);}catch{setNotice('这次的练习节奏没有保存，聊天不受影响。');}}}});
    conn.current=c;c.setPace(speed);c.setWrittenEnabled(writtenEnabled&&showText);void c.start();
  };
  const finish=()=>{setSheet(null);conn.current?.end();setLines([]);setNotes([]);setNotePending(false);setNoteError('');setUnreadNote('');};
  const useSeed=(next:Seed)=>{setNotes([]);setExpandedNote('');setNoteError('');setUnreadNote('');lastLearner.current='';readingNote.current=false;conn.current?.setReadingNote(false);setSeed(next);seen.current=[...seen.current,next.id].slice(-100);avoided.current=[...avoided.current,next.title].slice(-24);if(view==='chat'&&!['error','closed'].includes(phase))conn.current?.setTopic(next);};
  const replenish=async(wanted:Lane,selectWhenReady=false)=>{
    if(topicBusy.current)return;if(Date.now()-lastFetch.current<15000&&!selectWhenReady)return;
    topicBusy.current=true;const sessionGeneration=generation.current;lastFetch.current=Date.now();const seq=++topicSeq.current;topicAbort.current?.abort();const abort=topicAbort.current=new AbortController();setBusyTopics(true);setTopicNote('');
    try{const fresh=await fetchTopics(wanted,avoided.current,abort.signal);if(seq!==topicSeq.current||abort.signal.aborted)return;setPool(p=>[...p,...fresh].slice(-80));if(selectWhenReady&&fresh[0]&&sessionGeneration===generation.current)useSeed(fresh[0]);else setTopicNote('又准备了几个新话头。下次换时见。');}
    catch(e){if(!abort.signal.aborted&&seq===topicSeq.current)setTopicNote(e instanceof Error&&/provider_credit|provider_spend_limit|provider_usage_limit/.test(e.message)?friendlyError(e.message):wanted==='news'?'这次消息来源或内容校验没接好，原话题仍可聊。':'新话头稍后再来，现有的话题照样能聊。');}finally{if(seq===topicSeq.current){topicBusy.current=false;setBusyTopics(false);}}
  };
  const shuffle=()=>{const choices=pool.filter(s=>(lane==='mix'||s.lane===lane)&&s.expiresAt>Date.now());if(choices.length)useSeed(chooseSeed(choices,seen.current,lane));else{void replenish(lane,true);return;}if(choices.filter(s=>!seen.current.includes(s.id)).length<5||!choices.some(s=>s.signature))void replenish(lane);};
  const chooseLane=(next:Lane)=>{topicSeq.current++;topicAbort.current?.abort();topicBusy.current=false;setBusyTopics(false);setLane(next);setSheet(null);setTopicNote('');const choices=pool.filter(s=>(next==='mix'||s.lane===next)&&s.expiresAt>Date.now());if(choices.length)useSeed(chooseSeed(choices,seen.current,next));if(next==='news'||!choices.length)void replenish(next,true);else void replenish(next);};
  const toggleMemory=()=>{if(memory){eraseLearning(localStorage);memoryRef.current=false;setMemory(false);return;}if(protectedMemory)return;try{writeLearning(localStorage,policy.current);memoryRef.current=true;setMemory(true);}catch{setNotice('这个浏览器暂时无法保存，下次也可以重新认识你的节奏。');}};
  const act=(action:'help'|'repeat'|'simpler'|'repair')=>{setSheet(null);if(action==='help'){setShowText(true);readingNote.current=false;conn.current?.setReadingNote(false);conn.current?.writtenHelp();return;}conn.current?.action(action);};
  const toggleNote=(id:string)=>{setExpandedNote(expandedNote===id?'':id);readingNote.current=false;followBottom.current=false;conn.current?.setReadingNote(false);};
  const revealNote=()=>{const note=notes.find(n=>n.id===unreadNote);if(!note)return;setShowText(true);setExpandedNote(note.id);readingNote.current=false;followBottom.current=false;conn.current?.setReadingNote(false);requestAnimationFrame(()=>requestAnimationFrame(()=>{const cards=scroller.current?.querySelectorAll<HTMLElement>('[data-note-for]');Array.from(cards||[]).find(el=>el.dataset.noteFor===note.anchorId)?.scrollIntoView({block:'center',behavior:'smooth'});}));};
  const micLabel=!activity.micOn?'点一下，开麦说':activity.input==='requesting'?'正在打开麦克风':activity.input==='device-muted'?'麦克风暂时不可用':'已开麦 · 再点闭麦';
  const liveState=phase==='error'?'声音暂时没有接上':phase==='connecting'?'正在接通声音':activity.output==='blocked'?'声音等待播放':activity.output==='playing'?'听一句，慢慢来':phase==='thinking'?'正在接你的话':activity.micOn?'我在听，你慢慢说':'先听也好，准备好再开口';
  const visible=lines.filter(l=>l.text).slice(-32);const lastId=visible.at(-1)?.id;
  return <div className="kc-root" data-companion="native-v3" data-release="repair-20260911" data-ui-release="neon-20260911" data-view={view} data-motion={motionOn?'full':'reduced'} data-signal={voiceVisual(phase,activity).key}>
    <div className="kc-shell">
      <header className="kc-header">
        {view==='chat'?<button className="kc-icon" onClick={finish} aria-label="结束聊天"><X size={22}/></button>:<span className="kc-brand"><NeonMark/><span>HITOKOTO<small>AI 日本語パートナー</small></span></span>}
        {view==='chat'?<div className="kc-chat-heading"><span>日语，慢慢聊</span><button onClick={()=>setSheet('topics')}>{seed.title}<ChevronDown size={13}/></button></div>:<span className="kc-edition"><i/> NEON / 01</span>}
        {view==='chat'&&<button className="kc-icon" aria-label="换个话题" onClick={shuffle}><Shuffle size={19}/></button>}
      </header>
      {view==='home'&&<main className="kc-home">
        <NeonHero/>
        <section className="kc-topic-card" aria-label="聊天话题">
          <div className="kc-card-top"><span className="kc-topic-number">01 / 开场信号</span><button className="kc-lane" onClick={()=>setSheet('topics')}>{LANES[lane].name}<ChevronDown size={13}/></button></div>
          <div className="kc-card-copy"><h2>{seed.title}</h2><p lang="ja">{seed.opening}</p></div>
          <div className="kc-card-bottom"><span>{seed.sources.length?'有来源的真实消息':'话题只是开场，之后跟着你聊'}</span><button onClick={shuffle} aria-label="换个话题"><Shuffle size={16}/>换一个</button></div>
          {topicNote&&<p className="kc-topic-note" role="status">{topicNote}</p>}
          {busyTopics&&<p className="kc-topic-note" role="status">在找新话头，现在也能开聊。</p>}
          {seed.sources.length>0&&<button className="kc-source-link" onClick={()=>setSheet('sources')}>看看消息来源<ArrowRight size={13}/></button>}
          <div className="kc-start-area"><button className="kc-start" onClick={begin} aria-label="聊一会儿"><Mic size={20}/><span>聊一会儿<small>START TALKING</small></span><ArrowRight size={22}/></button><p>先听一句。点麦克风后，才开始收音。</p></div>
        </section>
        <section className="neon-shortcuts" aria-label="探索更多">
          <button onClick={()=>setSheet('topics')}><span className="neon-shortcut-icon"><Compass size={22}/></span><span><strong>找个话题</strong><small>日常、兴趣与一点想象</small></span><ChevronRight size={15}/></button>
          <button onClick={()=>chooseLane('work')}><span className="neon-shortcut-icon"><Briefcase size={22}/></span><span><strong>工作里的日语</strong><small>聊聊真正想说的话</small></span><ChevronRight size={15}/></button>
          <a href="/"><span className="neon-shortcut-icon"><BookOpen size={22}/></span><span><strong>我的 NHK 文章</strong><small>从熟悉的新闻继续学</small></span><ChevronRight size={15}/></a>
          <button onClick={()=>setSheet('settings')}><span className="neon-shortcut-icon"><SlidersHorizontal size={22}/></span><span><strong>聊天偏好</strong><small>提示、节奏与动态效果</small></span><ChevronRight size={15}/></button>
        </section>
        <footer className="kc-home-footer"><span className="neon-nav-active"><Home size={18}/>陪聊</span><a href="/"><BookOpen size={18}/>NHK 学习</a><button onClick={()=>setSheet('settings')}><SlidersHorizontal size={18}/>偏好</button></footer>
        <p className="kc-disclosure">AI 语音由 OpenAI 提供 · 不保存录音</p>
      </main>}
      {view==='chat'&&<>
        <NeonStage phase={phase} activity={activity} compact={showText&&visible.length>0}/>
        <main className="kc-conversation" ref={scroller} aria-label="当前对话" onScroll={e=>{const el=e.currentTarget;followBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<70;}}>
          {visible.length===0&&<div className="kc-awaiting"><span className="kc-small-sprig"><AudioLines size={28}/></span><p>{phase==='connecting'?'把声音接过来…':'给你递一个话头…'}</p><span>不着急，先听一句。</span></div>}
          {showText&&visible.map((line,index)=><article key={line.id} data-line-id={line.id} className={`kc-line ${line.role} ${line.id===lastId?'latest':''} ${index<visible.length-2?'earlier':''}`}><span className="kc-line-label">{line.role==='assistant'?'ひとこと / AI':'你 / YOU'}</span><p lang={line.role==='assistant'?'ja':undefined}>{line.text}</p>{line.interrupted&&<small>刚才这一句已打断</small>}{!line.interrupted&&notes.filter(n=>n.anchorId===line.id&&noteStillApplies(n,lines,writtenEnabled)).map(n=><WrittenNoteCard key={n.id} note={n} expanded={expandedNote===n.id} onToggle={()=>toggleNote(n.id)} onDismiss={()=>{conn.current?.dismissNote(n.anchorId);setNotes(old=>old.filter(x=>x.id!==n.id));readingNote.current=false;conn.current?.setReadingNote(false);}} onReading={value=>{readingNote.current=value;if(value)followBottom.current=false;conn.current?.setReadingNote(value);}} onSeen={()=>{conn.current?.exposeNote(n.id);setUnreadNote(old=>old===n.id?'':old);}}/>)}</article>)}
          {!showText&&visible.length>0&&<div className="kc-listen-only"><NeonMark/><h2>听着聊，也很好。</h2><p>需要文字时，点下方「打开字幕」。</p></div>}
          {phase==='thinking'&&visible.length>0&&<p className="kc-thinking" role="status"><span/><span/><span/><em>正在接话</em></p>}
          {error&&<div className="kc-inline-error" role="alert"><p>{error}</p><button onClick={begin}>重新接上<ArrowRight size={16}/></button></div>}
        </main>
        <footer className="kc-chat-bottom">
          {unreadNote&&notes.some(n=>n.id===unreadNote&&noteStillApplies(n,lines,writtenEnabled))&&<button className="kc-note-available" onClick={revealNote}>有新的文字提示 · 查看</button>}
          {noteError&&<p className="kc-note-error" role="status">{noteError}<button disabled={notePending} onClick={()=>conn.current?.retryWrittenHelp()}>重试文字提示</button></p>}
          {notePending&&<p className="kc-note-pending">在想一个你用得上的说法，聊天照常。</p>}
          {notice&&<p className="kc-notice" role="status">{notice}</p>}
          {activity.output==='blocked'&&<button className="kc-unlock" onClick={()=>void conn.current?.unlock()}><Volume2 size={16}/>点一下听声音</button>}
          <div className="kc-audio-status"><span className={`kc-person-meter ${activity.micOn?'on':''}`}><small>你</small><Bars level={activity.inputLevel} active={activity.micOn}/></span><p role="status">{liveState}</p><span className="kc-person-meter"><Bars level={activity.outputLevel} active={activity.output==='playing'}/><small>对方</small></span></div>
          <div className="kc-dock"><button className="kc-dock-side" disabled={phase==='connecting'||phase==='error'} onClick={()=>act('help')}><MessageCircle size={21}/><span>接不上</span></button><button className={`kc-mic ${activity.micOn?'on':''}`} style={{'--input':activity.inputLevel} as CSSProperties} onClick={()=>void conn.current?.toggleMic()} disabled={phase==='connecting'||phase==='error'} aria-label={activity.micOn?'关闭麦克风':'开启麦克风'} aria-pressed={activity.micOn}>{activity.micOn?<Mic size={29}/>:<MicOff size={28}/>}</button><button className="kc-dock-side" onClick={()=>setSheet('settings')}><MoreHorizontal size={25}/><span>更多</span></button></div>
          <p className="kc-mic-label">{micLabel}</p>
          <div className="neon-chat-tools"><button onClick={()=>setSheet('write')} disabled={phase==='connecting'||phase==='error'}><Keyboard size={16}/>用文字聊</button><button onClick={()=>setShowText(v=>!v)} aria-pressed={showText}><MessageCircle size={15}/>{showText?'字幕已开':'打开字幕'}</button><button onClick={()=>act('repeat')} disabled={phase==='connecting'||phase==='error'}><Volume2 size={16}/>再听一遍</button></div>
        </footer>
      </>}
      {view==='end'&&<main className="kc-ending"><div className="neon-end-art" aria-hidden="true"/><span className="neon-end-check"><Check size={27}/></span><p className="kc-kicker">SESSION COMPLETE</p><h1>多说的一句，<br/><em>都是新的可能。</em></h1><p lang="ja">おつかれさまでした。</p><p>这次就到这里。<br/>下次，从你想说的那一句继续。</p><div className="neon-closed-status"><MicOff size={15}/>麦克风已关闭 · 不保存录音</div><button className="kc-start" onClick={()=>{setView('home');setLines([]);}}><span>回去看看</span><ArrowRight size={20}/></button><a href="/" className="neon-end-link">回到我的 NHK 文章<ArrowRight size={15}/></a></main>}
    </div>
    <dialog className="kc-sheet" ref={dialog} onCancel={()=>setSheet(null)} onClick={e=>{if(e.target===e.currentTarget)setSheet(null);}} aria-labelledby="kc-sheet-title"><div className="kc-sheet-inner"><div className="kc-sheet-handle"/><header><h2 id="kc-sheet-title">{sheet==='topics'?'今天，想往哪儿聊？':sheet==='write'?'先用文字说也可以':sheet==='sources'?'这则消息的出处':'按你的节奏来'}</h2><button className="kc-icon" aria-label="关闭面板" onClick={()=>setSheet(null)}><X size={21}/></button></header>
      {sheet==='topics'&&<div className="kc-option-list neon-topic-list">{(Object.keys(LANES) as Lane[]).map(value=><button key={value} data-lane={value} onClick={()=>chooseLane(value)}><span className="neon-lane-symbol" aria-hidden="true">{({mix:'話',interests:'夢',work:'事',curiosity:'問',news:'新'})[value]}</span><span><strong>{LANES[value].name}</strong><small>{LANES[value].note}</small></span>{lane===value?<Check size={18}/>:<ChevronRight size={17}/>}</button>)}<p className="kc-sheet-footnote">话题只是开场。聊起来之后，跟着你走。</p></div>}
      {sheet==='settings'&&<>
        <div className="neon-settings-brand"><img src="/art/hitokoto-partner.webp" width="48" height="48" alt=""/><span><strong>HITOKOTO</strong><small>你的日语聊天伙伴</small></span><b>NEON / 01</b></div>
        {view==='chat'&&<div className="kc-quick-help"><button onClick={()=>act('repeat')}><RotateCcw size={18}/><span>再听一遍</span></button><button onClick={()=>{setSpeed(.7);conn.current?.setPace(.7);act('repeat');}}><Headphones size={18}/><span>慢一点</span></button><button onClick={()=>{conn.current?.changeDifficulty(-1);act('simpler');}}><Leaf size={18}/><span>简单一点</span></button><button onClick={()=>{conn.current?.changeDifficulty(1);setSheet(null);setNotice('接下来，轻轻多说一点。语速不变。');}}><ArrowUp size={18}/><span>多说一点</span></button></div>}
        <div className="kc-option-list">
          {view==='chat'&&<><button onClick={()=>setSheet('write')}><span><strong>用文字接一句</strong><small>中文、日语都可以</small></span><ChevronRight size={17}/></button><button onClick={()=>act('repair')}><span><strong>刚才没接上我的意思</strong><small>让对方停下来，重新听懂你</small></span><ChevronRight size={17}/></button><button onClick={()=>setShowText(v=>!v)} aria-pressed={showText}><span><strong>显示对话文字</strong></span><span className={`kc-switch ${showText?'checked':''}`}/></button></>}
          <button onClick={()=>setMotionOn(v=>!v)} aria-pressed={motionOn}><span><strong>霓虹动态效果</strong><small>关闭后保留颜色与真实收音状态，减少视觉干扰</small></span><span className={`kc-switch ${motionOn?'checked':''}`}/></button>
          <button className="kc-note-setting" onClick={()=>setWrittenEnabled(v=>!v)} aria-pressed={writtenEnabled}><span><strong>随句文字小提示</strong><small>修一点、接长一点，不插入语音。仅本次聊天。</small></span><span className={`kc-switch ${writtenEnabled?'checked':''}`}/></button>
          <button onClick={toggleMemory} disabled={protectedMemory} aria-pressed={memory}><span><strong>记住我的练习节奏</strong><small>仅本机保存引导进度，不保存聊天</small></span><span className={`kc-switch ${memory?'checked':''}`}/></button>
          {protectedMemory&&<button onClick={()=>{eraseLearning(localStorage);setProtectedMemory(false);}}><span><strong>清除无法读取的旧节奏记录</strong><small>只清除新陪聊记录，不影响文章和收藏</small></span><ChevronRight size={17}/></button>}
        </div><p className="kc-sheet-footnote">可以随时用中文问“什么意思”或“怎么说”，默认用文字说明；说“讲给我听”才语音讲解。提示会随对话继续更新，不需要纠正时就不打扰。版本 9.11 · NEON UI 01。<br/>语音由 AI 生成；开启麦克风后，声音会传给 OpenAI。</p>
      </>}
      {sheet==='write'&&<form className="kc-write" onSubmit={e=>{e.preventDefault();conn.current?.sendText(draft);setDraft('');setSheet(null);}}><textarea autoFocus value={draft} onChange={e=>setDraft(e.target.value)} maxLength={700} placeholder="我想说……" aria-label="要说的话"/><button type="submit" className="kc-start" disabled={!draft.trim()}><span>递过去</span><ArrowRight size={19}/></button></form>}
      {sheet==='sources'&&<div className="kc-option-list">{seed.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span><strong>{source.title}</strong><small>检索于 {new Date(source.retrievedAt).toLocaleDateString('zh-CN')}，不是发布日期</small></span><ArrowRight size={17}/></a>)}<p className="kc-sheet-footnote">开场经过了简化。涉及具体事实，以原报道为准。</p></div>}
    </div></dialog>
  </div>;
}
