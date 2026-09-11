/** Volatile copy of the AI's REMOTE output only. No user recording, persistence or upload. */
export class RemoteReplay {
 private remote:MediaStream|null=null;private recorder:MediaRecorder|null=null;private blob:Blob|null=null;private capture=0;private limit:ReturnType<typeof setTimeout>|undefined;
 private player:HTMLAudioElement|null=null;private url='';private playEpoch=0;private stopped=false;
 active=false;blocked=false;
 constructor(private changed:(ready:boolean,playing:boolean,blocked:boolean)=>void){}
 get ready(){return !!this.blob;}
 attachRemote(stream:MediaStream){this.remote=stream;}
 begin(){
  this.cancelCapture();this.blob=null;this.notify();
  if(this.stopped||!this.remote||typeof MediaRecorder==='undefined')return;
  const epoch=++this.capture,chunks:Blob[]=[];let total=0;
  try{
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
   const recorder=this.recorder=new MediaRecorder(this.remote,mime?{mimeType:mime}:undefined);
   recorder.ondataavailable=e=>{if(epoch!==this.capture||!e.data.size)return;total+=e.data.size;if(total>4000000){this.cancelCapture();return;}chunks.push(e.data);};
   recorder.onerror=()=>{if(epoch===this.capture)this.cancelCapture();};
   recorder.onstop=()=>{if(epoch!==this.capture||this.stopped)return;this.recorder=null;clearTimeout(this.limit);if(chunks.length&&total>128)this.blob=new Blob(chunks,{type:recorder.mimeType||mime||'audio/webm'});this.notify();};
   recorder.start(200);this.limit=setTimeout(()=>this.cancelCapture(),60000);
  }catch{this.recorder=null;}
 }
 complete(){clearTimeout(this.limit);if(this.recorder?.state==='recording')try{this.recorder.stop();}catch{this.cancelCapture();}}
 cancelCapture(){this.capture++;clearTimeout(this.limit);const recorder=this.recorder;this.recorder=null;if(recorder&&recorder.state!=='inactive')try{recorder.stop();}catch{/* Optional replay must never break the live transport. */}}
 clear(){this.cancelCapture();this.stopPlayback();this.blob=null;this.notify();}
 private notify(){this.changed(this.ready,this.active,this.blocked);}
 async playOriginal(){if(!this.blob)throw Error('original_unavailable');await this.playBlob(this.blob);}
 async playBlob(blob:Blob){
  if(this.stopped)return;this.stopPlayback();const epoch=++this.playEpoch;
  const audio=this.player=document.createElement('audio');audio.setAttribute('playsinline','');audio.preload='auto';audio.playbackRate=1;audio.style.display='none';document.body.appendChild(audio);
  this.url=URL.createObjectURL(blob);audio.src=this.url;
  audio.onplaying=()=>{if(epoch===this.playEpoch){this.active=true;this.blocked=false;this.notify();}};
  audio.onended=()=>{if(epoch===this.playEpoch)this.stopPlayback();};
  audio.onerror=()=>{if(epoch===this.playEpoch){this.active=false;this.blocked=true;this.notify();}};
  try{await audio.play();}catch{if(epoch===this.playEpoch){this.blocked=true;this.active=false;this.notify();}}
 }
 async unlock(){if(!this.player||this.stopped)return;try{await this.player.play();}catch{this.blocked=true;this.notify();}}
 stopPlayback(){this.playEpoch++;if(this.player){this.player.onplaying=null;this.player.onended=null;this.player.onerror=null;this.player.pause();this.player.removeAttribute('src');this.player.remove();}this.player=null;if(this.url)URL.revokeObjectURL(this.url);this.url='';this.active=false;this.blocked=false;this.notify();}
 dispose(){this.stopped=true;this.clear();this.remote=null;}
}
