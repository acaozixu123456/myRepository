import type {CSSProperties} from 'react';
import {Headphones,Radio,ShieldCheck} from 'lucide-react';
import type {VoiceActivity} from '../nhkAudioActivity';
import type {Phase} from './connection';

/** Visual identity only. These components never acquire media, issue API calls or simulate speech. */
export function NeonMark(){return <svg width="27" height="27" viewBox="0 0 30 30" fill="none" aria-hidden="true"><path d="M3 5h7v7h10V5h7v20h-7v-7H10v7H3V5Z" fill="currentColor"/><path d="M0 2h12M18 28h12" stroke="currentColor" strokeWidth="1.5"/></svg>;}
export function NeonHero(){return <section className="neon-hero" aria-label="HITOKOTO 日语陪聊">
 <div className="neon-hero-city" aria-hidden="true"/>
 <div className="neon-hero-grid" aria-hidden="true"/>
 <span className="neon-eyebrow"><i/> YOUR NEXT CONVERSATION</span>
 <div className="neon-hero-copy"><p lang="ja">今日も、ひとこと。</p><h1>下一句，<br/><em>说出你的世界。</em></h1><p>不用准备好。<br/>从你想说的那一句开始。</p></div>
 <div className="neon-hero-portrait" aria-hidden="true"><img src="/art/hitokoto-partner.webp" alt="" width="184" height="197" fetchPriority="high"/><span>ひとこと <b>AI</b></span></div>
 <div className="neon-hero-foot"><span><Headphones size={12}/> 日本語 / 中文辅助</span><span>SMALL TALKS. BIGGER YOU.</span></div>
</section>;}
export function voiceVisual(phase:Phase,activity:VoiceActivity){
 if(phase==='error'||phase==='closed')return {key:'offline',label:phase==='error'?'连接待恢复':'会话已结束',code:'OFFLINE'};
 if(phase==='connecting')return {key:'linking',label:'正在接通',code:'CONNECTING'};
 if(activity.output==='blocked')return {key:'blocked',label:'等待你允许播放',code:'TAP TO PLAY'};
 if(activity.input==='receiving'&&activity.micOn)return {key:'listening',label:'正在听你说',code:'YOUR VOICE'};
 if(activity.output==='playing')return {key:'speaking',label:'对方正在说',code:'AI VOICE'};
 if(phase==='thinking')return {key:'thinking',label:'正在接你的话',code:'THINKING'};
 return {key:activity.micOn?'open':'muted',label:activity.micOn?'已开麦，慢慢说':'先听一句，准备好再开麦',code:activity.micOn?'MIC OPEN':'MIC OFF'};
}
export function NeonSignal({level=0,active=false}:{level?:number;active?:boolean}){
 const weights=[.25,.48,.72,.32,.6,.9,.5,.78,.35,.85,.65,1,.55,.9,.7,.4,.78,.5,.92,.65,.3,.7,.42,.6,.25];
 const value=Number.isFinite(level)?Math.max(0,Math.min(1,level)):0;
 return <div className={`neon-signal ${active?'active':''}`} aria-hidden="true">{weights.map((weight,index)=><i key={index} style={{height:`${3+(active?value*weight*58:0)}px`} as CSSProperties}/>)}</div>;
}
export function NeonStage({phase,activity,compact=false}:{phase:Phase;activity:VoiceActivity;compact?:boolean}){
 const state=voiceVisual(phase,activity),hearing=activity.micOn&&activity.input==='receiving';
 const level=hearing?activity.inputLevel:activity.output==='playing'?activity.outputLevel:0;
 return <aside className={`neon-stage ${compact?'compact':''}`} data-voice-state={state.key} aria-label="AI 会话状态">
  <div className="neon-stage-art" aria-hidden="true"><div className="neon-stage-city"/><img src="/art/hitokoto-partner.webp" alt="" width="184" height="197"/><div className="neon-stage-scan"/></div>
  <div className="neon-stage-top"><span><Radio size={12}/> ひとこと</span><b>AI PARTNER</b></div>
  <div className="neon-stage-bottom"><span className="neon-stage-code"><i/>{state.code}</span><p>{state.label}</p><NeonSignal level={level} active={hearing||activity.output==='playing'}/><small><ShieldCheck size={12}/> 只在你开麦后接收声音</small></div>
 </aside>;
}
