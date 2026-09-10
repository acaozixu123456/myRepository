import type {Line} from './model.ts';
export type NoteMode='auto'|'help'|'question';
export type NoteKind='correction'|'extension'|'wording'|'explanation';
export type NoteLine=Pick<Line,'id'|'role'|'text'|'delivered'|'interrupted'|'assistance'>;
export type NoteRequest={requestId:string;mode:NoteMode;anchorId:string;source:string;context:NoteLine[];target:number};
export type WrittenNote={id:string;anchorId:string;source:string;kind:NoteKind;suggestion:string;reasonZh:string;detailZh:string;mode:NoteMode};
export const NOTE_LABELS:Record<NoteKind,string>={correction:'换一个小地方',extension:'也可以接成一句',wording:'借用这个说法',explanation:'这个表达，原来如此'};
const safe=(v:unknown,n:number):v is string=>typeof v==='string'&&v.length<=n&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/u.test(v);
export const languageQuestion=(s:string)=>/什么意思|怎么说|怎么读|语法|助词|自然吗|说得对吗|区别|どういう意味|という意味|何と言|どう言|文法|自然ですか|意味を教/u.test(s);
/** Reference is stable text associated with actual conversation items, never audio or invented user input. */
export function noteRequest(lines:Line[],mode:NoteMode,target=0):NoteRequest|null{
 const usable=lines.filter(l=>l.text&&l.delivered&&!l.interrupted).slice(-10);
 const anchor=mode==='help'?usable.at(-1):[...usable].reverse().find(l=>l.role==='user');
 if(!anchor)return null;
 const end=usable.findIndex(l=>l.id===anchor.id);const context=usable.slice(Math.max(0,end-7),end+1).map(l=>({id:l.id,role:l.role,text:l.text.slice(0,700),delivered:true,interrupted:false,assistance:l.assistance}));
 if(mode==='auto'&&/^(?:はい|うん|いいえ|えっと|えーと|あの|嗯|呃|ありがとう|そうです)[。！!\s]*$/u.test(anchor.text))return null;
 return {requestId:crypto.randomUUID(),mode:mode==='auto'&&languageQuestion(anchor.text)?'question':mode,anchorId:anchor.id,source:anchor.text.slice(0,700),context,target:Math.min(3,Math.max(0,target))};
}
export function validateNoteRequest(value:unknown):NoteRequest|null{
 if(!value||typeof value!=='object')return null;const r=value as NoteRequest;
 if(!safe(r.requestId,80)||!/^[a-zA-Z0-9_-]{8,80}$/.test(r.requestId)||!['auto','help','question'].includes(r.mode)||!safe(r.anchorId,160)||!r.anchorId||!safe(r.source,700)||!r.source||!Array.isArray(r.context)||r.context.length>8||!r.context.length||![0,1,2,3].includes(r.target))return null;
 const context:NoteLine[]=[];const ids=new Set<string>();
 for(const l of r.context){if(!l||!safe(l.id,160)||ids.has(l.id)||!safe(l.text,700)||!['user','assistant'].includes(l.role)||l.delivered!==true||l.interrupted!==false)return null;ids.add(l.id);context.push({id:l.id,role:l.role,text:l.text,delivered:true,interrupted:false,assistance:['hint','example'].includes(l.assistance)?l.assistance:'none'});}
 const last=context.at(-1)!;if(last.id!==r.anchorId||last.text!==r.source||(r.mode!=='help'&&last.role!=='user'))return null;
 return {requestId:r.requestId,mode:r.mode,anchorId:r.anchorId,source:r.source,context,target:r.target};
}
export function validateWrittenNote(value:unknown,request:NoteRequest):WrittenNote|null{
 if(!value||typeof value!=='object')return null;const n=value as Record<string,unknown>;
 if(n.kind==='none'||n.certainty!=='clear'||n.meaningPreserved!==true||!Object.hasOwn(NOTE_LABELS,String(n.kind)))return null;
 if(n.source!==request.source||!safe(n.suggestion,140)||!safe(n.reasonZh,130)||!safe(n.detailZh,360)||!n.reasonZh.trim())return null;
 if(n.kind!=='explanation'&&(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(n.suggestion)||n.suggestion.replace(/[\s\p{P}]/gu,'')===request.source.replace(/[\s\p{P}]/gu,'')))return null;
 if(request.mode==='help'&&n.kind==='correction')return null;
 return {id:request.requestId,anchorId:request.anchorId,source:request.source,kind:n.kind as NoteKind,suggestion:n.suggestion.trim(),reasonZh:n.reasonZh.trim(),detailZh:n.detailZh.trim(),mode:request.mode};
}
export function changedPart(before:string,after:string):{prefix:string;added:string;suffix:string}{
 const a=Array.from(before),b=Array.from(after);let i=0,j=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;while(j<a.length-i&&j<b.length-i&&a[a.length-1-j]===b[b.length-1-j])j++;
 return {prefix:b.slice(0,i).join(''),added:b.slice(i,b.length-j).join(''),suffix:j?b.slice(b.length-j).join(''):''};
}
