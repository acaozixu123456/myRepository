import {describe,it,expect} from 'vitest';
import {buildChatPlan,chatTopics,nextChatTopic,chatIntent,chatInstructions,validateChatPlan,chatError} from './nhkChat';
const plan=buildChatPlan({id:'test',title:'SNSのニュース',sentences:['子どもがSNSを使うことについて、新しいニュースがありました。']});
describe('random article-bound small talk',()=>{
  it('has varied news-related personal topics',()=>{const ids=chatTopics(plan).map(t=>t.id);expect(ids).toContain('sns-bed');expect(ids).toContain('sns-off');expect(ids.length).toBeGreaterThan(8);});
  it('does not mix unrelated domain facts',()=>{const rain=buildChatPlan({id:'rain',title:'雨',sentences:['今日は雨が降ります。']});expect(chatTopics(rain).some(t=>t.id.startsWith('sns-'))).toBe(false);expect(chatTopics(rain).some(t=>t.id==='weather-rain')).toBe(true);});
  it('uses real article source, not a random generic prompt supplied by client',()=>{const p=validateChatPlan({...plan,topicId:'invented',questionJa:'untrusted'});expect(p).toBeNull();expect(validateChatPlan(plan)?.chatMode).toBe(true);});
  it('exhausts a deck before repeating and does not immediately repeat at wrap',()=>{const pool=chatTopics(plan);let seen:string[]=[];let previous='';for(let i=0;i<pool.length*3;i++){const n=nextChatTopic(pool,seen,()=>0);if(previous)expect(n.topic.id).not.toBe(previous);seen=n.seen;previous=n.topic.id;if(i===pool.length-1)expect(new Set(seen).size).toBe(pool.length);}});
  it('local shuffling never needs an API or microphone',()=>{expect(()=>{let seen:string[]=[];for(let i=0;i<1000;i++)seen=nextChatTopic(chatTopics(plan),seen).seen;}).not.toThrow();});
  it.each(['はい','いいえ','うん','猫の動画','まだよく分かりません','我喜欢小猫'])('accepts minimal speech rather than imposing a scripted answer: %s',s=>expect(chatIntent(s)).toBe('answer'));
  it('distinguishes help, repeat, shuffle and stop',()=>{expect(chatIntent('帮我接')).toBe('help');expect(chatIntent('もう一度お願いします')).toBe('repeat');expect(chatIntent('换个话题')).toBe('shuffle');expect(chatIntent('今日はここまでにします')).toBe('end');expect(chatIntent('えっと')).toBe('filler');});
  it('responds to the actual answer and keeps history bounded',()=>{const s=chatInstructions(plan,'answer',Array.from({length:20},(_,i)=>({role:'user' as const,text:`turn-${i}`})),'猫の動画');expect(s).toContain('猫の動画');expect(s).not.toContain('turn-0');expect(s).toContain('turn-19');expect(s).toContain('Do not end automatically after three turns');});
  it('help targets the latest question and distinguishes personal prompts from news facts',()=>{const s=chatInstructions(plan,'help',[{role:'assistant',text:'猫は飼っていますか。'}]);expect(s).toContain('MOST RECENT question');expect(s).toContain('NOT news facts');expect(s).toContain('untrusted data');});
  it('does not mislabel burst throttling as provider credit exhaustion',()=>{expect(chatError('app_burst_limited')).toContain('不是 OpenAI 余额用完');expect(chatError('provider_insufficient_quota')).toContain('账单');expect(chatError('provider_rate_limited')).toContain('繁忙');});
});
