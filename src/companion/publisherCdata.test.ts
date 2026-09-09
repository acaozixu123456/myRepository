import {describe,it,expect} from 'vitest';
import {feedCandidates} from '../../supabase/functions/nihongo-companion/publisherFeed';
const now=Date.parse('2026-09-09T09:01:00Z');
const item='<item><title>A public science observation</title><link>https://science.nasa.gov/observation/</link><pubDate>Wed, 09 Sep 2026 06:20:49 +0000</pubDate><content:encoded><![CDATA[<p><!DOCTYPE html PUBLIC "example"><html>Quoted article HTML</html></p>]]></content:encoded></item>';
describe('real publisher CDATA regression without entity expansion',()=>{
 it('allows quoted article HTML without discarding the whole valid feed',()=>expect(feedCandidates('<rss><channel>'+item+'</channel></rss>',now)).toHaveLength(1));
 it('continues rejecting actual feed DTD and ENTITY declarations',()=>{expect(feedCandidates('<!DOCTYPE rss>'+item,now)).toEqual([]);expect(feedCandidates('<!ENTITY x SYSTEM "file:///etc/passwd">'+item,now)).toEqual([]);});
 it('ignores item-shaped content embedded in quoted article bodies',()=>{const wrapped='<item><title>Container</title><description><![CDATA['+item.replace(/<!\[CDATA\[|\]\]>/g,'')+']]></description></item>';expect(feedCandidates(wrapped,now)).toEqual([]);});
 it('does not turn CDATA allowance into permission for an outside declaration',()=>expect(feedCandidates(item+'<!DOCTYPE rss [<!ENTITY x "bad">]>',now)).toEqual([]));
});
