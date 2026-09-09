import {Mic,MicOff,Volume2,LoaderCircle} from 'lucide-react';
import type {VoiceActivity} from './nhkAudioActivity';
import './nhkVoiceControls.css';
function Wave({level,active}:{level:number;active:boolean}){return <span className="nhk-sound-wave" data-active={active} data-level={Math.round(level*100)} aria-hidden="true">{[.45,.75,1,.75,.45].map((factor,i)=><i key={i} style={{height:`${3+(active?level:0)*27*factor}px`}}/>)}</span>;}
export default function NhkVoiceControls({activity,disabled,toggle}:{activity:VoiceActivity;disabled:boolean;toggle:()=>void}){
  const input=activity.input==='off'?'已闭麦 · 点一下开麦':activity.input==='requesting'?'正在请求麦克风…':activity.input==='paused'?'已开麦 · 对方说完后收音':activity.input==='device-muted'?'麦克风暂时无信号':activity.inputLevel>.025?'收到你的声音':'正在收音 · 慢慢说';
  const output=activity.output==='playing'?'对方正在说话':activity.output==='preparing'?'对方正在准备回答':activity.output==='blocked'?'等待允许播放声音':'对方等待中';
  return <div className="nhk-voice-controls" data-voice-controls="nhk-manual-mic-v1">
    <div className="nhk-voice-peer" data-state={activity.output}><span className="nhk-voice-peer-label"><Volume2 size={17}/>对方</span><Wave level={activity.outputLevel} active={activity.output==='playing'}/><small role="status">{output}</small></div>
    <div className="nhk-voice-self" data-state={activity.input}><button className="nhk-mic-toggle" aria-label={activity.micOn?'关闭麦克风':'开启麦克风'} aria-pressed={activity.micOn} disabled={disabled&&!activity.micOn} onClick={toggle} style={{boxShadow:activity.inputLevel>.025?`0 0 0 ${5+activity.inputLevel*11}px rgba(91,145,114,.15)`:'none'}}>{activity.input==='requesting'?<LoaderCircle className="nhk-speaking-spin" size={28}/>:activity.micOn?<Mic size={29}/>:<MicOff size={29}/>}</button><Wave level={activity.inputLevel} active={activity.input==='receiving'||activity.input==='ready'}/><small role="status">{input}</small></div>
  </div>;
}
