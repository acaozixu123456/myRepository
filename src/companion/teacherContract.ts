/** Shared, bounded contracts. Lesson content is untrusted data, never instructions. */
export const TEACHER_RELEASE='teacher-20260911-v2';
export type Subject={phrase:string;meaningZh:string;kind:'correction'|'extension'|'wording'|'explanation'};
export type Lesson={id:string;subject:Subject;focus:string;scene:string;cueZh:string;keyword:string;starter:string;exampleJa:string;signature:string};
export type Verdict={verdict:'communicated'|'revise'|'uncertain';focusUsed:boolean;feedbackZh:string;suggestionJa:string};
export type SupportLevel=0|1|2|3;
export type TeacherInput=
 |{task:'prepare';requestId:string;subject:Subject;previousScene:string}
 |{task:'assess';requestId:string;lesson:Lesson;answer:string;source:'typed'|'confirmed_speech';support:SupportLevel};
const clean=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/u.test(v);
export const normalizePhrase=(s:string)=>s.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
export function validSubject(value:unknown):Subject|null{
 if(!value||typeof value!=='object')return null;const s=value as Subject;
 if(!clean(s.phrase,140)||!s.phrase.trim()||!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(s.phrase)||!clean(s.meaningZh,360)||!s.meaningZh.trim()||!['correction','extension','wording','explanation'].includes(s.kind))return null;
 return{phrase:s.phrase.trim(),meaningZh:s.meaningZh.trim(),kind:s.kind};
}
export function validLesson(value:unknown):Lesson|null{
 if(!value||typeof value!=='object')return null;const l=value as Lesson,subject=validSubject(l.subject);
 if(!subject||!clean(l.id,80)||!/^[a-zA-Z0-9_-]{8,80}$/.test(l.id)||!clean(l.signature,100)||!clean(l.focus,80)||!l.focus.trim()||!clean(l.scene,120)||!l.scene.trim()||!clean(l.cueZh,180)||!l.cueZh.trim()||!clean(l.keyword,55)||!l.keyword.trim()||!clean(l.starter,90)||!l.starter.trim()||!clean(l.exampleJa,160)||!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(l.exampleJa))return null;
 return{id:l.id,subject,focus:l.focus.trim(),scene:l.scene.trim(),cueZh:l.cueZh.trim(),keyword:l.keyword.trim(),starter:l.starter.trim(),exampleJa:l.exampleJa.trim(),signature:l.signature};
}
export function validTeacherInput(value:unknown):TeacherInput|null{
 if(!value||typeof value!=='object')return null;const r=value as TeacherInput;
 if(!clean(r.requestId,80)||!/^[a-zA-Z0-9_-]{8,80}$/.test(r.requestId))return null;
 if(r.task==='prepare'){const subject=validSubject(r.subject);return subject&&clean(r.previousScene,120)?{task:r.task,requestId:r.requestId,subject,previousScene:r.previousScene}:null;}
 if(r.task==='assess'){const lesson=validLesson(r.lesson);return lesson&&clean(r.answer,500)&&r.answer.trim()&&['typed','confirmed_speech'].includes(r.source)&&[0,1,2,3].includes(r.support)?{task:r.task,requestId:r.requestId,lesson,answer:r.answer.trim(),source:r.source,support:r.support}:null;}
 return null;
}
export function validVerdict(value:unknown):Verdict|null{
 if(!value||typeof value!=='object')return null;const r=value as Verdict;
 if(!['communicated','revise','uncertain'].includes(r.verdict)||typeof r.focusUsed!=='boolean'||!clean(r.feedbackZh,240)||!r.feedbackZh.trim()||!clean(r.suggestionJa,200))return null;
 return{verdict:r.verdict,focusUsed:r.focusUsed,feedbackZh:r.feedbackZh.trim(),suggestionJa:r.suggestionJa.trim()};
}
export function lessonSignatureValue(l:Lesson){const{signature,...lesson}=l;return{purpose:'hitokoto-lesson-v2',lesson};}
export function splitForListening(text:string):string[]{return(text.match(/[^。！？!?\n]+[。！？!?]?/gu)||[]).map(s=>s.trim()).filter(Boolean).flatMap(s=>s.length<=200?[s]:(s.match(/[^、，,]+[、，,]?/gu)||[s])).filter(s=>s.length<=200).slice(0,8);}
