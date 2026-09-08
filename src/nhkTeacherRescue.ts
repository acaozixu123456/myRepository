import type {TeacherTurn} from './nhkGentleTeacher';
type Cue={words:string[];starter:string;example:string};
/** A failed simplification must still offer a usable same-question foothold. */
export function sameThreadRescue(current:string,cue?:Cue|null):TeacherTurn{
  let words=(cue?.words||[]).filter(s=>s.trim()&&s.length<=14).slice(0,2);
  let starter=cue?.starter||'',example=cue?.example||'';
  if(/どこ.*(?:聞|知)|(?:どこで|何で).*(?:見|読)/u.test(current)&&words.length<2){words=['ニュースで','学校で'];starter='…で聞きました。';example='ニュースで聞きました。';}
  if(/知って(?:い|いました)|聞いたこと/u.test(current)&&words.length<2){words=['知っています','初めてです'];starter='名前は…';example='名前は知っています。';}
  let say='';
  if(words.length===2&&!/どちら|どっち/u.test(current))say=`${words[0]}、${words[1]}、どちらですか。`;
  if(!say||say.length>48){
    if(example&&example.length<=32)say=`例えば、「${example.replace(/[。.!！?？]+$/u,'')}」。`;
    else if(words[0])say=`「${words[0]}」だけでも、大丈夫です。`;
    else say=current.length<=48?current:'今の気持ちを、一言だけでも大丈夫です。';
  }
  return {say,words,starter:starter.slice(0,20),example:example.slice(0,32),origin:'local'};
}
