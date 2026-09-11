import {useEffect,useRef,useState} from 'react';
import {ChevronRight,Volume2,X,Bookmark,RotateCcw} from 'lucide-react';
import {validLesson,validVerdict,type Lesson,type Subject,type SupportLevel,type Verdict} from './teacherContract';
import type {CompanionConnection} from './connection';
import type {Line} from './model';
import {EVIDENCE_LABELS,currentEvidence,dueExpressions,type Expression} from './expressionLearning';

type PracticeProps={connection:CompanionConnection;subject:Subject;previousScene?:string;lines:Line[];onClose:()=>void;onLesson:(lesson:Lesson)=>void;onResult:(lesson:Lesson,result:Verdict,answer:string,support:SupportLevel,source:'typed'|'confirmed_speech',attemptId:string,seen:string[])=>void;onSave:()=>void};
/** Explicit, skippable practice. Recognized speech is editable and never counted without confirmation. */
export function TeacherStudio({connection,subject,previousScene='',lines,onClose,onLesson,onResult,onSave}:PracticeProps){
 const [lesson,setLesson]=useState<Lesson|null>(null),[answer,setAnswer]=useState(''),[support,setSupport]=useState<SupportLevel>(0),[result,setResult]=useState<Verdict|null>(null),[busy,setBusy]=useState(true),[problem,setProblem]=useState(''),[loadKey,setLoadKey]=useState(0),[speech,setSpeech]=useState(false);
 const epoch=useRef(0),abort=useRef<AbortController|null>(null),edited=useRef(false),baseline=useRef(new Set(connection.lines.map(l=>l.id))),mutex=useRef(false),attempt=useRef({input:'',id:''}),revealed=useRef<string[]>([subject.phrase]);
 const callbacks=useRef({onLesson,onResult});callbacks.current={onLesson,onResult};
 useEffect(()=>{
  connection.setPracticeMode(true);setBusy(true);setProblem('');const e=++epoch.current,a=abort.current=new AbortController();
  void connection.teacherRequest({task:'prepare',requestId:crypto.randomUUID(),subject,previousScene},a.signal).then(r=>{
   if(e!==epoch.current||a.signal.aborted)return;const next=validLesson(r.lesson);if(!next)throw Error('invalid_lesson');setLesson(next);connection.setPracticeContext(next.cueZh);callbacks.current.onLesson(next);
  }).catch(()=>{if(e===epoch.current&&!a.signal.aborted)setProblem('这次练习没有准备好，可重试，也可以直接继续聊天。');}).finally(()=>{if(e===epoch.current)setBusy(false);});
  return()=>{epoch.current++;a.abort();abort.current?.abort();};
 },[connection,loadKey]);
 useEffect(()=>{
  const incoming=lines.filter(l=>l.role==='user'&&!baseline.current.has(l.id)&&!l.id.startsWith('typed_')&&l.text&&l.delivered&&!l.interrupted).map(l=>l.text).join(' ');
  if(incoming&&!edited.current&&!result){setAnswer(incoming.slice(0,500));setSpeech(true);}
 },[lines,result]);
 const hint=(level:SupportLevel)=>{if(!lesson||busy)return;setSupport(level);const text=level===1?lesson.keyword:level===2?lesson.starter:lesson.exampleJa;revealed.current.push(text);connection.useSupport(text);};
 const submit=async()=>{
  if(!lesson||!answer.trim()||mutex.current||result)return;mutex.current=true;setBusy(true);setProblem('');await connection.setMic(false);const e=++epoch.current,a=abort.current=new AbortController();
  const signature=JSON.stringify([lesson.id,answer,support,speech]);if(attempt.current.input!==signature)attempt.current={input:signature,id:crypto.randomUUID()};
  try{
   const r=await connection.teacherRequest({task:'assess',requestId:attempt.current.id,lesson,answer,source:speech?'confirmed_speech':'typed',support},a.signal);
   if(e!==epoch.current||a.signal.aborted)return;const verdict=validVerdict(r.assessment);if(!verdict||r.requestId!==attempt.current.id)throw Error('invalid_verdict');setResult(verdict);callbacks.current.onResult(lesson,verdict,answer,support,speech?'confirmed_speech':'typed',attempt.current.id,revealed.current);
  }catch{if(e===epoch.current&&!a.signal.aborted)setProblem('这次反馈没接上，答案还在。再点确认可重试，不会重复记进度。');}
  finally{mutex.current=false;if(e===epoch.current)setBusy(false);}
 };
 const retry=()=>{setResult(null);setAnswer('');edited.current=false;setSpeech(false);baseline.current=new Set(connection.lines.map(l=>l.id));if(result?.suggestionJa){revealed.current.push(result.suggestionJa);setSupport(3);}attempt.current={input:'',id:''};};
 return <section className="teacher-studio" aria-label="短练习" data-testid="teacher-studio">
  <header><span>15 秒小练习 · 随时跳过</span><button onClick={onClose} aria-label="退出练习"><X size={18}/></button></header>
  {busy&&!lesson&&<p role="status">在准备一个你用得上的场景…</p>}
  {problem&&<p className="teacher-error" role="status">{problem}{!lesson&&<button onClick={()=>setLoadKey(v=>v+1)}>重试准备</button>}</p>}
  {lesson&&<>
   <p className="teacher-cue">{lesson.cueZh}</p><small>假设情境 · 表达意思即可，不必逐字背答案。</small>
   {!result&&<>
    <div className="teacher-hints"><button disabled={busy||support>=1} onClick={()=>hint(1)}>给个词</button><button disabled={busy||support>=2} onClick={()=>hint(2)}>给个开头</button><button disabled={busy||support>=3} onClick={()=>hint(3)}>看完整示范</button></div>
    {support>0&&<p className="teacher-scaffold" lang="ja">{support===1?lesson.keyword:support===2?lesson.starter:lesson.exampleJa}{support===3&&<button onClick={()=>void connection.demonstrate(lesson.exampleJa)} aria-label="听练习示范"><Volume2 size={17}/></button>}</p>}
    <label htmlFor="teacher-answer">{speech?'识别结果，请确认或修改后提交':'先试着说，也可以打字'}</label>
    <textarea id="teacher-answer" aria-label="练习回答" value={answer} maxLength={500} disabled={busy} onChange={e=>{edited.current=true;setAnswer(e.target.value);}} placeholder="用下方麦克风说，或在这里写一句…"/>
    <button className="teacher-primary" disabled={busy||!answer.trim()} onClick={()=>void submit()}>{busy?'老师正在看这一句…':speech?'确认这句，给我反馈':'看看这句表达'}</button>
   </>}
   {result&&<div className="teacher-result" data-verdict={result.verdict}><p>{result.feedbackZh}</p>{result.suggestionJa&&<p lang="ja">{result.suggestionJa}</p>}<small>{result.verdict==='uncertain'?'没有记录为会用；可修改识别结果再试。':'这是文字与意思的判断，不是发音评分。'}</small><div className="teacher-hints"><button onClick={retry}><RotateCcw size={14}/>再试一次</button><button onClick={onSave}><Bookmark size={14}/>收藏这个表达</button></div></div>}
  </>}
  <button className="teacher-skip" onClick={onClose}>继续聊天，不用做完<ChevronRight size={15}/></button>
 </section>;
}

type ShelfProps={items:Expression[];enabled:boolean;onPractice:(item:Expression)=>void;onRemove:(id:string)=>void;onEnable:()=>void;onExport:()=>void};
export function ExpressionShelf({items,enabled,onPractice,onRemove,onEnable,onExport}:ShelfProps){
 const due=dueExpressions(items);const sorted=[...due,...items.filter(i=>!due.includes(i)).slice().sort((a,b)=>b.updatedAt-a.updatedAt)].slice(0,40);
 return <section className="expression-shelf" aria-label="我的表达">
  <p>{enabled?'只在本机保存表达和练习结果，不保存整段聊天或录音。':'现在只记本次打开期间的表达。开启保存后，明天可以接着复习。'}</p>
  {!enabled&&<button className="teacher-primary" onClick={onEnable}>在本机保存表达与复习进度</button>}
  <small>复习间隔是可调整的安排，不是能力分数。独立表达过也不等于完全掌握。</small>
  {!items.length&&<p className="teacher-empty">聊天后点提示卡上的「练一句」或「收藏」，你的表达就会出现在这里。</p>}
  {sorted.map(item=><article className="expression-item" key={item.id}><header><span>{EVIDENCE_LABELS[currentEvidence(item)]}</span><small>{item.dueAt<=Date.now()?'可以复习了':`下次 ${new Date(item.dueAt).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'})}`}</small></header><h3 lang="ja">{item.subject.phrase}</h3><p>{item.subject.meaningZh}</p><div><button onClick={()=>onPractice(item)}>换个场景试试<ChevronRight size={14}/></button><button onClick={()=>onRemove(item.id)} aria-label={`删除表达 ${item.subject.phrase}`}>删除</button></div></article>)}
  {!!items.length&&<button className="teacher-skip" onClick={onExport}>导出表达记录</button>}
 </section>;
}
export function SessionTakeaway({items,sessionIds,onReview}:{items:Expression[];sessionIds:string[];onReview:()=>void}){
 const selected=items.filter(i=>sessionIds.includes(i.id)).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,3);if(!selected.length)return null;
 return <section className="session-takeaway"><h2>这次带走的表达</h2>{selected.map(i=><p key={i.id}><span lang="ja">{i.subject.phrase}</span><small>{EVIDENCE_LABELS[currentEvidence(i)]}</small></p>)}<button onClick={onReview}>查看表达与下次复习<ChevronRight size={15}/></button></section>;
}
