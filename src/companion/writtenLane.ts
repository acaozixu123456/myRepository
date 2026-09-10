import type {Line} from './model.ts';
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
