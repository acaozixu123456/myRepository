export const SAVE_KEY = 'nihongo.explore.yanaka.v1';
export const SAVE_VERSION = 1;
export const PHRASES = {
  order: {ja:'日替わり弁当を一つください。',zh:'请给我一份每日便当。',note:'「名词＋を＋数量＋ください」用于点餐或购物。一つ（ひとつ）：一个、一份。'},
  heat: {ja:'温めてもらえますか。',zh:'能帮我加热吗？',note:'「动词て形＋もらえますか」礼貌地请求对方为自己做某事。温める → 温めて。'},
  bag: {ja:'袋はいりません。',zh:'不需要袋子。',note:'「要る（いる）」表示需要。否定敬体为「いりません」；不是「ありません」。'},
  directions: {ja:'この先の右側です。',zh:'就在前面的右手边。',note:'「この先」表示沿着当前方向往前。「右側（みぎがわ）」是右侧。'},
} as const;
export type PhraseId = keyof typeof PHRASES;
export type PurchaseStep = 'order'|'heat'|'bag'|'pay'|'done';
export type Progress = {
  version:1; pose:{x:number;z:number;yaw:number;pitch:number};
  purchase:{step:PurchaseStep;warm:boolean|null;bag:boolean|null;paid:boolean};
  coins:number; bookmarked:PhraseId[]; assistedSteps:PurchaseStep[];
  learning:Partial<Record<PhraseId,{seen:number;assisted:number;independent:number}>>;
  visited:string[];updatedAt:string;
};
export const freshProgress = (): Progress => ({version:1,pose:{x:0,z:9,yaw:0,pitch:0},purchase:{step:'order',warm:null,bag:null,paid:false},coins:1000,bookmarked:[],assistedSteps:[],learning:{},visited:[],updatedAt:new Date().toISOString()});
const phraseExists=(key:unknown):key is PhraseId=>typeof key==='string'&&Object.prototype.hasOwnProperty.call(PHRASES,key);
const finite = (x:unknown):x is number => typeof x==='number' && Number.isFinite(x);
export function isProgress(value:unknown):value is Progress {
  if(!value||typeof value!=='object') return false;
  const v=value as Progress;
  if(v.version!==1||!v.pose||!v.purchase||!v.learning||typeof v.learning!=='object'||Array.isArray(v.learning))return false;
  if(![v.pose.x,v.pose.z,v.pose.yaw,v.pose.pitch,v.coins].every(finite))return false;
  if(Math.abs(v.pose.x)>50||v.pose.z<0||v.pose.z>180||Math.abs(v.pose.pitch)>1.3||Math.abs(v.pose.yaw)>Math.PI*2)return false;
  const p=v.purchase;
  if(!['order','heat','bag','pay','done'].includes(p.step)||![true,false,null].includes(p.warm)||![true,false,null].includes(p.bag)||typeof p.paid!=='boolean')return false;
  if(p.paid!==(p.step==='done')|| (p.step==='order'&&(p.warm!==null||p.bag!==null)))return false;
  if(p.step==='heat'&&(p.warm!==null||p.bag!==null))return false;
  if(p.step==='bag'&&p.bag!==null)return false;
  if(!Array.isArray(v.assistedSteps)||v.assistedSteps.length>4||v.assistedSteps.some(x=>!['order','heat','bag','pay'].includes(x)))return false;
  if((p.step==='bag'||p.step==='pay'||p.step==='done')&&p.warm===null)return false;
  if((p.step==='pay'||p.step==='done')&&p.bag===null)return false;
  if(v.coins!==(p.paid ? 1000-650-(p.bag?3:0):1000))return false;
  if(!Array.isArray(v.bookmarked)||v.bookmarked.some(k=>!phraseExists(k))||new Set(v.bookmarked).size!==v.bookmarked.length)return false;
  if(!Array.isArray(v.visited)||v.visited.length>20||v.visited.some(x=>typeof x!=='string'||x.length>64))return false;
  if(Object.entries(v.learning).some(([id,c])=>!phraseExists(id)||!c||![c.seen,c.assisted,c.independent].every(n=>finite(n)&&Number.isInteger(n)&&n>=0&&n<=10000)))return false;
  return typeof v.updatedAt==='string' && Number.isFinite(Date.parse(v.updatedAt));
}
export function loadProgress(storage:Pick<Storage,'getItem'>):{progress:Progress;writable:boolean;warning:string} {
  try {
    const raw=storage.getItem(SAVE_KEY);
    if(raw===null)return {progress:freshProgress(),writable:true,warning:''};
    const data:unknown=JSON.parse(raw);
    if(!isProgress(data))return {progress:freshProgress(),writable:false,warning:'游戏存档格式无法识别，已保留原数据。本次暂不保存；NHK 记录不受影响。'};
    return {progress:data,writable:true,warning:''};
  } catch {return {progress:freshProgress(),writable:false,warning:'游戏存档暂不可读，本次进度不会自动保存。NHK 记录未被改动。'};}
}
export function saveProgress(storage:Pick<Storage,'setItem'>,progress:Progress):boolean {
  if(!isProgress(progress))return false;
  try {storage.setItem(SAVE_KEY,JSON.stringify({...progress,updatedAt:new Date().toISOString()}));return true;}catch{return false;}
}
export function recordSeen(progress:Progress,id:PhraseId):Progress {
  const before=progress.learning[id]||{seen:0,assisted:0,independent:0};
  return {...progress,learning:{...progress.learning,[id]:{...before,seen:Math.min(10000,before.seen+1)}}};
}
export function markHint(progress:Progress):Progress {
  const step=progress.purchase.step;
  if(step==='done'||progress.assistedSteps.includes(step))return progress;
  return {...progress,assistedSteps:[...progress.assistedSteps,step]};
}
export function recordUse(progress:Progress,id:PhraseId,assisted:boolean):Progress {
  const before=progress.learning[id]||{seen:0,assisted:0,independent:0};
  const counts={seen:Math.min(10000,before.seen+1),assisted:Math.min(10000,before.assisted+(assisted?1:0)),independent:Math.min(10000,before.independent+(assisted?0:1))};
  return {...progress,learning:{...progress.learning,[id]:counts}};
}
export const normalizeJapanese=(raw:string)=>raw.normalize('NFKC').replace(/[\s、。！？!?「」『』・]/g,'').trim();
export const price=(p:Progress)=>650+(p.purchase.bag?3:0);
export function turnText(p:Progress):{ja:string;zh:string;choices:string[];phrase:PhraseId} {
  switch(p.purchase.step){
    case 'order': return {ja:'いらっしゃいませ。ご注文はお決まりですか。',zh:'欢迎光临。您决定好要点什么了吗？',choices:['日替わり弁当を一つください。','お弁当を一つお願いします。'],phrase:'order'};
    case 'heat': return {ja:'お弁当、温めますか。',zh:'便当需要加热吗？',choices:['はい、お願いします。','温めてもらえますか。','そのままでお願いします。'],phrase:'heat'};
    case 'bag': return {ja:'袋はご利用ですか。一枚三円です。',zh:'需要袋子吗？一个三日元。',choices:['袋はいりません。','一枚お願いします。'],phrase:'bag'};
    case 'pay': return {ja:`${p.purchase.bag?'六百五十三':'六百五十'}円になります。`,zh:`一共 ${price(p)} 日元。用游戏里的 1,000 日元付款。`,choices:['千円でお願いします。','これでお願いします。'],phrase:'order'};
    case 'done': return {ja:'ありがとうございます。またお越しください。',zh:'谢谢惠顾。欢迎再次光临。',choices:[],phrase:'bag'};
  }
}
export function interpret(step:PurchaseStep,raw:string):'yes'|'no'|'accept'|'unclear' {
  if(raw.length>160)return 'unclear';
  const t=normalizeJapanese(raw);
  if(!t||/大丈夫/.test(t))return 'unclear'; // Meaning depends on context; do not guess acceptance/refusal.
  if(step==='order') return /^(?:すみません)?(?:日替わり(?:弁当|べんとう)|お?弁当|お?べんとう)(?:を)?(?:一つ|ひとつ|1つ|一個)(?:ください|下さい|お願いします|お願いできますか|もらえますか)$/.test(t)?'accept':'unclear';
  if(step==='heat'){
    if(/^(?:いいえ)?(?:そのままで(?:お願いします)?|温めないで(?:ください)?|あたためないで(?:ください)?|温めなくていいです|結構です|いいえ)$/.test(t))return 'no';
    if(/^(?:はい)?(?:お願いします|温めて(?:ください|下さい|もらえますか|いただけますか)|あたためて(?:ください|もらえますか)|はい)$/.test(t))return 'yes';
  }
  if(step==='bag'){
    if(/^(?:いいえ)?(?:(?:袋|ふくろ)は(?:いりません|要りません)|(?:袋|ふくろ)なしで(?:お願いします)?|いりません|いいえ)$/.test(t))return 'no';
    if(/^(?:はい)?(?:(?:袋|ふくろ)(?:を)?(?:一枚)?(?:ください|下さい|お願いします)|一枚(?:ください|お願いします)|お願いします|はい)$/.test(t))return 'yes';
  }
  if(step==='pay' && /^(?:千円|1000円)でお願いします$|^これでお願いします$|^はい$/.test(t))return 'accept';
  return 'unclear';
}
export function reply(progress:Progress,raw:string,assisted:boolean):{progress:Progress;accepted:boolean;message:string} {
  if(progress.purchase.paid)return {progress,accepted:false,message:'这份便当已经买好了，不会重复扣款。'};
  const step=progress.purchase.step;
  assisted=assisted||progress.assistedSteps.includes(step);
  const intent=interpret(step,raw);
  if(intent==='unclear')return {progress,accepted:false,message:/大丈夫/.test(raw)?'「大丈夫です」在这里可能表示接受，也可能是婉拒。请把是否需要说得明确一些。':'店员还没有确认你的意思。样片支持此场景的常用说法；可以借一句表达，再试一次。'};
  let next={...progress,purchase:{...progress.purchase}};
  if(step==='order'){next.purchase.step='heat';next=recordUse(next,'order',assisted);}
  if(step==='heat'){next.purchase.warm=intent==='yes';next.purchase.step='bag';next=recordUse(next,'heat',assisted);}
  if(step==='bag'){next.purchase.bag=intent==='yes';next.purchase.step='pay';next=recordUse(next,'bag',assisted);}
  if(step==='pay'){next.purchase.step='done';next.purchase.paid=true;next.coins-=price(next);}
  return {progress:next,accepted:true,message:''};
}
