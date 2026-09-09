import {describe,it,expect} from 'vitest';
import {newsMaterial,sourceQuoteSupported,readVerifiedNews,approvedNewsUrl} from '../../supabase/functions/nihongo-companion/newsGuard.ts';
const now=Date.parse('2026-09-09T08:00:00Z');
const url='https://science.nasa.gov/blog/example';
const body='A telescope has taken a new photograph of a distant cloud. The image shows several bright stars and an intricate pattern of dust. Researchers published the picture for the public to explore.';
const html=(title='A new view of a distant cloud',date='2026-09-08',text=body)=>`<script type="application/ld+json">${JSON.stringify({'@type':'NewsArticle',headline:title,datePublished:date,articleBody:text})}</script>`;
describe('publisher material not generated search prose',()=>{
 it('extracts exact publisher title, date and excerpt',()=>{const n=newsMaterial(html(),url,now)!;expect(n.title).toBe('A new view of a distant cloud');expect(n.excerpt).toBe(body);expect(n.publishedAt).toBe('2026-09-08T00:00:00.000Z');});
 it('rejects article dates outside the recent window',()=>{expect(newsMaterial(html('Title long enough','2025-09-08'),url,now)).toBeNull();expect(newsMaterial(html().replace('datePublished','dateModified'),url,now)).toBeNull();});
 it('rejects an advertising subject even at an approved publisher',()=>expect(newsMaterial(html('New tobacco product colours'),url,now)).toBeNull());
 it('cannot turn a date-only page or empty description into news',()=>expect(newsMaterial('<meta property="article:published_time" content="2026-09-08">',url,now)).toBeNull());
 it('requires a continuous verbatim anchor rather than an invented translation',()=>{const n=newsMaterial(html(),url,now)!;expect(sourceQuoteSupported(body.slice(0,100),n)).toBe(true);expect(sourceQuoteSupported('A new telephone has new colours and a lower price.',n)).toBe(false);expect(sourceQuoteSupported('cloud',n)).toBe(false);});
 it('never requests a redirected private destination',async()=>{const calls:string[]=[];const n=await readVerifiedNews(url,now,async u=>{calls.push(u);return new Response('',{status:302,headers:{Location:'http://169.254.169.254/latest/meta-data/'}});});expect(n).toBeNull();expect(calls).toEqual([url]);});
 it('restricts hosts and nonstandard ports',()=>{expect(approvedNewsUrl('https://nasa.gov:8443/a')).toBe(false);expect(approvedNewsUrl('https://nasa.gov.evil.test/a')).toBe(false);});
 it('rejects oversized pages before using their claimed date',async()=>expect(await readVerifiedNews(url,now,async()=>new Response(html(),{headers:{'content-length':'1600000'}}))).toBeNull());
});
