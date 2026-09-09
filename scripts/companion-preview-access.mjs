import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='https://nihongo-discovery-v2-202608-git-30bf70-acaozixu123456s-projects.vercel.app';
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={scope:'UNAUTHENTICATED_PREVIEW_ASSET_AND_PROXY_CHECK_NO_VOICE_CALL_NO_AUTH_BYPASS',url:base+'/companion.html',source:process.env.GITHUB_SHA,status:'NOT_RUN',attempts:[],assets:[]};
await mkdir('artifacts/companion-access',{recursive:true});
try{
 const html=await readFile('dist/companion.html','utf8');const paths=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1]);
 for(let i=0;i<10;i++){
  const r=await fetch(report.url,{redirect:'manual',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
  if([401,403].includes(r.status)||(r.status>=300&&r.status<400)) {report.status='ACCESS_REQUIRES_OWNER_AUTH';report.httpStatus=r.status;break;}
  if(r.status!==200){report.status='PREVIEW_UNAVAILABLE';report.httpStatus=r.status;break;}
  const actual=await r.text();if(!paths.every(p=>actual.includes(p))){report.attempts.push('deployment not yet serving this candidate');await new Promise(resolve=>setTimeout(resolve,8000));continue;}
  for(const path of paths){const asset=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});if(asset.status!==200)throw new Error('Preview asset unavailable');const actualHash=sha(Buffer.from(await asset.arrayBuffer()));const expectedHash=sha(await readFile('dist'+path));if(actualHash!==expectedHash)throw new Error('Preview asset differs from reviewed source');report.assets.push({path,sha256:actualHash});}
  const health=await fetch(base+'/api/nhk-speech',{method:'POST',redirect:'manual',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'companion_health'}),signal:AbortSignal.timeout(25000)});
  report.healthStatus=health.status;report.health=await health.json().catch(()=>({ok:false}));report.status=health.ok&&report.health.ok&&report.health.mode==='native-stateful-audio'?'PASS':'PROXY_NOT_READY';break;
 }
 if(report.status==='NOT_RUN')report.status='DEPLOYMENT_NOT_CONVERGED';
 if(report.status!=='PASS')process.exitCode=1;
}catch(e){report.status='CHECK_FAILED';report.error=e.message;process.exitCode=1;}
finally{await writeFile('artifacts/companion-access/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
