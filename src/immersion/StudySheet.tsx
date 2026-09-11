import {useEffect,useRef,useState} from 'react';
import {X,Volume2,Bookmark,ArrowRight,ScanText} from 'lucide-react';
import {learnSelection,TextStudyConnection} from './studyClient';
import {type SelectionFocus,type StudyIntent,type Register,type StudyResult} from './contract';
import type {Subject} from '../companion/teacherContract';
type Props={focus:SelectionFocus;intentAction?:'study'|'listen'|'practice'|'save';onClose:()=>void;onPractice:(s:Subject)=>void;onSave:(s:Subject)=>void;onTheme:(text:string)=>void;acquire:()=>Promise<void>|void;release:()=>void;};
export function StudySheet({focus,intentAction='study',onClose,onPractice,onSave,onTheme,acquire,release}:Props){
 const [intent,setIntent]=useState<StudyIntent>('meaning'),[register,setRegister]=useState<Register>('natural'),[result,setResult]=useState<StudyResult|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[audioNote,setAudioNote]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),connection=useRef<TextStudyConnection|null>(null),auto=useRef(false),callbacks=useRef({acquire,release});callbacks.current={acquire,release};
 useEffect(()=>{dialog.current?.showModal();void callbacks.current.acquire();const c=connection.current=new TextStudyConnection(setAudioNote);return()=>{c.dispose();callbacks.current.release();};},[]);
 useEffect(()=>{const a=new AbortController();setBusy(true);setError('');setResult(null);connection.current?.stop();void learnSelection(focus,intent,register,a.signal).then(r=>{if(!a.signal.aborted)setResult(r);}).catch(()=>{if(!a.signal.aborted)setError('这次讲解没有接上。选中的原文还在，可以重试。');}).finally(()=>{if(!a.signal.aborted)setBusy(false);});return()=>a.abort();},[focus,intent,register,retry]);
 const subject:Subject|null=result?{phrase:focus.selectedText,meaningZh:result.meaningZh,kind:'explanation'}:null;
 useEffect(()=>{if(!subject||auto.current)return;auto.current=true;if(intentAction==='listen')void connection.current?.demonstrate(focus.selectedText,focus.sourceText);else if(intentAction==='practice')onPractice(subject);else if(intentAction==='save')onSave(subject);},[result]);
 return <dialog ref={dialog} className="imm-study-sheet" aria-label="选中即学" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section className="imm-study-inner">
 <header><span><ScanText size={15}/> CONTEXT LAB <small>选中即学</small></span><button onClick={onClose} aria-label="关闭学习面板"><X size={21}/></button></header>
 <h2 data-study-source={focus.sourceType} data-study-id={focus.sourceId+'-selection'} lang="ja">{focus.selectedText}</h2>
 <details className="imm-source"><summary>来自哪一句 · 所选文字快照</summary><p lang="ja" data-study-source={focus.sourceType}>{focus.sourceText}</p><small>字幕可能继续更新；本次解释始终对应这里的快照。</small></details>
 <nav aria-label="学习内容">{([['meaning','本句里'],['breakdown','拆解'],['extend','拓展']] as const).map(([id,label])=><button key={id} aria-pressed={intent===id} onClick={()=>setIntent(id)}>{label}</button>)}</nav>
 {intent==='extend'&&<div className="imm-register" aria-label="拓展场合">{([['natural','日常'],['polite','礼貌'],['business','商务']] as const).map(([id,label])=><button key={id} aria-pressed={register===id} onClick={()=>setRegister(id)}>{label}</button>)}</div>}
 <div className="imm-study-scroll">
 {busy&&<p className="imm-loading" role="status">正在结合这句的语境讲解…</p>}
 {error&&<p role="alert">{error}<button onClick={()=>setRetry(v=>v+1)}>重试讲解</button></p>}
 {result&&<><div className="imm-word-meta">{result.reading&&<span lang="ja">{result.reading}</span>}{result.dictionaryForm&&<small>词典形 <b lang="ja">{result.dictionaryForm}</b></small>}</div><h3>{result.meaningZh}</h3><p>{result.explanationZh}</p><span className="imm-usage">{result.status==='usable'?'本句表达可用':result.status==='needs_context'?'还需要一点语境':'结合语境再确认 · 不是发音判定'}</span>{result.points.map((p,i)=><article className="imm-analysis" key={i}><strong lang="ja" data-study-source="teacher">{p.part}</strong><p>{p.noteZh}</p></article>)}{result.questionZh&&<p className="imm-question">{result.questionZh}</p>}{result.examples.map((e,i)=><article className="imm-example" key={i}><p lang="ja" data-study-source="teacher">{e.ja}</p><small>{e.zh}</small><button onClick={()=>void connection.current?.demonstrate(e.ja)} aria-label={`听例句 ${i+1}`}><Volume2 size={16}/></button></article>)}</>}
 </div>
 {audioNote&&<p className="imm-audio-note" role="status">{audioNote}<button onClick={()=>void connection.current?.unlock()}>播放已准备的声音</button></p>}
 <footer><button disabled={!subject||busy} onClick={()=>void connection.current?.demonstrate(focus.selectedText,focus.sourceText)}><Volume2 size={17}/>听示范</button><button disabled={!subject||busy} onClick={()=>subject&&onPractice(subject)}>练一句<ArrowRight size={16}/></button><button disabled={!subject||busy} onClick={()=>subject&&onSave(subject)}><Bookmark size={16}/>收藏</button></footer>
 <button className="imm-topic-from" onClick={()=>onTheme(`围绕「${focus.selectedText}」练习。所在句子：${focus.sourceText}`)}>围绕这段，自定练习主题<ArrowRight size={14}/></button>
 <small className="imm-caption">仅传选区和必要上下文 · AI 讲解可有误 · 不录音、不自动计为掌握</small>
 </section></dialog>;
}
