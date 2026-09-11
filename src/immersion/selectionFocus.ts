import {points,revisionOf,validFocus,type SelectionFocus,type SourceType} from './contract';
const eligible='[data-study-source], [lang="ja"]';
function parent(node:Node|null):Element|null{return node?.nodeType===Node.ELEMENT_NODE?node as Element:node?.parentElement||null;}
export function focusFromSelection(selection:Selection|null):{focus:SelectionFocus;element:Element}|null {
 if(!selection||selection.isCollapsed||selection.rangeCount!==1)return null;
 const range=selection.getRangeAt(0),a=parent(range.startContainer),b=parent(range.endContainer);if(!a||!b||a.closest('button,input,textarea,[data-study-ignore]')||b.closest('button,input,textarea,[data-study-ignore]'))return null;
 const source=a.closest(eligible);if(!source||!source.contains(range.endContainer)||!source.closest('.kc-root,.nhk-only-app,.imm-study-sheet,dialog'))return null;
 if(b.closest(eligible)!==source&&!source.contains(b.closest(eligible)))return null;
 const raw=source.textContent||'';const before=range.cloneRange();before.selectNodeContents(source);before.setEnd(range.startContainer,range.startOffset);
 const selected=range.toString();const utfStart=before.toString().length;
 // Native offsets use UTF-16. Convert precisely to code points before transport.
 const globalStart=points(raw.slice(0,utfStart)).length;const selectedPoints=points(selected);
 if(!selectedPoints.length||selectedPoints.length>400||points(raw).slice(globalStart,globalStart+selectedPoints.length).join('')!==selected)return null;
 const windowStart=Math.max(0,globalStart-450),sourceText=points(raw).slice(windowStart,windowStart+1500).join('');
 const type=(source.getAttribute('data-study-source')|| (source.closest('.nhk-only-app')?'nhk':source.closest('.expression-item')?'expression':source.closest('.teacher-studio')?'practice':source.closest('.kc-line.user')?'user':'teacher')) as SourceType;
 const id=source.getAttribute('data-study-id')||source.closest('[data-line-id]')?.getAttribute('data-line-id')||source.closest('[data-note-for]')?.getAttribute('data-note-for')||'block_'+revisionOf(raw);
 const focus=validFocus({sourceType:type,sourceId:id,revision:revisionOf(sourceText),sourceText,selectedText:selected,start:globalStart-windowStart,end:globalStart-windowStart+selectedPoints.length,before:'',after:''});
 return focus?{focus,element:source}:null;
}
export function wholeSentence(f:SelectionFocus):SelectionFocus|null{
 const chars=points(f.sourceText);let start=f.start,end=f.end;while(start>0&&!/[。！？!?\n]/u.test(chars[start-1]))start--;while(end<chars.length&&!/[。！？!?\n]/u.test(chars[end-1]))end++;
 return validFocus({...f,start,end,selectedText:chars.slice(start,end).join('')});
}
export function standaloneFocus(text:string,type:SourceType='teacher',context=text):SelectionFocus|null {
 const i=context.indexOf(text);if(i<0)return null;return validFocus({sourceType:type,sourceId:'selected_'+revisionOf(context),revision:revisionOf(context),sourceText:context,selectedText:text,start:points(context.slice(0,i)).length,end:points(context.slice(0,i)).length+points(text).length,before:'',after:''});
}
