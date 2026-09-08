import {readFileSync,writeFileSync} from 'node:fs';
let p='src/nhkGentleTeacher.ts',s=readFileSync(p,'utf8');
if(!s.includes("from './nhkTeacherRescue'")){
 s="import {sameThreadRescue} from './nhkTeacherRescue';\n"+s;
 const before="const previous=teacherLastQuestion(c);let say='一言で大丈夫です。';";
 if(s.split(before).length!==2)throw new Error('Rescue integration anchor missing');
 s=s.replace(before,"const previous=teacherLastQuestion(c);if(c.kind==='simplify')return sameThreadRescue(previous,c.previous);let say='一言で大丈夫です。';");
 const old="  else if(c.kind==='simplify'){say='一言でも大丈夫です。';const f=localTurnSupport('fallback',previous);words=f.words.slice(0,2);starter=f.starter;}\n";
 if(s.split(old).length!==2)throw new Error('Old generic fallback anchor missing');s=s.replace(old,'');
}
if(!s.includes("from './nhkTeacherChoice'")){
 s="import {singleChoiceQuestion} from './nhkTeacherChoice';\n"+s;
 const old="const say=clean(r.say),parts=say.split";
 if(s.split(old).length!==2)throw new Error('Choice validator anchor missing');
 s=s.replace(old,"const say=singleChoiceQuestion(clean(r.say),r.words as string[]),parts=say.split");
 s=s.replace("'Scaffold only the next small gap:","'For a binary choice use exactly one question, for example ニュースで、学校で、どちらですか。 NOT ニュースで？学校で？. Do not split alternatives into two question marks.',\n    'Scaffold only the next small gap:");
}
writeFileSync(p,s);
p='scripts/nhk-teacher-live.mjs';s=readFileSync(p,'utf8');
if(!s.includes('simplification must provide'))s=s.replace("report.sameThreadSimplification=true;", "assert.ok(/ニュース|学校|聞き/.test(simpler.say),'simplification must provide a same-question foothold, not generic reassurance');assert.ok(simpler.planned.words.length||simpler.planned.example,'Simplification lost usable cues');report.sameThreadSimplification=true;");
if(!s.includes('plannerDiagnostics')){
 s=s.replace("frames:[],speeds:[],renewals:0", "frames:[],speeds:[],renewals:0,drafts:[]");
 s=s.replace("c.event=e=>{if(e.type==='session.updated'", "c.event=e=>{if(e.type==='response.done'&&e.response?.metadata?.purpose==='nhk-gentle-teacher-v1')state.drafts.push({status:e.response.status,details:e.response.status_details,metadata:e.response.metadata,output:e.response.output});if(e.type==='session.updated'");
 s=s.replace('report.validatedModelTurns=report.replies.filter', 'report.plannerDiagnostics=await page.evaluate(()=>window.__state.drafts);report.validatedModelTurns=report.replies.filter');
}
writeFileSync(p,s);
console.log('Concrete current-question rescue; exact two alternatives canonicalized to one question before strict validation.');
