import {companionApi} from '../companion/api';
import {RemoteReplay} from '../companion/remoteReplay';
import type {TeacherConnection} from '../companion/TeacherStudio';
import {validStudyResult,studyKey,type StudyTicket,type SelectionFocus,type StudyIntent,type Register,type StudyResult} from './contract';
let ticket:StudyTicket|null=null,ticketPending:Promise<StudyTicket>|null=null;
async function getTicket():Promise<StudyTicket>{
 if(ticket&&ticket.expiresAt>Date.now()+20000)return ticket;
 if(ticketPending)return ticketPending;
 ticketPending=companionApi('study_session').then(r=>{const t=r.ticket;if(!t||typeof t.id!=='string'||typeof t.token!=='string'||!Number.isFinite(t.expiresAt))throw Error('invalid_study_ticket');ticket=t;return t;}).finally(()=>{ticketPending=null;});return ticketPending;
}
export async function studyApi(action:string,input:Record<string,unknown>,signal?:AbortSignal){
 const t=await getTicket();if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 return companionApi(action,{studyTicket:t,input},signal);
}
const results=new Map<string,StudyResult>();
export async function learnSelection(focus:SelectionFocus,intent:StudyIntent,register:Register,signal:AbortSignal):Promise<StudyResult>{
 const cacheKey=studyKey(focus,intent,register);const prior=results.get(cacheKey);if(prior)return prior;
 const r=await studyApi('study',{requestId:crypto.randomUUID(),focus,intent,register},signal);
 const result=validStudyResult(r.result,focus.selectedText);if(!result||r.revision!==focus.revision)throw Error('invalid_study_response');if(signal.aborted)throw new DOMException('Aborted','AbortError');
 if(results.size>=60)results.delete(results.keys().next().value!);results.set(cacheKey,result);return result;
}
/** Independent text practice: NEVER establishes a peer connection or acquires a microphone. */
export class TextStudyConnection implements TeacherConnection{
 lines=[];private replay:RemoteReplay;private abort:AbortController|null=null;private epoch=0;
 constructor(private notice:(text:string)=>void=()=>{}){this.replay=new RemoteReplay((_r,p,b)=>{if(b)this.notice('浏览器需要你点击「播放已准备的声音」。');else if(p)this.notice('正在听 AI 示范');});}
 setPracticeMode(_on:boolean){} setPracticeContext(_cue:string){} useSupport(_text:string){} async setMic(_on:boolean){}
 teacherRequest(input:Record<string,unknown>,signal?:AbortSignal){return studyApi('study_lesson',input,signal);}
 async demonstrate(text:string,context?:string){
  this.stop();const epoch=this.epoch,abort=this.abort=new AbortController();this.notice('正在准备 AI 示范…');
  try{const r=await studyApi('study_demo',{requestId:crypto.randomUUID(),text,...(context?{context}: {})},abort.signal);if(epoch!==this.epoch)return;if(r.text!==text||r.mime!=='audio/mpeg'||typeof r.audio!=='string'||r.audio.length>2100000)throw Error('invalid_audio');const bytes=Uint8Array.from(atob(r.audio),(c:string)=>c.charCodeAt(0));await this.replay.playBlob(new Blob([bytes],{type:'audio/mpeg'}));}
  catch{if(!abort.signal.aborted)this.notice('示范暂未接上，请再点同一句重试。');}
 }
 unlock(){return this.replay.unlock();} stop(){this.epoch++;this.abort?.abort();this.replay.stopPlayback();} dispose(){this.stop();this.replay.dispose();}
}
