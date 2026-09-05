import {afterEach,it,expect,vi} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import * as ts from 'typescript';
import type {VercelRequest,VercelResponse} from '@vercel/node';
import handler,{validProxySentenceRequest} from '../api/nhk-sentence';
import {validSentenceRequest} from './nhkSentenceAnalysis';

const valid={title:'test',sentence:'図書館を利用できます。',sentenceIndex:19,before:[],after:[]};
function response() {
  const state:{code:number;body:unknown}={code:0,body:null};
  const res={setHeader:vi.fn(),status(n:number){state.code=n;return res;},json(v:unknown){state.body=v;return res;}};
  return {state,res:res as unknown as VercelResponse};
}
const request=(body:unknown,method='POST')=>({body,method,headers:{'x-forwarded-for':'127.0.0.1','user-agent':'test'}} as unknown as VercelRequest);
afterEach(()=>vi.unstubAllGlobals());

it('serverless entry boots as standalone Node ESM without a frontend bundler',()=>{
  const dir=mkdtempSync(join(tmpdir(),'nhk-proxy-'));
  try {
    const source=readFileSync('api/nhk-sentence.ts','utf8');
    const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    const file=join(dir,'entry.mjs');writeFileSync(file,code);
    execFileSync(process.execPath,['--input-type=module','-e',`const m=await import(${JSON.stringify(pathToFileURL(file).href)}); if(typeof m.default!=='function') process.exit(1);`],{timeout:10000,stdio:'pipe'});
  } finally {rmSync(dir,{recursive:true,force:true});}
});
it('proxy validation agrees with the frontend without importing its runtime module',()=>{
  const cases=[valid,null,[],{},'{bad', {...valid,sentence:'日'.repeat(8000)}, {...valid,sentence:'日'.repeat(8001)}, {...valid,sentence:' '}, {...valid,title:'日'.repeat(301)}, {...valid,sentenceIndex:-1}, {...valid,sentenceIndex:1.2}, {...valid,sentenceIndex:10001}, {...valid,before:['a','b','c']}, {...valid,after:[1]}, {...valid,after:['日'.repeat(8001)]}];
  for(const value of cases)expect(validProxySentenceRequest(value)).toBe(validSentenceRequest(value));
});
it('invalid requests and unsupported methods cannot call the paid backend',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  for(const [body,method,status] of [[valid,'GET',405],['{bad','POST',400],[{...valid,sentence:'日'.repeat(8001)},'POST',400]] as const) {
    const {state,res}=response();await handler(request(body,method),res);expect(state.code).toBe(status);
  }
  expect(fetcher).not.toHaveBeenCalled();
});
it('proxy forwards the exact selected source and preserves the backend status',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true,cached:true}),{status:200}));vi.stubGlobal('fetch',fetcher);
  const {state,res}=response();await handler(request({...valid,clientKey:'untrusted-client'}),res);
  expect(state.code).toBe(200);expect(state.body).toEqual({ok:true,cached:true});
  const forwarded=JSON.parse(fetcher.mock.calls[0][1].body);expect(forwarded.sentence).toBe(valid.sentence);expect(forwarded.sentenceIndex).toBe(19);expect(forwarded.clientKey).not.toBe('untrusted-client');
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ok:false,reason:'client_quota'}),{status:429}));
  const quota=response();await handler(request(valid),quota.res);expect(quota.state.code).toBe(429);
});
it('unexpected backend text returns explicit JSON failure instead of a false success',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('upstream unavailable',{status:500})));
  const {state,res}=response();await handler(request(valid),res);expect(state.code).toBe(502);expect(state.body).toEqual({ok:false,reason:'sentence_coach_unavailable'});
});
