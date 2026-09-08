/** Opt-in LOCAL-only UX observations. No text, recordings, article identity, IP, user ID or network calls. */
export const EXPERIENCE_KEY='nihongo-chat-experience-v1';
export type ExperienceMetric='permission_ready'|'request_sent'|'audio_started'|'help'|'answer'|'shuffle'|'hint_shown'|'hint_hidden'|'renew';
export type Effort='easy'|'okay'|'hard';
export type ExperienceRow={day:string;firstAudioWaitMs:number|null;replyWaitTotalMs:number;replyWaitSamples:number;helpUses:number;answersAfterHelp:number;answerEvents:number;shuffles:number;hintsShown:number;hintsHidden:number;renewals:number;effort:Effort|null};
type State={version:1;enabled:boolean;rows:ExperienceRow[]};
type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const numberFields=['replyWaitTotalMs','replyWaitSamples','helpUses','answersAfterHelp','answerEvents','shuffles','hintsShown','hintsHidden','renewals'] as const;
const today=()=>new Date().toISOString().slice(0,10);
const fresh=():ExperienceRow=>({day:today(),firstAudioWaitMs:null,replyWaitTotalMs:0,replyWaitSamples:0,helpUses:0,answersAfterHelp:0,answerEvents:0,shuffles:0,hintsShown:0,hintsHidden:0,renewals:0,effort:null});
const retain=(rows:ExperienceRow[])=>{const cutoff=new Date(Date.now()-14*86400000).toISOString().slice(0,10);return rows.filter(r=>r.day>=cutoff&&r.day<=today()).slice(-30);};
export function cleanExperienceRow(raw:unknown):ExperienceRow|null {
  if(!raw||typeof raw!=='object')return null;const v=raw as Record<string,unknown>;
  if(typeof v.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v.day))return null;
  if(v.firstAudioWaitMs!==null&&(!Number.isFinite(v.firstAudioWaitMs)||Number(v.firstAudioWaitMs)<0||Number(v.firstAudioWaitMs)>180000))return null;
  if(!numberFields.every(k=>Number.isFinite(v[k])&&Number(v[k])>=0&&Number(v[k])<=3600000))return null;
  if(v.effort!==null&&!['easy','okay','hard'].includes(String(v.effort)))return null;
  const row=fresh();row.day=v.day;row.firstAudioWaitMs=v.firstAudioWaitMs as number|null;row.effort=v.effort as Effort|null;
  for(const k of numberFields)row[k]=Math.round(Number(v[k]));return row;
}
export class ChatExperienceStore {
  private storage:StorageLike|null;private state:State={version:1,enabled:false,rows:[]};private blocked=false;private revision=0;private generation=0;private listeners=new Set<()=>void>();
  constructor(storage?:StorageLike){
    this.storage=null;
    try{
      this.storage=storage||localStorage;const text=this.storage.getItem(EXPERIENCE_KEY);if(!text)return;
      const raw=JSON.parse(text);
      if(raw?.version!==1||typeof raw.enabled!=='boolean'||!Array.isArray(raw.rows)){this.blocked=true;return;}
      const rows=raw.rows.map(cleanExperienceRow) as Array<ExperienceRow|null>;
      if(rows.some(r=>!r)){this.blocked=true;return;}
      this.state={version:1,enabled:raw.enabled,rows:raw.enabled?retain(rows as ExperienceRow[]):[]};
      if(rows.length!==this.state.rows.length)this.save();
    }catch{this.blocked=true;}
  }
  get enabled(){return this.state.enabled&&!this.blocked;}
  get count(){return this.state.rows.length;}
  get unavailable(){return this.blocked;}
  get currentRevision(){return this.revision;}
  get consentGeneration(){return this.generation;}
  subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn);};}
  private notify(){this.revision++;for(const fn of this.listeners)fn();}
  private save(){try{this.storage?.setItem(EXPERIENCE_KEY,JSON.stringify(this.state));}catch{this.blocked=true;}this.notify();}
  consent(on:boolean){if(this.blocked)return;this.generation++;this.state={version:1,enabled:on,rows:on?retain(this.state.rows):[]};this.save();}
  clear(){this.generation++;try{this.storage?.removeItem(EXPERIENCE_KEY);this.blocked=false;this.state={version:1,enabled:false,rows:[]};}catch{this.blocked=true;}this.notify();}
  append(row:ExperienceRow){if(!this.enabled)return -1;const safe=cleanExperienceRow(row);if(!safe)return -1;this.state.rows=retain([...this.state.rows,safe]);this.save();return this.revision;}
  feedback(revision:number,effort:Effort){if(!this.enabled||this.revision!==revision||!this.state.rows.length||!['easy','okay','hard'].includes(effort))return;this.state.rows[this.state.rows.length-1].effort=effort;this.save();}
  export(){const rows=retain(this.state.rows);if(!this.blocked&&rows.length!==this.state.rows.length){this.state.rows=rows;this.save();}return JSON.stringify({version:1,scope:'local_ux_only_not_learning_scores',timing:'server_playback_start_event_not_acoustic_or_learner_reaction_time',rows:rows.map(cleanExperienceRow).filter(Boolean)},null,2);}
}
export class ChatExperienceSession {
  private store:ChatExperienceStore;private clock:()=>number;private row=fresh();private readyAt:number|null=null;private waitingAt:number|null=null;private helpPending=false;private ended=false;private revision=-1;private answeredFeedback=false;private generation:number;
  constructor(store:ChatExperienceStore,clock=()=>performance.now()){this.store=store;this.clock=clock;this.generation=store.consentGeneration;}
  private syncConsent(){if(this.generation!==this.store.consentGeneration){this.generation=this.store.consentGeneration;this.row=fresh();this.readyAt=null;this.waitingAt=null;this.helpPending=false;}}
  mark(event:ExperienceMetric){
    this.syncConsent();
    if(this.ended||!this.store.enabled)return;const now=this.clock();
    switch(event){
      case'permission_ready':if(this.readyAt===null)this.readyAt=now;break;
      case'request_sent':this.waitingAt=now;break;
      case'audio_started':if(this.row.firstAudioWaitMs===null&&this.readyAt!==null)this.row.firstAudioWaitMs=Math.min(180000,Math.round(now-this.readyAt));if(this.waitingAt!==null){this.row.replyWaitTotalMs+=Math.min(180000,Math.round(now-this.waitingAt));this.row.replyWaitSamples++;this.waitingAt=null;}break;
      case'help':this.row.helpUses++;this.helpPending=true;break;
      case'answer':this.row.answerEvents++;if(this.helpPending)this.row.answersAfterHelp++;this.helpPending=false;break;
      case'shuffle':this.row.shuffles++;this.helpPending=false;break;
      case'hint_shown':this.row.hintsShown++;break;
      case'hint_hidden':this.row.hintsHidden++;break;
      case'renew':this.row.renewals++;break;
    }
  }
  finish(){if(this.ended)return;this.syncConsent();this.ended=true;this.revision=this.store.append(this.row);}
  get askEffort(){return this.ended&&this.store.enabled&&this.revision===this.store.currentRevision&&this.row.answerEvents>0&&this.store.count%3===1&&!this.answeredFeedback;}
  feedback(effort:Effort){if(!this.askEffort)return;this.store.feedback(this.revision,effort);this.answeredFeedback=true;}
}
