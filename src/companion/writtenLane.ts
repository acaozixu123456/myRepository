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
 private fingerprint='';private lastAttempt='';private timer:ReturnType<typeof setTimeout>|undefined;private abort:AbortController|null=null;
 private waiting:WrittenNote|null=null;private retired=new Set<string>();private explicit:NoteRequest|null=null;
 constructor(private request:Requester,private publish:(note:WrittenNote)=>void,private pending:(busy:boolean)=>void=()=>{}){}
 private automatic(){const newest=[...this.lines].reverse().find(l=>l.role==='user');if(newest&&(!newest.text||newest.interrupted||!newest.delivered))return null;return noteRequest(this.lines,'auto',this.target);}
 private unchanged(r:NoteRequest){const index=this.lines.findIndex(l=>l.id===r.anchorId),line=this.lines[index];return !!line&&!line.interrupted&&line.delivered&&line.text.slice(0,700)===r.source&&!this.lines.slice(index+1).some(l=>l.role==='user');}
 update(lines:Line[],target:number){
  if(this.stopped)return;this.lines=lines;this.target=target;
  // Assistant streaming or a late unrelated subtitle must not starve a requested help note.
  if(this.explicit&&this.unchanged(this.explicit)){this.deliver();return;}
  const r=this.automatic(),fingerprint=r?JSON.stringify([r.anchorId,r.source,r.context.map(l=>[l.id,l.text])]):'';
  if(fingerprint===this.fingerprint)return;this.fingerprint=fingerprint;this.invalidate();
  if(!r||(!this.enabled&&r.mode!=='question'))return;this.schedule(r,1100);
 }
 setSpeaking(value:boolean){this.speaking=value;if(value){clearTimeout(this.timer);}else{
  this.deliver();const r=this.explicit||this.automatic();
  if(r&&!this.abort&&!this.waiting&&(this.explicit||this.fingerprint!==this.lastAttempt)&&(this.enabled||r.mode!=='auto'))this.schedule(r,this.explicit?100:900);
 }}
 setReading(value:boolean){this.reading=value;if(!value)this.deliver();}
 setEnabled(value:boolean){if(value===this.enabled)return;this.enabled=value;if(!value){if(!this.explicit)this.invalidate();}else{this.fingerprint='';this.lastAttempt='';this.update(this.lines,this.target);}}
 help(){if(this.stopped)return;const r=noteRequest(this.lines,'help',this.target);if(!r)return;this.retired.delete(r.anchorId);this.invalidate();this.explicit=r;this.pending(true);this.schedule(r,200);}
 dismiss(anchorId:string){this.retired.add(anchorId);if(this.waiting?.anchorId===anchorId)this.waiting=null;}
 reset(){this.invalidate();this.lines=[];this.fingerprint='';this.lastAttempt='';this.retired.clear();}
 private invalidate(){this.epoch++;clearTimeout(this.timer);this.abort?.abort();this.abort=null;this.waiting=null;if(this.explicit){this.explicit=null;this.pending(false);}}
 private schedule(r:NoteRequest,delay:number){clearTimeout(this.timer);if(this.speaking)return;const epoch=this.epoch;this.timer=setTimeout(()=>void this.run(r,epoch),delay);}
 private async run(r:NoteRequest,epoch:number){
  if(this.stopped||epoch!==this.epoch||this.retired.has(r.anchorId))return;const abort=this.abort=new AbortController();this.lastAttempt=this.fingerprint;
  try{const result=await this.request(r,abort.signal);if(this.stopped||abort.signal.aborted||epoch!==this.epoch)return;
   const current=this.lines.find(l=>l.id===r.anchorId);if(!current||current.text.slice(0,700)!==r.source||current.interrupted)return;
   const note=validateWrittenNote(result,r);if(note){this.waiting=note;this.deliver();}
  }catch{/* Optional feedback never cancels, reconnects or delays the voice conversation. */}
  finally{if(this.abort===abort)this.abort=null;if(epoch===this.epoch&&this.explicit){this.explicit=null;this.pending(false);}}
 }
 private deliver(){if(this.stopped||this.speaking||this.reading||!this.waiting)return;const note=this.waiting;this.waiting=null;if(!this.retired.has(note.anchorId)&&noteStillApplies(note,this.lines,this.enabled))this.publish(note);}
 dispose(){this.stopped=true;this.invalidate();this.lines=[];this.retired.clear();}
}
