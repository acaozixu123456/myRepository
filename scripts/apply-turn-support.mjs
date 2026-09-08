import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const markers=[['src/nhkChatConnection.ts','private support:TurnSupportChannel;'],['src/nhkChat.ts','export function chatResponseStyle'],['src/NhkSpeakingCoach.tsx','data-turn-support="nhk-turn-support-v1"']].map(([p,m])=>readFileSync(p,'utf8').includes(m));
if(markers.every(Boolean)){console.log('Reviewed turn-support integration already present.');process.exit(0);}if(markers.some(Boolean))throw new Error('Partial integration; review instead of patching blindly');
function patch(path,sha,edit){const s=readFileSync(path,'utf8');const bytes=Buffer.from(s);const actual=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');if(actual!==sha)throw new Error(`Refuse to patch changed base ${path}: ${actual}`);let value=s;const once=(a,b)=>{if(value.split(a).length!==2)throw new Error(`Nonunique anchor in ${path}: ${a.slice(0,70)}`);value=value.replace(a,b);};edit(once);writeFileSync(path,value);}
patch('src/nhkChatConnection.ts','acf7baab6e4a90eb86471e4190b63c001bcfd69c',once=>{
  once("import {SPEAKING_CONSENT}","import {TurnSupportChannel,type TurnSupportFrame} from './nhkTurnSupport';\nimport type {ExperienceMetric} from './nhkChatExperience';\nimport {SPEAKING_CONSENT}");
  once('heard:(text:string)=>void};','heard:(text:string)=>void;support?:(frame:TurnSupportFrame|null)=>void;metric?:(event:ExperienceMetric)=>void};');
  once('type Job={kind:ChatAction;heard:string};','type Job={kind:ChatAction;heard:string;example?:string};');
  once('  constructor(private plan:ChatPlan,private hooks:ChatHooks){}',`  private support:TurnSupportChannel;
  constructor(private plan:ChatPlan,private hooks:ChatHooks){this.support=new TurnSupportChannel({send:e=>this.emit(e),update:f=>this.hooks.support?.(f),spend:()=>{if(!this.hooks.support||this.closed||this.busyConnecting||this.dc?.readyState!=='open'||this.responses>=22||Date.now()>this.renewAt-6000)return false;this.responses++;return true;}});}
  setSupportEnabled(on:boolean){this.support.setEnabled(on);}
  private prepareSupport(){if(!this.pending&&!this.shuffleTimer&&this.output&&['start','answer','resume'].includes(this.activeJob.kind))this.support.begin(\`\${this.serial}-\${this.topicSerial}-\${this.requestSeq}\`,this.output,{learner:this.activeJob.heard,source:this.plan.source});}`);
  once('    this.stream=stream;this.mic(false);','    this.stream=stream;this.hooks.metric?.(\'permission_ready\');this.mic(false);');
  once('private closePeer(){this.serial++;','private closePeer(){this.support.reset();this.serial++;');
  once('private rotate(job:Job){if(this.closed||this.busyConnecting)return;','private rotate(job:Job){if(this.closed||this.busyConnecting)return;this.hooks.metric?.(\'renew\');');
  once('    if(this.closed)return;this.mic(false);this.waiting=false;',"    if(this.closed)return;if(job.kind==='help'||job.kind==='repeat')this.support.cancelPending();else this.support.clear();this.mic(false);this.waiting=false;");
  once("this.hooks.assistant('');this.hooks.phase('coach');","this.hooks.assistant('');this.hooks.phase('coach');this.hooks.metric?.('request_sent');");
  once('chatInstructions(this.plan,job.kind,this.history,job.heard)','chatInstructions(this.plan,job.kind,this.history,job.heard,job.example)');
  once('changeTopic(plan:ChatPlan){if(this.closed)return;','changeTopic(plan:ChatPlan){if(this.closed)return;this.support.clear();this.hooks.metric?.(\'shuffle\');');
  once("  help(){this.request({kind:'help',heard:''});}","  help(){this.hooks.metric?.('help');this.request({kind:'help',heard:'',example:this.support.frame?.example||undefined});}");
  once("private event(e:any){if(!e||typeof e.type!=='string')return;","private event(e:any){if(this.closed||!e||typeof e.type!=='string')return;if(this.support.handle(e))return;");
  once("this.output=String(e.transcript||this.output).slice(0,1000);this.hooks.assistant(this.output);","this.output=String(e.transcript||this.output).slice(0,1000);this.hooks.assistant(this.output);this.prepareSupport();");
  once("case'output_audio_buffer.started':this.playbackDone=false;","case'output_audio_buffer.started':this.hooks.metric?.('audio_started');this.playbackDone=false;");
  once("        this.responseDone=true;this.release();break;","        this.prepareSupport();this.responseDone=true;this.release();break;");
  once("case'input_audio_buffer.speech_started':if(this.accepting){this.talking=true;","case'input_audio_buffer.speech_started':if(this.accepting){this.support.cancelPending();this.talking=true;");
  once("if(intent==='help'||intent==='repeat'){this.request({kind:intent,heard:text});break;}","if(intent==='help'){this.help();break;}if(intent==='repeat'){this.repeat();break;}");
  once("        this.hooks.heard(text);","        this.hooks.metric?.('answer');this.hooks.heard(text);");
});
patch('src/nhkChat.ts','5511f14222d046479fe6ee8622dd7c1518a0023c',once=>{
  once("export function chatInstructions(plan:ChatPlan,kind:ChatAction,history:ChatLine[]=[],heard=''):string{",`export function chatResponseStyle(history:ChatLine[],heard:string):'answer-only'|'acknowledge'|'followup-optional'{
  const question=(s:string)=>/[?？]|(?:ですか|ますか|でしたか|ましたか|でしょうか|ませんか)[。！!]?$/u.test(s.trim());
  if(question(heard))return'answer-only';
  const recent=history.filter(h=>h.role==='assistant').slice(-2);
  return recent.length===2&&recent.every(h=>question(h.text))?'acknowledge':'followup-optional';
}
export function chatInstructions(plan:ChatPlan,kind:ChatAction,history:ChatLine[]=[],heard='',example=''):string{`);
  once("'Use natural standard Japanese, short familiar words, at most 2 short sentences and ONE easy question per turn. Keep ordinary replies within 65 Japanese characters where possible. Never stack questions or demand a reason. Never announce steps or praise correctness mechanically.',","'Use natural standard Japanese, short familiar words and at most two short sentences. At MOST one easy question, NOT one mandatory question. Keep ordinary replies within 65 Japanese characters where possible. Never stack questions or demand a reason. Never announce steps or praise correctness mechanically. Speak respectfully to an adult; easy must not mean childish.',");
  once("    kind==='answer'?'Respond to LEARNER, not to a prepared next exercise. If the learner asked you a simple question, answer briefly instead of ignoring it. Do not assume the sample answers are their preference.':'',",`    kind==='answer'?'Respond to LEARNER, not to a prepared next exercise. A short word or incomplete sentence is meaningful; do not demand repetition or a full sentence. Do not assume the sample answers are their preference. Never invent a personal history, body, pets, employment or offline experiences for yourself.':'',
    kind==='answer'&&chatResponseStyle(history,heard)==='answer-only'?'The learner asked YOU something. Answer briefly and directly, no follow-up question in this turn. Stay honest about being AI, without a long disclaimer.':'',
    kind==='answer'&&chatResponseStyle(history,heard)==='acknowledge'?'NO QUESTION THIS TURN: the previous two companion turns already asked questions. Briefly respond to what was said; a warm acknowledgement is enough. Do not ask another question, imply an obligation to continue, or announce the session is over.':'',
    kind==='answer'&&chatResponseStyle(history,heard)==='followup-optional'?'A brief relevant reaction can be enough. Only ask an easy follow-up when it gives the learner an obvious way to continue; no automatic interview or repeated why-questions.':'',`);
  once("    kind==='help'?'Help the learner answer the MOST RECENT question in HISTORY, not the first question. Say one short usable example, clearly as an option, then wait. Do not invent a preference on their behalf or add a question.':'',",`    kind==='help'?'Help the learner answer the MOST RECENT question in HISTORY, not the first question. Give one small usable expression, clearly optional, then wait; do not add a question, new facts, or a preference on their behalf. If they already expressed their intent, preserve it.':'',
    kind==='help'&&example&&example.length<=48?\`The optional scaffold was prepared for this exact turn. Say only 例えば、「\${example}」, then wait. Never say that this is the learner's actual belief.\`:'',`);
  once("kind==='resume'?'A technical connection was renewed, NOT a new lesson. Preserve HISTORY. Briefly repeat the most recent unanswered question, or the topic opening if there is no history. Do not explain technology or start a new topic.':'',","kind==='resume'?'A technical connection was renewed, NOT a new lesson. Preserve HISTORY. Briefly repeat the most recent assistant utterance or topic opening; if it was a comment, do not turn it into a question. Do not explain technology or start a new topic.':'',");
});
patch('src/NhkSpeakingCoach.tsx','fb0a471a917836012641d1eacd4e053837c87978',once=>{
  once("import './nhkChat.css';","import './nhkChat.css';\nimport './nhkTurnSupport.css';\nimport {localTurnSupport,type TurnSupportFrame} from './nhkTurnSupport';\nimport {ChatExperienceStore,ChatExperienceSession} from './nhkChatExperience';\nimport {ChatExperienceSettings,ChatEffortCheck} from './NhkChatExperience';");
  once("  const connection=useRef<NhkChatConnection|null>(null)","  const [support,setSupport]=useState<TurnSupportFrame|null>(null),[supportVisible,setSupportVisible]=useState(true);\n  const [experience]=useState(()=>new ChatExperienceStore());const session=useRef<ChatExperienceSession|null>(null);const shown=useRef(new Set<string>());\n  const connection=useRef<NhkChatConnection|null>(null)");
  once("setAssistant('');setShowHelp(false);setTurns(0);setHint('不喜欢这个，也可以继续换。');","setAssistant('');setSupport(null);setShowHelp(false);setTurns(0);setHint('不喜欢这个，也可以继续换。');");
  once('  const dismiss=()=>{connection.current?.dispose();','  const dismiss=()=>{session.current?.finish();connection.current?.dispose();');
  once('if(Date.now()<retryUntil)return;connection.current?.dispose();','if(Date.now()<retryUntil)return;session.current?.finish();connection.current?.dispose();session.current=new ChatExperienceSession(experience);shown.current.clear();setSupport(null);');
  once("{phase:p=>{if(current())setPhase(p);}","{support:f=>{if(current())setSupport(f);},metric:e=>{if(current())session.current?.mark(e);},phase:p=>{if(current()){if(p==='done'||p==='error')session.current?.finish();setPhase(p);}}");
  once('    connection.current=next;void next.start();','    connection.current=next;next.setSupportEnabled(supportVisible);void next.start();');
  once('  useEffect(()=>()=>{sequence.current++;connection.current?.dispose();},[]);','  useEffect(()=>()=>{session.current?.finish();sequence.current++;connection.current?.dispose();},[]);');
  once("  const running=!['done','error'].includes(phase)",`  const frame=support||(!turns&&!showHelp?localTurnSupport('opening',selected.questionJa):null);
  useEffect(()=>{if(open&&supportVisible&&frame&&(frame.words.length||frame.starter)&&!shown.current.has(frame.key)){shown.current.add(frame.key);session.current?.mark('hint_shown');}},[open,supportVisible,frame]);
  const toggleSupport=()=>{const on=!supportVisible;setSupportVisible(on);connection.current?.setSupportEnabled(on);if(!on)session.current?.mark('hint_hidden');};
  const running=!['done','error'].includes(phase)`);
  once('data-speaking-contract="nhk-chat-v2"','data-speaking-contract="nhk-chat-v2" data-turn-support="nhk-turn-support-v1"');
  once('    {open&&createPortal(', '    <ChatExperienceSettings store={experience}/>\n    {open&&createPortal(');
  once(`<div className="nhk-speaking-step nhk-chat-current"><small>{showHelp?'借用这一句，再说成自己的':'现在只接这一句'}</small><strong lang="ja">{assistant||(!turns?selected.questionJa:'我在接着你的话想一句…')}</strong>{!turns&&!showHelp&&<div className="nhk-chat-suggestions">{selected.answersJa.map(a=><span lang="ja" key={a}>{a}</span>)}</div>}</div>`,
`<div className="nhk-speaking-step nhk-chat-current"><small>{showHelp?'刚才聊到这里':'接一点，也可以'}</small><strong lang="ja">{showHelp&&frame?frame.question:assistant||(!turns?selected.questionJa:'正在接着你的话…')}</strong>
          <div className="nhk-turn-support" data-testid="turn-support" data-turn-key={frame?.key||''}>
            <div className="nhk-turn-support-label"><span>{supportVisible?'可以从这里接，不必照着说':'按自己的意思说就好'}</span><button onClick={toggleSupport} aria-expanded={supportVisible}>{supportVisible?'收起提示':'显示提示'}</button></div>
            {supportVisible&&frame&&<div className="nhk-turn-support-chips">{[...frame.words,frame.starter].filter(Boolean).slice(0,3).map((word,i)=><span lang="ja" key={i}>{word}</span>)}</div>}
            {showHelp&&(assistant||frame?.example)&&<div className="nhk-turn-support-example"><small>只是一个说法，可以换成你的意思</small><p lang="ja">{assistant||frame?.example}</p></div>}
          </div></div>`);
  once('<button className="nhk-speaking-start" onClick={start}>接着这个话题聊</button>', '<ChatEffortCheck session={session.current}/><button className="nhk-speaking-start" onClick={start}>接着这个话题聊</button>');
});
console.log('Turn support integrated: frontend only; legacy API/edge and storage schemas unchanged.');
