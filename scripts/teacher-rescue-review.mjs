import {readFileSync,writeFileSync} from 'node:fs';
let p='src/nhkGentleTeacher.ts',s=readFileSync(p,'utf8');
if(!s.includes("from './nhkTeacherRescue'")){
 s="import {sameThreadRescue} from './nhkTeacherRescue';\n"+s;
 const before="const previous=teacherLastQuestion(c);let say='一言で大丈夫です。';";
 if(s.split(before).length!==2)throw new Error('Rescue integration anchor missing');
 s=s.replace(before,"const previous=teacherLastQuestion(c);if(c.kind==='simplify')return sameThreadRescue(previous,c.previous);let say='一言で大丈夫です。';");
 const old="  else if(c.kind==='simplify'){say='一言でも大丈夫です。';const f=localTurnSupport('fallback',previous);words=f.words.slice(0,2);starter=f.starter;}\n";
 if(s.split(old).length!==2)throw new Error('Old generic fallback anchor missing');s=s.replace(old,'');writeFileSync(p,s);
}
p='scripts/nhk-teacher-live.mjs';s=readFileSync(p,'utf8');
if(!s.includes('simplification must provide')){
 s=s.replace("report.sameThreadSimplification=true;", "assert.ok(/ニュース|学校|聞き/.test(simpler.say),'simplification must provide a same-question foothold, not generic reassurance');assert.ok(simpler.planned.words.length||simpler.planned.example,'Simplification lost usable cues');report.sameThreadSimplification=true;");writeFileSync(p,s);
}
console.log('REVISE finding fixed: failed simplification retains concrete current-question scaffolding.');
