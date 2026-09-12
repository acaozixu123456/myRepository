import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=process.cwd(),port=43129;
const child=spawn(process.execPath,['local/codex-bridge/server.mjs'],{cwd:root,env:{...process.env,HITOKOTO_CODEX_PORT:String(port),HITOKOTO_CODEX_FAKE:path.join(root,'local/codex-bridge/fake-codex.mjs'),HITOKOTO_UPSTREAM:'http://127.0.0.1:9'},stdio:['ignore','pipe','pipe']});
const wait=async()=>{for(let i=0;i<40;i++){try{const r=await fetch(`http://127.0.0.1:${port}/__hitokoto_codex/status?refresh=1`);if(r.ok)return r.json();}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('bridge did not start');};
try{
 const status=await wait();assert.equal(status.ok,true);assert.equal(status.accountPresent,true);assert.equal(status.apiFallback,false);assert.equal(status.rateLimits.primary.usedPercent,12);
 const start=await fetch(`http://127.0.0.1:${port}/api/nhk-speech`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'companion_start',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n',seed:{title:'测试',opening:'こんばんは。',context:''},policy:{target:0}})}).then(r=>r.json());assert.equal(start.ok,true);assert.equal(start.channel,'codex-subscription');assert.match(start.callId,/^rtc_codex_/);assert.equal(typeof start.sdp,'string');
 const feedback=await fetch(`http://127.0.0.1:${port}/api/nhk-speech`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'companion_feedback',callId:start.callId,token:start.token,input:{mode:'help',source:'分かりません',context:[],target:0}})}).then(r=>r.json());assert.equal(feedback.ok,true);assert.equal(feedback.note.suggestion,'もう一度お願いします。');
 const stop=await fetch(`http://127.0.0.1:${port}/api/nhk-speech`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'companion_stop',callId:start.callId,token:start.token})}).then(r=>r.json());assert.equal(stop.ok,true);
 console.log(JSON.stringify({ok:true,status:'chatgpt-ready',noApiFallback:true,realtimeBootstrap:true,textTeacher:true}));
}finally{child.kill('SIGINT');}
