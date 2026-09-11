import {useState} from 'react';
import {Check,Volume2,Eye,EyeOff,RotateCcw,Bookmark,ArrowRight} from 'lucide-react';
import type {Lesson,Verdict} from './teacherContract';
import {playLearningCue} from './learningSound';
export type ChangeChunk={text:string;changed:boolean};
/** Exact code-point diff: visual comparison only, never a claim that unchanged words are incorrect. */
export function phraseChanges(before:string,after:string):{before:ChangeChunk[];after:ChangeChunk[]}{
 const a=Array.from(before).slice(0,500),b=Array.from(after).slice(0,500),n=a.length,m=b.length;
 const dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
 const old:ChangeChunk[]=[],next:ChangeChunk[]=[];
 const push=(list:ChangeChunk[],text:string,changed:boolean)=>{const last=list.at(-1);if(last&&last.changed===changed)last.text+=text;else list.push({text,changed});};
 let i=0,j=0;while(i<n||j<m){if(i<n&&j<m&&a[i]===b[j]){push(old,a[i++],false);push(next,b[j++],false);}else if(j<m&&(i===n||dp[i][j+1]>=dp[i+1][j]))push(next,b[j++],true);else push(old,a[i++],true);}
 return{before:old,after:next};
}
export function resultHeading(result:Verdict):string{return result.verdict==='uncertain'?'先确认你想说的意思':result.verdict==='revise'?'这句，再调一下':result.suggestionJa?'意思到了，再顺一点':'这句，表达清楚了';}
export function FeedbackMoment({lesson,result,answer,onRetry,onSave,onListen}:{lesson:Lesson;result:Verdict;answer:string;onRetry:()=>void;onSave:()=>void;onListen:(text:string)=>void}){
 const [covered,setCovered]=useState(false),[compare,setCompare]=useState(false);
 const target=result.suggestionJa||answer,changes=phraseChanges(answer,target),different=!!result.suggestionJa&&answer!==target;
 return <div className="teacher-result df-feedback" data-verdict={result.verdict}>
  <div className="df-result-heading"><span className="df-result-icon" aria-hidden="true">{result.verdict==='communicated'?<Check size={22}/>:<ArrowRight size={22}/>}</span><div><small>THIS MOMENT / 这一句</small><h3>{resultHeading(result)}</h3></div></div>
  <div className="df-focus-label"><span>练习焦点</span><strong lang="ja">{lesson.focus}</strong></div>
  <div className={`df-phrase-stage ${covered?'covered':''}`}>
   <small>{result.suggestionJa?'参考说法 · 高亮显示调整处':'你刚才说的'}</small>
   {!covered?<p lang="ja" data-study-source="practice" data-study-id={lesson.id+'-feedback'}>{changes.after.map((part,index)=>part.changed?<mark key={index}>{part.text}</mark>:<span key={index}>{part.text}</span>)}</p>:<div className="df-recall"><EyeOff size={25}/><strong>先不看，自己想一句</strong><span>表达原来的意思就好，不用逐字背。</span></div>}
  </div>
  <div className="df-feedback-tools">
   <button onClick={()=>onListen(target)}><Volume2 size={16}/>听这句</button>
   {different&&<button aria-expanded={compare} onClick={()=>{setCompare(v=>!v);playLearningCue('hint');}}>看变化</button>}
   <button aria-pressed={covered} onClick={()=>{setCovered(v=>!v);playLearningCue('hint');}}>{covered?<Eye size={16}/>:<EyeOff size={16}/>} {covered?'显示句子':'遮住试说'}</button>
  </div>
  {compare&&different&&!covered&&<div className="df-comparison"><small>你的原句 · 只标出文字差异，不代表每处都是错误</small><p lang="ja" data-study-source="user">{changes.before.map((part,index)=>part.changed?<del key={index}>{part.text}</del>:<span key={index}>{part.text}</span>)}</p></div>}
  <details className="df-result-detail"><summary>看老师的完整说明</summary><p>{result.feedbackZh}</p></details>
  <small className="df-evidence-note">{result.verdict==='uncertain'?'这次没有记录为会用；请先确认识别结果。':'反馈基于已确认的文字和意思，不是发音评分。'}</small>
  <div className="teacher-hints df-result-actions"><button onClick={onRetry}><RotateCcw size={15}/>再试一次</button><button onClick={onSave}><Bookmark size={15}/>收藏这个表达</button></div>
 </div>;
}
