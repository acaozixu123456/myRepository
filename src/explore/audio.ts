export type AudioStatus='idle'|'loading'|'playing'|'error';
const SILENCE='data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
/** One text-bound stream. Cancelling a dialogue also cancels pending requests and late audio. */
export class SpeechPlayer{
  private audio=new Audio();private sequence=0;private controller:AbortController|null=null;
  private cache=new Map<string,string>();private dead=false;
  constructor(private change:(state:AudioStatus,message:string)=>void){}
  stop(){this.sequence++;this.controller?.abort();this.controller=null;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();if('speechSynthesis'in window)window.speechSynthesis.cancel();if(!this.dead)this.change('idle','');}
  async play(text:string){
    this.stop();const seq=this.sequence;this.change('loading','正在准备这句日语…');
    // Prime the same media element during the user's gesture. Failure is recoverable and explicit.
    this.audio.src=SILENCE;void this.audio.play().catch(()=>{});
    const controller=new AbortController();this.controller=controller;
    const timeout=window.setTimeout(()=>controller.abort(),35000);
    try{
      let url=this.cache.get(text);
      if(!url){
        const response=await fetch('/api/nhk-speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'tts',text}),signal:controller.signal});
        const data=await response.json();
        if(!response.ok||!data.ok||typeof data.url!=='string')throw new Error(response.status===429?'朗读额度暂时用完，可继续用文字交流。':'这句朗读暂不可用，可重试或选择系统日语声音。');
        const parsed=new URL(data.url,location.href);
        if(parsed.protocol!=='https:'||parsed.hostname!=='kivebsjsdfdobxzaokbj.supabase.co')throw new Error('朗读地址校验失败，请重试。');
        url=parsed.href;this.cache.set(text,url);
      }
      if(seq!==this.sequence||this.dead)return;
      this.audio.pause();this.audio.src=url;this.audio.playbackRate=.95;
      this.audio.onended=()=>{if(seq===this.sequence)this.change('idle','');};
      this.audio.onerror=()=>{if(seq===this.sequence)this.change('error','声音加载失败，请重试。');};
      await this.audio.play();if(seq===this.sequence)this.change('playing','正在朗读');
    }catch(error){
      if(seq!==this.sequence||this.dead)return;
      this.audio.pause();this.change('error',error instanceof Error&&error.name==='NotAllowedError'?'浏览器需要再次点击播放，请按「重听」。':error instanceof Error&&error.name==='AbortError'?'朗读请求超时，可重试；文字互动仍可继续。':error instanceof Error?error.message:'朗读暂不可用。');
    }finally{window.clearTimeout(timeout);}
  }
  system(text:string){
    this.stop();const seq=this.sequence;
    if(!('speechSynthesis'in window)){this.change('error','这个浏览器没有系统朗读。');return;}
    const voice=window.speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith('ja'));
    if(!voice){this.change('error','设备未提供日语系统声音。请使用原声重试，或继续文字互动。');return;}
    const u=new SpeechSynthesisUtterance(text);u.lang='ja-JP';u.voice=voice;u.rate=.9;
    u.onend=()=>{if(seq===this.sequence)this.change('idle','系统日语声音');};u.onerror=()=>{if(seq===this.sequence)this.change('error','系统朗读失败，请重试。');};
    window.speechSynthesis.speak(u);this.change('playing','系统日语声音 · 非原声');
  }
  dispose(){this.stop();this.dead=true;}
}
