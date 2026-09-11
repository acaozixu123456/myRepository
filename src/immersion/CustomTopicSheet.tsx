import {useEffect,useRef,useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {points,validBrief,type TopicBrief} from './contract';
import {studyApi} from './studyClient';
import {validSeed,type Seed} from '../companion/model';
import {validSubject,type Subject} from '../companion/teacherContract';
export const emptyBrief=():TopicBrief=>({requestId:crypto.randomUUID(),text:'',difficulty:'current',register:'natural',entryMode:'chat'});
export function CustomTopicSheet({brief,onChange,onPrepared,onCancelPreparation}:{brief:TopicBrief;onChange:(b:TopicBrief)=>void;onPrepared:(s:Seed,subject:Subject,mode:TopicBrief['entryMode'])=>void;onCancelPreparation:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const abort=useRef<AbortController|null>(null),generation=useRef(0),lock=useRef(false);
 useEffect(()=>()=>{generation.current++;abort.current?.abort();},[]);
 const patch=(p:Partial<TopicBrief>)=>{generation.current++;abort.current?.abort();lock.current=false;setBusy(false);setError('');onChange({...brief,...p,requestId:crypto.randomUUID()});};
 const submit=async()=>{const valid=validBrief(brief);if(!valid||lock.current)return;onCancelPreparation();lock.current=true;setBusy(true);setError('');const id=++generation.current,a=abort.current=new AbortController();
  try{const r=await studyApi('custom_topic',valid,a.signal);if(a.signal.aborted||id!==generation.current)return;const seed=validSeed(r.seed),subject=validSubject(r.subject);if(!seed||!seed.origin||!seed.signature||!subject||r.requestId!==valid.requestId)throw Error('invalid_topic');onPrepared(seed,subject,valid.entryMode);}
  catch{if(!a.signal.aborted&&id===generation.current)setError('主题暂时没准备好。输入还在，原话题不变；可再次提交。');}finally{if(id===generation.current){lock.current=false;setBusy(false);}}
 };
 return <form className="imm-custom-topic" onSubmit={e=>{e.preventDefault();void submit();}}><p>用中文或日文，说说你现在真正想练什么。</p><label htmlFor="imm-topic">今天想练什么？</label><textarea id="imm-topic" aria-label="自定练习主题" value={brief.text} onChange={e=>patch({text:e.target.value})} placeholder="向同事说明任务还在调查，希望练自然的商务表达。"/><small>{points(brief.text).length} / 500 · 不自动长期保存主题</small>
 <div className="imm-topic-examples">{['干洗店取衣服','练「つもりが」','说明任务仍在调查'].map(t=><button key={t} type="button" onClick={()=>patch({text:t})}>{t}</button>)}</div>
 <details><summary>调整练法 <small>默认直接聊，无需填写</small></summary><label>材料难度<select aria-label="材料难度" value={brief.difficulty} onChange={e=>patch({difficulty:e.target.value as TopicBrief['difficulty']})}><option value="current">沿用当前</option><option>N3</option><option>N2</option><option>N1</option></select></label><label>说话场合<select aria-label="说话场合" value={brief.register} onChange={e=>patch({register:e.target.value as TopicBrief['register']})}><option value="natural">自然</option><option value="polite">礼貌</option><option value="business">商务</option></select></label><label>怎么开始<select aria-label="怎么开始" value={brief.entryMode} onChange={e=>patch({entryMode:e.target.value as TopicBrief['entryMode']})}><option value="chat">直接聊</option><option value="explain">先讲明白</option><option value="practice">直接练一句</option></select></label></details>
 {error&&<p role="alert" className="teacher-error">{error}</p>}
 <button className="imm-primary" type="submit" disabled={busy||!validBrief(brief)}>{busy?'正在准备你的话题…':'按这个主题开始'}<ArrowRight size={20}/></button><small>主题是开场，不是限制；你随时可以把话聊向别处。</small></form>;
}
