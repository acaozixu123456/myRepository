import {nativeCompanionPrompt} from './prompt.ts';
export const COMPANION = 'nihongo-companion-v3';
export const CONSENT = 'companion-realtime-v3';
export const VOICE_MODEL = 'gpt-realtime-2.1';
export const TEXT_MODEL = 'gpt-4.1-mini';
export type Lane = 'mix'|'interests'|'work'|'curiosity'|'news';
export type Source = {title:string;url:string;retrievedAt:string};
export type Seed = {id:string;lane:Lane;title:string;opening:string;context:string;angle:string;sources:Source[];expiresAt:number;signature?:string};
export type Policy = {revision:number;target:0|1|2|3;comprehension:'unknown'|'supported'|'comfortable';evidence:number;independent:number;assisted:number;lastMove:'observe'|'support'|'extend'|'user';seen:string[]};
export const freshPolicy = ():Policy => ({revision:0,target:0,comprehension:'unknown',evidence:0,independent:0,assisted:0,lastMove:'observe',seen:[]});
export const clean = (s:string) => s.replace(/\s+/g,' ').trim();
export const key = (s:string) => s.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
export const text = (v:unknown,n:number):v is string => typeof v==='string'&&v.length<=n&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/u.test(v);
export function validPolicy(v:unknown):Policy {
  if(!v||typeof v!=='object')return freshPolicy();const r=v as Policy;
  if(![0,1,2,3].includes(r.target)||!['unknown','supported','comfortable'].includes(r.comprehension))return freshPolicy();
  const count=(n:unknown)=>typeof n==='number'&&Number.isInteger(n)&&n>=0?Math.min(n,10000):0;
  return {revision:count(r.revision),target:r.target,comprehension:r.comprehension,evidence:count(r.evidence),independent:count(r.independent),assisted:count(r.assisted),lastMove:['observe','support','extend','user'].includes(r.lastMove)?r.lastMove:'observe',seen:Array.isArray(r.seen)?r.seen.filter(id=>text(id,160)).slice(-120):[]};
}
export function validSeed(v:unknown,now=Date.now()):Seed|null {
  if(!v||typeof v!=='object')return null;const r=v as Seed;
  if(!text(r.id,100)||!r.id||!['mix','interests','work','curiosity','news'].includes(r.lane)||!text(r.title,60)||!r.title||!text(r.opening,160)||!r.opening||!text(r.context,2800)||!text(r.angle,80)||!Array.isArray(r.sources)||r.sources.length>5||!Number.isFinite(r.expiresAt)||r.expiresAt<now)return null;
  const sources:Source[]=[];
  for(const s of r.sources){if(!s||!text(s.title,180)||!text(s.url,1500)||!text(s.retrievedAt,40))return null;try{const u=new URL(s.url);if(u.protocol!=='https:'||u.username||u.password)return null;}catch{return null;}if(!Number.isFinite(Date.parse(s.retrievedAt)))return null;sources.push({title:s.title,url:s.url,retrievedAt:s.retrievedAt});}
  if(r.lane==='news'&&(!sources.length||!r.context))return null;
  return {id:r.id,lane:r.lane,title:clean(r.title),opening:clean(r.opening),context:clean(r.context),angle:clean(r.angle),sources,expiresAt:r.expiresAt,...(text(r.signature,200)?{signature:r.signature}:{})};
}
const local=(id:string,lane:Lane,title:string,opening:string,angle:string):Seed=>({id,lane,title,opening,angle,context:'这是一个聊天开场或想象情境，不是现实新闻报道。',sources:[],expiresAt:4102444800000});
export const LOCAL_SEEDS:Seed[]=[
 local('cat-day','interests','只当一天猫','一日だけ猫になれたら、まず何をしたいですか。','imagination'),
 local('tiny-good','mix','今天的小小好事','今日は、何か小さないいことがありましたか。','experience'),
 local('travel-door','interests','门后是你想去的地方','このドアの向こうに行けるなら、海と山、どちらがいいですか。','choice'),
 local('work-word','work','工作里最想说顺的一句','仕事で、日本語が出てこなくなることはありますか。','communication'),
 local('no-phone','curiosity','手机休息一天','スマホを一日休ませたら、何をしたいですか。','hypothetical'),
 local('comfort-food','mix','疲惫时想吃的东西','疲れた日は、何を食べたいですか。','comfort'),
 local('fantasy-shop','interests','一家奇怪的小店','空を飛べる靴と、どこでも眠れる枕、どちらが欲しいですか。','imagination'),
 local('meeting-help','work','开会没听清的那一刻','会議で聞き取れなかったら、何と言いたいですか。','communication'),
 local('small-invention','curiosity','发明一个偷懒小工具','面倒なことを一つなくせるなら、何がいいですか。','invention'),
 local('weekend-free','mix','突然多出来的半天','明日の午後が自由になったら、何をしたいですか。','choice'),
 local('video-loop','interests','忍不住反复看的画面','つい何度も見てしまう動画はありますか。','experience'),
 local('help-at-work','work','如何轻松地求助','仕事で困ったとき、人に聞くのは得意ですか。','experience')
];
export function chooseSeed(pool:Seed[],seen:string[],lane:Lane='mix',random=Math.random):Seed {
  const valid=pool.filter(s=>s.expiresAt>Date.now()&&(lane==='mix'||s.lane===lane));
  const choices=valid.filter(s=>!seen.includes(s.id));const candidates=choices.length?choices:valid.filter(s=>s.id!==seen.at(-1));
  const fallback=candidates.length?candidates:valid.length?valid:LOCAL_SEEDS.filter(s=>lane==='mix'||s.lane===lane);
  const pick=fallback.length?fallback:LOCAL_SEEDS;
  return pick[Math.max(0,Math.min(pick.length-1,Math.floor(random()*pick.length)))];
}
export const TARGETS=['一个意思就好，单词也能接住','尝试把熟悉的词连成一个短句','有余力时，补一个时间、动作或细节','能顺畅时，自然连接两三个意思'];
export function companionInstructions(seed:Seed,policy:Policy):string {return nativeCompanionPrompt(seed,policy,TARGETS[policy.target]);}
export type Line={id:string;previous:string;role:'user'|'assistant';text:string;delivered:boolean;interrupted:boolean;assistance:'none'|'hint'|'example';seq:number;exercise?:boolean;textOnly?:boolean};
/** Fallible transcripts for UI/observation only, never duplicate native audio input. */
export class TranscriptLedger {
  private entries=new Map<string,Line>();private seq=0;
  upsert(id:string,role:Line['role'],patch:Partial<Line>={}){if(!id)return;const old=this.entries.get(id);this.entries.set(id,{id,role,previous:'',text:'',delivered:role==='user',interrupted:false,assistance:'none',seq:++this.seq,...old,...patch});if(this.entries.size>120){const first=this.ordered()[0];if(first)this.entries.delete(first.id);}}
  ordered():Line[]{const entries=[...this.entries.values()].sort((a,b)=>a.seq-b.seq);const done=new Set<string>();const out:Line[]=[];let left=entries;for(let pass=0;left.length&&pass<entries.length+1;pass++){const next:Line[]=[];for(const item of left){if(item.previous&&this.entries.has(item.previous)&&!done.has(item.previous)){next.push(item);continue;}done.add(item.id);out.push(item);}if(next.length===left.length){out.push(...next);break;}left=next;}return out;}
  evidence(){return this.ordered().filter(l=>l.text&&l.delivered&&!l.interrupted&&!l.exercise).slice(-18);}
  clear(){this.entries.clear();}
}
export type Observation={id:string;meaning:'clear'|'repair'|'uncertain';independence:'independent'|'prompted'|'imitated'|'uncertain';complexity:0|1|2|3;comprehension:'comfortable'|'needs_help'|'uncertain'};
/** Conservative product heuristics, not a validated proficiency test. */
export function applyObservations(previous:Policy,observations:Observation[],lines:Line[]):Policy {
  const p=validPolicy(previous);const users=new Map(lines.filter(l=>l.role==='user'&&l.delivered&&!l.interrupted&&!l.exercise).map(l=>[l.id,l]));
  let higher=0,needsHelp=0,newCount=0,comfortable=0;
  for(const o of observations){const l=users.get(o?.id);if(!l||p.seen.includes(o.id)||!['clear','repair','uncertain'].includes(o.meaning)||!['independent','prompted','imitated','uncertain'].includes(o.independence)||![0,1,2,3].includes(o.complexity))continue;p.seen.push(o.id);newCount++;p.evidence++;
    const independent=l.assistance==='none'&&o.independence==='independent'&&o.meaning==='clear';
    if(independent){p.independent++;if(o.complexity>p.target)higher++;}else if(l.assistance!=='none'||['prompted','imitated'].includes(o.independence))p.assisted++;
    if(o.comprehension==='needs_help')needsHelp++;if(o.comprehension==='comfortable')comfortable++;
  }
  if(!newCount)return p;p.revision++;p.lastMove='observe';
  if(needsHelp>=2){p.comprehension='supported';p.target=Math.max(0,p.target-1) as Policy['target'];p.lastMove='support';}
  else {if(comfortable>=3)p.comprehension='comfortable';if(higher>=3&&newCount>=4){p.target=Math.min(3,p.target+1) as Policy['target'];p.lastMove='extend';}}
  p.seen=p.seen.slice(-120);return p;
}
export function changeChallenge(p:Policy,delta:number):Policy{return {...validPolicy(p),revision:p.revision+1,target:Math.min(3,Math.max(0,p.target+delta)) as Policy['target'],lastMove:'user'};}
export const LEARNING_KEY='nihongo-companion-learning-v3';
export function readLearning(storage:Storage):{enabled:boolean;policy:Policy;protected:boolean}{try{const s=storage.getItem(LEARNING_KEY);if(!s)return{enabled:false,policy:freshPolicy(),protected:false};const r=JSON.parse(s);if(r.version!==1||r.enabled!==true)return{enabled:false,policy:freshPolicy(),protected:true};return{enabled:true,policy:validPolicy(r.policy),protected:false};}catch{return{enabled:false,policy:freshPolicy(),protected:true};}}
export function writeLearning(storage:Storage,policy:Policy){const p=validPolicy(policy);storage.setItem(LEARNING_KEY,JSON.stringify({version:1,enabled:true,updatedAt:new Date().toISOString(),policy:{...p,seen:[]}}));}
export function eraseLearning(storage:Storage){storage.removeItem(LEARNING_KEY);}
