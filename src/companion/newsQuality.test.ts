import {describe,it,expect} from 'vitest';
import {approvedNewsUrl,excludedNews,publicationTime,recentPublication,verifyNewsPage} from '../../supabase/functions/nihongo-companion/newsGuard.ts';
const now=Date.parse('2026-09-09T08:00:00Z');
describe('news source guard after an unsuitable advertising result',()=>{
 it('accepts only explicit public publisher hosts, not lookalikes or credentials',()=>{expect(approvedNewsUrl('https://science.nasa.gov/news/example')).toBe(true);for(const u of ['https://nasa.gov.evil.example','http://nasa.gov','https://secret@nasa.gov','https://127.0.0.1/','https://www.oricon.co.jp/advertisement'])expect(approvedNewsUrl(u)).toBe(false);});
 it('does not turn tobacco advertising into a learning news card',()=>{expect(excludedNews('JTの加熱式たばこ Ploom 新色')).toBe(true);expect(excludedNews('NASA publishes a new photo of the Moon')).toBe(false);});
 it('requires a publication date, not a crawl or modification date',()=>{expect(publicationTime('<script>{"dateModified":"2026-09-09"}</script>')).toBe(null);expect(publicationTime('<script>{"datePublished":"2026-09-08"}</script>')).toBe(Date.parse('2026-09-08'));});
 it('accepts standard article publication metadata',()=>expect(publicationTime('<meta content="2026-09-08T13:00:00Z" property="article:published_time">')).toBe(Date.parse('2026-09-08T13:00:00Z')));
 it('rejects old, unknown and future publication dates',()=>{expect(recentPublication(Date.parse('2026-09-08'),now)).toBe(true);for(const d of [null,Date.parse('2026-08-20'),Date.parse('2026-09-20')])expect(recentPublication(d,now)).toBe(false);});
 it('validates an actual allowed page rather than a model-generated date',async()=>expect(await verifyNewsPage('https://www.nasa.gov/example',now,async()=>new Response('<script>{"datePublished":"2026-09-08"}</script>'))).toBe('2026-09-08'));
 it('does not follow a publisher redirect into an untrusted host',async()=>expect(await verifyNewsPage('https://www.nasa.gov/example',now,async()=>new Response('',{status:302,headers:{Location:'http://127.0.0.1/'}}))).toBe(null));
 it('fails closed on publisher fetch or missing date',async()=>expect(await verifyNewsPage('https://www.nasa.gov/example',now,async()=>new Response('no date'))).toBe(null));
});
