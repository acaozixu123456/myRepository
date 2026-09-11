import {describe,it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {validSubject,validLesson,validTeacherInput,validVerdict,lessonSignatureValue,splitForListening,type Lesson,type Subject} from './teacherContract';
import {readExpressions,writeExpressions,rememberSubject,recordAttempt,dueExpressions,EXPRESSION_KEY,currentEvidence} from './expressionLearning';
import {deliveryInstructions} from './voicePreferences';
import {RemoteReplay} from './remoteReplay';
const subject:Subject={phrase:'少し休むつもりが、寝てしまいました。',meaningZh:'本来打算稍微休息，结果睡着了。',kind:'explanation'};
const lesson:Lesson={id:'lesson-test-001',subject,focus:'〜つもりが',scene:'午休',cueZh:'本来打算看五分钟，结果看了一小时。',keyword:'つもり',starter:'五分だけ見るつもりが、',exampleJa:'五分だけ見るつもりが、一時間も見てしまいました。',signature:'f'.repeat(64)};
const pass={verdict:'communicated' as const,focusUsed:true,feedbackZh:'本来打算和实际结果都表达出来了。',suggestionJa:''};
function storage(){const m=new Map<string,string>();return{m,getItem:(k:string)=>m.get(k)||null,setItem:vi.fn((k:string,v:string)=>{m.set(k,v);})};}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('bounded teacher request/result contracts',()=>{
 it('accepts a natural selected expression',()=>expect(validSubject(subject)).toEqual(subject));
 it.each([null,{}, {...subject,phrase:'<script>hi</script>'},{...subject,phrase:'a'.repeat(141)},{...subject,kind:'grade'}])('rejects unsafe or malformed subject %j',s=>expect(validSubject(s)).toBeNull());
 it('preserves both signed lesson fields and selected meaning',()=>{expect(validLesson(lesson)).toEqual(lesson);expect(lessonSignatureValue(lesson)).not.toHaveProperty('signature');expect(lessonSignatureValue(lesson).lesson).not.toHaveProperty('signature');});
 it('accepts only a confirmed speech or typed attempt',()=>{const r={task:'assess',requestId:'attempt-001',lesson,answer:'五分だけ見るつもりが、一時間見てしまいました。',support:0,source:'confirmed_speech'};expect(validTeacherInput(r)).not.toBeNull();expect(validTeacherInput({...r,source:'unconfirmed_asr'})).toBeNull();expect(validTeacherInput({...r,support:6})).toBeNull();});
 it('bounds utterances without truncating their meaning silently',()=>expect(validTeacherInput({task:'assess',requestId:'attempt-001',lesson,answer:'あ'.repeat(501),support:0,source:'typed'})).toBeNull());
 it('validates direct exercise preparation and previous context',()=>expect(validTeacherInput({task:'prepare',requestId:'prepare-001',subject,previousScene:'休憩'})).not.toBeNull());
 it('never accepts a fabricated pronunciation grade result',()=>{expect(validVerdict({...pass,verdict:'A+'})).toBeNull();expect(validVerdict({...pass,feedbackZh:''})).toBeNull();expect(validVerdict(pass)).toEqual(pass);});
 it('splits listening into bounded meaning units, never one character at a time',()=>expect(splitForListening('今日は休みです。家でゆっくりします。')).toEqual(['今日は休みです。','家でゆっくりします。']));
 it('limits listen panels to eight bounded units',()=>expect(splitForListening('短い文です。'.repeat(20))).toHaveLength(8));
});
describe('specific expression progress is evidence, not fictional levels',()=>{
 it('starts with opt-in disabled without modifying other study keys',()=>{const s=storage();s.m.set('nihongo-nhk-article-library-v1','KEEP');expect(readExpressions(s).library.enabled).toBe(false);expect(s.setItem).not.toHaveBeenCalled();expect(s.m.get('nihongo-nhk-article-library-v1')).toBe('KEEP');});
 it('keeps corrupt and future-version data protected and untouched',()=>{for(const raw of ['{','{"version":999,"enabled":true,"items":[]}']){const s=storage();s.m.set(EXPRESSION_KEY,raw);expect(readExpressions(s).protected).toBe(true);expect(s.m.get(EXPRESSION_KEY)).toBe(raw);expect(s.setItem).not.toHaveBeenCalled();}});
 it('rejects data with unsafe stored strings and duplicate items',()=>{const items=rememberSubject([],subject);const s=storage();s.m.set(EXPRESSION_KEY,JSON.stringify({version:1,enabled:true,items:[items[0],items[0]]}));expect(readExpressions(s).protected).toBe(true);});
 it('writes only explicitly serialized expression data, no raw answer or chat',()=>{const s=storage(),items=rememberSubject([],subject);const raw=writeExpressions(s,{version:1,enabled:true,items},null);expect(readExpressions(s).library.items).toEqual(items);expect(raw).not.toContain('rawTranscript');expect([...s.m.keys()]).toEqual([EXPRESSION_KEY]);});
 it('refuses to overwrite another tab or another version',()=>{const s=storage();s.m.set(EXPRESSION_KEY,'OTHER');expect(()=>writeExpressions(s,{version:1,enabled:true,items:[]},null)).toThrow('storage_changed');expect(s.m.get(EXPRESSION_KEY)).toBe('OTHER');});
 it('treats seeing a sample as seen, not success',()=>expect(currentEvidence(rememberSubject([],subject)[0])).toBe('seen'));
 it.each([1,2] as const)('records support level %s without independent success',support=>{const items=recordAttempt([],lesson,pass,'五分だけ見るつもりが、一時間見てしまいました。',support,'typed','try-001');expect(currentEvidence(items[0])).toBe('supported');});
 it('does not count full example reading as independent',()=>expect(currentEvidence(recordAttempt([],lesson,pass,lesson.exampleJa,3,'confirmed_speech','try-001')[0])).toBe('imitated'));
 it('recognizes a copied example even when no hint was clicked this time',()=>expect(currentEvidence(recordAttempt([],lesson,pass,subject.phrase,0,'typed','try-001',[subject.phrase])[0])).toBe('imitated'));
 it('counts a communicated target used independently',()=>expect(currentEvidence(recordAttempt([],lesson,pass,'五分だけ見るつもりが、一時間見てしまいました。',0,'typed','try-001')[0])).toBe('independent'));
 it('counts transfer only after a previous independent success in a different scene',()=>{let items=recordAttempt([],lesson,pass,'独立した文です',0,'typed','try-001',[],1000);items=recordAttempt(items,{...lesson,scene:'買い物'},pass,'別の場面です',0,'typed','try-002',[],2000);expect(currentEvidence(items[0])).toBe('transfer');expect(items[0].dueAt).toBe(2000+3*86400000);});
 it('does not label the same scene as transfer',()=>{let items=recordAttempt([],lesson,pass,'文です',0,'typed','try-001');items=recordAttempt(items,lesson,pass,'違う文です',0,'typed','try-002');expect(currentEvidence(items[0])).toBe('independent');});
 it('a valid alternative without the target is not counted as target mastery',()=>expect(currentEvidence(recordAttempt([],lesson,{...pass,focusUsed:false},'他の表現です',0,'typed','try-001')[0])).toBe('retry'));
 it('uncertain recognition does not manufacture an error or progress',()=>{const items=rememberSubject([],subject);expect(recordAttempt(items,lesson,{...pass,verdict:'uncertain'},'えっと',0,'confirmed_speech','try-001')).toEqual(items);});
 it('deduplicates retry requests carrying the same attempt id',()=>{const items=recordAttempt([],lesson,pass,'文です',0,'typed','try-001');expect(recordAttempt(items,lesson,pass,'文です',0,'typed','try-001')).toEqual(items);});
 it('schedules supported and retry attempts differently, without erasing past successes',()=>{let items=recordAttempt([],lesson,pass,'文です',0,'typed','try-001',[],1000);items=recordAttempt(items,lesson,{...pass,verdict:'revise'},'違う',0,'typed','try-002',[],2000);expect(items[0].evidence.some(e=>e.kind==='independent')).toBe(true);expect(items[0].dueAt).toBe(602000);expect(dueExpressions(items,602001)).toHaveLength(1);expect(dueExpressions(items,3000)).toHaveLength(0);});
 it('retains bookmark status and avoids duplicate expressions',()=>{let items=rememberSubject([],subject);items=rememberSubject(items,subject,subject.phrase,2000,true);expect(items).toHaveLength(1);expect(items[0].bookmarked).toBe(true);});
});
describe('voice settings and direct teacher behavior',()=>{
 it('naturally changes phrase pauses, never applies slowed output speed',()=>{expect(deliveryInstructions('natural','automatic','speech')).toContain('1.0');expect(deliveryInstructions('gentle','automatic','speech')).toContain('BETWEEN meaningful clauses');expect(deliveryInstructions('gentle','automatic','speech')).toContain('not inside words');});
 it('voice questions need no special password and typed ones receive written answers',()=>{expect(deliveryInstructions('natural','automatic','speech')).toContain('No special phrase');expect(deliveryInstructions('natural','automatic','typed')).toContain('written Chinese');expect(deliveryInstructions('natural','text','speech')).toContain('written-only');});
 it('mirrors all shared contracts and prompts',()=>{for(const [a,b] of [['model.ts','model.ts'],['prompt.ts','prompt.ts'],['teacherContract.ts','teacherContract.ts'],['writtenFeedback.ts','writtenContract.ts']])expect(readFileSync('src/companion/'+a,'utf8')).toBe(readFileSync('supabase/functions/nihongo-companion/'+b,'utf8'));});
 it('keeps caption preference independent of note activation and actual teaching mode',()=>{const source=readFileSync('src/companion/CompanionApp.tsx','utf8');expect(source).not.toContain('writtenEnabled&&showText');expect(source).toContain('teacher-captionless-notes');expect(source).toContain('讲解只显示文字');});
 it('the server uses speed 1 and retains native audio + access controls',()=>{const source=readFileSync('supabase/functions/nihongo-companion/index.ts','utf8');expect(source).toContain("voice:'marin',speed:1");expect(source).toContain('await verifyTicket(body)');expect(source).toContain('audio_consent_required');expect(source).toContain("create_response:false");});
 it('only asks for optional exercise evaluation after explicit confirmation',()=>{const source=readFileSync('src/companion/TeacherStudio.tsx','utf8');expect(source).toContain('确认这句，给我反馈');expect(source).toContain("source:speech?'confirmed_speech':'typed'");expect(source).toContain('继续聊天，不用做完');});
});
describe('volatile remote-only original replay',()=>{
 function setup(){
  const recorders:any[]=[];
  class Recorder{static isTypeSupported(){return true;}state='inactive';mimeType='audio/webm';ondataavailable:any;onstop:any;onerror:any;constructor(public stream:unknown){recorders.push(this);}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['x'.repeat(300)])});this.onstop?.();}}
  vi.stubGlobal('MediaRecorder',Recorder);const callback=vi.fn(),replay=new RemoteReplay(callback);const remote={} as MediaStream;replay.attachRemote(remote);return{replay,recorders,callback,remote};
 }
 it('buffers only the attached AI remote stream and becomes ready after a complete utterance',()=>{const{replay,recorders,remote}=setup();replay.begin();expect(recorders[0].stream).toBe(remote);expect(replay.ready).toBe(false);replay.complete();expect(replay.ready).toBe(true);replay.dispose();});
 it('never makes a canceled/incomplete utterance replayable',()=>{const{replay}=setup();replay.begin();replay.cancelCapture();expect(replay.ready).toBe(false);replay.dispose();});
 it('late recorder callbacks cannot overwrite a newer utterance',()=>{const{replay,recorders}=setup();replay.begin();const old=recorders[0];replay.begin();old.ondataavailable({data:new Blob(['stale'.repeat(60)])});old.onstop();expect(replay.ready).toBe(false);replay.complete();expect(replay.ready).toBe(true);replay.dispose();});
 it('limits recording duration rather than retaining an unbounded stream',()=>{vi.useFakeTimers();const{replay,recorders}=setup();replay.begin();vi.advanceTimersByTime(61000);expect(recorders[0].state).toBe('inactive');expect(replay.ready).toBe(false);replay.dispose();});
 it('discards oversized output buffers',()=>{const{replay,recorders}=setup();replay.begin();recorders[0].ondataavailable({data:new Blob([new Uint8Array(4000001)])});expect(replay.ready).toBe(false);replay.dispose();});
 it('does not pretend to regenerate an original when none is available',async()=>{const{replay}=setup();await expect(replay.playOriginal()).rejects.toThrow('original_unavailable');replay.dispose();});
 it('releases the original on session disposal',()=>{const{replay}=setup();replay.begin();replay.complete();replay.dispose();expect(replay.ready).toBe(false);});
 it('contains no microphone acquisition, upload, or durable storage',()=>{const s=readFileSync('src/companion/remoteReplay.ts','utf8');expect(s).not.toMatch(/getUserMedia|fetch\(|localStorage|indexedDB|caches\./);});
});
