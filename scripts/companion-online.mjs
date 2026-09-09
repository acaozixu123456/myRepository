import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
// Exact independent branch alias supplied by Vercel's PR comment. No bypass token or admin change.
const base='https://nihongo-discovery-v2-202608-git-30bf70-acaozixu123456s-projects.vercel.app';
const report={base,path:'/companion.html',access:'NOT_CHECKED',exactAssets:false,proxyHealth:null};
try{
 const expectedHtml=await readFile('dist/companion.html','utf8');const assets=[...expectedHtml.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1]);
 for(let i=0;i<12;i++){
  const page=await fetch(base+'/companion.html',{redirect:'manual',signal:AbortSignal.timeout(15000)});report.httpStatus=page.status;
  if([401,403,302,307,308].includes(page.status)){report.access='PROTECTED_OR_REDIRECTED';report.note='No attempt was made to bypass deployment authentication. User may need their own Vercel login.';break;}
  const html=await page.text();
  if(page.ok&&assets.every(a=>html.includes(a))){for(const asset of assets){const actual=await fetch(base+asset,{signal:AbortSignal.timeout(15000)});assert.equal(actual.status,200);const bytes=Buffer.from(await actual.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),createHash('sha256').update(await readFile('dist'+asset)).digest('hex'));}report.access='PUBLIC';report.exactAssets=true;break;}
  if(i<11)await new Promise(r=>setTimeout(r,5000));
 }
 if(report.access==='PUBLIC'){
  const r=await fetch(base+'/api/nhk-speech',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'companion_health'}),signal:AbortSignal.timeout(25000)});const data=await r.json();report.proxyHealth={status:r.status,data};assert.equal(r.status,200);assert.equal(data.contract,'nihongo-companion-v3');
 }
 console.log('PREVIEW_ACCESS',JSON.stringify(report));
 if(report.access==='NOT_CHECKED')throw new Error('Reviewed preview assets have not converged');
}finally{await writeFile('artifacts/companion-phone/online.json',JSON.stringify(report,null,2));}
