import {describe,it,expect,vi,afterEach} from 'vitest';
import {readCatalogTopic,readTopicTicket,similarTopic,TOPIC_CATALOG} from './nhkTopicCatalog';
import {TopicDeck} from './nhkTopicDeck';
import {buildChatPlan,chatTopics,validateChatPlan} from './nhkChat';
import {rmsLevel} from './nhkAudioActivity';
import {generateTopics,verifyTopic} from '../supabase/functions/nihongo-speaking-session/topics';
const plan=buildChatPlan({id:'a',title:'SNS',sentences:['子どもがSNSやスマホを使っています。']});
const topic={id:'gen-0123456789abcdef',titleZh:'一起分享的小东西',questionJa:'写真を友達に送りますか。',answersJa:['よく送ります。','あまり送りません。'],kind:'personal',sourceQuote:'SNS',angle:'sharing'};
const ticket={topic,expiresAt:Date.now()+3600000,proof:'a'.repeat(64)};
afterEach(()=>vi.unstubAllGlobals());
describe('fresh bounded article topics',()=>{
 it('accepts an exact-source simple topic and rejects invented anchors',()=>{expect(readCatalogTopic(topic,plan.source)).not.toBeNull();expect(readCatalogTopic({...topic,sourceQuote:'not in article'},plan.source)).toBeNull();});
 it('rejects long, abstract, multiquestion or malformed suggestions',()=>{for(const questionJa of ['何が好きですか。なぜですか。','政策についてどう思いますか。','あ'.repeat(43)])expect(readCatalogTopic({...topic,questionJa},plan.source)).toBeNull();});
 it('rejects stale or malformed proof envelopes',()=>{expect(readTopicTicket(ticket,plan.source)).not.toBeNull();expect(readTopicTicket({...ticket,expiresAt:1},plan.source)).toBeNull();expect(readTopicTicket({...ticket,proof:'oops'},plan.source)).toBeNull();});
 it('recognizes normalized repeats',()=>{expect(similarTopic('SNSは好きですか？','ＳＮＳは好きですか。')).toBe(true);expect(similarTopic('寝る前にスマホを見ますか。','何の写真を撮りますか。')).toBe(false);});
 it('resolves a signed topic structurally on the client',()=>{const p={...plan,topicId:topic.id,generated:ticket};expect(chatTopics(p)[0].questionJa).toBe(topic.questionJa);expect(validateChatPlan(p)?.generated).toBeDefined();});
 it('does not classify 米国 as food',()=>{const p=buildChatPlan({id:'usa',title:'米国',sentences:['米国で新しい学校が開きました。']});expect(chatTopics(p).some(t=>t.id.startsWith('food-'))).toBe(false);});
 it('creates no requests during construction and batches explicit browsing',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true,catalog:TOPIC_CATALOG,topics:[ticket]})));vi.stubGlobal('fetch',fetcher);const d=new TopicDeck(plan,chatTopics(plan));expect(fetcher).not.toHaveBeenCalled();await Promise.all([d.replenish(()=>{}),d.replenish(()=>{})]);expect(fetcher).toHaveBeenCalledTimes(1);expect(d.choose(plan.topicId).id).toBe(topic.id);d.dispose();});
 it('server proof rejects both source changes and question tampering',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({topics:[topic]})}]}]}))));const result=await generateTopics(plan,[], 'test-client','not-a-real-key','test-only-signing-secret',vi.fn().mockResolvedValue(true));expect(result.ok).toBe(true);const signed=result.topics![0];expect(await verifyTopic(plan,signed,'test-only-signing-secret')).not.toBeNull();expect(await verifyTopic({...plan,articleId:'other'},signed,'test-only-signing-secret')).toBeNull();expect(await verifyTopic(plan,{...signed,topic:{...signed.topic,questionJa:'好きな写真は何ですか。'}},'test-only-signing-secret')).toBeNull();});
});
describe('sound visualization uses real samples',()=>{
 it('silence has no invented waveform',()=>expect(rmsLevel(new Uint8Array(256).fill(128))).toBe(0));
 it('louder PCM produces a larger bounded level',()=>{expect(rmsLevel(new Uint8Array(256).fill(132))).toBeGreaterThan(0);expect(rmsLevel(new Uint8Array(256).fill(180))).toBeGreaterThan(rmsLevel(new Uint8Array(256).fill(132)));expect(rmsLevel(new Uint8Array(256).fill(255))).toBeLessThanOrEqual(1);});
});
