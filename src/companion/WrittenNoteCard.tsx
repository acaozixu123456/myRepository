import {useEffect,useRef} from 'react';
import {ChevronDown,Leaf} from 'lucide-react';
import {changedPart,NOTE_LABELS,type WrittenNote} from './writtenFeedback';
import './writtenNotes.css';
type Props={note:WrittenNote;expanded:boolean;onToggle:()=>void;onDismiss:()=>void;onSeen:()=>void};
/** No live-region announcement: a quiet visual aid, not another voice. */
export function WrittenNoteCard({note,expanded,onToggle,onDismiss,onSeen}:Props){
 const card=useRef<HTMLElement>(null);const reported=useRef(false);
 useEffect(()=>{if(!expanded||reported.current||!card.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){reported.current=true;onSeen();observer.disconnect();}},{threshold:.25});observer.observe(card.current);return()=>observer.disconnect();},[expanded,onSeen]);
 const diff=changedPart(note.source,note.suggestion);
 return <aside ref={card} className="kc-written-note" data-note-for={note.anchorId} data-note-kind={note.kind} aria-label="安静的文字提示">
  <button className="kc-note-heading" onClick={onToggle} aria-expanded={expanded}><span><Leaf size={13}/>{NOTE_LABELS[note.kind]}</span><ChevronDown size={14} className={expanded?'expanded':''}/></button>
  {expanded&&<div className="kc-note-body">
   {note.suggestion&&<p className="kc-note-japanese" lang="ja">{diff.prefix}<strong>{diff.added}</strong>{diff.suffix}</p>}
   <p className="kc-note-reason" lang="zh-CN">{note.reasonZh}</p>
   <details className="kc-note-detail"><summary>看一小点说明</summary>{note.detailZh&&<p lang="zh-CN">{note.detailZh}</p>}<small>根据刚才的字幕和语境提供参考，不是发音评分。</small><button onClick={onDismiss}>识别不对，先收起</button></details>
  </div>}
 </aside>;
}
