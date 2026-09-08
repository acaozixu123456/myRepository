import {readFileSync,writeFileSync} from 'node:fs';
const path='src/nhkChatConnection.test.ts';let s=readFileSync(path,'utf8');
if(!s.includes('support response isolation')){
s+=`
// Optional hint responses must never hijack the microphone state machine.
describe('support response isolation',()=>{
 const hints=()=>dc.send.mock.calls.map((v:any)=>JSON.parse(v[0])).filter((e:any)=>e.response?.metadata?.purpose==='nhk-turn-support-v1');
 const sendHint=(req:any,id='h1')=>{const metadata=req.response.metadata;emit({type:'response.created',response:{id,metadata}});emit({type:'response.done',response:{id,metadata,status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({turnKey:metadata.turnKey,words:['好き','苦手'],starter:'私は…',example:'猫が好きです。'})}]}]}});};
 it('text completion neither starts nor stops the voice turn',async()=>{hooks.support=vi.fn();await c.start();reply();sendHint(hints().at(-1));expect(hooks.support.mock.calls.at(-1)[0].origin).toBe('model');expect(hooks.phase).toHaveBeenLastCalledWith('listening');expect(track.enabled).toBe(true);expect(hooks.heard).not.toHaveBeenCalled();});
 it('sidecar creation before voice completion cannot take its response id',async()=>{hooks.support=vi.fn();await c.start();emit({type:'response.created',response:{id:'voice'}});emit({type:'response.output_audio_transcript.done',response_id:'voice',transcript:'好きですか。'});sendHint(hints().at(-1));expect(track.enabled).toBe(false);emit({type:'response.done',response:{id:'voice',status:'completed'}});emit({type:'output_audio_buffer.stopped',response_id:'voice'});expect(track.enabled).toBe(true);expect(hooks.error).not.toHaveBeenCalled();});
 it('hint failure is optional; microphone continues listening',async()=>{hooks.support=vi.fn();await c.start();reply();const req=hints().at(-1);emit({type:'error',error:{event_id:req.event_id,code:'server_error'}});expect(track.enabled).toBe(true);expect(hooks.error).not.toHaveBeenCalled();});
 it('hiding hints prevents text calls while main audio still works',async()=>{hooks.support=vi.fn();c.setSupportEnabled(false);await c.start();reply();expect(hints()).toHaveLength(0);expect(track.enabled).toBe(true);});
 it('helper audio is bound to the current visible optional example',async()=>{hooks.support=vi.fn();await c.start();reply();sendHint(hints().at(-1));c.help();const req=JSON.parse(dc.send.mock.calls.at(-1)[0]);expect(req.response.output_modalities).toEqual(['audio']);expect(req.response.instructions).toContain('猫が好きです。');expect(req.response.instructions).toContain('actual belief');});
 it('ending ignores pending hint callbacks and releases the microphone',async()=>{hooks.support=vi.fn();await c.start();reply();const req=hints().at(-1);c.end();sendHint(req);expect(track.stop).toHaveBeenCalledTimes(1);expect(hooks.phase).toHaveBeenLastCalledWith('done');});
});
`;
writeFileSync(path,s);}
