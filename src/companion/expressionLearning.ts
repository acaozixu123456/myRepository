import {normalizePhrase,validSubject,type Subject,type Lesson,type Verdict,type SupportLevel} from './teacherContract';
/** Dedicated opt-in store. Never reads/writes the NHK library, microphone or full conversation. */
export const EXPRESSION_KEY='hitokoto-expression-learning-v1';
export type EvidenceKind='seen'|'imitated'|'supported'|'independent'|'transfer'|'retry';
export type Evidence={id:string;kind:EvidenceKind;at:number;scene:string;source:'typed'|'confirmed_speech'|'view'};
export type Expression={id:string;subject:Subject;focus:string;createdAt:number;updatedAt:number;dueAt:number;evidence:Evidence[];bookmarked:boolean};
export type Library={version:1;enabled:boolean;items:Expression[]};
export type LibraryRead={library:Library;raw:string|null;protected:boolean};
const safeText=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max&&!/[<>\u0000-\u0008]/u.test(v);
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<9e15;
const empty=():Library=>({version:1,enabled:false,items:[]});
export function expressionId(s:Subject):string{const text=normalizePhrase(s.phrase);let h=2166136261;for(const c of text){h^=c.codePointAt(0)!;h=Math.imul(h,16777619);}return'expr_'+(h>>>0).toString(16)+'_'+text.length;}
export function readExpressions(storage:Pick<Storage,'getItem'>):LibraryRead{
 let raw:string|null=null;
 try{
  raw=storage.getItem(EXPRESSION_KEY);if(!raw)return{library:empty(),raw,protected:false};if(raw.length>1200000)throw Error('oversized');
  const r=JSON.parse(raw);if(r?.version!==1||typeof r.enabled!=='boolean'||!Array.isArray(r.items)||r.items.length>250)throw Error('schema');
  const ids=new Set<string>();const items:Expression[]=r.items.map((item:any)=>{
   const subject=validSubject(item?.subject);
   if(!subject||!safeText(item.id,100)||!item.id||ids.has(item.id)||!safeText(item.focus,80)||!finite(item.createdAt)||!finite(item.updatedAt)||!finite(item.dueAt)||typeof item.bookmarked!=='boolean'||!Array.isArray(item.evidence)||item.evidence.length>40)throw Error('item');ids.add(item.id);
   const evidence:Evidence[]=item.evidence.map((e:any)=>{if(!e||!safeText(e.id,100)||!e.id||!['seen','imitated','supported','independent','transfer','retry'].includes(e.kind)||!finite(e.at)||!safeText(e.scene,120)||!['typed','confirmed_speech','view'].includes(e.source))throw Error('evidence');return{id:e.id,kind:e.kind,at:e.at,scene:e.scene,source:e.source};});
   return{id:item.id,subject,focus:item.focus,createdAt:item.createdAt,updatedAt:item.updatedAt,dueAt:item.dueAt,evidence,bookmarked:item.bookmarked};
  });return{library:{version:1,enabled:r.enabled,items},raw,protected:false};
 }catch{return{library:empty(),raw,protected:true};}
}
export function writeExpressions(storage:Pick<Storage,'getItem'|'setItem'>,library:Library,expected:string|null):string{
 if(storage.getItem(EXPRESSION_KEY)!==expected)throw Error('storage_changed');
 const raw=JSON.stringify(library);
 // Validate our serialized state too; never persist responses with unknown extra fields.
 if(readExpressions({getItem:()=>raw}).protected)throw Error('invalid_library');
 storage.setItem(EXPRESSION_KEY,raw);return raw;
}
export function rememberSubject(items:Expression[],subject:Subject,focus=subject.phrase,now=Date.now(),bookmark=false):Expression[]{
 const id=expressionId(subject),existing=items.find(e=>e.id===id&&normalizePhrase(e.subject.phrase)===normalizePhrase(subject.phrase));
 if(existing)return items.map(e=>e===existing?{...e,bookmarked:e.bookmarked||bookmark}:e);
 if(items.length>=250)throw Error('library_full');
 const item:Expression={id,subject,focus:focus.slice(0,80),createdAt:now,updatedAt:now,dueAt:now+86400000,evidence:[{id:'seen_'+id,kind:'seen',at:now,scene:'',source:'view'}],bookmarked:bookmark};return[...items,item];
}
export function recordAttempt(items:Expression[],lesson:Lesson,verdict:Verdict,answer:string,support:SupportLevel,source:'typed'|'confirmed_speech',attemptId:string,seenExamples:string[]=[],now=Date.now()):Expression[]{
 if(verdict.verdict==='uncertain')return items;
 const prepared=rememberSubject(items,lesson.subject,lesson.focus,now),id=expressionId(lesson.subject);
 return prepared.map(item=>{
  if(item.id!==id||item.evidence.some(e=>e.id===attemptId))return item;
  const successful=verdict.verdict==='communicated'&&verdict.focusUsed;
  const copied=seenExamples.some(s=>normalizePhrase(s)===normalizePhrase(answer));
  const priorIndependent=item.evidence.filter(e=>e.kind==='independent'||e.kind==='transfer');
  const kind:EvidenceKind=!successful?'retry':support===3||copied?'imitated':support>0?'supported':priorIndependent.some(e=>e.scene!==lesson.scene&&e.scene)?'transfer':'independent';
  const successes=priorIndependent.length+(kind==='independent'||kind==='transfer'?1:0);
  const delay=kind==='retry'?10*60000:kind==='imitated'||kind==='supported'?86400000:[1,3,7,14][Math.min(3,Math.max(0,successes-1))]*86400000;
  return{...item,focus:lesson.focus,updatedAt:now,dueAt:now+delay,evidence:[...item.evidence,{id:attemptId,kind,at:now,scene:lesson.scene,source}].slice(-40)};
 });
}
export const EVIDENCE_LABELS:Record<EvidenceKind,string>={seen:'看过',imitated:'参考示范说出',supported:'借助提示说出',independent:'独立表达过',transfer:'换场景用过',retry:'下次再试'};
export function currentEvidence(item:Expression):EvidenceKind{return item.evidence.at(-1)?.kind||'seen';}
export function dueExpressions(items:Expression[],now=Date.now()):Expression[]{return items.filter(i=>i.dueAt<=now).sort((a,b)=>a.dueAt-b.dueAt).slice(0,5);}
