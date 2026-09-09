/** Controls native audio response scheduling, independently of fallible/delayed ASR. */
export class NativeTurnGate {
  private seen=new Set<string>();private pending:string[]=[];
  speaking=false;active=false;
  commit(id:string){if(!id||this.seen.has(id))return false;this.seen.add(id);this.pending.push(id);if(this.seen.size>300)this.seen.delete(this.seen.values().next().value!);return true;}
  get ready(){return this.pending.length>0&&!this.speaking&&!this.active;}
  get hasPending(){return this.pending.length>0;}
  consume(){const ids=this.pending.splice(0);this.active=true;return ids;}
  finish(){this.active=false;}
  clear(){this.pending=[];this.speaking=false;this.active=false;}
}
