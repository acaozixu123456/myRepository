/** Ephemeral written coaching. No microphone, voice-generation or persistence access. */
export type FeedbackMode='automatic'|'help';
export type DialogueLine={id:string;role:'user'|'assistant';text:string;delivered:boolean;interrupted:boolean;assistance?:string};
export type FeedbackTarget={anchorId:string;userIds:string[];original:string;revision:string};
export type FeedbackInput={requestId:string;mode:FeedbackMode;topicId:string;target:FeedbackTarget;context:DialogueLine[]};
export type WrittenNote={kind:'correction'|'extension'|'wording'|'explanation';suggestionJa:string;highlight:string;reasonZh:string;detailZh:string;sourceSpan:string};
export type FeedbackEnvelope={requestId:string;anchorId:string;revision:string;note:WrittenNote|null};
export type PublishedNote=WrittenNote&{key:string;anchorId:string;original:string;userIds:string[];requested:boolean};
export const FEEDBACK_CONTRACT='companion-quiet-feedback-v1';
const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
/** Correlation fingerprint only, never an authorization token. */
export function textRevision(text:string):string{let h=2166136261;for(const c of text){h^=c.codePointAt(0)!;h=Math.imul(h,16777619);}return(h>>>0).toString(16)+':'+text.length;}
export function makeFeedbackInput(lines:DialogueLine[],topicId:string,mode:FeedbackMode,requestId:string):FeedbackInput|null{
 const context=lines.filter(l=>l.text.trim()&&l.delivered&&!l.interrupted).slice(-10).map(l=>({...l,text:l.text.slice(0,700)}));if(!context.length)return null;
 let lastUser=-1;for(let i=context.length-1;i>=0;i--)if(context[i].role==='user'){lastUser=i;break;}
 if(mode==='help'&&context.at(-1)?.role==='assistant'){const anchor=context.at(-1)!;return{requestId,mode,topicId,target:{anchorId:anchor.id,userIds:[],original:'',revision:textRevision(JSON.stringify(context))},context};}
 if(lastUser<0)return null;const group:DialogueLine[]=[];for(let i=lastUser;i>=0&&context[i].role==='user'&&group.length<3;i--)group.unshift(context[i]);
 const original=clean(group.map(l=>l.text).join(' '));if(!original||(mode==='automatic'&&/^(はい|いいえ|うん|えっと|えーと|あの|嗯|呃|谢谢|ありがとう)[。.!！?？\s]*$/u.test(original)))return null;
 const target={anchorId:group.at(-1)!.id,userIds:group.map(l=>l.id),original,revision:textRevision(original)};return{requestId,mode,topicId,target,context:context.slice(0,lastUser+1)};
}
export function validateEnvelope(raw:unknown,input:FeedbackInput):FeedbackEnvelope|null{
 if(!raw||typeof raw!=='object')return null;const r=raw as Record<string,unknown>;
 if(r.requestId!==input.requestId||r.anchorId!==input.target.anchorId||r.revision!==input.target.revision)return null;
 if(r.note===null)return{requestId:input.requestId,anchorId:input.target.anchorId,revision:input.target.revision,note:null};
 if(!r.note||typeof r.note!=='object')return null;const n=r.note as Record<string,unknown>;if(!['correction','extension','wording','explanation'].includes(String(n.kind)))return null;
 for(const[k,max]of[['suggestionJa',160],['highlight',100],['reasonZh',100],['detailZh',360],['sourceSpan',220]]as const){if(typeof n[k]!=='string'||(n[k]as string).length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/u.test(n[k]as string))return null;}
 const note=n as unknown as WrittenNote;if(!note.suggestionJa.trim()||!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(note.suggestionJa)||!note.reasonZh.trim())return null;
 if(note.highlight&&!note.suggestionJa.includes(note.highlight))return null;if(note.sourceSpan&&!input.target.original.includes(note.sourceSpan))return null;
 if(note.kind==='correction'&&(!note.sourceSpan||!input.target.original))return null;if(clean(note.suggestionJa)===clean(input.target.original))return null;
 return{requestId:input.requestId,anchorId:input.target.anchorId,revision:input.target.revision,note};
}
export type NoteRequest=(input:FeedbackInput,signal:AbortSignal)=>Promise<unknown>;
/** Bounded debouncing and cancellation. Cannot cancel a native voice response. */
export class QuietFeedbackController{
 private requestAbort:AbortController|null=null;private debounce:ReturnType<typeof setTimeout>|undefined;private timeout:ReturnType<typeof setTimeout>|undefined;
 private epoch=0;private disposed=false;private signature='';private deferred:PublishedNote|null|undefined;private userSpeaking=false;private reading=false;
 constructor(private request:NoteRequest,private publish:(note:PublishedNote|null)=>void,private issue:(message:string)=>void=()=>{}){}
 setPresentation(userSpeaking:boolean,reading:boolean){this.userSpeaking=userSpeaking;this.reading=reading;if(!userSpeaking&&!reading&&this.deferred!==undefined){const value=this.deferred;this.deferred=undefined;this.publish(value);}}
 update(input:FeedbackInput|null){if(this.disposed||!input)return;const key=[input.topicId,input.mode,input.target.anchorId,input.target.revision].join('|');if(key===this.signature)return;this.signature=key;this.cancelPending();const epoch=++this.epoch;this.debounce=setTimeout(()=>void this.run(input,key,epoch),input.mode==='help'?0:700);}
 private async run(input:FeedbackInput,key:string,epoch:number){const abort=this.requestAbort=new AbortController();this.timeout=setTimeout(()=>abort.abort(),12000);
  try{const raw=await this.request(input,abort.signal);if(this.disposed||abort.signal.aborted||epoch!==this.epoch)return;const parsed=validateEnvelope(raw,input);if(!parsed)throw new Error('invalid_note');const value=parsed.note?{...parsed.note,key,anchorId:input.target.anchorId,original:input.target.original,userIds:input.target.userIds,requested:input.mode==='help'}:null;if(this.userSpeaking||this.reading)this.deferred=value;else this.publish(value);}
  catch{if(!this.disposed&&epoch===this.epoch&&input.mode==='help')this.issue('这句的文字提示暂时没接上，聊天不受影响。');}
  finally{if(epoch===this.epoch){clearTimeout(this.timeout);this.requestAbort=null;}}
 }
 private cancelPending(){clearTimeout(this.debounce);clearTimeout(this.timeout);this.requestAbort?.abort();this.requestAbort=null;this.deferred=undefined;}
 reset(){this.epoch++;this.signature='';this.cancelPending();}dispose(){this.disposed=true;this.reset();}
}
