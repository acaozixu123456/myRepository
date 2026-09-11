import {useEffect,useRef,useState} from 'react';
import {SelectionWorkspace} from './SelectionWorkspace';
import {useExpressionLibrary} from '../companion/useExpressionLibrary';
import {TeacherStudio} from '../companion/TeacherStudio';
import type {Subject} from '../companion/teacherContract';
import {TextStudyConnection} from './studyClient';
import './immersion.css';
/** Selection extension only. Does not rewrite the NHK import, article or backup storage. */
export function NhkStudyTools(){
 const library=useExpressionLibrary(),[subject,setSubject]=useState<Subject|null>(null),[save,setSave]=useState<Subject|null>(null),[notice,setNotice]=useState('');const dialog=useRef<HTMLDialogElement>(null),conn=useRef<TextStudyConnection|null>(null);
 if(!conn.current)conn.current=new TextStudyConnection(setNotice);
 useEffect(()=>{if(subject||save)dialog.current?.showModal();else dialog.current?.close();},[subject,save]);useEffect(()=>()=>conn.current?.dispose(),[]);
 const close=()=>{setSubject(null);setSave(null);conn.current?.stop();};
 const bookmark=(s:Subject)=>{if(library.library.enabled){library.remember(s,s.phrase,true);setNotice('已保存到本机表达本。');}else setSave(s);};
 return <><SelectionWorkspace acquire={()=>{document.dispatchEvent(new Event('hitokoto-study-focus'));document.querySelectorAll('audio').forEach(a=>a.pause());}} release={()=>{}} onPractice={setSubject} onSave={bookmark} onTheme={text=>{const u=new URL('/companion.html',location.origin);u.searchParams.set('topic',Array.from(text).slice(0,500).join(''));location.assign(u.href);}}/>{notice&&<p role="status" className="imm-small-note">{notice}<button onClick={()=>setNotice('')}>收起</button></p>}
 <dialog className="imm-study-sheet" ref={dialog} onCancel={close}><section className="imm-study-inner"><header><span>NHK · CONTEXT LAB</span><button aria-label="关闭文章学习面板" onClick={close}>×</button></header>{subject&&conn.current&&<><p>先用文字练一句，不建立语音通话。</p><TeacherStudio connection={conn.current} subject={subject} lines={[]} onClose={close} onLesson={l=>library.remember(l.subject,l.focus)} onResult={(l,r,a,s,t,id,seen)=>library.record(l,r,a,s,t,id,seen)} onSave={()=>bookmark(subject)}/></>}{save&&<section><h2 lang="ja">{save.phrase}</h2><p>开启后仅在本机保存表达与练习进度，不保存整篇文章、聊天或录音。</p><button className="imm-primary" onClick={()=>{if(library.enable(true)){library.remember(save,save.phrase,true);setSave(null);setNotice('已加入表达本。');}}}>开启本机保存并收藏</button><button className="imm-topic-from" onClick={()=>{library.remember(save,save.phrase,true);setSave(null);}}>这次先不长期保存</button></section>}{library.storageError&&<p role="alert">{library.storageError}</p>}</section></dialog></>;
}
