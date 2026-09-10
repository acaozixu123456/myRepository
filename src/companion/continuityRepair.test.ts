import {describe,it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {noteRequest,validateNoteRequest,type NoteRequest} from './writtenFeedback';
import {WrittenLane} from './writtenLane';
import {companionInstructions,LOCAL_SEEDS,freshPolicy,type Line} from './model';
const line=(id:string,role:Line['role'],text:string):Line=>({id,role,text,previous:'',delivered:true,interrupted:false,assistance:'none',seq:0});
const question=line('q','assistant','「アーティストやバンド」の意味を知りたいということですか？');
const yes=line('yes','user','はい。');
const raw=(r:NoteRequest)=>({source:r.source,kind:r.mode==='question'?'explanation':'wording',certainty:'clear',meaningPreserved:true,suggestion:'このバンドが好きです。',reasonZh:'アーティスト是艺术家或歌手；バンド是乐队。',detailZh:''});
afterEach(()=>vi.useRealTimers());
describe('the reported confirmation is real contextual language help',()=>{
 it.each(['はい。','はい、そうです。','是的','对'])('answers the preceding clarification after %s',text=>{const r=noteRequest([question,line('yes','user',text)],'auto')!;expect(r.mode).toBe('question');expect(r.context[0].text).toContain('アーティスト');expect(r.source).toBe(text);expect(validateNoteRequest(r)).toEqual(r);});
 it.each(['いいえ。','ありがとう。','えっと'])('does not turn %s into a request to explain',text=>expect(noteRequest([question,line('u','user',text)],'auto')).toBeNull());
 it('does not turn an ordinary affirmative into a language lesson',()=>expect(noteRequest([line('q','assistant','猫が好きですか？'),yes],'auto')).toBeNull());
 it('does not interpret a statement of meaning as a clarification question',()=>expect(noteRequest([line('q','assistant','バンドは楽器を演奏するグループという意味です。'),yes],'auto')).toBeNull());
 it('does not recycle a distant language question',()=>expect(noteRequest([question,line('u','user','わかりました'),line('newq','assistant','今日は休みですか？'),yes],'auto')).toBeNull());
 it.each(['その言葉の意味が分かりません。','その言葉の意味がわからない。','这个表达请用中文解释'])('recognizes direct requests %s',text=>expect(noteRequest([line('u','user',text)],'auto')?.mode).toBe('question'));
});
describe('text notes continue after reading and throughout a session',()=>{
 it('publishes five successive notes, even with the previous card left open',async()=>{vi.useFakeTimers();const publish=vi.fn(),request=vi.fn(async(r:NoteRequest)=>raw(r));const lane=new WrittenLane(request,publish);const history:Line[]=[];for(let i=0;i<5;i++){history.push(line('q'+i,'assistant','何が好きですか？'),line('u'+i,'user','猫動画好き。'));lane.update([...history],0);await vi.advanceTimersByTimeAsync(1200);expect(publish).toHaveBeenCalledTimes(i+1);lane.setReading(true);}expect(request).toHaveBeenCalledTimes(5);lane.dispose();});
 it('releases reading when the learner resumes speaking without cancelling the voice',async()=>{vi.useFakeTimers();const publish=vi.fn(),lane=new WrittenLane(async r=>raw(r),publish);lane.update([question,yes],0);lane.setReading(true);await vi.advanceTimersByTimeAsync(250);expect(publish).not.toHaveBeenCalled();lane.setSpeaking(true);lane.setSpeaking(false);expect(publish).toHaveBeenCalledTimes(1);lane.dispose();});
 it('shows language questions with automatic corrections disabled',async()=>{vi.useFakeTimers();const publish=vi.fn(),pending=vi.fn(),lane=new WrittenLane(async r=>raw(r),publish,pending);lane.setEnabled(false);lane.update([question,yes],0);await vi.advanceTimersByTimeAsync(250);expect(publish).toHaveBeenCalledTimes(1);expect(pending).toHaveBeenLastCalledWith(false);lane.dispose();});
 it('does not starve a requested explanation while assistant subtitles stream',async()=>{vi.useFakeTimers();let resolve!:(v:unknown)=>void;let input!:NoteRequest;const request=vi.fn((r:NoteRequest,_s:AbortSignal)=>{input=r;return new Promise(v=>{resolve=v;});}),publish=vi.fn();const lane=new WrittenLane(request,publish);lane.update([question,yes],0);await vi.advanceTimersByTimeAsync(250);for(let i=0;i<10;i++)lane.update([question,yes,{...line('a','assistant','意味ですね。'.slice(0,i+1)),delivered:false}],0);expect(request.mock.calls[0][1].aborted).toBe(false);resolve(raw(input));await vi.advanceTimersByTimeAsync(1);expect(publish).toHaveBeenCalledTimes(1);lane.dispose();});
 it('surfaces a failure and retries the same actual question on demand',async()=>{vi.useFakeTimers();const error=vi.fn(),pending=vi.fn(),publish=vi.fn();const request=vi.fn().mockRejectedValueOnce(new Error('temporary')).mockImplementation(async(r:NoteRequest)=>raw(r));const lane=new WrittenLane(request,publish,pending,error);lane.update([question,yes],0);await vi.advanceTimersByTimeAsync(250);expect(error.mock.calls.some(c=>c[0].includes('重试'))).toBe(true);expect(pending).toHaveBeenLastCalledWith(false);lane.retry();await vi.advanceTimersByTimeAsync(250);expect(request).toHaveBeenCalledTimes(2);expect(request.mock.calls[1][0].mode).toBe('question');expect(request.mock.calls[1][0].anchorId).toBe('yes');expect(publish).toHaveBeenCalledTimes(1);expect(error).toHaveBeenLastCalledWith('');lane.dispose();});
 it('does not silently drop an empty result for explicit help',async()=>{vi.useFakeTimers();const error=vi.fn(),lane=new WrittenLane(async()=>null,vi.fn(),vi.fn(),error);lane.update([question,yes],0);await vi.advanceTimersByTimeAsync(250);expect(error.mock.calls.some(c=>c[0].includes('可靠'))).toBe(true);lane.dispose();});
 it('keeps no-note results quiet for ordinary correct conversation',async()=>{vi.useFakeTimers();const error=vi.fn(),lane=new WrittenLane(async()=>null,vi.fn(),vi.fn(),error);lane.update([line('u','user','今日は休みです。')],0);await vi.advanceTimersByTimeAsync(1200);expect(error.mock.calls.every(c=>c[0]==='')).toBe(true);lane.dispose();});
 it('does not retry an old question after a new learner turn',async()=>{vi.useFakeTimers();const request=vi.fn().mockRejectedValue(new Error('temporary'));const lane=new WrittenLane(request,vi.fn());lane.update([question,yes],0);await vi.advanceTimersByTimeAsync(250);lane.update([question,yes,line('new','user','ありがとう。')],0);lane.retry();await vi.advanceTimersByTimeAsync(1200);expect(request).toHaveBeenCalledTimes(1);lane.dispose();});
 it('topic reset clears both reading and failed requests',async()=>{vi.useFakeTimers();const publish=vi.fn(),request=vi.fn(async(r:NoteRequest)=>raw(r));const lane=new WrittenLane(request,publish);lane.setReading(true);lane.reset();lane.update([question,yes],0);await vi.advanceTimersByTimeAsync(250);expect(publish).toHaveBeenCalledTimes(1);lane.dispose();});
 it('disposal prevents a late error from leaking into a new session',async()=>{vi.useFakeTimers();let reject!:(v:unknown)=>void;const error=vi.fn();const lane=new WrittenLane(()=>new Promise((_r,j)=>{reject=j;}),vi.fn(),vi.fn(),error);lane.update([question,yes],0);await vi.advanceTimersByTimeAsync(250);lane.dispose();error.mockClear();reject(new Error('late'));await vi.advanceTimersByTimeAsync(1);expect(error).not.toHaveBeenCalled();});
});
describe('reviewed native voice and touch contracts',()=>{
 it('forbids the stock empty promise and preserves quiet teaching',()=>{const p=companionInstructions(LOCAL_SEEDS[0],freshPolicy());expect(p).not.toContain('acknowledge briefly with');expect(p).toContain('Never use a stock promise');expect(p).toContain('Keep unsolicited teaching silent');expect(p).toContain('immediately preceding clarification');expect(p).toContain('Fillers');});
 it('balances touch cancellation and never treats an open details panel as a global lock',()=>{const s=readFileSync('src/companion/WrittenNoteCard.tsx','utf8');expect(s).toContain('onPointerUp');expect(s).toContain('onPointerCancel');expect(s).toContain('onPointerLeave');expect(s).not.toContain('onReading?.(e.currentTarget.open)');});
 it('keeps audio native while extending only the learner end-of-turn grace',()=>{const s=readFileSync('src/companion/connection.ts','utf8');expect(s).toContain('this.flushSoon(950)');expect(s).toContain('private flushSoon(delay=400)');expect(s).not.toContain("conversation:'none'");expect(s).not.toContain('TeacherTurnChannel');});
 it('mirrors request validation between frontend and backend',()=>expect(readFileSync('src/companion/writtenFeedback.ts','utf8')).toBe(readFileSync('supabase/functions/nihongo-companion/writtenContract.ts','utf8')));
});

describe('pre-transcript ownership',()=>{
 it('a new audio item invalidates help even before ASR',async()=>{
  vi.useFakeTimers();let resolve!:(v:unknown)=>void;let input!:NoteRequest;
  const request=vi.fn((r:NoteRequest,_signal:AbortSignal)=>{input=r;return new Promise(v=>{resolve=v;});});
  const publish=vi.fn(),lane=new WrittenLane(request,publish);
  const opening=line('opening','assistant','何が好きですか？');
  lane.update([opening],0);lane.help();await vi.advanceTimersByTimeAsync(250);
  lane.update([opening,line('new-audio','user','')],0);
  expect(request.mock.calls[0][1].aborted).toBe(true);
  resolve(raw(input));await vi.advanceTimersByTimeAsync(1);
  expect(publish).not.toHaveBeenCalled();lane.dispose();
 });
});
