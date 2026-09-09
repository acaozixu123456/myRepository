export const NEWS_DOMAINS=['nasa.gov','jaxa.jp','nhk.or.jp','reuters.com','apnews.com'];
export function approvedNewsUrl(raw:string){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&NEWS_DOMAINS.some(d=>u.hostname===d||u.hostname.endsWith('.'+d));}catch{return false;}}
export function excludedNews(text:string){return /たばこ|タバコ|喫煙|烟草|香烟|加熱式|ニコチン|tobacco|nicotine|vaping|Ploom|IQOS|advertorial|sponsored content|赌博|賭博|オンラインカジノ|性的暴行|自殺|自杀/iu.test(text);}
export function publicationTime(html:string):number|null{
 const candidates=[...html.matchAll(/["']datePublished["']\s*:\s*["']([^"']+)["']/gi)].map(m=>m[1]);
 for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){if(/(?:article:published_time|datePublished|pubdate|publishdate)/i.test(tag)){const match=tag.match(/\bcontent=["']([^"']+)["']/i);if(match)candidates.push(match[1]);}}
 for(const date of candidates){const t=Date.parse(date);if(Number.isFinite(t))return t;}return null;
}
export function recentPublication(time:number|null,now=Date.now()){return time!==null&&time<=now+3600000&&time>=now-7*86400000;}
export async function verifyNewsPage(url:string,now=Date.now(),fetcher:(url:string,init:RequestInit)=>Promise<Response>=fetch):Promise<string|null>{
 if(!approvedNewsUrl(url))return null;let current=url;
 try{for(let i=0;i<3;i++){
  const r=await fetcher(current,{redirect:'manual',signal:AbortSignal.timeout(9000),headers:{Accept:'text/html'}});
  if([301,302,303,307,308].includes(r.status)){const location=r.headers.get('location');if(!location)return null;current=new URL(location,current).href;if(!approvedNewsUrl(current))return null;continue;}
  if(!r.ok||Number(r.headers.get('content-length'))>1500000)return null;
  const reader=r.body?.getReader();if(!reader)return null;let size=0,html='';const decoder=new TextDecoder();
  while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>1500000){await reader.cancel();return null;}html+=decoder.decode(chunk.value,{stream:true});}
  const published=publicationTime(html);return recentPublication(published,now)?new Date(published!).toISOString().slice(0,10):null;
 }return null;}catch{return null;}
}
