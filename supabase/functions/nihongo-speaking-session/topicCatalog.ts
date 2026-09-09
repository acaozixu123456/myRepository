/** Shared bounded topic data. No network, storage or credentials. */
export const TOPIC_CATALOG='nhk-topic-catalog-v1';
export type CatalogTopic={id:string;titleZh:string;questionJa:string;answersJa:string[];kind:'personal'|'hypothetical'|'article';sourceQuote:string;angle?:string};
export type TopicTicket={topic:CatalogTopic;expiresAt:number;proof:string};
export type TopicSource={articleId:string;title:string;source:string[]};
const clean=(s:string)=>s.normalize('NFKC').replace(/\s+/gu,' ').trim();
export const topicKey=(s:string)=>clean(s).replace(/[\s\p{P}\p{S}]/gu,'');
export function similarTopic(a:string,b:string):boolean {
  a=topicKey(a);b=topicKey(b);if(a===b)return true;if(!a||!b)return false;
  const grams=(s:string)=>new Set(Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)));
  const x=grams(a),y=grams(b);let intersection=0;for(const g of x)if(y.has(g))intersection++;
  return intersection/(x.size+y.size-intersection)>.72;
}
export function readCatalogTopic(raw:unknown,source:string[]):CatalogTopic|null {
  if(!raw||typeof raw!=='object')return null;const r=raw as Record<string,unknown>;
  const text=(v:unknown,n:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=n&&!/[<>\x00-\x1f]|https?:|```|ignore|instructions|system prompt/iu.test(v);
  if(!text(r.id,80)||!/^gen-[a-f0-9]{16,40}$/.test(String(r.id))||!text(r.titleZh,22)||!text(r.questionJa,42)||!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(String(r.questionJa)))return null;
  if(!['personal','hypothetical','article'].includes(String(r.kind))||!text(r.sourceQuote,240)||!source.some(s=>s.includes(String(r.sourceQuote)))||String(r.sourceQuote).length<2)return null;
  if(!Array.isArray(r.answersJa)||r.answersJa.length!==2||!r.answersJa.every(a=>text(a,26)))return null;
  const q=String(r.questionJa);
  if((q.match(/(?:ですか|ますか|でしたか|ましたか)[。?？]?|[?？]/gu)||[]).length>1||q.split(/[。！？?]/u).filter(Boolean).length>1)return null;
  if(/なぜ|どうして|政策|経済的|どう思いますか|どのような影響|理由を|説明して/u.test(q))return null;
  return {id:String(r.id),titleZh:clean(String(r.titleZh)),questionJa:clean(q),answersJa:r.answersJa.map(a=>clean(String(a))),kind:r.kind as CatalogTopic['kind'],sourceQuote:String(r.sourceQuote),...(typeof r.angle==='string'&&r.angle.length<=20?{angle:clean(r.angle)}:{})};
}
export function readTopicTicket(raw:unknown,source:string[],now=Date.now()):TopicTicket|null {
  if(!raw||typeof raw!=='object')return null;const r=raw as Record<string,unknown>;const topic=readCatalogTopic(r.topic,source);
  if(!topic||typeof r.expiresAt!=='number'||r.expiresAt<now||r.expiresAt>now+86400000||typeof r.proof!=='string'||!/^[a-f0-9]{64}$/.test(r.proof))return null;
  return {topic,expiresAt:r.expiresAt,proof:r.proof};
}
/** Signing binds the exact source and entire immutable topic, not client-supplied instructions. */
export function topicSigningText(plan:TopicSource,ticket:Omit<TopicTicket,'proof'>):string {
  return JSON.stringify([TOPIC_CATALOG,plan.articleId,plan.title,plan.source,ticket.topic,ticket.expiresAt]);
}
