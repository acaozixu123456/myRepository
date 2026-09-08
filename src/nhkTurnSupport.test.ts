import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {TurnSupportChannel,localTurnSupport,parseTurnSupport,turnSupportInstructions} from './nhkTurnSupport';
import {ChatExperienceStore,ChatExperienceSession,EXPERIENCE_KEY,cleanExperienceRow} from './nhkChatExperience';
import {chatInstructions,chatResponseStyle,buildChatPlan,type ChatLine} from './nhkChat';
let sent:any[],views:any[],support:TurnSupportChannel;
const context={learner:'猫の動画',source:['SNSのニュースです。']};
const payload=(key:string)=>({turnKey:key,words:['猫','旅行'],starter:'好きなのは…',example:'猫の動画が好きです。'});
function complete(req:any,id='hint'){const metadata=req.response.metadata;support.handle({type:'response.created',response:{id,metadata}});return support.handle({type:'response.done',response:{id,metadata,status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(payload(metadata.turnKey))}]}]}});}
beforeEach(()=>{vi.useFakeTimers();sent=[];views=[];support=new TurnSupportChannel({send:e=>sent.push(e),update:f=>views.push(f),spend:()=>true});});
afterEach(()=>{support.reset();vi.useRealTimers();});
describe('current-turn asynchronous scaffolding',()=>{
 it('creates no API request before an actual turn',()=>expect(sent).toEqual([]));
 it('provides small local stems and no default complete answer',()=>{const f=localTurnSupport('a','寝る前に、スマホを見ますか。');expect(f.words).toEqual(['よく…','あまり…']);expect(f.example).toBe('');});
 it('unknown questions never receive a previous topic answer',()=>{expect(localTurnSupport('a','何時に出発しますか。').words).toEqual([]);});
 it('uses isolated text-only generation and a bounded budget',()=>{support.begin('a','動画は好きですか。',context);expect(sent[0].response).toMatchObject({conversation:'none',input:[],output_modalities:['text'],max_output_tokens:280});expect(sent[0].response.instructions).toContain('CURRENT=');});
 it('deduplicates transcript-done and response-done callbacks',()=>{support.begin('a','好きですか。',context);support.begin('a','好きですか。',context);expect(sent).toHaveLength(1);});
 it('accepts a well-formed completion for the exact current request',()=>{support.begin('a','好きですか。',context);expect(complete(sent[0])).toBe(true);expect(views.at(-1).origin).toBe('model');});
 it('swallows late completions after changing topic without repainting',()=>{support.begin('a','好きですか。',context);const first=sent[0];support.begin('b','見ますか。',context);complete(first);expect(views.at(-1).key).toBe('b');expect(views.at(-1).origin).toBe('local');});
 it('same-turn hide/show has a separate request identity',()=>{support.begin('a','好きですか。',context);const first=sent[0];support.setEnabled(false);support.setEnabled(true);complete(first);expect(views.at(-1).origin).toBe('local');});
 it('late text cannot repaint while the learner is speaking',()=>{support.begin('a','好きですか。',context);const first=sent[0];support.cancelPending();complete(first);expect(views.at(-1).origin).toBe('local');});
 it('time out hides only the optional asynchronous result',async()=>{support.begin('a','好きですか。',context);const req=sent[0];await vi.advanceTimersByTimeAsync(5600);complete(req);expect(views.at(-1).origin).toBe('local');});
 it('known scaffold failures do not leak to voice error handling',()=>{support.begin('a','好きですか。',context);expect(support.handle({type:'error',error:{event_id:sent[0].event_id,code:'server_error'}})).toBe(true);expect(support.handle({type:'error',error:{code:'unrelated_voice_error'}})).toBe(false);});
 it('hiding hints suppresses new requests, not conversation',()=>{support.setEnabled(false);support.begin('a','好きですか。',context);expect(sent).toHaveLength(0);});
 it('does not interfere with main audio responses',()=>expect(support.handle({type:'response.done',response:{id:'main',metadata:{purpose:'nhk-chat-v2'},status:'completed'}})).toBe(false));
 it('rejects malformed, wrong-turn, oversized and markup hints',()=>{const f=localTurnSupport('a','好きですか。');for(const text of ['bad',JSON.stringify(payload('wrong')),JSON.stringify({...payload('a'),starter:'あ'.repeat(30)}),JSON.stringify({...payload('a'),words:['<script>あ</script>']})])expect(parseTurnSupport(text,f)).toBeNull();});
 it('bounds source and learner input and describes suggestions as optional',()=>{const s=turnSupportInstructions(localTurnSupport('a','好きですか。'),{learner:'x'.repeat(1000),source:['a'.repeat(5000)]});expect(s.length).toBeLessThan(4000);expect(s).toContain('untrusted data');expect(s).toContain('not the learner');});
});
const memory=()=>{const data=new Map<string,string>();return{data,getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};};
describe('optional local experience, not proficiency or surveillance',()=>{
 it('is off by default and does not persist anything during a session',()=>{const m=memory(),store=new ChatExperienceStore(m),s=new ChatExperienceSession(store);s.mark('permission_ready');s.mark('answer');s.finish();expect(m.data.size).toBe(0);});
 it('excludes permission wait and learner thinking from service timing',()=>{const m=memory(),store=new ChatExperienceStore(m);store.consent(true);let time=0;const s=new ChatExperienceSession(store,()=>time);time=5000;s.mark('permission_ready');time=6000;s.mark('request_sent');time=6500;s.mark('audio_started');time=20000;s.mark('answer');time=20001;s.mark('request_sent');time=21001;s.mark('audio_started');s.finish();const row=JSON.parse(store.export()).rows[0];expect(row.firstAudioWaitMs).toBe(1500);expect(row.replyWaitTotalMs).toBe(1500);expect(row.replyWaitSamples).toBe(2);});
 it('counts help then an ASR answer without inventing correctness',()=>{const store=new ChatExperienceStore(memory());store.consent(true);const s=new ChatExperienceSession(store);s.mark('help');s.mark('answer');s.finish();s.finish();const rows=JSON.parse(store.export()).rows;expect(rows).toHaveLength(1);expect(rows[0].answersAfterHelp).toBe(1);expect(rows[0]).not.toHaveProperty('accuracy');});
 it('changing topic cancels the help-to-next-answer association',()=>{const store=new ChatExperienceStore(memory());store.consent(true);const s=new ChatExperienceSession(store);s.mark('help');s.mark('shuffle');s.mark('answer');s.finish();expect(JSON.parse(store.export()).rows[0].answersAfterHelp).toBe(0);});
 it('opt-out and clearing touch only the owned key',()=>{const m=memory();m.data.set('articles','leave alone');const store=new ChatExperienceStore(m);store.consent(true);store.clear();expect(m.data.get('articles')).toBe('leave alone');expect(m.data.has(EXPERIENCE_KEY)).toBe(false);});
 it('does not resurrect data collected before opting out',()=>{const store=new ChatExperienceStore(memory());store.consent(true);const s=new ChatExperienceSession(store);s.mark('help');store.consent(false);store.consent(true);s.mark('answer');s.finish();expect(JSON.parse(store.export()).rows[0].helpUses).toBe(0);});
 it('preserves a corrupt/future store unless explicitly cleared',()=>{const m=memory();m.data.set(EXPERIENCE_KEY,'{"version":99}');const store=new ChatExperienceStore(m);store.consent(true);new ChatExperienceSession(store).finish();expect(m.data.get(EXPERIENCE_KEY)).toBe('{"version":99}');store.clear();expect(m.data.has(EXPERIENCE_KEY)).toBe(false);});
 it('limits local retention to 30 records',()=>{const store=new ChatExperienceStore(memory());store.consent(true);for(let i=0;i<40;i++){const s=new ChatExperienceSession(store);s.mark('answer');s.finish();}expect(store.count).toBe(30);});
 it('whitelists row fields rather than storing arbitrary data',()=>{const store=new ChatExperienceStore(memory());store.consent(true);new ChatExperienceSession(store).finish();const row=JSON.parse(store.export()).rows[0];const safe=cleanExperienceRow({...row,transcript:'secret',articleId:'private',audio:'raw'});expect(safe).not.toHaveProperty('transcript');expect(safe).not.toHaveProperty('articleId');expect(safe).not.toHaveProperty('audio');});
 it('does not require feedback and asks only occasionally',()=>{const store=new ChatExperienceStore(memory());store.consent(true);const first=new ChatExperienceSession(store);first.mark('answer');first.finish();expect(first.askEffort).toBe(true);first.feedback('easy');const second=new ChatExperienceSession(store);second.mark('answer');second.finish();expect(second.askEffort).toBe(false);});
});
describe('conversation, not repeated interviews',()=>{
 const history:ChatLine[]=[{role:'assistant',text:'動画は好きですか。'},{role:'user',text:'はい'},{role:'assistant',text:'猫は好きですか。'},{role:'user',text:'好きです'}];
 it('requests a reaction rather than a third question',()=>expect(chatResponseStyle(history,'はい')).toBe('acknowledge'));
 it('answers a user question directly',()=>expect(chatResponseStyle(history,'あなたは？')).toBe('answer-only'));
 it('allows a follow-up but does not require one',()=>expect(chatResponseStyle([{role:'assistant',text:'かわいいですね。'}],'はい')).toBe('followup-optional'));
 it('retains adult tone and no automatic difficulty escalation',()=>{const plan=buildChatPlan({id:'test',title:'SNS',sentences:['SNSを使います。']});const s=chatInstructions(plan,'answer',history,'はい');expect(s).toContain('NO QUESTION THIS TURN');expect(s).toContain('easy must not mean childish');expect(s).toContain('Do not make the topic harder');});
});
