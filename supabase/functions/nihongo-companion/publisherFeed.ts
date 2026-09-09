import {approvedNewsUrl,excludedNews,readVerifiedNews,recentPublication,type VerifiedNews} from './newsGuard.ts';
/** Fixed public publisher feeds. Feed entries discover URLs; publisher pages verify facts. */
export const PUBLISHER_FEEDS=['https://www.nasa.gov/feed/','https://www.jpl.nasa.gov/feeds/news/'] as const;
const MAX_BYTES=1000000;
const decode=(s:string)=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").trim();
const element=(item:string,tag:string)=>decode(item.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'))?.[1]||'');
export function feedCandidates(xml:string,now=Date.now()):Array<{url:string;time:number}>{
 if(xml.length>MAX_BYTES)return [];
 // Reject XML declarations; HTML quoted inside CDATA is inert content, not a feed DTD.
 const markup=xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g,'');
 if(/<!DOCTYPE|<!ENTITY/i.test(markup))return [];
 // Do not interpret tag-shaped text inside article bodies as feed metadata.
 const listing=xml.replace(/<(content:encoded|description|content)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
 const items=[...listing.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].slice(0,30);const seen=new Set<string>();const result:Array<{url:string;time:number}>=[];
 for(const item of items){const body=item[2],title=element(body,'title');if(excludedNews(title))continue;
  const date=element(body,'pubDate')||element(body,'published')||element(body,'dc:date');const time=Date.parse(date);if(!date||!Number.isFinite(time)||!recentPublication(time,now))continue;
  let raw=element(body,'link');if(!raw)for(const tag of body.match(/<link\b[^>]*\/?\s*>/gi)||[]){if(/rel=["'](?:self|enclosure)["']/i.test(tag))continue;raw=decode(tag.match(/href=["']([^"']+)["']/i)?.[1]||'');if(raw)break;}
  if(!approvedNewsUrl(raw))continue;const url=new URL(raw);if(url.pathname==='/'||/\/(?:feeds?|rss)\/?$/i.test(url.pathname))continue;url.hash='';for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key))url.searchParams.delete(key);
  if(!seen.has(url.href)){seen.add(url.href);result.push({url:url.href,time});}
 }return result.sort((a,b)=>b.time-a.time).slice(0,12);
}
async function readFeed(url:typeof PUBLISHER_FEEDS[number],fetcher:typeof fetch):Promise<string>{
 try{const r=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(6000),headers:{Accept:'application/rss+xml,application/atom+xml,application/xml,text/xml'}});
  if(!r.ok||Number(r.headers.get('content-length'))>MAX_BYTES)return '';const type=r.headers.get('content-type')||'';if(type&&!/xml|text\/plain/i.test(type))return '';
  const reader=r.body?.getReader();if(!reader)return '';let bytes=0,text='';const decoder=new TextDecoder();
  while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>MAX_BYTES){await reader.cancel();return '';}text+=decoder.decode(part.value,{stream:true});}return text+decoder.decode();
 }catch{return '';}
}
export async function publisherNews(now=Date.now(),fetcher:typeof fetch=fetch):Promise<VerifiedNews[]>{
 const feeds=await Promise.all(PUBLISHER_FEEDS.map(url=>readFeed(url,fetcher)));
 const candidates=feeds.flatMap(xml=>feedCandidates(xml,now)).sort((a,b)=>b.time-a.time);const urls=[...new Set(candidates.map(c=>c.url))].slice(0,4);
 const articles=await Promise.all(urls.map(url=>readVerifiedNews(url,now,(input,init)=>fetcher(input,init))));
 return articles.filter((a):a is VerifiedNews=>a!==null).slice(0,2);
}
