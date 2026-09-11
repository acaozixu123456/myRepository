/** Shared Unicode-safe data contracts. User text is DATA, never a system instruction. */
export const IMMERSION_RELEASE = 'immersion-20260911-v3';
export const points = (s:string) => Array.from(s);
export const japanese = (s:string) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(s);
export function bounded(v:unknown,max:number):v is string {
 return typeof v==='string' && points(v).length<=max && !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v);
}
export type SourceType='assistant'|'user'|'teacher'|'practice'|'expression'|'nhk';
export type SelectionFocus={sourceType:SourceType;sourceId:string;revision:string;sourceText:string;selectedText:string;start:number;end:number;before:string;after:string};
export const revisionOf=(s:string)=>{let h=2166136261;for(const c of s){h=Math.imul(h^c.codePointAt(0)!,16777619);}return 'r'+(h>>>0).toString(16)+'-'+points(s).length;};
export function validFocus(v:unknown):SelectionFocus|null {
 if(!v||typeof v!=='object')return null;const f=v as SelectionFocus;
 if(!['assistant','user','teacher','practice','expression','nhk'].includes(f.sourceType)||!bounded(f.sourceId,120)||!f.sourceId||!bounded(f.revision,80)||!bounded(f.sourceText,1500)||!bounded(f.selectedText,400)||!f.selectedText.trim()||!japanese(f.selectedText)||!bounded(f.before,200)||!bounded(f.after,200))return null;
 if(!Number.isInteger(f.start)||!Number.isInteger(f.end)||f.start<0||f.end<=f.start||f.end>points(f.sourceText).length||points(f.sourceText).slice(f.start,f.end).join('')!==f.selectedText||f.revision!==revisionOf(f.sourceText))return null;
 return{sourceType:f.sourceType,sourceId:f.sourceId,revision:f.revision,sourceText:f.sourceText,selectedText:f.selectedText,start:f.start,end:f.end,before:f.before,after:f.after};
}
export type StudyIntent='meaning'|'breakdown'|'extend';
export type Register='natural'|'polite'|'business';
export type StudyInput={requestId:string;focus:SelectionFocus;intent:StudyIntent;register:Register};
export function validStudyInput(v:unknown):StudyInput|null {if(!v||typeof v!=='object')return null;const r=v as StudyInput,f=validFocus(r.focus);return f&&requestIdOK(r.requestId)&&['meaning','breakdown','extend'].includes(r.intent)&&['natural','polite','business'].includes(r.register)?{requestId:r.requestId,focus:f,intent:r.intent,register:r.register}:null;}
export const requestIdOK=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(v);
export type StudyResult={original:string;reading:string;dictionaryForm:string;meaningZh:string;explanationZh:string;status:'usable'|'needs_context'|'possible_issue';points:Array<{part:string;noteZh:string}>;examples:Array<{ja:string;zh:string}>;questionZh:string};
export function validStudyResult(v:unknown,original:string):StudyResult|null {
 if(!v||typeof v!=='object')return null;const r=v as StudyResult;
 if(r.original!==original||!bounded(r.reading,500)||!bounded(r.dictionaryForm,400)||!bounded(r.meaningZh,360)||!r.meaningZh.trim()||!bounded(r.explanationZh,800)||!['usable','needs_context','possible_issue'].includes(r.status)||!bounded(r.questionZh,180)||!Array.isArray(r.points)||r.points.length>3||!Array.isArray(r.examples)||r.examples.length>3)return null;
 if(r.points.some(p=>!p||!bounded(p.part,200)||!bounded(p.noteZh,360))||r.examples.some(e=>!e||!bounded(e.ja,300)||!japanese(e.ja)||!bounded(e.zh,360)))return null;
 return{original,reading:r.reading,dictionaryForm:r.dictionaryForm,meaningZh:r.meaningZh,explanationZh:r.explanationZh,status:r.status,points:r.points.map(p=>({part:p.part,noteZh:p.noteZh})),examples:r.examples.map(e=>({ja:e.ja,zh:e.zh})),questionZh:r.questionZh};
}
export type TopicBrief={requestId:string;text:string;difficulty:'current'|'N3'|'N2'|'N1';register:Register;entryMode:'chat'|'explain'|'practice'};
export type TopicOrigin={kind:'user';brief:string;difficulty:TopicBrief['difficulty'];register:Register;entryMode:TopicBrief['entryMode']};
export function validBrief(v:unknown):TopicBrief|null {if(!v||typeof v!=='object')return null;const r=v as TopicBrief;return requestIdOK(r.requestId)&&bounded(r.text,500)&&!!r.text.trim()&&['current','N3','N2','N1'].includes(r.difficulty)&&['natural','polite','business'].includes(r.register)&&['chat','explain','practice'].includes(r.entryMode)?{requestId:r.requestId,text:r.text.trim(),difficulty:r.difficulty,register:r.register,entryMode:r.entryMode}:null;}
export function validOrigin(v:unknown):TopicOrigin|null {if(!v||typeof v!=='object'||(v as TopicOrigin).kind!=='user')return null;const r=v as TopicOrigin,b=validBrief({...r,text:r.brief,requestId:'origin_ok'});return b?{kind:'user',brief:b.text,difficulty:b.difficulty,register:b.register,entryMode:b.entryMode}:null;}
export type StudyTicket={id:string;expiresAt:number;token:string};
export const studyTicketValue=(clientKey:string,id:string,expiresAt:number)=>({purpose:'hitokoto-study-v3',clientKey,id,expiresAt,capabilities:['study','study_demo','study_lesson','custom_topic']});
export const studyKey=(focus:SelectionFocus,intent:StudyIntent,register:Register)=>JSON.stringify([focus.sourceType,focus.sourceText,focus.start,focus.end,focus.before,focus.after,intent,register]);
