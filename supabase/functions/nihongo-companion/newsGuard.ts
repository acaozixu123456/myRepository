export const NEWS_DOMAINS=['nasa.gov','jaxa.jp','nhk.or.jp','reuters.com','apnews.com'];
export function approvedNewsUrl(raw:string){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&NEWS_DOMAINS.some(d=>u.hostname===d||u.hostname.endsWith('.'+d));}catch{return false;}}
export function excludedNews(value:string){return /たばこ|タバコ|喫煙|烟草|香烟|加熱式|ニコチン|tobacco|nicotine|vaping|Ploom|IQOS|advertorial|sponsored content|paid content|提供記事|タイアップ|赌博|賭博|オンラインカジノ|性的暴行|自殺|自杀/iu.test(value);}
const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
const decode=(s:string)=>s.replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n:string)=>{const x=parseInt(n[0].toLowerCase()==='x'?n.slice(1):n,n[0].toLowerCase()==='x'?16:10);return x>0&&x<=0x10ffff?String.fromCodePoint(x):'';}).replace(/&quot;/gi,'"').replace(/&apos;|&#39;/gi,"'").replace(/&nbsp;/gi,' ').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&amp;/gi,'&');
const strip=(s:string)=>clean(decode(s.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ')));
function meta(html:string,name:string):string{for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const attrs=new Map([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1].toLowerCase(),decode(m[2])]));if(attrs.get('property')===name||attrs.get('name')===name)return attrs.get('content')||'';}return '';}
export function publicationTime(html:string):number|null{
 const candidates=[meta(html,'article:published_time'),meta(html,'datePublished'),meta(html,'pubdate'),meta(html,'publishdate'),...[...html.matchAll(/["']datePublished["']\s*:\s*["']([^"']+)["']/gi)].map(m=>m[1])];
 for(const date of candidates){const t=Date.parse(date);if(date&&Number.isFinite(t))return t;}return null;
}
export function recentPublication(time:number|null,now=Date.now()){return time!==null&&time<=now+3600000&&time>=now-7*86400000;}
export type VerifiedNews={url:string;title:string;publishedAt:string;excerpt:string;retrievedAt:string};
/** Extract only publisher material, never a generated search summary or date. */
export function newsMaterial(html:string,url:string,now=Date.now()):VerifiedNews|null{
 if(!approvedNewsUrl(url))return null;const published=publicationTime(html);if(!recentPublication(published,now))return null;
 let title=meta(html,'og:title'),body='';
 const visit=(node:any,depth=0)=>{if(!node||typeof node!=='object'||depth>8)return;if(Array.isArray(node)){node.slice(0,50).forEach(v=>visit(v,depth+1));return;}const type=Array.isArray(node['@type'])?node['@type'].join(' '):String(node['@type']||'');if(/Article|Report|NewsArticle/.test(type)){if(typeof node.headline==='string')title=node.headline;if(typeof node.articleBody==='string'&&node.articleBody.length>body.length)body=node.articleBody;}if(node['@graph'])visit(node['@graph'],depth+1);};
 for(const s of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(s[1]));}catch{/* Publisher schema is optional, never executable. */}}
 if(!title)title=strip(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
 if(!body){const article=html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]||html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||'';body=strip(article);}
 if(!body)body=meta(html,'og:description')||meta(html,'description');
 title=clean(decode(title));body=strip(body);
 if(title.length<5||body.length<80||excludedNews(title+' '+body))return null;
 return {url,title:title.slice(0,160),publishedAt:new Date(published!).toISOString(),excerpt:body.slice(0,2200),retrievedAt:new Date(now).toISOString()};
}
async function allowedHtml(url:string,fetcher:(url:string,init:RequestInit)=>Promise<Response>):Promise<{url:string;html:string}|null>{
 if(!approvedNewsUrl(url))return null;let current=url;
 try{for(let i=0;i<3;i++){
  const r=await fetcher(current,{redirect:'manual',signal:AbortSignal.timeout(6500),headers:{Accept:'text/html'}});
  if([301,302,303,307,308].includes(r.status)){const location=r.headers.get('location');if(!location)return null;current=new URL(location,current).href;if(!approvedNewsUrl(current))return null;continue;}
  if(!r.ok||Number(r.headers.get('content-length'))>1500000)return null;
  const type=r.headers.get('content-type')||'';if(type&&!/text\/html|application\/xhtml|text\/plain/i.test(type))return null;
  const reader=r.body?.getReader();if(!reader)return null;let size=0,html='';const decoder=new TextDecoder();
  while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>1500000){await reader.cancel();return null;}html+=decoder.decode(chunk.value,{stream:true});}
  return {url:current,html:html+decoder.decode()};
 }return null;}catch{return null;}
}
export async function verifyNewsPage(url:string,now=Date.now(),fetcher:(url:string,init:RequestInit)=>Promise<Response>=fetch):Promise<string|null>{const page=await allowedHtml(url,fetcher);if(!page)return null;const t=publicationTime(page.html);return recentPublication(t,now)?new Date(t!).toISOString().slice(0,10):null;}
export async function readVerifiedNews(url:string,now=Date.now(),fetcher:(url:string,init:RequestInit)=>Promise<Response>=fetch){const page=await allowedHtml(url,fetcher);return page?newsMaterial(page.html,page.url,now):null;}
export function sourceQuoteSupported(quote:unknown,news:VerifiedNews){return typeof quote==='string'&&clean(quote).length>=20&&quote.length<=260&&news.excerpt.includes(clean(quote));}
