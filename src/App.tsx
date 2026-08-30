import {useEffect,useMemo,useRef,useState} from 'react';
import {Bookmark,ChevronLeft,ChevronRight,Compass,Heart,Map,RotateCcw,Sparkles,User,Zap} from 'lucide-react';
import {api} from './api';
import {categories,stories as bundledStories,Story} from './content';
import PracticeLane,{type Weakness} from './PracticeLane';
import ReviewLane from './ReviewLane';
import {PlayClipId} from './playPlan';
import {playSfx} from './sfx';

type Tab='play'|'review'|'collection'|'atlas'|'profile';
type OpenMode='play'|'review';
type RecallResult='good'|'close'|'miss';
type MemoryRecord={strength:number;nextReviewAt:number;lastSeen:number;weaknesses?:Partial<Record<Weakness,number>>;lastResult?:RecallResult};
type MemoryMap=Record<string,MemoryRecord>;
type ClipState='ready'|'pending'|'failed';
type SeriesMeta={worldId?:string;worldTitle?:string;seasonId?:string;seasonTitle?:string;episodeNo?:number;previousEpisodeId?:string|null;nextEpisodeId?:string|null;prevSummary?:string;currentHook?:string;durableSummary?:string};
type SeriesStory=Story&{series?:SeriesMeta};

const SILENT_WAV='data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
const DAY=24*60*60*1000;
const GOOD_DELAYS=[0,DAY,3*DAY,7*DAY,14*DAY,30*DAY];
const seriesOf=(story:Story|null|undefined)=>(story as SeriesStory|undefined)?.series;

function App(){
  const[tab,setTab]=useState<Tab>('play');
  const[openMode,setOpenMode]=useState<OpenMode>('play');
  const[selectedId,setSelectedId]=useState<string|null>(null);
  const[clipStatus,setClipStatus]=useState<Partial<Record<PlayClipId,ClipState>>>({});
  const[sfxEnabled,setSfxEnabled]=useState(()=>localStorage.getItem('nihongo-sfx')!=='off');
  const[favorites,setFavorites]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('nihongo-favorites')||'[]')as string[]}catch{return[]}});
  const[memories,setMemories]=useState<MemoryMap>(()=>{try{return JSON.parse(localStorage.getItem('nihongo-memories')||'{}')as MemoryMap}catch{return{}}});
  const evergreen=useMemo(()=>bundledStories.filter(s=>!s.news),[]);
  const fallbackDynamic=useMemo(()=>bundledStories.filter(s=>!!s.news).map(s=>({...s,audioAvailable:false})),[]);
  const[dynamic,setDynamic]=useState<Story[]>(fallbackDynamic);
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const requestRef=useRef(0);

  useEffect(()=>{let active=true;void api.get('/api/news-content').then(({data})=>{if(!active)return;const payload=data as {ok?:boolean;stories?:Story[]};const remote=payload?.ok&&Array.isArray(payload.stories)?payload.stories:[];if(remote.length)setDynamic(remote)}).catch(()=>{});return()=>{active=false}},[]);
  useEffect(()=>{if(!selectedId){setClipStatus({});return}let active=true;void api.get(`/api/play-audio-status/${selectedId}`).then(({data})=>{const payload=data as {ok?:boolean;clips?:Partial<Record<PlayClipId,ClipState>>};if(active&&payload?.ok&&payload.clips)setClipStatus(payload.clips)}).catch(()=>{if(active)setClipStatus({})});return()=>{active=false}},[selectedId]);
  useEffect(()=>localStorage.setItem('nihongo-favorites',JSON.stringify(favorites)),[favorites]);
  useEffect(()=>localStorage.setItem('nihongo-memories',JSON.stringify(memories)),[memories]);
  useEffect(()=>localStorage.setItem('nihongo-sfx',sfxEnabled?'on':'off'),[sfxEnabled]);

  const stories=useMemo(()=>{const ids=new Set(dynamic.map(s=>s.id));return[...dynamic,...evergreen.filter(s=>!ids.has(s.id))]},[dynamic,evergreen]);
  const seasonStories=useMemo(()=>stories.filter(s=>seriesOf(s)?.seasonId==='release-week-01').sort((a,b)=>(seriesOf(a)?.episodeNo||0)-(seriesOf(b)?.episodeNo||0)),[stories]);
  const selected=stories.find(s=>s.id===selectedId)||null;
  const learned=stories.filter(s=>(memories[s.id]?.lastSeen||0)>0);
  const due=learned.filter(s=>(memories[s.id]?.nextReviewAt||0)<=Date.now()).sort((a,b)=>(memories[a.id]?.nextReviewAt||0)-(memories[b.id]?.nextReviewAt||0));
  const nextSeasonStory=seasonStories.find(s=>!(memories[s.id]?.lastSeen));
  const continueStory=nextSeasonStory||due[0]||stories.find(s=>!(memories[s.id]?.lastSeen))||stories[0]||null;
  const continueSeries=seriesOf(continueStory);
  const completedSeason=seasonStories.filter(s=>(memories[s.id]?.lastSeen||0)>0).length;
  const favoriteStories=stories.filter(s=>favorites.includes(s.id));

  const unlock=()=>{audioRef.current?.pause();const a=new Audio(SILENT_WAV);a.preload='auto';a.loop=true;audioRef.current=a;try{void a.play().catch(()=>{})}catch{}return a};
  const playClip=async(storyId:string,clipId:PlayClipId,rate=1)=>{const request=++requestRef.current,a=unlock();try{const response=await Promise.race([api.get(`/api/play-audio/${storyId}/${clipId}`),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('play_audio_timeout')),5000))]);if(request!==requestRef.current)return false;const data=response.data as {status?:string;url?:string};if(data?.status!=='ready'||!data?.url)throw new Error('not_ready');a.loop=false;a.src=data.url;a.currentTime=0;a.playbackRate=rate;audioRef.current=a;await a.play();return true}catch{if(request===requestRef.current)a.pause();return false}};
  const toggleFavorite=(id:string)=>setFavorites(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
  const openStory=(id:string,mode:OpenMode='play')=>{requestRef.current++;audioRef.current?.pause();setOpenMode(mode);setSelectedId(id)};
  const closeStory=()=>{requestRef.current++;audioRef.current?.pause();setSelectedId(null)};
  const markMistake=(kind:Weakness)=>{if(!selected)return;setMemories(v=>{const old=v[selected.id]||{strength:0,nextReviewAt:0,lastSeen:0},weaknesses={...(old.weaknesses||{})};weaknesses[kind]=(weaknesses[kind]||0)+1;return{...v,[selected.id]:{...old,weaknesses}}})};
  const finish=(result:RecallResult)=>{if(!selected)return;const now=Date.now(),old=memories[selected.id]||{strength:0,nextReviewAt:0,lastSeen:0},weaknesses={...(old.weaknesses||{})};let strength=old.strength,delay=10*60*1000;if(result==='good'){strength=Math.min(old.strength+1,5);delay=GOOD_DELAYS[strength];(Object.keys(weaknesses)as Weakness[]).forEach(k=>{weaknesses[k]=Math.max(0,(weaknesses[k]||0)-1)})}else if(result==='close'){strength=Math.max(old.strength-1,0);delay=6*60*60*1000;weaknesses.recall=(weaknesses.recall||0)+1}else{strength=0;delay=10*60*1000;weaknesses.recall=(weaknesses.recall||0)+2}setMemories(v=>({...v,[selected.id]:{strength,nextReviewAt:now+delay,lastSeen:now,weaknesses,lastResult:result}}));if(openMode==='review'){const next=stories.find(s=>s.id!==selected.id&&(memories[s.id]?.lastSeen||0)>0&&(memories[s.id]?.nextReviewAt||0)<=now);setSelectedId(next?.id||null);if(!next)setTab('review');return}const meta=seriesOf(selected);const nextId=meta?.nextEpisodeId||selected.nextId;const next=stories.find(s=>s.id===nextId)||stories.find(s=>s.id!==selected.id&&!(memories[s.id]?.lastSeen));setOpenMode('play');setSelectedId(next?.id||null)};

  if(selected){
    const memory=memories[selected.id]||{strength:0,nextReviewAt:0,lastSeen:0};
    const meta=seriesOf(selected);
    return <div className='shell'><main className='phone play-only'><header className='play-topbar'><button aria-label='返回' onClick={closeStory}><ChevronLeft size={22}/></button><div><small>{openMode==='review'?'复习 · ':''}{meta?.seasonTitle?`${meta.seasonTitle} · 第${meta.episodeNo}集`: `${selected.category} · ${selected.level}`}</small><strong>{selected.key.term}</strong></div><button aria-label={favorites.includes(selected.id)?'取消收藏':'收藏'} onClick={()=>toggleFavorite(selected.id)}><Heart size={20} fill={favorites.includes(selected.id)?'currentColor':'none'}/></button></header>{openMode==='play'&&meta&&<section className='episode-recap'><span>{meta.worldTitle||'在日本生活和工作的我'}</span>{meta.prevSummary&&<p><b>上集</b>{meta.prevSummary}</p>}<p><b>今天</b>{meta.currentHook||selected.title}</p></section>}{openMode==='review'?<ReviewLane story={selected} clipStatus={clipStatus} playClip={playClip} memory={memory} onComplete={finish} onMistake={markMistake}/>:<PracticeLane story={selected} clipStatus={clipStatus} playClip={playClip} onSfx={kind=>playSfx(kind,sfxEnabled)} onComplete={finish} onMistake={markMistake}/>}</main></div>
  }

  const card=(s:Story,mode:OpenMode='play')=><button className='topic-row' key={`${mode}-${s.id}`} onClick={()=>openStory(s.id,mode)}><span>{s.emoji}</span><div><strong>{s.key.term}</strong><small>{seriesOf(s)?.seasonTitle?`第${seriesOf(s)?.episodeNo}集 · ${seriesOf(s)?.seasonTitle}`:`${s.category} · ${s.level}`}</small></div><ChevronRight size={16}/></button>;

  return <div className='shell'><main className='phone focus-app'>
    {tab==='play'&&<><header className='focus-header'><div><small>NIHONGO DISCOVERY</small><strong>继续玩</strong></div><span>{due.length?`待复习 ${due.length}`:`已遇见 ${learned.length}`}</span></header>{continueStory&&<section className='hero-play'><div className='hero-meta'><span>{continueSeries?`${continueSeries.seasonTitle||'项目上线前的一周'} · 第${continueSeries.episodeNo}集`:'接着玩'}</span><b>{continueStory.level}</b></div><div className='hero-emoji'>{continueStory.emoji}</div><small>{continueSeries?.worldTitle||continueStory.category}</small><h1>{continueSeries?.currentHook||continueStory.key.term}</h1>{continueSeries?.prevSummary?<p>上集：{continueSeries.prevSummary}</p>:<p>{continueStory.title}</p>}<div className='hero-key'><span>本集表达</span><strong>{continueStory.key.term}</strong></div><button onClick={()=>openStory(continueStory.id,'play')}><Sparkles size={19}/><strong>继续本集</strong><span>7 个短玩法 · 多听多说</span><ChevronRight size={19}/></button></section>}{seasonStories.length>0&&<section className='season-progress'><div><strong>项目上线前的一周</strong><span>{completedSeason}/{seasonStories.length}</span></div><div className='season-dots'>{seasonStories.map(s=><i key={s.id} className={(memories[s.id]?.lastSeen||0)>0?'done':s.id===continueStory?.id?'current':''}/>)}</div><small>世界稳定，剧情连续；每集只多学一点，同时把旧表达叫回来。</small></section>}</>}
    {tab==='review'&&<section className='secondary-page'><header><strong>再遇</strong><small>听力辨认 → 场景召回 → 开放输出，不再整套重跑</small></header><div className='topic-list'>{(due.length?due:learned).map(s=>card(s,'review'))}</div>{!learned.length&&<p className='empty-copy'>先玩一组，这里会按记忆强度安排再遇。</p>}</section>}
    {tab==='collection'&&<section className='secondary-page'><header><strong>收藏</strong><small>只保留你想反复玩的主题</small></header><div className='topic-list'>{favoriteStories.map(s=>card(s))}</div>{!favoriteStories.length&&<p className='empty-copy'>在玩法顶部点♡就能收藏。</p>}</section>}
    {tab==='atlas'&&<section className='secondary-page'><header><strong>图鉴</strong><small>旧内容继续保留，用来主动探索和清理积压</small></header>{seasonStories.length>0&&<div className='atlas-season'><strong>连续世界</strong><span>项目上线前的一周 · {seasonStories.length} 集</span><button onClick={()=>openStory(seasonStories[0].id)}>从第1集查看</button></div>}<div className='atlas-simple'>{categories.filter(c=>c!=='全部').map(c=>{const list=stories.filter(s=>s.category===c&&!seriesOf(s));return <button key={c} disabled={!list.length} onClick={()=>list[0]&&openStory(list[0].id)}><strong>{c}</strong><span>{list.length} 个情景</span></button>})}</div></section>}
    {tab==='profile'&&<section className='secondary-page'><header><strong>我的日语</strong><small>这里只留必要状态</small></header><div className='profile-simple'><div><strong>{learned.length}</strong><span>已遇见</span></div><div><strong>{favorites.length}</strong><span>收藏</span></div><div><strong>{due.length}</strong><span>待复习</span></div></div><button className='sound-toggle' onClick={()=>setSfxEnabled(v=>!v)}><Zap size={18}/><span>反馈音效</span><b>{sfxEnabled?'开':'关'}</b></button></section>}
    <nav className='bottom-nav-simple'>{([{id:'play',label:'继续',icon:Compass},{id:'review',label:'复习',icon:RotateCcw},{id:'collection',label:'收藏',icon:Bookmark},{id:'atlas',label:'图鉴',icon:Map},{id:'profile',label:'我的',icon:User}]as const).map(n=>{const I=n.icon;return <button key={n.id} className={tab===n.id?'active':''} aria-label={n.label} onClick={()=>setTab(n.id)}><I size={21}/></button>})}</nav>
  </main></div>
}

export default App;
