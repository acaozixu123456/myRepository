import {useEffect,useRef,useState} from 'react';
import {readExpressions,writeExpressions,rememberSubject,recordAttempt,EXPRESSION_KEY,type Library,type LibraryRead} from './expressionLearning';
import type {Lesson,Subject,SupportLevel,Verdict} from './teacherContract';
export function useExpressionLibrary(){
 const holder=useRef<LibraryRead|null>(null);if(!holder.current)holder.current=readExpressions(localStorage);
 const [library,setLibrary]=useState(holder.current.library),[protectedData,setProtected]=useState(holder.current.protected),[storageError,setStorageError]=useState('');
 const update=(next:Library,persist=next.enabled)=>{
  const state=holder.current!;
  if(persist){
   if(state.protected){setStorageError('表达记录暂时只读，请先导出或重新打开；不会覆盖旧数据。');return false;}
   try{state.raw=writeExpressions(localStorage,next,state.raw);setStorageError('');}
   catch(e){setStorageError(e instanceof Error&&e.message==='storage_changed'?'另一页面更新了表达记录。请重新打开本页后再保存，避免覆盖。':'这次没能保存到本机，请勿刷新；当前会话内仍可练习。');return false;}
  }
  state.library=next;setLibrary(next);return true;
 };
 useEffect(()=>{const changed=(event:StorageEvent)=>{if(event.key!==EXPRESSION_KEY&&event.key!==null)return;holder.current!.protected=true;setProtected(true);setStorageError('另一页面修改了记录，本页暂停保存。重新打开后可继续。');};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[]);
 const remember=(subject:Subject,focus=subject.phrase,bookmark=false)=>{
  try{const state=holder.current!.library;return update({...state,items:rememberSubject(state.items,subject,focus,Date.now(),bookmark)});}catch{setStorageError('表达本已满，请先删除不需要的表达。');return false;}
 };
 const record=(lesson:Lesson,verdict:Verdict,answer:string,support:SupportLevel,source:'typed'|'confirmed_speech',id:string,seen:string[])=>{
  try{const state=holder.current!.library;return update({...state,items:recordAttempt(state.items,lesson,verdict,answer,support,source,id,seen)});}catch{setStorageError('这次练习结果没有保存，原记录未改变。');return false;}
 };
 const enable=(value:boolean)=>{const state=holder.current!.library;return update({...state,enabled:value},true);};
 const remove=(id:string)=>{const state=holder.current!.library;update({...state,items:state.items.filter(i=>i.id!==id)},state.enabled||holder.current!.raw!==null);};
 const clear=()=>{try{localStorage.removeItem(EXPRESSION_KEY);holder.current={library:{version:1,enabled:false,items:[]},raw:null,protected:false};setLibrary(holder.current.library);setProtected(false);setStorageError('');}catch{setStorageError('无法清除表达记录，请检查浏览器存储权限。');}};
 const exportData=()=>{const raw=holder.current?.protected?holder.current.raw:JSON.stringify(holder.current?.library,null,2);if(!raw)return;const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='hitokoto-expressions.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return{library,protectedData,storageError,remember,record,enable,remove,clear,exportData};
}
