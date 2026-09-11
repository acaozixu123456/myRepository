import {useEffect,useRef,useState} from 'react';
import {ChevronDown,Leaf} from 'lucide-react';
import {changedPart,NOTE_LABELS,type WrittenNote} from './writtenFeedback';
import './writtenNotes.css';
type Props={note:WrittenNote;expanded:boolean;onToggle:()=>void;onDismiss:()=>void;onSeen:()=>void;onReading?:(value:boolean)=>void;onPractice?:()=>void;onSave?:()=>void;onSpeak?:()=>void;onSupport?:(text:string)=>void};
/** No live-region announcement: a quiet visual aid, not another voice. */
export function WrittenNoteCard({note,expanded,onToggle,onDismiss,onSeen,onReading,onPractice,onSave,onSpeak,onSupport}:Props){
 const [step,setStep]=useState(note.mode==='help'&&note.scaffold?1:3);
 const card=useRef<HTMLElement>(null);const reported=useRef(false);
 useEffect(()=>{if(step<3||!expanded||reported.current||!card.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){reported.current=true;onSeen();observer.disconnect();}},{threshold:.25});observer.observe(card.current);return()=>observer.disconnect();},[expanded,onSeen,step]);
 const diff=changedPart(note.source,note.suggestion);
 return <aside ref={card} className="kc-written-note" data-note-for={note.anchorId} data-note-kind={note.kind} aria-label="安静的文字提示">
  <button className="kc-note-heading" onClick={onToggle} aria-expanded={expanded}><span><Leaf size={13}/>{NOTE_LABELS[note.kind]}</span><ChevronDown size={14} className={expanded?'expanded':''}/></button>
  {expanded&&<div className="kc-note-body" onPointerDown={()=>onReading?.(true)} onPointerUp={()=>onReading?.(false)} onPointerCancel={()=>onReading?.(false)} onPointerLeave={()=>onReading?.(false)}>
   {step<3&&note.scaffold&&<p className="kc-note-japanese" lang="ja">{step===1?note.scaffold.keyword:note.scaffold.starter}</p>}
   {step===3&&note.suggestion&&<p className="kc-note-japanese" lang="ja">{diff.prefix}<strong>{diff.added}</strong>{diff.suffix}</p>}
   {note.mode==='help'&&note.scaffold&&step<3&&<div className="teacher-hints"><button onClick={()=>{setStep(2);onSupport?.(note.scaffold!.starter);}}>给个开头</button><button onClick={()=>{setStep(3);onSupport?.(note.suggestion);}}>完整示范</button></div>}
   <p className="kc-note-reason" lang="zh-CN">{note.reasonZh}</p>
   <div className="teacher-note-actions">{onPractice&&<button onClick={onPractice}>练一句</button>}{onSave&&<button onClick={onSave}>收藏</button>}{onSpeak&&step===3&&<button onClick={onSpeak}>听示范</button>}</div>
   <details className="kc-note-detail" onToggle={()=>onReading?.(false)}><summary>看一小点说明</summary>{note.detailZh&&<p lang="zh-CN">{note.detailZh}</p>}<small>根据刚才的字幕和语境提供参考，不是发音评分。</small><button onClick={onDismiss}>识别不对，先收起</button></details>
  </div>}
 </aside>;
}
