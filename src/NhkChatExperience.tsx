import {useEffect,useState} from 'react';
import type {ChatExperienceStore,ChatExperienceSession,Effort} from './nhkChatExperience';
export function ChatExperienceSettings({store}:{store:ChatExperienceStore}){
  const [,refresh]=useState(0);useEffect(()=>store.subscribe(()=>refresh(v=>v+1)),[store]);
  const exportLocal=()=>{const blob=new Blob([store.export()],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='nhk-chat-experience.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <details className="nhk-experience-settings"><summary>体验记录 · 可选，仅本机</summary>
    <p>默认不记录。开启后，只在本机保留最近 14 天、最多 30 次的等待和提示使用次数；不含文章、说话内容或录音，不上传。不用于评分。</p>
    {store.unavailable?<p role="status">本机记录暂不可写，聊天不受影响。已有异常数据不会被自动覆盖。</p>:<label><input type="checkbox" checked={store.enabled} onChange={e=>store.consent(e.target.checked)}/>只在这台手机记录体验</label>}
    <small>等待指授权后到服务播放开始事件的时间估计，不是你思考或开口的速度。“帮助后回应”也不代表答对或掌握。</small>
    <div><button disabled={!store.count} onClick={exportLocal}>导出本机记录</button><button onClick={()=>store.clear()}>清除并关闭记录</button></div>
  </details>;
}
export function ChatEffortCheck({session}:{session:ChatExperienceSession|null}){
  const [submitted,setSubmitted]=useState(false);if(!session?.askEffort||submitted)return null;
  const answer=(value:Effort)=>{session.feedback(value);setSubmitted(true);};
  return <div className="nhk-effort-check" role="group" aria-label="可选的接话感受"><span>刚才接话费劲吗？<small>可不答</small></span><div>{([['easy','轻松'],['okay','还好'],['hard','有点费劲']] as const).map(([value,label])=><button key={value} onClick={()=>answer(value)}>{label}</button>)}</div></div>;
}
