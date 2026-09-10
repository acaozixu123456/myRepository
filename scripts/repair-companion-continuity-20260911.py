"""Targeted repair of the inspected companion UI; no credentials, billing or NHK data changes."""
from pathlib import Path
import hashlib

ROOT = Path('.')

def edit(name, transform, expected=None):
    p = ROOT / name
    old = p.read_text()
    if expected:
        raw = old.encode()
        actual = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        assert actual == expected, f'Unreviewed source for {name}: {actual}'
    new = transform(old)
    assert new != old, f'No change: {name}'
    p.write_text(new)

def replace_once(s, before, after):
    assert s.count(before) == 1, f'Expected one match: {before[:100]}'
    return s.replace(before, after, 1)

if 'data-release="repair-20260911"' in Path('src/companion/CompanionApp.tsx').read_text():
    assert Path('src/companion/continuityRepair.test.ts').exists()
    print('Reviewed repair already applied; re-running verification only.')
    raise SystemExit(0)

# Keep unsolicited teaching silent, but never promise that a separate service has delivered a card.
def prompt(s):
    start = s.index("  '# PRIORITY:")
    end = s.index("  '# Listen first", start)
    s = s[:start] + r'''  '# PRIORITY: conversation and requested language help\nAn independent text teacher provides grammar corrections, phrase extensions, word meanings and how-to-say answers on screen. Keep unsolicited teaching silent. Do NOT read text notes aloud. For an explicit language-learning question, acknowledge the particular word or expression briefly, then wait for the learner; do not ask again whether they want its meaning when that is already clear. Never use a stock promise such as「文字で説明しますね。」or claim that a note appeared: you cannot see whether the written service succeeded. A confirmation such as「はい」answers your immediately preceding clarification; it is not a new topic. If you already acknowledged the same request, do not repeat the acknowledgement or ask for the same confirmation. ONLY when the learner explicitly asks for an audible explanation, for example「声で説明して」「読んで」「讲给我听」「用语音说」，answer briefly in Chinese or give one short Japanese example. A request like「请用中文解释」alone specifies language, NOT permission to give a spoken lesson.',
''' + s[end:]
    needle = "  '# Spoken size and tone"
    pos = s.index(needle)
    s = s[:pos] + r'''  '# Continuity and uncertainty\nTreat adjacent learner audio fragments as one developing thought until its meaning is clear. Fillers such as「えっと」「そのまま、えっと」are not a new preference or a completed answer. Preserve the latest self-correction, rather than answering an abandoned fragment. Pronoun references such as それ and そのまま belong to the immediately preceding exchange, not a distant seed. Listen to the actual audio; subtitles are fallible, including homophones such as 感じ and 漢字. Do not silently turn an uncertain phrase into an invented preference about sleep, volume, pets or hobbies. When meaning is not clear, ask ONE brief concrete clarification, e.g.「静かな感じが好き、ということですか。」only if that matches the actual exchange. Do not invent the next event or a psychological interpretation. If the learner asks you a question, answer that question before any optional follow-up.',
''' + s[pos:]
    return replace_once(s, '一个简短回应，或者一个容易接的问题。只处理一个意思；', '一个简短回应，或者一个容易接的问题。普通接话尽量控制在一到两个短分句、约60个日文字符以内；已经接住意思就可以停，不必每轮追问。只处理一个意思；')

edit('src/companion/prompt.ts', prompt, 'f35d6f6b0be72cb1600ae219858a970fb67ad409')
Path('supabase/functions/nihongo-companion/prompt.ts').write_text(Path('src/companion/prompt.ts').read_text())

# A yes after a meaning clarification is a request to explain that real referent, not a disposable filler.
def contract(s):
    start = s.index('export const languageQuestion=')
    end = s.index('/** Reference', start)
    s = s[:start] + r'''export const languageQuestion=(s:string)=>/什么意思|什么含义|怎么说|怎么表达|如何表达|怎么读|语法|助词|自然吗|说得对吗|区别|どういう意味|という意味ですか|って何|とは何|何と言|どう言|文法|自然ですか|意味を教|意味が(?:分か|わか)ら|の意味は|(?:中文|中国語).*(?:解释|説明)/u.test(s);
export function confirmedLanguageQuestion(context:NoteLine[]):boolean{
 const answer=context.at(-1),previous=context.at(-2);
 if(answer?.role!=='user'||previous?.role!=='assistant')return false;
 const normalized=answer.text.replace(/[\s\p{P}]/gu,'');
 if(!/^(?:はい|はいそうです|はいお願いします|うん|ええ|そうです|そうですね|お願いします|是的|对|对的|嗯|是|好的|好|请解释)$/u.test(normalized))return false;
 const clarifying=/(?:意味|言い方|文法|词义|含义|意思|怎么说|解释)/u.test(previous.text)&&/(?:ですか|ますか|でしょうか|吗|[？?])/u.test(previous.text);
 const pendingPromise=/文字で説明|文字で解説|用文字解释/u.test(previous.text)&&context.slice(0,-2).some(l=>l.role==='user'&&languageQuestion(l.text));
 return clarifying||pendingPromise;
}
''' + s[end:]
    s = replace_once(s, " if(mode==='auto'&&/^(?:はい|うん|いいえ|えっと|えーと|あの|嗯|呃|ありがとう|そうです)[。！!\\s]*$/u.test(anchor.text))return null;", " const question=languageQuestion(anchor.text)||confirmedLanguageQuestion(context);\n if(mode==='auto'&&!question&&/^(?:はい|うん|いいえ|えっと|えーと|あの|嗯|呃|ありがとう|そうです)[。！!\\s]*$/u.test(anchor.text))return null;")
    return replace_once(s, "mode:mode==='auto'&&languageQuestion(anchor.text)?'question':mode", "mode:mode==='auto'&&question?'question':mode")

edit('src/companion/writtenFeedback.ts', contract, '91809c14f193cc00de943941e701aaaacc0d816d')
Path('supabase/functions/nihongo-companion/writtenContract.ts').write_text(Path('src/companion/writtenFeedback.ts').read_text())
edit('supabase/functions/nihongo-companion/writtenFeedback.ts', lambda s: replace_once(s, 'TASK: Answer the LANGUAGE QUESTION in the last learner line directly in WRITING.', 'TASK: Answer the LANGUAGE QUESTION in the last learner line directly in WRITING. When the last line is an affirmative confirmation such as はい after your language clarification, resolve the requested word from that immediately preceding real exchange and explain it now; do not explain the word はい, do not ask again, and do not merely promise an explanation. The source field still belongs to the actual latest learner line. Subtitle homophones or unfinished self-repairs alone are not evidence of a grammar error.'), 'df956c062c9d871e0277576c609e9b1f12ec1d22')

# Reading is a temporary interaction, never a lifetime pause of all subsequent notes.
edit('src/companion/WrittenNoteCard.tsx', lambda s: replace_once(replace_once(s,
    'onPointerDown={()=>onReading?.(true)}',
    'onPointerDown={()=>onReading?.(true)} onPointerUp={()=>onReading?.(false)} onPointerCancel={()=>onReading?.(false)} onPointerLeave={()=>onReading?.(false)}'),
    'onToggle={e=>onReading?.(e.currentTarget.open)}', 'onToggle={()=>onReading?.(false)}'), 'd8156d47b7629420bdd1cdb5ece91ac35457458a')

lane = r'''import type {Line} from './model.ts';
import {noteRequest,validateWrittenNote,type NoteRequest,type WrittenNote} from './writtenFeedback.ts';
type Requester=(input:NoteRequest,signal:AbortSignal)=>Promise<unknown>;
export function noteStillApplies(note:WrittenNote,lines:Line[],automatic=true):boolean{
 if(!automatic&&note.mode==='auto')return false;
 const index=lines.findIndex(l=>l.id===note.anchorId),line=lines[index];
 if(!line||line.interrupted||!line.delivered||line.text.slice(0,700)!==note.source)return false;
 if(note.mode!=='help'&&line.role==='user')for(const next of lines.slice(index+1)){
  if(next.role==='assistant'&&next.delivered&&!next.interrupted)break;
  if(next.role==='user')return false;
 }
 return true;
}
/** Text-only side lane: no media operations, no voice response creation, no persistence. */
export class WrittenLane {
 private lines:Line[]=[];private target=0;private speaking=false;private reading=false;private enabled=true;private stopped=false;private epoch=0;
 private fingerprint='';private lastAttempt='';private lastLearner='';private timer:ReturnType<typeof setTimeout>|undefined;private abort:AbortController|null=null;
 private waiting:WrittenNote|null=null;private retired=new Set<string>();private explicit:NoteRequest|null=null;private failed:NoteRequest|null=null;
 constructor(private request:Requester,private publish:(note:WrittenNote)=>void,private pending:(busy:boolean)=>void=()=>{},private error:(message:string)=>void=()=>{}){}
 private automatic(){const newest=[...this.lines].reverse().find(l=>l.role==='user');if(newest&&(!newest.text||newest.interrupted||!newest.delivered))return null;return noteRequest(this.lines,'auto',this.target);}
 private unchanged(r:NoteRequest){const index=this.lines.findIndex(l=>l.id===r.anchorId),line=this.lines[index];return !!line&&!line.interrupted&&line.delivered&&line.text.slice(0,700)===r.source&&!this.lines.slice(index+1).some(l=>l.role==='user');}
 update(lines:Line[],target:number){
  if(this.stopped)return;
  const newest=[...lines].reverse().find(l=>l.role==='user')?.id||'';
  if(this.lastLearner&&newest!==this.lastLearner)this.reading=false;
  this.lastLearner=newest;this.lines=lines;this.target=target;
  // Streaming assistant subtitles cannot cancel explicit help or an actual language question.
  if(this.explicit&&this.unchanged(this.explicit)){this.deliver();return;}
  const r=this.automatic(),fingerprint=r?JSON.stringify([r.anchorId,r.source,r.context.map(l=>[l.id,l.text])]):'';
  if(fingerprint===this.fingerprint)return;this.fingerprint=fingerprint;this.invalidate();this.failed=null;this.error('');
  if(!r||(!this.enabled&&r.mode!=='question'))return;
  if(r.mode==='question'){this.explicit=r;this.pending(true);}
  this.schedule(r,r.mode==='question'?200:1100);
 }
 setSpeaking(value:boolean){
  this.speaking=value;
  if(value){this.reading=false;clearTimeout(this.timer);return;}
  this.deliver();const r=this.explicit||this.automatic();
  if(r&&!this.abort&&!this.waiting&&(this.explicit||this.fingerprint!==this.lastAttempt)&&(this.enabled||r.mode!=='auto'))this.schedule(r,this.explicit?100:900);
 }
 setReading(value:boolean){this.reading=value;if(!value)this.deliver();}
 setEnabled(value:boolean){
  if(value===this.enabled)return;this.enabled=value;
  if(!value){if(!this.explicit){this.invalidate();this.failed=null;this.error('');}}
  else{this.fingerprint='';this.lastAttempt='';this.update(this.lines,this.target);}
 }
 help(){
  if(this.stopped)return;const r=noteRequest(this.lines,'help',this.target);
  if(!r){this.error('先听对方一句，再点「接不上」就能借用一个说法。');return;}
  this.beginExplicit(r);
 }
 retry(){
  if(this.stopped||!this.failed)return;
  if(!this.unchanged(this.failed)){this.failed=null;this.error('对话已更新，可以再点「接不上」。');return;}
  this.beginExplicit({...this.failed,requestId:crypto.randomUUID()});
 }
 private beginExplicit(r:NoteRequest){this.retired.delete(r.anchorId);this.invalidate();this.failed=null;this.error('');this.reading=false;this.explicit=r;this.pending(true);this.schedule(r,200);}
 dismiss(anchorId:string){this.retired.add(anchorId);if(this.waiting?.anchorId===anchorId)this.waiting=null;if(this.failed?.anchorId===anchorId){this.failed=null;this.error('');}}
 reset(){this.invalidate();this.lines=[];this.fingerprint='';this.lastAttempt='';this.lastLearner='';this.reading=false;this.speaking=false;this.failed=null;this.retired.clear();this.error('');}
 private invalidate(){this.epoch++;clearTimeout(this.timer);this.abort?.abort();this.abort=null;this.waiting=null;if(this.explicit){this.explicit=null;this.pending(false);}}
 private schedule(r:NoteRequest,delay:number){clearTimeout(this.timer);if(this.speaking)return;const epoch=this.epoch;this.timer=setTimeout(()=>void this.run(r,epoch),delay);}
 private async run(r:NoteRequest,epoch:number){
  if(this.stopped||epoch!==this.epoch||this.retired.has(r.anchorId))return;
  const abort=this.abort=new AbortController();this.lastAttempt=this.fingerprint;
  try{
   const result=await this.request(r,abort.signal);
   if(this.stopped||abort.signal.aborted||epoch!==this.epoch)return;
   const current=this.lines.find(l=>l.id===r.anchorId);
   if(!current||current.text.slice(0,700)!==r.source||current.interrupted)return;
   const note=validateWrittenNote(result,r);
   if(note){this.failed=null;this.error('');this.waiting=note;this.deliver();}
   else if(this.explicit){this.failed=r;this.error('这次没找到可靠的文字提示，可以点一下重试。');}
  }catch{
   if(!this.stopped&&!abort.signal.aborted&&epoch===this.epoch){this.failed=r;this.error('文字提示暂时没接上，可以重试；语音聊天不受影响。');}
  }finally{
   if(this.abort===abort)this.abort=null;
   if(epoch===this.epoch&&this.explicit){this.explicit=null;this.pending(false);}
  }
 }
 private deliver(){if(this.stopped||this.speaking||this.reading||!this.waiting)return;const note=this.waiting;this.waiting=null;if(!this.retired.has(note.anchorId)&&noteStillApplies(note,this.lines,this.enabled))this.publish(note);}
 dispose(){this.stopped=true;this.invalidate();this.lines=[];this.failed=null;this.retired.clear();}
}
'''
edit('src/companion/writtenLane.ts', lambda _: lane, 'bd8ebec49a906fccbe78e3dfefe988797506c17e')

def connection(s):
    s = replace_once(s, 'writtenPending?:(busy:boolean)=>void}', 'writtenPending?:(busy:boolean)=>void;writtenError?:(message:string)=>void}')
    s = replace_once(s, 'private noteSeen=new Set<string>();', 'private noteSeen=new Set<string>();private earlierTopicItems=new Set<string>();')
    s = replace_once(s, '},hooks.written,hooks.writtenPending);', '},hooks.written,hooks.writtenPending,hooks.writtenError);')
    s = replace_once(s, 'this.written?.update(lines,this.policy.target);', 'this.written?.update(lines.filter(l=>!this.earlierTopicItems.has(l.id)),this.policy.target);')
    s = replace_once(s, 'writtenHelp(){this.written?.help();}', 'writtenHelp(){this.written?.help();}\n  retryWrittenHelp(){this.written?.retry();}')
    s = replace_once(s, 'this.topicEpoch++;this.written?.reset();', 'this.topicEpoch++;this.earlierTopicItems=new Set(this.ledger.ordered().map(l=>l.id));this.written?.reset();')
    s = replace_once(s, 'private flushSoon(){clearTimeout(this.replyTimer);this.replyTimer=setTimeout(()=>this.flush(),400);}', 'private flushSoon(delay=400){clearTimeout(this.replyTimer);this.replyTimer=setTimeout(()=>this.flush(),delay);}')
    s = replace_once(s, "this.speakingItem='';if(this.gate.hasPending)this.flushSoon();", "this.speakingItem='';if(this.gate.hasPending)this.flushSoon(950);")
    s = replace_once(s, 'this.userTurns++;this.flushSoon();break;', 'this.userTurns++;this.changed();this.flushSoon(950);break;')
    return s
edit('src/companion/connection.ts', connection, '0cbe42d0296aecf9cd2d782d785656cdc4f8931a')

def app(s):
    s = replace_once(s, 'const readingNote=useRef(false),followBottom=useRef(true);', "const readingNote=useRef(false),followBottom=useRef(true),lastLearner=useRef('');\n  const [noteError,setNoteError]=useState(''),[unreadNote,setUnreadNote]=useState('');")
    s = replace_once(s, '},[lines,phase]);', '},[lines,phase,notes]);')
    s = replace_once(s, "setNotePending(false);readingNote.current=false;followBottom.current=true;", "setNotePending(false);setNoteError('');setUnreadNote('');lastLearner.current='';readingNote.current=false;followBottom.current=true;")
    s = replace_once(s, 'lines:l=>{if(current())setLines(l);}', "lines:l=>{if(current()){const latest=[...l].reverse().find(v=>v.role==='user')?.id||'';if(latest&&latest!==lastLearner.current){lastLearner.current=latest;readingNote.current=false;followBottom.current=true;}setLines(l);}}")
    s = replace_once(s, "setNotes(old=>[...old.filter(x=>x.anchorId!==n.anchorId),n].slice(-24));if(!readingNote.current)setExpandedNote(n.id);", "setNotes(old=>[...old.filter(x=>x.anchorId!==n.anchorId),n].slice(-24));setUnreadNote(n.id);if(n.mode!=='auto')setShowText(true);if(!readingNote.current)setExpandedNote(n.id);")
    s = replace_once(s, 'writtenPending:v=>{if(current())setNotePending(v);}', 'writtenPending:v=>{if(current())setNotePending(v);},writtenError:s=>{if(current())setNoteError(s);}')
    s = replace_once(s, "const finish=()=>{setSheet(null);conn.current?.end();setLines([]);setNotes([]);setNotePending(false);};", "const finish=()=>{setSheet(null);conn.current?.end();setLines([]);setNotes([]);setNotePending(false);setNoteError('');setUnreadNote('');};")
    s = replace_once(s, "const useSeed=(next:Seed)=>{setNotes([]);setExpandedNote('');", "const useSeed=(next:Seed)=>{setNotes([]);setExpandedNote('');setNoteError('');setUnreadNote('');lastLearner.current='';")
    s = replace_once(s, "const toggleNote=(id:string)=>{const next=expandedNote===id?'':id;setExpandedNote(next);readingNote.current=!!next;followBottom.current=false;conn.current?.setReadingNote(!!next);};", "const toggleNote=(id:string)=>{setExpandedNote(expandedNote===id?'':id);readingNote.current=false;followBottom.current=false;conn.current?.setReadingNote(false);};\n  const revealNote=()=>{const note=notes.find(n=>n.id===unreadNote);if(!note)return;setShowText(true);setExpandedNote(note.id);readingNote.current=false;followBottom.current=false;conn.current?.setReadingNote(false);requestAnimationFrame(()=>requestAnimationFrame(()=>{const cards=scroller.current?.querySelectorAll<HTMLElement>('[data-note-for]');Array.from(cards||[]).find(el=>el.dataset.noteFor===note.anchorId)?.scrollIntoView({block:'center',behavior:'smooth'});}));};")
    s = replace_once(s, 'data-release="quiet-20260910"', 'data-release="repair-20260911"')
    s = replace_once(s, 'onSeen={()=>conn.current?.exposeNote(n.id)}', "onSeen={()=>{conn.current?.exposeNote(n.id);setUnreadNote(old=>old===n.id?'':old);}}")
    s = replace_once(s, '{notePending&&<p className="kc-note-pending">', '{unreadNote&&notes.some(n=>n.id===unreadNote&&noteStillApplies(n,lines,writtenEnabled))&&<button className="kc-note-available" onClick={revealNote}>有新的文字提示 · 查看</button>}\n          {noteError&&<p className="kc-note-error" role="status">{noteError}<button disabled={notePending} onClick={()=>conn.current?.retryWrittenHelp()}>重试文字提示</button></p>}\n          {notePending&&<p className="kc-note-pending">')
    return replace_once(s, '可以随时用中文问“什么意思”或“怎么说”，默认用文字说明；说“讲给我听”才语音讲解。', '可以随时用中文问“什么意思”或“怎么说”，默认用文字说明；说“讲给我听”才语音讲解。提示会随对话继续更新，不需要纠正时就不打扰。版本 9.11。')
edit('src/companion/CompanionApp.tsx', app, '773fa10861facfc29edd7ffd8429a420f5b39872')
with Path('src/companion/writtenNotes.css').open('a') as f:
    f.write('\n/* Recoverable text-only lane; never obscures or controls the microphone. */\n.kc-note-available{display:block;margin:0 auto 8px;padding:6px 14px;border:1px solid currentColor;border-radius:20px;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}\n.kc-note-error{margin:0 12px 8px;font-size:12px;line-height:1.6;text-align:center}.kc-note-error button{margin-left:8px;padding:4px 8px;border:0;border-radius:8px;background:transparent;color:inherit;text-decoration:underline;font:inherit;cursor:pointer}.kc-note-error button:disabled{opacity:.5}\n')

Path('src/companion/continuityRepair.test.ts').write_text(r'''import {describe,it,expect,vi,afterEach} from 'vitest';
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
''')
print('Applied bounded companion repair; source, unit tests and phone checks must pass before publication.')
