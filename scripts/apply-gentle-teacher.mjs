import {readFileSync,writeFileSync} from 'node:fs';
function once(s,a,b){if(s.split(a).length!==2)throw new Error(`Unique integration anchor required: ${a.slice(0,90)}`);return s.replace(a,b);}
let s=readFileSync('src/nhkChatConnection.ts','utf8');
if(!s.includes('TeacherTurnChannel')){
 s="import {TeacherTurnChannel,TEACHER_SPEED,TEACHER_SLOW_SPEED,teacherControl,teacherFrame,teacherLastQuestion,teacherVoiceInstructions,fallbackTeacherTurn,type TeacherTurn,type TeacherContext} from './nhkGentleTeacher';\n"+s;
 s=once(s,"type Job={kind:ChatAction;heard:string;example?:string};","type Job={kind:ChatAction|'simplify';heard:string;example?:string};");
 s=once(s,'private support:TurnSupportChannel;','private support:TurnSupportChannel;\n  private teacher:TeacherTurnChannel;private lastTeacher:TeacherTurn|null=null;private plannedTeacher:TeacherTurn|null=null;private speed=TEACHER_SPEED;private configuredSpeed=0;private voiceLimit:ReturnType<typeof setTimeout>|undefined;private clipped=false;');
 s=once(s,'constructor(private plan:ChatPlan,private hooks:ChatHooks){this.support=', 'constructor(private plan:ChatPlan,private hooks:ChatHooks){this.teacher=new TeacherTurnChannel(e=>this.emit(e));this.support=');
 s=once(s,'metric?:(event:ExperienceMetric)=>void};','metric?:(event:ExperienceMetric)=>void;pace?:(value:number)=>void};');
 const a=s.indexOf('  private prepareSupport()');const b=s.indexOf('\n  async start()',a);if(a<0||b<a)throw new Error('support method anchor');
 s=s.slice(0,a)+`  private prepareSupport(){
    if(this.pending||this.shuffleTimer||!this.output||!['start','answer','resume','simplify'].includes(this.activeJob.kind))return;
    const key=\`\${this.serial}-\${this.topicSerial}-\${this.requestSeq}\`;
    const frame=this.plannedTeacher&&teacherFrame(key,this.plannedTeacher,this.output);
    if(frame&&(frame.words.length||frame.starter))this.support.adopt(frame);else this.support.begin(key,this.output,{learner:this.activeJob.heard,source:[]});
  }
  private teacherContext(job:Job):TeacherContext{return {kind:job.kind,plan:this.plan,history:this.history,heard:job.heard,previous:this.lastTeacher};}
  slowDown(){if(this.closed)return;this.speed=TEACHER_SLOW_SPEED;this.hooks.pace?.(this.speed);this.hooks.hint('慢一点，还是刚才这一句。');this.repeat();}
  simplify(){if(this.closed)return;this.hooks.hint('不换话题，只把刚才那句变简单。');this.request({kind:'simplify',heard:''});}
  private stopLongVoice(){
    if(this.closed||this.clipped)return;this.clipped=true;clearTimeout(this.voiceLimit);clearTimeout(this.watchdog);
    if(this.responseId)this.emit({type:'response.cancel',response_id:this.responseId});this.emit({type:'output_audio_buffer.clear'});
    this.support.cancelPending();this.generation=false;this.responseDone=true;this.playbackDone=true;
    this.hooks.hint('先停一下，一次只说一点。可以点“再简单点”。');this.listen();
  }`+s.slice(b);
 s=once(s,'private closePeer(){this.support.reset();','private closePeer(){this.teacher.reset();this.configuredSpeed=0;clearTimeout(this.voiceLimit);this.support.reset();');
 const x=s.indexOf('  private request(job:Job)');const y=s.indexOf('\n  changeTopic(',x);if(x<0||y<x)throw new Error('request method anchor');
 s=s.slice(0,x)+`  private request(job:Job){
    if(this.closed)return;this.teacher.cancel();
    if(job.kind==='help'||job.kind==='repeat')this.support.cancelPending();else this.support.clear();
    this.mic(false);this.waiting=false;this.talking=false;clearTimeout(this.idle);clearTimeout(this.voiceLimit);
    if(this.busyConnecting){this.pending=job;return;}
    if(this.generation){this.pending=job;if(this.responseId)this.emit({type:'response.cancel',response_id:this.responseId});this.emit({type:'output_audio_buffer.clear'});return;}
    if(this.renewDue||Date.now()>=this.renewAt||this.responses>=22){this.rotate(job);return;}
    this.pending=null;this.committed.clear();this.emit({type:'input_audio_buffer.clear'});if(this.responses)this.emit({type:'output_audio_buffer.clear'});
    this.requestSeq++;this.responseId='';this.responseDone=false;this.playbackDone=false;this.clipped=false;this.output='';this.activeJob=job;
    this.hooks.assistant('');const key=\`\${this.serial}-\${this.topicSerial}-\${this.requestSeq}\`;
    const context=this.teacherContext(job);
    if(['start','repeat','resume'].includes(job.kind)||(job.kind==='help'&&job.example)){
      if(job.kind==='help')context.previous={...(context.previous||fallbackTeacherTurn(context)),example:job.example!};
      this.playTeacher(job,fallbackTeacherTurn(context));return;
    }
    this.responses++;this.hooks.phase('thinking');
    this.teacher.begin(key,context,turn=>{
      if(this.closed||key!==\`\${this.serial}-\${this.topicSerial}-\${this.requestSeq}\`||this.pending||this.shuffleTimer)return;
      this.playTeacher(job,turn);
    });
  }
  private playTeacher(job:Job,turn:TeacherTurn){
    if(this.closed||this.busyConnecting)return;
    if(this.configuredSpeed!==this.speed){this.emit({type:'session.update',session:{type:'realtime',audio:{output:{speed:this.speed}}}});this.configuredSpeed=this.speed;}
    this.plannedTeacher=turn;if(job.kind!=='help'&&job.kind!=='repeat')this.lastTeacher=turn;
    this.responses++;this.generation=true;this.activeJob=job;this.hooks.phase('coach');this.hooks.metric?.('request_sent');
    this.emit({type:'response.create',response:{conversation:'none',input:[],output_modalities:['audio'],max_output_tokens:256,instructions:teacherVoiceInstructions(turn),metadata:{purpose:CHAT_CONTRACT,seq:String(this.requestSeq),topic:String(this.topicSerial)}}});
    clearTimeout(this.watchdog);this.watchdog=setTimeout(()=>this.fail('response_timeout'),28000);
  }`+s.slice(y);
 s=once(s,'changeTopic(plan:ChatPlan){if(this.closed)return;this.support.clear();','changeTopic(plan:ChatPlan){if(this.closed)return;this.teacher.cancel();this.lastTeacher=null;this.plannedTeacher=null;clearTimeout(this.voiceLimit);this.support.clear();');
 s=once(s,"private event(e:any){if(this.closed||!e||typeof e.type!=='string')return;if(this.support.handle(e))return;","private event(e:any){if(this.closed||!e||typeof e.type!=='string')return;if(this.teacher.handle(e)||this.support.handle(e))return;");
 s=once(s,"this.hooks.assistant(this.output);}break;", "this.hooks.assistant(this.output);if(this.output.length>64)this.stopLongVoice();}break;");
 s=once(s,"case'output_audio_buffer.started':this.hooks.metric?.('audio_started');", "case'output_audio_buffer.started':clearTimeout(this.voiceLimit);this.voiceLimit=setTimeout(()=>this.stopLongVoice(),16000);this.hooks.metric?.('audio_started');");
 s=once(s,"case'output_audio_buffer.stopped':this.playbackDone=true;", "case'output_audio_buffer.stopped':clearTimeout(this.voiceLimit);this.playbackDone=true;");
 s=once(s,"if(e.response?.status==='cancelled')break;", "if(e.response?.status==='cancelled'){if(this.clipped)this.listen();break;}");
 s=once(s,"this.mic(false);this.waiting=false;this.talking=false;\n        if(intent==='end')", "this.mic(false);this.waiting=false;this.talking=false;\n        const control=teacherControl(text);if(control==='slow'){this.slowDown();break;}if(control==='simplify'){this.simplify();break;}\n        if(intent==='end')");
 s=s.replaceAll('if(!this.pending&&!this.shuffleTimer){this.output=', 'if(!this.pending&&!this.shuffleTimer&&!this.clipped){this.output=');
 writeFileSync('src/nhkChatConnection.ts',s);
}
s=readFileSync('src/nhkTurnSupport.ts','utf8');
if(!s.includes('adopt(frame:TurnSupportFrame)')){
 s=once(s,'  setEnabled(on:boolean)', '  /** A checked teacher plan already contains the matching scaffold; no second hint request. */\n  adopt(frame:TurnSupportFrame){this.cancelPending();this.frame=frame;this.context={learner:\'\',source:[]};this.hooks.update(frame);}\n  setEnabled(on:boolean)');
 writeFileSync('src/nhkTurnSupport.ts',s);
}
s=readFileSync('src/NhkSpeakingCoach.tsx','utf8');
if(!s.includes('nhkGentleTeacher.css')){
 s="import './nhkGentleTeacher.css';\n"+s;
 s=once(s,"const [support,setSupport]", "const [pace,setPace]=useState(0.8);\n  const [support,setSupport]");
 s=once(s,"setPhase('connecting');setAssistant('');", "setPhase('connecting');setPace(0.8);setAssistant('');");
 s=once(s,'new NhkChatConnection(plan(),{support:', 'new NhkChatConnection(plan(),{pace:v=>{if(current())setPace(v);},support:');
 s=once(s,'只聊这篇，也可以聊到你的生活','从新闻出发，顺着你的话聊');
 s=once(s,'data-turn-support="nhk-turn-support-v1"','data-turn-support="nhk-turn-support-v1" data-teacher="nhk-gentle-teacher-v1"');
 s=once(s,'        <div className="nhk-chat-minor-tools">','        <div className="nhk-teacher-tools"><button disabled={!connected} onClick={()=>connection.current?.slowDown()} aria-pressed={pace<0.8}><Volume2 size={16}/>{pace<0.8?\'慢速重听\':\'慢一点\'}</button><button disabled={!connected} onClick={()=>{setShowHelp(false);connection.current?.simplify();}}>再简单点</button></div>\n        <div className="nhk-chat-minor-tools">');
 writeFileSync('src/NhkSpeakingCoach.tsx',s);
}
console.log('Gentle teacher integrated; no API/edge/credentials/storage-schema changes.');
