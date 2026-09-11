import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
const out='artifacts/immersion-gate';
await mkdir(out,{recursive:true});
const report={ok:false,scope:'SOURCE_TESTS_REAL_BROWSER_UI_MOCKED_PROVIDER_NO_PHYSICAL_IPHONE',automatedSourceEdits:false,checks:[],completedAt:null};
const checks=[
 ['typecheck','npm',['run','typecheck']],
 ['tests','npm',['test']],
 ['build','npm',['run','build']],
 ['native-mic','node',['scripts/companion-phone.mjs']],
 ['five-width-notes','node',['scripts/hitokoto-neon-phone.mjs']],
 ['teacher02','node',['scripts/teacher-v2-phone.mjs']],
 ['selection-and-themes','node',['scripts/immersion/browser.mjs']],
];
async function run(name,command,args){
 const started=Date.now(),log=createWriteStream(`${out}/${name}.log`);
 const child=spawn(command,args,{stdio:['ignore','pipe','pipe'],env:process.env});
 child.stdout.on('data',chunk=>log.write(chunk));child.stderr.on('data',chunk=>log.write(chunk));
 let timeout=false;const timer=setTimeout(()=>{timeout=true;child.kill('SIGTERM');},300000);
 const exit=await new Promise(resolve=>{child.on('error',error=>{log.write(error.message);resolve(-1);});child.on('close',code=>resolve(code));});
 clearTimeout(timer);await new Promise(resolve=>log.end(resolve));
 const check={name,exitCode:exit,timeout,ok:exit===0&&!timeout,milliseconds:Date.now()-started};report.checks.push(check);console.log('ACCEPTANCE_CHECK',JSON.stringify(check));return check.ok;
}
try{
 for(const [name,command,args] of checks){if(!await run(name,command,args))throw new Error(`Acceptance failed: ${name}; inspect ${out}/${name}.log and screenshots. No production change.`);}
 report.ok=true;
}catch(error){report.failure=error.message;process.exitCode=1;}
finally{report.completedAt=new Date().toISOString();await writeFile(`${out}/status.json`,JSON.stringify(report,null,2));console.log('IMMERSION_ACCEPTANCE',JSON.stringify(report));}
