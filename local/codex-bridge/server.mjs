#!/usr/bin/env node
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const PORT=Number(process.env.HITOKOTO_CODEX_PORT||43127);
const HOST='127.0.0.1';
const UPSTREAM=process.env.HITOKOTO_UPSTREAM||'https://nihongo-discovery-v2-20260831.vercel.app';
const BRIDGE_VERSION='codex-bridge-20260912-a1';
const CONTRACT='nihongo-companion-v3';
const MAX_BODY=120000;
const WORKDIR=path.join(os.homedir(),'.hitokoto-codex-bridge','empty-workspace');
mkdirSync(WORKDIR,{recursive:true});

const json=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));};
const text=(res,status,body,type='text/plain; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const bounded=(v,n)=>typeof v==='string'?v.slice(0,n):'';
const sha=s=>createHash('sha256').update(String(s)).digest('hex').slice(0,24);

function locateCodex(){
 if(process.env.HITOKOTO_CODEX_FAKE)return{cmd:process.execPath,args:[process.env.HITOKOTO_CODEX_FAKE]};
 if(process.env.CODEX_BIN)return{cmd:process.env.CODEX_BIN,args:['app-server','--listen','stdio://']};
 const which=process.platform==='win32'?'where':'which';
 const probe=spawnSync(which,['codex'],{encoding:'utf8'});const first=probe.status===0?String(probe.stdout).split(/\r?\n/).find(Boolean):'';
 const candidates=[first,
  process.platform==='darwin'?'/Applications/Codex.app/Contents/Resources/codex':'',
  process.platform==='darwin'?'/Applications/ChatGPT.app/Contents/Resources/codex':'',
  path.join(os.homedir(),'.codex','packages','standalone','current',process.platform==='win32'?'codex.exe':'codex')
 ].filter(Boolean);
 for(const cmd of candidates){const p=spawnSync(cmd,['--version'],{stdio:'ignore'});if(p.status===0)return{cmd,args:['app-server','--listen','stdio://']};}
 throw new Error('codex_not_found');
}

class CodexRpc{
 constructor(){this.child=null;this.seq=0;this.pending=new Map();this.waiters=[];this.listeners=new Set();this.stderr=[];this.ready=false;}
 async start(){
  if(this.ready)return;
  const found=locateCodex();
  this.child=spawn(found.cmd,found.args,{stdio:['pipe','pipe','pipe'],cwd:WORKDIR,env:{...process.env,HITOKOTO_CODEX_BRIDGE:'1'}});
  this.child.on('exit',(code,signal)=>{const err=new Error(`codex_app_server_exit:${code??''}:${signal??''}`);for(const p of this.pending.values())p.reject(err);this.pending.clear();this.ready=false;});
  readline.createInterface({input:this.child.stdout}).on('line',line=>this.onLine(line));
  readline.createInterface({input:this.child.stderr}).on('line',line=>{this.stderr.push(line.slice(0,2000));this.stderr=this.stderr.slice(-30);});
  await this.request('initialize',{clientInfo:{name:'hitokoto_codex_bridge',title:'HITOKOTO Local Codex Bridge',version:BRIDGE_VERSION},capabilities:{experimentalApi:true}},15000);
  this.notify('initialized');this.ready=true;
 }
 onLine(line){
  let m;try{m=JSON.parse(line);}catch{return;}
  if(m&&Object.prototype.hasOwnProperty.call(m,'id')&&(m.result!==undefined||m.error!==undefined)){
   const p=this.pending.get(String(m.id));if(!p)return;this.pending.delete(String(m.id));if(m.error)p.reject(new Error(`codex_rpc:${m.error.code||''}:${m.error.message||'error'}`));else p.resolve(m.result);return;
  }
  if(!m?.method)return;
  for(const fn of this.listeners)try{fn(m);}catch{}
  const keep=[];for(const w of this.waiters){if(w.method===m.method&&(!w.filter||w.filter(m.params||{}))){clearTimeout(w.timer);w.resolve(m.params||{});}else keep.push(w);}this.waiters=keep;
 }
 send(obj){if(!this.child?.stdin?.writable)throw new Error('codex_not_running');this.child.stdin.write(JSON.stringify(obj)+'\n');}
 notify(method,params){this.send({method,...(params===undefined?{}:{params})});}
 request(method,params,timeout=30000){
  const id=String(++this.seq);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`codex_timeout:${method}`));},timeout);this.pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});this.send({id,method,...(params===undefined?{}:{params})});});
 }
 wait(method,filter,timeout=30000){return new Promise((resolve,reject)=>{const w={method,filter,resolve,timer:null};w.timer=setTimeout(()=>{this.waiters=this.waiters.filter(x=>x!==w);reject(new Error(`codex_notification_timeout:${method}`));},timeout);this.waiters.push(w);});}
 on(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 async account(){await this.start();return this.request('account/read',{refreshToken:false},10000);}
 async limits(){await this.start();return this.request('account/rateLimits/read',undefined,12000).catch(()=>null);}
 async newThread(){
  await this.start();const r=await this.request('thread/start',{cwd:WORKDIR,approvalPolicy:'never',sandbox:'readOnly',ephemeral:true},20000);const id=r?.thread?.id;if(typeof id!=='string'||!id)throw new Error('codex_thread_missing');return id;
 }
 async startRealtime({sdp,prompt,opening}){
  const threadId=await this.newThread();
  const sdpWait=this.wait('thread/realtime/sdp',p=>p.threadId===threadId,40000);const startedWait=this.wait('thread/realtime/started',p=>p.threadId===threadId,40000).catch(()=>null);
  await this.request('thread/realtime/start',{threadId,clientManagedHandoffs:true,delegationAckFiller:false,outputModality:'audio',includeStartupContext:false,realtimeStartInstructions:prompt,prompt,transport:{type:'webrtc',sdp},version:'v3',voice:'marin'},40000);
  const answer=await sdpWait;const started=await startedWait;
  if(opening)await this.request('thread/realtime/appendSpeech',{threadId,text:opening},15000).catch(()=>{});
  return{threadId,sdp:answer.sdp,realtimeSessionId:started?.realtimeSessionId||null};
 }
 async stopRealtime(threadId){return this.request('thread/realtime/stop',{threadId},10000).catch(()=>({}));}
 async appendText(threadId,value,role='user'){return this.request('thread/realtime/appendText',{threadId,text:value,role},15000);}
 async appendSpeech(threadId,value){return this.request('thread/realtime/appendSpeech',{threadId,text:value},15000);}
 async ask(prompt,{timeout=60000}={}){
  const threadId=await this.newThread();let final='';let turnId='';
  const off=this.on(m=>{if(m.method==='item/completed'&&m.params?.threadId===threadId&&m.params?.item?.type==='agentMessage'){const t=m.params.item.text;if(typeof t==='string'&&t.trim())final=t;}if(m.method==='turn/started'&&m.params?.threadId===threadId)turnId=m.params?.turn?.id||turnId;});
  try{
   const done=this.wait('turn/completed',p=>p.threadId===threadId,timeout);
   await this.request('turn/start',{threadId,input:[{type:'text',text:prompt,text_elements:[]}]},20000);
   const completed=await done;if(completed?.turn?.status!=='completed')throw new Error('codex_turn_failed');if(!final.trim())throw new Error('codex_empty_answer');return final.trim();
  }finally{off();}
 }
}

const rpc=new CodexRpc();
const sessions=new Map();
const statusCache={at:0,value:null};
function teacherPrompt(seed,policy){
 const opening=bounded(seed?.opening,180),title=bounded(seed?.title,80),ctx=bounded(seed?.context,1400),target=Number.isInteger(policy?.target)?policy.target:0;
 return `You are HITOKOTO, a Japanese conversation partner and teacher for one Chinese adult learner. This is language practice, never a coding task. Never use tools, shell commands, files, web search or programming. Speak natural standard Japanese with calm adult Tokyo-style pronunciation. First understand the learner's meaning; keep ordinary replies to one or two short clauses unless they explicitly ask for an explanation. Chinese questions about Japanese meaning/grammar should be answered briefly in Chinese plus one Japanese example. Do not invent personal facts. Accept short answers. Do not force a question every turn. If the learner self-corrects, use the latest meaning. Current support target ${target}/3. Topic title: ${JSON.stringify(title)}. Opening: ${JSON.stringify(opening)}. Context data: ${JSON.stringify(ctx)}.`;
}
function verifySession(body){const s=sessions.get(String(body.callId||''));if(!s||s.token!==body.token||s.expiresAt<Date.now())throw new Error('session_closed');return s;}
function parseObject(text){const clean=String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim();try{return JSON.parse(clean);}catch{const a=clean.indexOf('{'),b=clean.lastIndexOf('}');if(a>=0&&b>a)return JSON.parse(clean.slice(a,b+1));throw new Error('invalid_json');}}
async function codexJson(instruction,data){
 const prompt=`You are a Japanese teacher inside HITOKOTO. Do not use tools. Return ONLY one valid JSON object, no markdown. ${instruction}\nUNTRUSTED INPUT DATA:\n${JSON.stringify(data).slice(0,18000)}`;
 return parseObject(await rpc.ask(prompt));
}
async function bridgeStatus(force=false){
 if(!force&&statusCache.value&&Date.now()-statusCache.at<5000)return statusCache.value;
 try{const account=await rpc.account();const limits=await rpc.limits();const value={ok:true,bridge:BRIDGE_VERSION,codex:true,accountPresent:!!account?.account,requiresOpenaiAuth:!!account?.requiresOpenaiAuth,accountType:account?.account?.type||null,planType:limits?.rateLimits?.planType||null,rateLimits:limits?.rateLimits||null,apiFallback:false};statusCache.at=Date.now();statusCache.value=value;return value;}catch(e){const value={ok:false,bridge:BRIDGE_VERSION,codex:false,reason:String(e?.message||e),apiFallback:false,stderr:rpc.stderr.slice(-3)};statusCache.at=Date.now();statusCache.value=value;return value;}
}

async function readBody(req){let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>MAX_BODY)throw new Error('too_large');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
async function companion(body){
 const action=String(body.action||'').replace(/^companion_/,'');
 if(action==='health')return{ok:true,...await bridgeStatus(true),contract:CONTRACT,model:'codex-subscription-realtime',mode:'local-codex-app-server'};
 if(action==='start'){
  const st=await bridgeStatus(true);if(!st.ok||!st.accountPresent||st.requiresOpenaiAuth)throw new Error('codex_login_required');
  if(typeof body.sdp!=='string'||!body.sdp.startsWith('v=0'))throw new Error('invalid_input');
  const started=await rpc.startRealtime({sdp:body.sdp,prompt:teacherPrompt(body.seed,body.policy),opening:body.seed?.opening});const callId='rtc_codex_'+randomUUID().replaceAll('-','');const token=randomBytes(24).toString('hex'),expiresAt=Date.now()+90*60_000;
  const s={callId,token,expiresAt,threadId:started.threadId,realtimeSessionId:started.realtimeSessionId};sessions.set(callId,s);return{ok:true,contract:CONTRACT,model:'gpt-realtime-2.1',channel:'codex-subscription',sdp:started.sdp,callId,token,expiresAt};
 }
 if(action==='heartbeat'){const s=verifySession(body);s.expiresAt=Date.now()+90*60_000;return{ok:true,expiresAt:s.expiresAt,channel:'codex-subscription'};}
 if(action==='stop'){const s=verifySession(body);await rpc.stopRealtime(s.threadId);sessions.delete(s.callId);return{ok:true};}
 if(action==='observe'){verifySession(body);return{ok:true,observations:[]};}
 if(action==='topics')return{ok:true,topics:[]};
 if(action==='feedback'){
  verifySession(body);const input=body.input||{};const mode=input.mode;
  const schema='Fields: kind one of none/correction/extension/wording/explanation; certainty clear/uncertain; meaningPreserved boolean; suggestion Japanese <=140 chars; reasonZh Chinese <=130; detailZh Chinese <=360. For a natural utterance choose kind none. For help give wording, for a language question give explanation. Do not invent facts. If kind is not none, suggestion must be natural Japanese except explanation may use an example. Preserve exact intent.';
  const r=await codexJson(schema,input);if(r.kind==='none'||r.certainty!=='clear'||r.meaningPreserved!==true)return{ok:true,note:null,model:'codex-subscription',disposition:'not_needed'};return{ok:true,note:{...r,source:input.source},model:'codex-subscription',disposition:'shown'};
 }
 if(action==='lesson'){
  verifySession(body);const input=body.input||{};
  if(input.task==='prepare'){
   const r=await codexJson('Create ONE optional 15-second speaking exercise. Return fields focus,scene,cueZh,keyword,starter,exampleJa. Keep the same target expression, with keyword and starter not revealing the full answer. Natural adult Japanese.',input);return{ok:true,lesson:{id:input.requestId,subject:input.subject,focus:bounded(r.focus,80),scene:bounded(r.scene,120),cueZh:bounded(r.cueZh,180),keyword:bounded(r.keyword,55),starter:bounded(r.starter,90),exampleJa:bounded(r.exampleJa,160),signature:'codex-local'},model:'codex-subscription'};
  }
  const r=await codexJson('Assess the Japanese attempt for meaning. Return verdict communicated/revise/uncertain, focusUsed boolean, feedbackZh concise Chinese, suggestionJa minimal corrected Japanese or empty. Do not score pronunciation.',input);return{ok:true,assessment:{verdict:r.verdict,focusUsed:!!r.focusUsed,feedbackZh:bounded(r.feedbackZh,240),suggestionJa:bounded(r.suggestionJa,200)},requestId:input.requestId,model:'codex-subscription'};
 }
 if(action==='demo'||action==='study_demo')throw new Error('codex_demo_not_available');
 if(action==='study_session'){const id=randomUUID(),expiresAt=Date.now()+30*60_000;return{ok:true,ticket:{id,expiresAt,token:sha(id+expiresAt)}};}
 if(action==='study'){
  const input=body.input||{},focus=input.focus||{};const r=await codexJson('Explain selected Japanese in context. Return original exactly selectedText, reading, dictionaryForm, meaningZh, explanationZh, status usable/needs_context/possible_issue, points array of {part,noteZh}, examples array {ja,zh}, questionZh. Max 3 points/examples.',input);return{ok:true,result:r,requestId:input.requestId,revision:focus.revision,model:'codex-subscription'};
 }
 if(action==='study_lesson'){
  const input=body.input||{};if(input.task==='prepare'){const r=await codexJson('Create one short speaking exercise. Return focus,scene,cueZh,keyword,starter,exampleJa.',input);return{ok:true,lesson:{id:input.requestId,subject:input.subject,focus:r.focus,scene:r.scene,cueZh:r.cueZh,keyword:r.keyword,starter:r.starter,exampleJa:r.exampleJa,signature:'codex-local'},model:'codex-subscription'};}
  const r=await codexJson('Assess attempt. Return verdict communicated/revise/uncertain, focusUsed boolean, feedbackZh, suggestionJa.',input);return{ok:true,assessment:r,requestId:input.requestId,model:'codex-subscription'};
 }
 if(action==='custom_topic'){
  const input=body.input||{};const r=await codexJson('Create a learner-defined Japanese topic. Return title Chinese <=40, opening natural Japanese <=120, context Chinese <=1000, phrase Japanese <=100, meaningZh Chinese <=180. Preserve the requested topic and negation.',input);const seed={id:'custom_'+input.requestId,lane:input.register==='business'?'work':'mix',title:r.title,opening:r.opening,context:r.context,angle:'user-chosen',sources:[],expiresAt:Date.now()+86400000,origin:{kind:'user',brief:input.text,difficulty:input.difficulty,register:input.register,entryMode:input.entryMode}};return{ok:true,seed,subject:{phrase:r.phrase,meaningZh:r.meaningZh,kind:'explanation'},requestId:input.requestId,model:'codex-subscription'};
 }
 throw new Error('codex_action_not_implemented');
}

async function proxy(req,res){
 const target=new URL(req.url,UPSTREAM);const headers={};for(const[k,v]of Object.entries(req.headers))if(v&& !['host','content-length','connection','accept-encoding'].includes(k.toLowerCase()))headers[k]=v;
 const init={method:req.method,headers,redirect:'manual'};if(!['GET','HEAD'].includes(req.method)){const chunks=[];for await(const c of req)chunks.push(c);init.body=Buffer.concat(chunks);}
 const r=await fetch(target,init);const out={};r.headers.forEach((v,k)=>{if(!['content-encoding','transfer-encoding','content-length','content-security-policy'].includes(k.toLowerCase()))out[k]=v;});out['cache-control']='no-store';res.writeHead(r.status,out);if(req.method==='HEAD'){res.end();return;}const buf=Buffer.from(await r.arrayBuffer());res.end(buf);
}

const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,`http://${HOST}:${PORT}`);
  if(url.pathname==='/__hitokoto_codex/status'&&req.method==='GET')return json(res,200,await bridgeStatus(url.searchParams.get('refresh')==='1'));
  if(url.pathname==='/__hitokoto_codex/usage'&&req.method==='GET')return json(res,200,{ok:true,limits:await rpc.limits()});
  if(url.pathname==='/sw.js')return text(res,200,"self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));",'text/javascript; charset=utf-8');
  if(url.pathname==='/api/nhk-speech'&&req.method==='POST'){
   const body=await readBody(req);try{return json(res,200,await companion(body));}catch(e){const reason=String(e?.message||e).replace(/^Error:\s*/,''),status=/invalid/.test(reason)?400:/login/.test(reason)?401:/session_closed/.test(reason)?409:503;return json(res,status,{ok:false,reason,channel:'codex-subscription',apiFallback:false});}
  }
  return await proxy(req,res);
 }catch(e){return json(res,502,{ok:false,reason:'bridge_proxy_error',detail:String(e?.message||e).slice(0,240)});}
});
server.listen(PORT,HOST,async()=>{
 console.log(`HITOKOTO Codex Bridge ${BRIDGE_VERSION}`);
 console.log(`Open: http://${HOST}:${PORT}/`);
 console.log('API fallback: OFF');
 try{const s=await bridgeStatus(true);console.log(s.ok&&s.accountPresent&&!s.requiresOpenaiAuth?'Codex ChatGPT account: ready':'Codex account needs attention:',s.reason||s.requiresOpenaiAuth||'unknown');}catch{}
});
process.on('SIGINT',()=>{for(const s of sessions.values())void rpc.stopRealtime(s.threadId);server.close(()=>process.exit(0));});
