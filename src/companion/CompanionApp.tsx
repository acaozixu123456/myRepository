import {CityStage} from '../city05/CityStage';
import {ScenePicker} from '../city05/ScenePicker';
import {CityMusicControl,changeCityMusicScene,updateCityMusicGate,hushCityMusic,disposeCityMusic} from '../city05/music';
import {readScene,saveScene,sceneById,type SceneId} from '../city05/scenes';
import {DesktopAtmosphere,type AtmosphereLevel} from '../immersion/DesktopAtmosphere';
import {LearningSoundControl,playLearningCue,updateLearningSoundGate,stopLearningCues} from './learningSound';
import {SelectionWorkspace,type SelectionWorkspaceRef} from '../immersion/SelectionWorkspace';
import {CustomTopicSheet,emptyBrief} from '../immersion/CustomTopicSheet';
import {AmbientStage,type Quality} from '../immersion/AmbientStage';
import {TextStudyConnection} from '../immersion/studyClient';
import {standaloneFocus} from '../immersion/selectionFocus';
import type {TopicBrief} from '../immersion/contract';
import {Image as SceneIcon,Maximize2,PenLine} from 'lucide-react';
import {TeacherStudio,ExpressionShelf,SessionTakeaway} from './TeacherStudio';
import {useExpressionLibrary} from './useExpressionLibrary';
import {expressionId,dueExpressions,type Expression} from './expressionLearning';
import {splitForListening,validSubject,type Subject} from './teacherContract';
import type {TeachingChannel} from './voicePreferences';
import {useEffect,useRef,useState,useCallback,type CSSProperties} from 'react';
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
type Sheet='topics'|'settings'|'write'|'sources'|'expressions'|'segments'|'save-consent'|'custom'|'scene'|'standalone-practice'|null;
function Bars({level,active}:{level:number;active:boolean}){return <span className="kc-bars" aria-hidden="true">{[.4,.7,1,.65,.85,.5,.3].map((weight,i)=><i key={i} style={{height:`${2+(active?Math.min(1,level)*weight*20:0)}px`}}/>)}</span>;}
export default function CompanionApp(){
  const [cityScene,setCityScene]=useState<SceneId>(()=>{try{return readScene(localStorage);}catch{return 'skyport';}});
  const chooseCity=(id:SceneId)=>{setCityScene(id);try{saveScene(localStorage,id);}catch{}changeCityMusicScene(id);};
  useEffect(()=>{changeCityMusicScene(cityScene);},[cityScene]);
  useEffect(()=>()=>disposeCityMusic(),[]);
  const [desktop,setDesktop]=useState(()=>window.matchMedia('(min-width: 1100px)').matches);
  const [atmosphere,setAtmosphere]=useState<AtmosphereLevel>('rich');
  const teacherScroll=useRef<HTMLDivElement>(null);
  useEffect(()=>{const media=window.matchMedia('(min-width: 1100px)');const update=()=>setDesktop(media.matches);media.addEventListener('change',update);return()=>{media.removeEventListener('change',update);stopLearningCues();};},[]);
  const [seed,setSeed]=useState<Seed>(()=>chooseSeed(LOCAL_SEEDS,[]));const [lane,setLane]=useState<Lane>('mix');const [pool,setPool]=useState(LOCAL_SEEDS);const seen=useRef<string[]>([seed.id]);const avoided=useRef<string[]>([seed.title]);
  const [view,setView]=useState<'home'|'chat'|'end'>('home'),[phase,setPhase]=useState<Phase>('ready'),[lines,setLines]=useState<Line[]>([]),[activity,setActivity]=useState<VoiceActivity>(silent),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const [sheet,setSheet]=useState<Sheet>(null),[busyTopics,setBusyTopics]=useState(false),[topicNote,setTopicNote]=useState(''),[draft,setDraft]=useState(''),[speed,setSpeed]=useState(1),[showText,setShowText]=useState(true);
  const [notes,setNotes]=useState<WrittenNote[]>([]),[expandedNote,setExpandedNote]=useState(''),[writtenEnabled,setWrittenEnabled]=useState(true),[notePending,setNotePending]=useState(false);
  const learning=useExpressionLibrary();const [teachingChannel,setTeachingChannel]=useState<TeachingChannel>('automatic'),[replayReady,setReplayReady]=useState(false);
  const [practice,setPractice]=useState<{key:string;subject:Subject;previousScene:string}|null>(null),[sessionIds,setSessionIds]=useState<string[]>([]),[saveCandidate,setSaveCandidate]=useState<Subject|null>(null),[confirmClear,setConfirmClear]=useState(false);
  const queuedReview=useRef<Expression|null>(null),lastPracticeTurn=useRef(0);
  const selection=useRef<SelectionWorkspaceRef>(null),selectedActive=useRef(false);
  const [studyOpen,setStudyOpen]=useState(false),[scenery,setScenery]=useState(true),[wallpaper,setWallpaper]=useState(false),[quality,setQuality]=useState<Quality>('auto'),[ambientStatus,setAmbientStatus]=useState(''),[ambientKey,setAmbientKey]=useState(0);
  const [brief,setBrief]=useState<TopicBrief>(emptyBrief),[textPractice,setTextPractice]=useState<Subject|null>(null);
  const textConnection=useRef<TextStudyConnection|null>(null);
  useEffect(()=>{const u=new URL(location.href),incoming=u.searchParams.get('topic');if(incoming){setBrief({...emptyBrief(),text:Array.from(incoming).slice(0,500).join('')});setSheet('custom');u.searchParams.delete('topic');history.replaceState({},'',u.pathname+u.search+u.hash);}},[]);
  if(!textConnection.current)textConnection.current=new TextStudyConnection(setNotice);
  useEffect(()=>()=>textConnection.current?.dispose(),[]);

  useEffect(()=>{updateCityMusicGate({micOn:activity.micOn||activity.input==='requesting',outputBusy:activity.output!=='idle',studying:studyOpen||!!practice});},[activity.micOn,activity.input,activity.output,studyOpen,practice]);
  const readingNote=useRef(false),followBottom=useRef(true),lastLearner=useRef('');
  const [noteError,setNoteError]=useState(''),[unreadNote,setUnreadNote]=useState('');
  const [motionOn,setMotionOn]=useState(()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&!(navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData);
  const [memory,setMemory]=useState(false),[protectedMemory,setProtectedMemory]=useState(false);const policy=useRef<Policy>(freshPolicy());const memoryRef=useRef(false);
  const conn=useRef<CompanionConnection|null>(null),generation=useRef(0),dialog=useRef<HTMLDialogElement>(null),scroller=useRef<HTMLDivElement>(null),topicAbort=useRef<AbortController|null>(null),topicSeq=useRef(0),lastFetch=useRef(0),topicBusy=useRef(false);
  useEffect(()=>{const stored=readLearning(localStorage);policy.current=stored.policy;setMemory(stored.enabled);memoryRef.current=stored.enabled;setProtectedMemory(stored.protected);return()=>{generation.current++;conn.current?.dispose();topicAbort.current?.abort();};},[]);
  useEffect(()=>{if(sheet){dialog.current?.showModal();}else dialog.current?.close();},[sheet]);
  useEffect(()=>{const hidden=()=>{if(document.hidden)conn.current?.end();};const pagehide=()=>conn.current?.dispose();document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',pagehide);return()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pagehide);};},[]);
  useEffect(()=>{const el=scroller.current;if(el&&followBottom.current&&!readingNote.current&&!selectedActive.current)el.scrollTop=el.scrollHeight;},[lines,phase,notes]);
  useEffect(()=>{conn.current?.setWrittenEnabled(writtenEnabled);},[writtenEnabled]);
  useEffect(()=>{conn.current?.setTeachingChannel(teachingChannel);},[teachingChannel]);
  useEffect(()=>{if(view==='chat'&&phase==='ready'&&queuedReview.current&&conn.current){const item=queuedReview.current;queuedReview.current=null;setPractice({key:crypto.randomUUID(),subject:item.subject,previousScene:item.evidence.at(-1)?.scene||''});}},[phase,view]);
  const begin=(nextSeed?:Seed,deferOpening=false)=>{stopLearningCues();conn.current?.dispose();const id=++generation.current;setView('chat');setPhase('connecting');setPractice(null);setSessionIds([]);lastPracticeTurn.current=0;setReplayReady(false);setLines([]);setNotes([]);setExpandedNote('');setNotePending(false);setNoteError('');setUnreadNote('');lastLearner.current='';readingNote.current=false;followBottom.current=true;setActivity(silent);setError('');setNotice('');
    const current=()=>generation.current===id;const c=new CompanionConnection(nextSeed||seed,policy.current,{phase:p=>{if(current()){setPhase(p);if(p==='closed'){setPractice(null);setView('end');}}},lines:l=>{if(current()){const latest=[...l].reverse().find(v=>v.role==='user')?.id||'';if(latest&&latest!==lastLearner.current){lastLearner.current=latest;readingNote.current=false;followBottom.current=true;}setLines(l);}},activity:a=>{if(current()){updateCityMusicGate({micOn:a.micOn||a.input==='requesting',outputBusy:a.output!=='idle'});updateLearningSoundGate({micOn:a.micOn||a.input==='requesting',outputBusy:a.output!=='idle'});setActivity(a);}},notice:s=>{if(current())setNotice(s);},error:s=>{if(current())setError(friendlyError(s));},written:n=>{if(current()){setNotes(old=>[...old.filter(x=>x.anchorId!==n.anchorId),n].slice(-24));setUnreadNote(n.id);if(!readingNote.current)setExpandedNote(n.id);}},replay:ready=>{if(current())setReplayReady(ready);},writtenPending:v=>{if(current())setNotePending(v);},writtenError:s=>{if(current())setNoteError(s);},policy:p=>{if(current()){policy.current=p;if(memoryRef.current)try{writeLearning(localStorage,p);}catch{setNotice('这次的练习节奏没有保存，聊天不受影响。');}}}});
    conn.current=c;c.setPace(speed);c.setWrittenEnabled(writtenEnabled);c.setTeachingChannel(teachingChannel);void c.start(deferOpening||!!queuedReview.current);
  };
  const finish=()=>{stopLearningCues();setPractice(null);setSheet(null);conn.current?.end();setLines([]);setNotes([]);setNotePending(false);setNoteError('');setUnreadNote('');};
  const useSeed=(next:Seed)=>{if(practice){conn.current?.setPracticeMode(false);setPractice(null);}setNotes([]);setExpandedNote('');setNoteError('');setUnreadNote('');lastLearner.current='';readingNote.current=false;conn.current?.setReadingNote(false);setSeed(next);seen.current=[...seen.current,next.id].slice(-100);avoided.current=[...avoided.current,next.title].slice(-24);if(view==='chat'&&!['error','closed'].includes(phase))conn.current?.setTopic(next);};
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
  const revealNote=()=>{const valid=notes.filter(n=>noteStillApplies(n,lines,writtenEnabled));const note=valid.find(n=>n.id===unreadNote)||valid.at(-1);if(!note)return;if(!desktop)setScenery(false);setShowText(true);setExpandedNote(note.id);readingNote.current=false;followBottom.current=false;conn.current?.setReadingNote(false);requestAnimationFrame(()=>requestAnimationFrame(()=>{const host=desktop?teacherScroll.current:scroller.current;Array.from(host?.querySelectorAll<HTMLElement>('[data-note-for]')||[]).find(el=>el.dataset.noteFor===note.anchorId)?.scrollIntoView({block:'nearest',behavior:'smooth'});}));};
  const closePractice=()=>{conn.current?.setPracticeMode(false);setPractice(null);lastPracticeTurn.current=lines.filter(l=>l.role==='user').length;setNotice('练习结束，想继续说时再开麦；也可以换个话题。');};
  const startPractice=(subject:Subject,previousScene='')=>{setNotice('');setScenery(false);if(view!=='chat'||!conn.current||['closed','error','connecting'].includes(phase)){setTextPractice(subject);setSheet('standalone-practice');return;}setSheet(null);setPractice({key:crypto.randomUUID(),subject,previousScene});followBottom.current=true;};
  const reviewExpression=(item:Expression)=>{setSheet(null);if(view==='chat'&&!['error','closed','connecting'].includes(phase))startPractice(item.subject,item.evidence.at(-1)?.scene||'');else{queuedReview.current=item;begin();}};
  const bookmark=(subject:Subject)=>{if(!learning.library.enabled){setSaveCandidate(subject);setSheet('save-consent');}else{if(learning.remember(subject,subject.phrase,true)){setNotice('已加入本机表达本。');playLearningCue('saved');}}};
  const noteSubject=(n:WrittenNote)=>validSubject({phrase:n.suggestion,meaningZh:n.reasonZh,kind:n.kind});
  const noteCard=(n:WrittenNote)=><WrittenNoteCard key={n.id} note={n} showSource={desktop} expanded={expandedNote===n.id} onToggle={()=>toggleNote(n.id)} onDismiss={()=>{conn.current?.dismissNote(n.anchorId);setNotes(old=>old.filter(x=>x.id!==n.id));readingNote.current=false;conn.current?.setReadingNote(false);}} onReading={value=>{readingNote.current=value;if(value)followBottom.current=false;conn.current?.setReadingNote(value);}} onSeen={()=>{conn.current?.exposeNote(n.id);setUnreadNote(old=>old===n.id?'':old);}} onSupport={text=>conn.current?.useSupport(text)} onPractice={noteSubject(n)?()=>startPractice(noteSubject(n)!):undefined} onSave={noteSubject(n)?()=>bookmark(noteSubject(n)!):undefined} onSpeak={noteSubject(n)?()=>void conn.current?.demonstrate(n.suggestion):undefined}/>;
  const cancelRandom=()=>{topicSeq.current++;topicAbort.current?.abort();topicBusy.current=false;setBusyTopics(false);};
  const prepareCustom=()=>{cancelRandom();setSheet('custom');};
  const themeFromSelection=(text:string)=>{cancelRandom();setBrief({...emptyBrief(),text:Array.from(text).slice(0,500).join('')});setSheet('custom');};
  const selecting=useCallback((active:boolean)=>{selectedActive.current=active;if(active)followBottom.current=false;},[]);
  const acquireStudy=async()=>{cancelRandom();textConnection.current?.stop();if(view==='chat')await conn.current?.pauseForStudy();};
  const releaseStudy=()=>{selectedActive.current=false;readingNote.current=false;conn.current?.setReadingNote(false);if(view==='chat')conn.current?.resumeAfterStudy();};
  const customReady=(next:Seed,subject:Subject,mode:TopicBrief['entryMode'])=>{
    cancelRandom();setSheet(null);setSeed(next);setNotes([]);setNoteError('');setUnreadNote('');setExpandedNote('');
    if(view==='chat'&&conn.current&&!['error','closed'].includes(phase)){conn.current.setTopic(next,mode!=='chat');setPractice(null);}
    else if(mode==='chat')begin(next);
    if(mode==='practice')startPractice(subject);
    if(mode==='explain'){const focus=standaloneFocus(subject.phrase);if(focus)selection.current?.open(focus);}
  };
  const practiceFinished=()=>{setTextPractice(null);setSheet(null);textConnection.current?.stop();};
  const eligibleNotes=notes.filter(n=>noteStillApplies(n,lines,writtenEnabled));
  const due=dueExpressions(learning.library.items);const later=learning.library.items.find(i=>sessionIds.includes(i.id)&&i.evidence.some(e=>e.kind==='supported'||e.kind==='imitated'));
  const micLabel=!activity.micOn?'点一下，开麦说':activity.input==='requesting'?'正在打开麦克风':activity.input==='device-muted'?'麦克风暂时不可用':'已开麦 · 再点闭麦';
  const liveState=phase==='error'?'声音暂时没有接上':phase==='connecting'?'正在接通声音':activity.output==='blocked'?'声音等待播放':activity.output==='playing'?'听一句，慢慢来':phase==='thinking'?'正在接你的话':activity.micOn?'我在听，你慢慢说':'先听也好，准备好再开口';
  const visible=lines.filter(l=>l.text).slice(-32);const lastId=visible.at(-1)?.id;
  return <div className={`kc-root ${wallpaper?'imm-wallpaper':''}`} data-companion="native-v3" data-release="repair-20260911" data-ui-release="neon-20260911" data-entry-release="entry-20260911" data-teacher-release="teacher-20260911-v2" data-immersion-release="immersion-20260911-v3" data-desktop-release="desktop-20260911-v4" data-city-release="city-20260911-v5" data-city-choice={cityScene} data-desktop-focus={desktop} data-practice={!!practice} data-scenery={scenery&&!practice} data-view={view} data-motion={motionOn?'full':'reduced'} data-signal={voiceVisual(phase,activity).key}>
    <AmbientStage key={ambientKey} quality={quality} motion={cityScene==='classic'&&motionOn} paused={studyOpen||!!sheet} onStatus={setAmbientStatus}/>
    {cityScene!=='classic'&&<CityStage key={'city-'+ambientKey} scene={cityScene} quality={quality} motion={motionOn} paused={studyOpen||(!!sheet&&sheet!=='scene')} onStatus={setAmbientStatus}/> }
    {desktop&&<DesktopAtmosphere level={atmosphere} enabled={motionOn&&!studyOpen&&!practice&&(!sheet||sheet==='scene')}/> }
    {wallpaper&&<button className="imm-return" onClick={()=>{setWallpaper(false);conn.current?.resumeAfterStudy();}}>← 返回陪练 · 麦克风已暂停</button>}
    <div className="kc-shell">
      <header className="kc-header">
        {view==='chat'?<button className="kc-icon" onClick={finish} aria-label="结束聊天"><X size={22}/></button>:<span className="kc-brand"><NeonMark/><span>HITOKOTO<small>AI 日本語パートナー</small></span></span>}
        {view==='chat'?<div className="kc-chat-heading"><span>日语，慢慢聊</span><button onClick={()=>setSheet('topics')}>{seed.title}<ChevronDown size={13}/></button></div>:<span className="imm-edition">{'CITY / 05'}</span>}
        {view!=='chat'&&<button className="imm-header-scene" onClick={()=>setSheet('scene')}><SceneIcon size={15}/>风景</button>}
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
          <div className="kc-start-area"><button className="kc-start" onClick={()=>begin()} aria-label="聊一会儿"><Mic size={20}/><span>聊一会儿<small>ENTER THE CONVERSATION</small></span><ArrowRight size={22}/></button><button className="imm-custom-entry" onClick={prepareCustom}><PenLine size={16}/>我来定主题</button><p>先听一句。点麦克风后，才开始收音。</p></div>
        </section>
        <section className="neon-shortcuts" aria-label="探索更多">
          <button onClick={()=>setSheet('topics')}><span className="neon-shortcut-icon"><Compass size={22}/></span><span><strong>找个话题</strong><small>日常、兴趣与一点想象</small></span><ChevronRight size={15}/></button>
          <button onClick={()=>chooseLane('work')}><span className="neon-shortcut-icon"><Briefcase size={22}/></span><span><strong>工作里的日语</strong><small>聊聊真正想说的话</small></span><ChevronRight size={15}/></button>
          <a href="/?view=nhk"><span className="neon-shortcut-icon"><BookOpen size={22}/></span><span><strong>我的 NHK 文章</strong><small>从熟悉的新闻继续学</small></span><ChevronRight size={15}/></a>
          <button onClick={()=>setSheet('settings')}><span className="neon-shortcut-icon"><SlidersHorizontal size={22}/></span><span><strong>聊天偏好</strong><small>提示、节奏与动态效果</small></span><ChevronRight size={15}/></button>
        </section>
        <button className="teacher-home-entry" onClick={()=>setSheet('expressions')}><BookOpen size={19}/><span>我的表达<small>{due.length?`${due.length} 个表达可以复习`:'只练一句，也能慢慢积累'}</small></span><ChevronRight size={16}/></button>
        <footer className="kc-home-footer"><span className="neon-nav-active"><Home size={18}/>陪聊</span><a href="/?view=nhk"><BookOpen size={18}/>NHK 学习</a><button onClick={()=>setSheet('settings')}><SlidersHorizontal size={18}/>偏好</button></footer>
        <p className="kc-disclosure">AI 语音由 OpenAI 提供 · 不保存录音</p>
      </main>}
      {view==='chat'&&<>
        <div className="imm-view-toggle"><button aria-pressed={scenery} onClick={()=>setScenery(true)}>风景陪练</button><button aria-pressed={!scenery} onClick={()=>setScenery(false)}>对话与历史</button><button onClick={()=>setSheet('scene')}><SceneIcon size={12}/> 风景</button><CityMusicControl compact/></div>
        {scenery&&!practice&&<div className="imm-scene-caption">{cityScene==='classic'?'RAIN / MIDNIGHT':sceneById(cityScene).subtitle}<small>此刻，只说你想说的一句。</small></div>}
        <NeonStage phase={phase} activity={activity} compact={(showText&&visible.length>0)||!!practice}/>
        <main className="kc-conversation" ref={scroller} aria-label="当前对话" onScroll={e=>{const el=e.currentTarget;followBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<70;}}>
          {visible.length===0&&<div className="kc-awaiting"><span className="kc-small-sprig"><AudioLines size={28}/></span><p>{phase==='connecting'?'把声音接过来…':'给你递一个话头…'}</p><span>不着急，先听一句。</span></div>}
          {(scenery&&!practice?visible.slice(-1):visible).filter(line=>showText||line.textOnly).map((line,index)=><article key={line.id} data-line-id={line.id} className={`kc-line ${line.role} ${line.id===lastId?'latest':''} ${index<visible.length-2?'earlier':''}`}><span className="kc-line-label">{line.role==='assistant'?'ひとこと / AI':line.exercise?'你 / 练习':'你 / YOU'}</span><p lang="ja" data-study-source={line.role} data-study-id={line.id}>{line.text}</p>{line.interrupted&&<small>刚才这一句已打断</small>}{line.role==='assistant'&&line.delivered&&!line.interrupted&&<button className="teacher-explain-line" disabled={!!practice} onClick={()=>conn.current?.sendText(`请用中文解释这句日语的意思和一个关键用法：「${line.text.slice(0,420)}」`)}>解释这句</button>}{!desktop&&!line.interrupted&&eligibleNotes.filter(n=>n.anchorId===line.id).map(noteCard)}</article>)}
          {!showText&&visible.length>0&&!practice&&<div className="kc-listen-only"><NeonMark/><h2>听着聊，也很好。</h2><p>需要文字时，点下方「打开字幕」。</p></div>}
          {!desktop&&!showText&&!practice&&<div className="teacher-captionless-notes">{eligibleNotes.slice(-3).map(noteCard)}</div>}
          {practice&&conn.current&&<TeacherStudio key={practice.key} connection={conn.current} subject={practice.subject} previousScene={practice.previousScene} lines={lines} onClose={closePractice} onLesson={lesson=>{learning.remember(lesson.subject,lesson.focus);setSessionIds(ids=>[...new Set([...ids,expressionId(lesson.subject)])]);}} onResult={(lesson,result,answer,support,source,id,seen)=>{learning.record(lesson,result,answer,support,source,id,seen);setSessionIds(ids=>[...new Set([...ids,expressionId(lesson.subject)])]);}} onSave={()=>bookmark(practice.subject)}/>}
          {!practice&&later&&lines.filter(l=>l.role==='user').length-lastPracticeTurn.current>=3&&<button className="teacher-revisit" onClick={()=>reviewExpression(later)}>刚才的表达，换个情境再试一次<ChevronRight size={15}/></button>}
          {learning.storageError&&<p className="teacher-error" role="status">{learning.storageError}</p>}
          {phase==='thinking'&&visible.length>0&&<p className="kc-thinking" role="status"><span/><span/><span/><em>正在接话</em></p>}
          {error&&<div className="kc-inline-error" role="alert"><p>{error}</p><button onClick={()=>begin()}>重新接上<ArrowRight size={16}/></button></div>}
        </main>
        {desktop&&<aside className="df-teacher" aria-label="常驻文字教师">
          <header className="df-teacher-heading"><div><span>TEACHER / LIVE NOTES</span><h2>随聊笔记</h2></div><BookOpen size={20}/></header>
          <div className={`df-teacher-scroll ${!showText?'teacher-captionless-notes':''}`} ref={teacherScroll}>
            {notePending&&<p className="df-teacher-status" role="status">正在整理这一句…</p>}
            {noteError&&<p className="df-teacher-error" role="status">{noteError}<button disabled={notePending} onClick={()=>conn.current?.retryWrittenHelp()}>重试文字提示</button></p>}
            {eligibleNotes.length>1&&<details className="df-earlier-notes"><summary>较早的提示 · {eligibleNotes.length-1}</summary>{eligibleNotes.slice(0,-1).reverse().map(noteCard)}</details>}
            {eligibleNotes.length?<div className="df-current-note">{noteCard(eligibleNotes.at(-1)!)}</div>:<div className="df-teacher-empty"><span>一次，只看一个重点</span><p>{writtenEnabled?'有值得留意的表达，会直接出现在这里。':'自动提示已关闭；仍可主动问词义或点「接不上」。'}</p><p>也可以选中一句日语，点「学这段」。</p></div>}
          </div>
          <footer className="df-teacher-foot"><LearningSoundControl compact/><button disabled={phase==='connecting'||phase==='error'||!!practice} onClick={()=>act('help')}>帮我接一句</button></footer>
        </aside>}
        <footer className="kc-chat-bottom">
          {!desktop&&unreadNote&&notes.some(n=>n.id===unreadNote&&noteStillApplies(n,lines,writtenEnabled))&&<button className="kc-note-available" onClick={revealNote}>有新的文字提示 · 查看</button>}
          {!desktop&&noteError&&<p className="kc-note-error" role="status">{noteError}<button disabled={notePending} onClick={()=>conn.current?.retryWrittenHelp()}>重试文字提示</button></p>}
          {!desktop&&notePending&&<p className="kc-note-pending">在想一个你用得上的说法，聊天照常。</p>}
          {notice&&<p className="kc-notice" role="status">{notice}</p>}
          {activity.output==='blocked'&&<button className="kc-unlock" onClick={()=>void conn.current?.unlock()}><Volume2 size={16}/>点一下听声音</button>}
          <div className="kc-audio-status"><span className={`kc-person-meter ${activity.micOn?'on':''}`}><small>你</small><Bars level={activity.inputLevel} active={activity.micOn}/></span><p role="status">{liveState}</p><span className="kc-person-meter"><Bars level={activity.outputLevel} active={activity.output==='playing'}/><small>对方</small></span></div>
          <div className="kc-dock"><button className="kc-dock-side" disabled={phase==='connecting'||phase==='error'} onClick={()=>practice?setNotice('练习里可点「给个词」「给个开头」或「完整示范」。'):act('help')}><MessageCircle size={21}/><span>接不上</span></button><button className={`kc-mic ${activity.micOn?'on':''}`} style={{'--input':activity.inputLevel} as CSSProperties} onClick={()=>{hushCityMusic();stopLearningCues();void conn.current?.toggleMic();}} disabled={phase==='connecting'||phase==='error'} aria-label={activity.micOn?'关闭麦克风':'开启麦克风'} aria-pressed={activity.micOn}>{activity.micOn?<Mic size={29}/>:<MicOff size={28}/>}</button><button className="kc-dock-side" onClick={()=>setSheet('settings')}><MoreHorizontal size={25}/><span>更多</span></button></div>
          <p className="kc-mic-label">{micLabel}<span className="teacher-pace-label"> · {speed===1?'自然语速':'从容停顿'}{practice?' · 练习中':''}</span></p>
          <div className="neon-chat-tools"><button onClick={()=>setSheet('write')} disabled={phase==='connecting'||phase==='error'}><Keyboard size={16}/>用文字聊</button><button onClick={()=>setShowText(v=>!v)} aria-pressed={showText}><MessageCircle size={15}/>{showText?'字幕已开':'打开字幕'}</button><button onClick={()=>void conn.current?.replayOriginal()} disabled={phase==='connecting'||phase==='error'} title={replayReady?'重播本次 AI 原音':'原音不可用时可用分句示范'}><Volume2 size={16}/>重播原音</button></div>
        </footer>
      </>}
      {view==='end'&&<main className="kc-ending"><div className="neon-end-art" aria-hidden="true"/><span className="neon-end-check"><Check size={27}/></span><p className="kc-kicker">SESSION COMPLETE</p><h1>多说的一句，<br/><em>都是新的可能。</em></h1><p lang="ja">おつかれさまでした。</p><p>这次就到这里。<br/>下次，从你想说的那一句继续。</p><SessionTakeaway items={learning.library.items} sessionIds={sessionIds} onReview={()=>setSheet('expressions')}/><div className="neon-closed-status"><MicOff size={15}/>麦克风已关闭 · 不保存录音</div><button className="kc-start" onClick={()=>{setView('home');setLines([]);}}><span>回去看看</span><ArrowRight size={20}/></button><a href="/?view=nhk" className="neon-end-link">回到我的 NHK 文章<ArrowRight size={15}/></a></main>}
    </div>
    <dialog className="kc-sheet" ref={dialog} onCancel={()=>setSheet(null)} onClick={e=>{if(e.target===e.currentTarget)setSheet(null);}} aria-labelledby="kc-sheet-title"><div className="kc-sheet-inner"><div className="kc-sheet-handle"/><header><h2 id="kc-sheet-title">{sheet==='topics'?'今天，想往哪儿聊？':sheet==='write'?'先用文字说也可以':sheet==='sources'?'这则消息的出处':sheet==='expressions'?'我的表达':sheet==='segments'?'分句听 · 重新示范':sheet==='save-consent'?'保存到本机？':sheet==='custom'?'我来定主题':sheet==='scene'?'城市与背景音乐':sheet==='standalone-practice'?'先练一句 · 文字练习':'按你的节奏来'}</h2><button className="kc-icon" aria-label="关闭面板" onClick={()=>setSheet(null)}><X size={21}/></button></header>
      {sheet==='topics'&&<button className="imm-custom-entry" onClick={prepareCustom}><PenLine size={16}/>我来定主题</button>}
      {sheet==='topics'&&<div className="kc-option-list neon-topic-list">{(Object.keys(LANES) as Lane[]).map(value=><button key={value} data-lane={value} onClick={()=>chooseLane(value)}><span className="neon-lane-symbol" aria-hidden="true">{({mix:'話',interests:'夢',work:'事',curiosity:'問',news:'新'})[value]}</span><span><strong>{LANES[value].name}</strong><small>{LANES[value].note}</small></span>{lane===value?<Check size={18}/>:<ChevronRight size={17}/>}</button>)}<p className="kc-sheet-footnote">话题只是开场。聊起来之后，跟着你走。</p></div>}
      {sheet==='settings'&&<>
        <div className="neon-settings-brand"><img src="/art/hitokoto-partner.webp" width="48" height="48" alt=""/><span><strong>HITOKOTO</strong><small>你的日语聊天伙伴</small></span><b>CITY / 05</b></div>
        {view==='chat'&&<div className="kc-quick-help"><button onClick={()=>{setSheet(null);void conn.current?.replayOriginal();}}><RotateCcw size={18}/><span>重播原音</span></button><button onClick={()=>setSheet('segments')}><Headphones size={18}/><span>分句听</span></button><button onClick={()=>{conn.current?.changeDifficulty(-1);act('simpler');}}><Leaf size={18}/><span>简单一点</span></button><button onClick={()=>{conn.current?.changeDifficulty(1);setSheet(null);setNotice('接下来，轻轻多说一点。语速不变。');}}><ArrowUp size={18}/><span>多说一点</span></button></div>}
        <LearningSoundControl/><CityMusicControl/><section className="teacher-preferences"><h3>声音节奏</h3><div className="teacher-hints"><button aria-pressed={speed===1} onClick={()=>{setSpeed(1);conn.current?.setPace(1);}}>自然 · 恢复默认</button><button aria-pressed={speed!==1} onClick={()=>{setSpeed(.9);conn.current?.setPace(.9);}}>从容 · 自然停顿</button></div><p>不再把整段音频拉成 0.8 或 0.7 倍。两档都保留正常音高与字音时长。</p><h3>主动提问时</h3><div className="teacher-hints"><button aria-pressed={teachingChannel==='automatic'} onClick={()=>setTeachingChannel('automatic')}>语音问就讲给我听</button><button aria-pressed={teachingChannel==='text'} onClick={()=>setTeachingChannel('text')}>讲解只显示文字</button></div><p>文字提问以文字答；字幕开关不再关闭文字教师。</p></section>
        <div className="kc-option-list">
          {view==='chat'&&<><button onClick={()=>setSheet('write')}><span><strong>用文字接一句</strong><small>中文、日语都可以</small></span><ChevronRight size={17}/></button><button onClick={()=>act('repair')}><span><strong>刚才没接上我的意思</strong><small>让对方停下来，重新听懂你</small></span><ChevronRight size={17}/></button><button onClick={()=>setShowText(v=>!v)} aria-pressed={showText}><span><strong>显示对话文字</strong></span><span className={`kc-switch ${showText?'checked':''}`}/></button></>}
          <button onClick={()=>setMotionOn(v=>!v)} aria-pressed={motionOn}><span><strong>霓虹动态效果</strong><small>关闭后保留颜色与真实收音状态，减少视觉干扰</small></span><span className={`kc-switch ${motionOn?'checked':''}`}/></button>
          <button className="kc-note-setting" onClick={()=>setWrittenEnabled(v=>!v)} aria-pressed={writtenEnabled}><span><strong>随句文字小提示</strong><small>明确错误才修正；可选拓展单独标明。与字幕独立。</small></span><span className={`kc-switch ${writtenEnabled?'checked':''}`}/></button>
          <button onClick={()=>setSheet('expressions')}><span><strong>表达本与复习</strong><small>{learning.library.enabled?'已开启本机保存':'未开启保存 · 仅本次打开'}</small></span><ChevronRight size={17}/></button>
          {learning.library.enabled&&<button onClick={()=>learning.enable(false)}><span><strong>停止自动保存表达</strong><small>保留已有记录，后续练习仅留本次</small></span></button>}
          <button onClick={()=>setConfirmClear(v=>!v)}><span><strong>清除表达记录</strong><small>只清除表达本，不影响 NHK 文章和收藏</small></span></button>
          {confirmClear&&<button onClick={()=>{learning.clear();setConfirmClear(false);setSessionIds([]);}}><span><strong>确认清除表达本</strong><small>此操作不可撤销；可先在表达本里导出。</small></span></button>}
          <button onClick={toggleMemory} disabled={protectedMemory} aria-pressed={memory}><span><strong>记住我的练习节奏</strong><small>仅本机保存引导进度，不保存聊天</small></span><span className={`kc-switch ${memory?'checked':''}`}/></button>
          {protectedMemory&&<button onClick={()=>{eraseLearning(localStorage);setProtectedMemory(false);}}><span><strong>清除无法读取的旧节奏记录</strong><small>只清除新陪聊记录，不影响文章和收藏</small></span><ChevronRight size={17}/></button>}
        </div><p className="kc-sheet-footnote">可以随时问词义、语法和怎么说，不再要求特殊口令。短练习可随时跳过。版本 9.11 · DESKTOP 04 / IMMERSION 03 / TEACHER 02。实时语音：gpt-realtime-2.1 / marin；文字教师：gpt-5.4-mini。AI 原音仅在当前会话内存中用于重播，结束即释放，不录制你的声音。<br/>语音由 AI 生成；开启麦克风后，声音会传给 OpenAI。</p>
      </>}
      {sheet==='custom'&&<CustomTopicSheet brief={brief} onChange={setBrief} onPrepared={customReady} onCancelPreparation={cancelRandom}/>}
      {sheet==='scene'&&<section className="imm-scene-settings"><ScenePicker value={cityScene} onChange={chooseCity}/><CityMusicControl/>{desktop&&<fieldset className="df-atmosphere-controls"><legend>桌面环境动态</legend><div>{([['off','关闭'],['gentle','舒缓'],['rich','增强']] as const).map(([value,label])=><button key={value} aria-pressed={atmosphere===value} disabled={!motionOn} onClick={()=>setAtmosphere(value)}>{label}</button>)}</div><small>更明显的景深雨幕、玻璃雨滴与雾流。声音独立；练习时暂停前景特效。</small></fieldset>}<div className="imm-quality">{([['auto','自动 · 推荐'],['1080','流畅 · 1080'],['1440','高画质 · 1440'],['2160','超清 · 2160']] as const).map(([q,label])=><button key={q} aria-pressed={quality===q} onClick={()=>setQuality(q)}>{label}</button>)}</div><p className="imm-status">{ambientStatus||'画面就绪后开始播放；优先保持聊天流畅。'}</p><button className="imm-custom-entry" onClick={()=>setMotionOn(v=>!v)}>{motionOn?'减少动态，保留高清静帧':'启用动态风景与粒子'}</button><button className="imm-custom-entry" onClick={()=>{setAmbientStatus('');setAmbientKey(v=>v+1);}}>重新加载风景</button><button className="imm-primary" onClick={()=>{void conn.current?.pauseForStudy();setWallpaper(true);setSheet(null);}}><Maximize2 size={18}/>看全景 · 暂停麦克风</button><p><small>四套新风景：原画裁切＋独立载具、屏幕和粒子实时动态，不是完整3D场景。原来的雨夜保留4K静音循环。渲染精度不是底图的原生分辨率。</small></p></section>}
      {sheet==='standalone-practice'&&textPractice&&textConnection.current&&<><p className="imm-small-note">本页是文字练习，不会偷偷建立语音通话或打开麦克风。想开口时，可回到陪聊。</p><TeacherStudio key={textPractice.phrase} connection={textConnection.current} subject={textPractice} lines={[]} onClose={practiceFinished} onLesson={lesson=>learning.remember(lesson.subject,lesson.focus)} onResult={(lesson,result,answer,support,source,id,seen)=>learning.record(lesson,result,answer,support,source,id,seen)} onSave={()=>bookmark(textPractice)}/></>}
      {sheet==='write'&&<form className="kc-write" onSubmit={e=>{e.preventDefault();conn.current?.sendText(draft);setDraft('');setSheet(null);}}><textarea autoFocus value={draft} onChange={e=>setDraft(e.target.value)} maxLength={700} placeholder="我想说……" aria-label="要说的话"/><button type="submit" className="kc-start" disabled={!draft.trim()}><span>递过去</span><ArrowRight size={19}/></button></form>}
      {sheet==='expressions'&&<><ExpressionShelf items={learning.library.items} enabled={learning.library.enabled} onPractice={reviewExpression} onRemove={learning.remove} onEnable={()=>{setSaveCandidate(null);setSheet('save-consent');}} onExport={learning.exportData}/>{learning.protectedData&&<p className="teacher-error">旧表达记录暂时只读，不会覆盖。可先导出，再在偏好中清除。</p>}{learning.storageError&&<p className="teacher-error">{learning.storageError}</p>}</>}
      {sheet==='save-consent'&&<section className="teacher-consent"><p>仅保存选中的表达、短中文解释、练习阶段和复习日期。只在本机，不上传整段聊天或录音。</p><button className="teacher-primary" disabled={learning.protectedData} onClick={()=>{if(learning.enable(true)){if(saveCandidate)learning.remember(saveCandidate,saveCandidate.phrase,true);setSaveCandidate(null);setSheet('expressions');}}}>开启本机保存</button><button className="teacher-skip" onClick={()=>{if(saveCandidate)learning.remember(saveCandidate,saveCandidate.phrase,true);setSaveCandidate(null);setSheet('expressions');}}>这次先不保存</button>{learning.storageError&&<p role="status">{learning.storageError}</p>}</section>}
      {sheet==='segments'&&<section className="teacher-segments"><p>选择一句重新示范，不会改变整场聊天语速。它不是刚才的原音；原音请用「重播原音」。</p>{splitForListening([...lines].reverse().find(l=>l.role==='assistant'&&l.delivered&&!l.interrupted)?.text||seed.opening).map((text,i)=><button key={i} onClick={()=>void conn.current?.demonstrate(text)}><Volume2 size={17}/><span lang="ja">{text}</span></button>)}</section>}
      {sheet==='sources'&&<div className="kc-option-list">{seed.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span><strong>{source.title}</strong><small>检索于 {new Date(source.retrievedAt).toLocaleDateString('zh-CN')}，不是发布日期</small></span><ArrowRight size={17}/></a>)}<p className="kc-sheet-footnote">开场经过了简化。涉及具体事实，以原报道为准。</p></div>}
    </div></dialog>
    <SelectionWorkspace ref={selection} onPractice={startPractice} onSave={bookmark} onTheme={themeFromSelection} acquire={acquireStudy} release={releaseStudy} onSelecting={selecting} onOpenChange={setStudyOpen}/>
  </div>;
}
