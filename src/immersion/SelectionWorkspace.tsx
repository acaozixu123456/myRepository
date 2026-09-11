import {forwardRef,useImperativeHandle,useState} from 'react';
import {SelectionStudyLayer} from './SelectionStudyLayer';
import {StudySheet} from './StudySheet';
import type {SelectionFocus} from './contract';
import type {Subject} from '../companion/teacherContract';
export type SelectionWorkspaceRef={open:(f:SelectionFocus,action?:'study'|'listen'|'practice'|'save')=>void};
type Props={onPractice:(s:Subject)=>void;onSave:(s:Subject)=>void;onTheme:(text:string)=>void;acquire:()=>Promise<void>|void;release:()=>void;onSelecting?:(v:boolean)=>void;onOpenChange?:(v:boolean)=>void};
export const SelectionWorkspace=forwardRef<SelectionWorkspaceRef,Props>(function Workspace({onPractice,onSave,onTheme,acquire,release,onSelecting,onOpenChange},ref){
 const [active,setActive]=useState<{focus:SelectionFocus;action:'study'|'listen'|'practice'|'save';key:string}|null>(null);
 const open=(focus:SelectionFocus,action:'study'|'listen'|'practice'|'save'='study')=>{setActive({focus,action,key:crypto.randomUUID()});onOpenChange?.(true);};
 const close=()=>{setActive(null);onSelecting?.(false);onOpenChange?.(false);};
 useImperativeHandle(ref,()=>({open}));
 return <><SelectionStudyLayer onOpen={open} disabled={false} onSelecting={onSelecting}/>{active&&<StudySheet key={active.key} focus={active.focus} intentAction={active.action} onClose={close} acquire={acquire} release={release} onPractice={s=>{close();onPractice(s);}} onSave={s=>{close();onSave(s);}} onTheme={t=>{close();onTheme(t);}}/>}</>;
});
