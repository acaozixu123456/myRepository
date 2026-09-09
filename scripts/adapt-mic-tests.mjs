import {readFileSync,writeFileSync} from 'node:fs';
const path='src/nhkChatConnection.test.ts';let s=readFileSync(path,'utf8');
if(!s.includes('manual microphone consent')){
 s=s.replace('addTrack(){}createDataChannel()',"addTrack(){}addTransceiver(){return{sender:{replaceTrack:vi.fn().mockResolvedValue(undefined)}};}createDataChannel()");
 // Existing voice/teacher tests retain their assertions, with explicit microphone consent added.
 s=s.replaceAll('await c.start();','await c.start();await c.setMicEnabled(true);');
 s=s.replace("expect(hooks.error).toHaveBeenCalledWith('app_burst_limited',60);expect(track.stop).toHaveBeenCalled();", "expect(hooks.error).toHaveBeenCalledWith('app_burst_limited',60);expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();");
 s=s.replace('const promise=c.start();c.dispose();','await c.start();const promise=c.setMicEnabled(true);c.dispose();');
 s=s.replace('await promise;expect(track.stop).toHaveBeenCalledTimes(1);expect(fetch).not.toHaveBeenCalled();','await promise;expect(track.stop).toHaveBeenCalledTimes(1);expect(starts()).toHaveLength(1);');
 s+=`\n// New behavior: playback-only start is never microphone consent.\ndescribe('manual microphone consent',()=>{
 it('can hear the opening without ever requesting a microphone',async()=>{await c.start();reply();expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();expect(hooks.phase).toHaveBeenLastCalledWith('listening');});
 it('stops the actual track on mute and stays muted across replies and topic changes',async()=>{await c.start();reply();await c.setMicEnabled(true);expect(track.enabled).toBe(true);await c.setMicEnabled(false);expect(track.enabled).toBe(false);expect(track.stop).toHaveBeenCalledTimes(1);c.repeat();reply();c.changeTopic({...plan,topicId:chatTopics(plan)[1].id});await vi.advanceTimersByTimeAsync(450);reply();expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);expect(track.enabled).toBe(false);});
 it('ignores late permission when toggled back off, without stopping playback',async()=>{await c.start();reply();let grant!:(v:any)=>void;(navigator.mediaDevices.getUserMedia as any).mockImplementation(()=>new Promise(r=>{grant=r;}));const pending=c.setMicEnabled(true);await c.setMicEnabled(false);grant({getTracks:()=>[track],getAudioTracks:()=>[track]});await pending;expect(track.stop).toHaveBeenCalledTimes(1);expect(hooks.error).not.toHaveBeenCalled();expect(starts()).toHaveLength(1);});
 it('permission denial leaves listening-only mode available',async()=>{await c.start();reply();(navigator.mediaDevices.getUserMedia as any).mockRejectedValue(new DOMException('denied','NotAllowedError'));await c.setMicEnabled(true);expect(hooks.error).not.toHaveBeenCalled();c.repeat();reply();expect(starts()).toHaveLength(1);});
 it('muted ASR events cannot become learner answers',async()=>{await c.start();reply();speak('phantom','猫が好きです');expect(hooks.heard).not.toHaveBeenCalled();});
 it('reports output generation as preparation, not real playback',async()=>{hooks.activity=vi.fn();await c.start();expect(hooks.activity.mock.calls.at(-1)[0].output).toBe('preparing');expect(hooks.activity.mock.calls.at(-1)[0].micOn).toBe(false);});
});\n`;
 writeFileSync(path,s);
}
