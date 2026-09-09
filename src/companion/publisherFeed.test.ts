import {describe,it,expect,vi} from 'vitest';
import {feedCandidates,publisherNews,PUBLISHER_FEEDS} from '../../supabase/functions/nihongo-companion/publisherFeed';
const now=Date.parse('2026-09-09T09:00:00Z');
const item=(url:string,date='Tue, 08 Sep 2026 10:00:00 GMT',title='A small science discovery')=>`<item><title>${title}</title><link>${url}</link><pubDate>${date}</pubDate></item>`;
const url='https://www.nasa.gov/science/new-observation/';
describe('publisher feed discovery does not certify a news fact',()=>{
 it('accepts a recent linked item and removes tracking',()=>expect(feedCandidates(item(url+'?utm_source=rss'),now)).toEqual([{url,time:Date.parse('2026-09-08T10:00:00Z')}]));
 it.each(['http://127.0.0.1/','https://nasa.gov.evil.example/story','https://user:pass@www.nasa.gov/story','https://www.nasa.gov:444/story'])('rejects non-approved URL %s',u=>expect(feedCandidates(item(u),now)).toEqual([]));
 it('rejects old, undated, future, duplicate and promotional entries',()=>{expect(feedCandidates(item(url,'2024-01-01')+item(url,'')+item(url,'2026-10-01'),now)).toEqual([]);expect(feedCandidates(item(url)+item(url),now)).toHaveLength(1);expect(feedCandidates(item(url,undefined,'Sponsored content nicotine'),now)).toHaveLength(0);});
 it('never expands DTD entities',()=>expect(feedCandidates('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]>'+item(url),now)).toEqual([]));
 it('supports Atom alternate links without relying on updated dates',()=>{expect(feedCandidates(`<entry><title>new study</title><link rel="self" href="https://www.nasa.gov/feed/"/><link rel="alternate" href="${url}"/><published>2026-09-08T10:00:00Z</published></entry>`,now)).toHaveLength(1);expect(feedCandidates(`<entry><title>new study</title><link href="${url}"/><updated>2026-09-08T10:00:00Z</updated></entry>`,now)).toEqual([]);});
 it('does not trust a fresh feed date when publisher page is old',async()=>{const fetcher=vi.fn(async(input:RequestInfo|URL)=>new Response(PUBLISHER_FEEDS.includes(String(input) as typeof PUBLISHER_FEEDS[number])?item(url):'<meta property="article:published_time" content="2024-01-01"/><article>Old content.</article>',{headers:{'Content-Type':PUBLISHER_FEEDS.includes(String(input) as typeof PUBLISHER_FEEDS[number])?'application/rss+xml':'text/html'}}));expect(await publisherNews(now,fetcher)).toEqual([]);expect(fetcher.mock.calls.map(c=>String(c[0]))).toContain(url);});
 it('returns empty without inventing stories when sources fail',async()=>expect(await publisherNews(now,vi.fn(async()=>new Response('',{status:503})))).toEqual([]));
});
