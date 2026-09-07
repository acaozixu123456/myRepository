import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {NhkSpeakingConnection} from './nhkSpeakingConnection';
import {buildSpeakingPlan} from './nhkSpeaking';
const plan=buildSpeakingPlan({id:'test',title:'ニュース',sentences:['子どもを守ります。']});
let dc:any,track:any,media:any,hooks:any,connection:NhkSpeakingConnection,peer:any;
const emit=(event:any)=>dc.onmessage?.({data:JSON.stringify(event)});
let response=0;
function reply(stop=true){const id=`r${++response}`;emit({type:'response.created',response:{id}});emit({type:'output_audio_buffer.started',response_id:id});emit({type:'response.done',response:{id,status:'completed'}});if(stop)emit({type:'output_audio_buffer.stopped',response_id:id});return id;}
function heard(id:string,text:string){emit({type:'input_audio_buffer.speech_started'});emit({type:'input_audio_buffer.speech_stopped'});emit({type:'conversation.item.input_audio_transcription.completed',item_id:id,transcript:text});}
beforeEach(()=>{
  vi.useFakeTimers();response=0;track={enabled:true,stop:vi.fn()};media={getTracks:()=>[track],getAudioTracks:()=>[track]};
  vi.stubGlobal('window',{isSecureContext:true});vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn().mockResolvedValue(media)}});
  vi.stubGlobal('document',{body:{appendChild:vi.fn()},createElement:()=>({style:{},setAttribute:vi.fn(),play:vi.fn().mockResolvedValue(undefined),pause:vi.fn(),remove:vi.fn()})});
  class FakePeer{connectionState='connected';localDescription:any;ontrack:any;onconnectionstatechange:any;constructor(){peer=this;}addTrack(){}createDataChannel(){dc={readyState:'connecting',send:vi.fn(),close:vi.fn(),onmessage:null,onopen:null,onclose:null,onerror:null};return dc;}async createOffer(){return{type:'offer',sdp:'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'};}async setLocalDescription(v:any){this.localDescription=v;}async setRemoteDescription(){dc.readyState='open';dc.onopen?.();}close=vi.fn();}
  vi.stubGlobal('RTCPeerConnection',FakePeer);
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>new Response(JSON.stringify({ok:true,contractVersion:'nhk-speaking-v1',model:'gpt-realtime-2.1',sdp:'v=0',callId:'rtc_test',expiresAt:Date.now()+110000,stopToken:'a'.repeat(64)}))));
  hooks={onPhase:vi.fn(),onProgress:vi.fn(),onAssistant:vi.fn(),onHint:vi.fn(),onBlocked:vi.fn(),onModel:vi.fn(),onError:vi.fn()};connection=new NhkSpeakingConnection(plan,hooks);
});
afterEach(()=>{connection.dispose();vi.useRealTimers();vi.unstubAllGlobals();});
describe('owned microphone and bounded turns',()=>{
  it('does not open a microphone on construction',()=>expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled());
  it('requires real playback end before enabling microphone',async()=>{await connection.start();expect(track.enabled).toBe(false);const id=reply(false);expect(track.enabled).toBe(false);emit({type:'output_audio_buffer.stopped',response_id:id});expect(track.enabled).toBe(true);});
  it('never counts help buttons or manual finish as speech',async()=>{await connection.start();reply();connection.finishUtterance();expect(hooks.onProgress).not.toHaveBeenCalled();connection.help();reply();expect(hooks.onProgress).not.toHaveBeenCalled();});
  it('counts ASR once and automatically closes after three answers',async()=>{await connection.start();reply();heard('a','子ども');reply();heard('a','子ども');expect(hooks.onProgress).toHaveBeenCalledTimes(1);heard('b','子どもを守ります');reply();heard('c','まだよく分かりません');reply();expect(hooks.onProgress.mock.calls.at(-1)[0].turn).toBe(3);expect(track.stop).toHaveBeenCalledTimes(1);expect(hooks.onPhase).toHaveBeenLastCalledWith('done');});
  it('help, fillers and ASR failure remain at the same step',async()=>{await connection.start();reply();heard('a','えっと');expect(hooks.onProgress.mock.calls.at(-1)[0].turn).toBe(0);heard('b','帮我接');reply();expect(hooks.onProgress.mock.calls.at(-1)[0].turn).toBe(0);emit({type:'conversation.item.input_audio_transcription.failed'});expect(track.enabled).toBe(true);});
  it('stops tracks, closes peer and sends a signed stop on exit',async()=>{await connection.start();connection.end();expect(track.stop).toHaveBeenCalledTimes(1);expect(peer.close).toHaveBeenCalledTimes(1);expect(JSON.parse((fetch as any).mock.calls.at(-1)[1].body).action).toBe('speaking_stop');});
  it('late microphone permission after dismissal cannot leak a track',async()=>{let grant!:(v:any)=>void;(navigator.mediaDevices.getUserMedia as any).mockImplementation(()=>new Promise(r=>{grant=r;}));const pending=connection.start();connection.dispose();grant(media);await pending;expect(track.stop).toHaveBeenCalledTimes(1);expect(fetch).not.toHaveBeenCalled();});
  it('closes on protocol failure without trying another model',async()=>{await connection.start();emit({type:'error',error:{code:'server_error'}});expect(track.stop).toHaveBeenCalled();expect(hooks.onPhase).toHaveBeenLastCalledWith('error');expect((fetch as any).mock.calls.filter((c:any)=>JSON.parse(c[1].body).action==='speaking_start')).toHaveLength(1);});
  it('closes a stalled assistant instead of leaving the mic running',async()=>{await connection.start();await vi.advanceTimersByTimeAsync(29000);expect(track.stop).toHaveBeenCalled();expect(hooks.onPhase).toHaveBeenLastCalledWith('error');});
});
