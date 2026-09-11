import {createPortal} from 'react-dom';
import type {ReactNode} from 'react';
import {useEffect,useRef,useState} from 'react';
import {BookOpen,Volume2,MoreHorizontal,X} from 'lucide-react';
import {focusFromSelection,wholeSentence} from './selectionFocus';
import type {SelectionFocus} from './contract';
type Action='study'|'listen'|'practice'|'save';
function mountSelectionToolbar(node:ReactNode){
 const anchor=window.getSelection()?.anchorNode;
 const element=anchor instanceof Element?anchor:anchor?.parentElement;
 const host=element?.closest('dialog[open]')||null;
 return host?createPortal(<div className="imm-modal-selection-wrap">{node}</div>,host):createPortal(node,document.body);
}
export function SelectionStudyLayer({onOpen,disabled=false,onSelecting}:{onOpen:(f:SelectionFocus,a:Action)=>void;disabled?:boolean;onSelecting?:(active:boolean)=>void}){
 const [focus,setFocus]=useState<SelectionFocus|null>(null),[more,setMore]=useState(false),[message,setMessage]=useState('');const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>{
  const changed=()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>{if(disabled)return;const found=focusFromSelection(window.getSelection());setFocus(found?.focus||null);setMore(false);setMessage(!found&&Array.from(window.getSelection()?.toString()||'').length>400?'选区超过400字，请缩小到一个词或一句话。':'');onSelecting?.(!!found);},220);};
  document.addEventListener('selectionchange',changed);document.addEventListener('pointerup',changed);document.addEventListener('keyup',changed);
  return()=>{clearTimeout(timer.current);document.removeEventListener('selectionchange',changed);document.removeEventListener('pointerup',changed);document.removeEventListener('keyup',changed);onSelecting?.(false);};
 },[disabled,onSelecting]);
 const open=(a:Action)=>{if(!focus)return;const f=focus;setFocus(null);setMore(false);window.getSelection()?.removeAllRanges();onSelecting?.(false);onOpen(f,a);};
 if(disabled)return null;
 if(!focus&&message)return mountSelectionToolbar(<div className="imm-selection-tools" role="status"><small>{message}</small><button onClick={()=>setMessage('')}>收起</button></div>);
 if(!focus)return null;
 return mountSelectionToolbar(<div className="imm-selection-tools" role="toolbar" aria-label="选中文字操作" data-study-ignore onPointerDown={e=>e.preventDefault()} onMouseDown={e=>e.preventDefault()}>
 <div><button onClick={()=>open('study')}><BookOpen size={16}/>学这段</button><button onClick={()=>open('listen')}><Volume2 size={16}/>听读</button><button onClick={()=>setMore(v=>!v)} aria-expanded={more}><MoreHorizontal size={18}/>更多</button><button aria-label="收起选词工具" onClick={()=>{setFocus(null);onSelecting?.(false);}}><X size={16}/></button></div>
 {more&&<div><button onClick={()=>{const sentence=wholeSentence(focus);if(sentence)setFocus(sentence);else setMessage('整句超过400字，请保留较短选区。');}}>选整句</button><button onClick={()=>open('practice')}>练一句</button><button onClick={()=>open('save')}>收藏</button></div>}{message&&<small>{message}</small>}
 </div>);
}
