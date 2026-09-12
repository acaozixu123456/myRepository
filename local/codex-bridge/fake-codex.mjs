#!/usr/bin/env node
import readline from 'node:readline';
const rl=readline.createInterface({input:process.stdin});let seq=0;
const out=o=>process.stdout.write(JSON.stringify(o)+'\n');
const result=(id,r={})=>out({id,result:r});
rl.on('line',line=>{let m;try{m=JSON.parse(line);}catch{return;}if(!m.id)return;const id=m.id,p=m.params||{};
 if(m.method==='initialize')return result(id,{userAgent:'fake-codex',codexHome:'/tmp/fake',platformFamily:'unix',platformOs:'linux'});
 if(m.method==='account/read')return result(id,{account:{type:'chatgpt'},requiresOpenaiAuth:false});
 if(m.method==='account/rateLimits/read')return result(id,{rateLimits:{planType:'pro',primary:{usedPercent:12,windowDurationMins:300,resetsAt:4102444800},secondary:null,rateLimitReachedType:null}});
 if(m.method==='thread/start')return result(id,{thread:{id:'thr_'+(++seq)}});
 if(m.method==='thread/realtime/start'){result(id,{});setTimeout(()=>out({method:'thread/realtime/started',params:{threadId:p.threadId,realtimeSessionId:'rt_fake'}}),5);setTimeout(()=>out({method:'thread/realtime/sdp',params:{threadId:p.threadId,sdp:'v=0\r\no=fake 0 0 IN IP4 127.0.0.1\r\n'}}),10);return;}
 if(['thread/realtime/appendSpeech','thread/realtime/appendText','thread/realtime/stop'].includes(m.method))return result(id,{});
 if(m.method==='turn/start'){result(id,{turn:{id:'turn_'+(++seq),status:'inProgress'}});const prompt=p.input?.[0]?.text||'';let answer='{}';if(prompt.includes('kind one of'))answer=JSON.stringify({kind:'wording',certainty:'clear',meaningPreserved:true,suggestion:'もう一度お願いします。',reasonZh:'可以借用这句继续表达。',detailZh:''});else if(prompt.includes('focus,scene,cueZh'))answer=JSON.stringify({focus:'〜てもらえますか',scene:'会议前确认',cueZh:'请对方再确认一个细节',keyword:'確認',starter:'もう一度、',exampleJa:'もう一度確認してもらえますか。'});else if(prompt.includes('verdict communicated'))answer=JSON.stringify({verdict:'communicated',focusUsed:true,feedbackZh:'意思已经传达。',suggestionJa:''});else if(prompt.includes('original exactly'))answer=JSON.stringify({original:'確認',reading:'かくにん',dictionaryForm:'確認する',meaningZh:'确认',explanationZh:'表示确认内容。',status:'usable',points:[{part:'確認',noteZh:'名词，也可接する。'}],examples:[{ja:'確認します。',zh:'我确认一下。'}],questionZh:''});else if(prompt.includes('learner-defined'))answer=JSON.stringify({title:'会议确认',opening:'会議の前に、何を確認したいですか。',context:'练习会议前确认事项。',phrase:'確認したいです',meaningZh:'想确认'});
 setTimeout(()=>out({method:'item/completed',params:{threadId:p.threadId,turnId:'turn_x',item:{type:'agentMessage',phase:'final_answer',text:answer}}}),5);setTimeout(()=>out({method:'turn/completed',params:{threadId:p.threadId,turn:{id:'turn_x',status:'completed'}}}),10);return;}
 result(id,{});
});
