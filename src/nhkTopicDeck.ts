import {readTopicTicket,similarTopic,TOPIC_CATALOG,type TopicTicket,type CatalogTopic} from './nhkTopicCatalog';
import type {SpeakingPlan} from './nhkSpeaking';
import type {ChatPlan} from './nhkChat';
type Cache={tickets:TopicTicket[];seen:string[];touched:number};
const cache=new Map<string,Cache>();
/** Per-tab cache only; never stores an article or learner transcript in localStorage. */
export class TopicDeck {
  private data:Cache;private flight:Promise<void>|null=null;private retryAt=0;private abort:AbortController|null=null;
  status='';
  constructor(private base:SpeakingPlan,private fallback:CatalogTopic[]){
    const key=JSON.stringify([base.articleId,base.source]);this.data=cache.get(key)||{tickets:[],seen:[],touched:Date.now()};this.data.touched=Date.now();cache.set(key,this.data);
    if(cache.size>10)cache.delete(cache.keys().next().value!);
  }
  topics():CatalogTopic[]{this.data.tickets=this.data.tickets.filter(t=>t.expiresAt>Date.now()+60000);return [...this.data.tickets.map(t=>t.topic),...this.fallback];}
  find(id:string){return this.topics().find(t=>t.id===id);}
  plan(id:string):ChatPlan {const ticket=this.data.tickets.find(t=>t.topic.id===id);return {...this.base,chatMode:true,topicId:id,...(ticket?{generated:ticket}:{})};}
  choose(currentId:string,random=Math.random):CatalogTopic {
    const topics=this.topics();const current=topics.find(t=>t.id===currentId);if(current&&!this.data.seen.includes(current.questionJa))this.data.seen.push(current.questionJa);
    let next=topics.filter(t=>t.id!==currentId&&!this.data.seen.some(s=>similarTopic(s,t.questionJa)));
    const fresh=next.filter(t=>t.id.startsWith('gen-'));if(fresh.length)next=fresh;
    if(!next.length){next=topics.filter(t=>t.id!==currentId);this.data.seen=this.data.seen.slice(-40);this.status=this.flight?'新话题还在准备，先换一个已有话头':'这批话题已经看过，可以再聊一个';}
    const choice=next[Math.min(next.length-1,Math.floor(random()*next.length))]||topics[0];
    if(choice){this.data.seen.push(choice.questionJa);this.data.seen=this.data.seen.slice(-60);}return choice;
  }
  async replenish(changed:()=>void,force=false):Promise<void>{
    if(this.flight)return this.flight;
    const left=this.data.tickets.filter(t=>t.expiresAt>Date.now()+60000&&!this.data.seen.some(s=>similarTopic(s,t.topic.questionJa))).length;
    if((left>=3&&!force)||Date.now()<this.retryAt||!this.base.source.length)return;
    this.status='正在根据这篇文章准备新话头…';changed();this.abort=new AbortController();
    const excluded=[...this.data.seen,...this.data.tickets.map(t=>t.topic.questionJa),...this.fallback.map(t=>t.questionJa)].slice(-48);
    this.flight=(async()=>{try{
      const response=await fetch('/api/nhk-speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'speaking_topics',plan:this.base,exclude:excluded}),signal:AbortSignal.any([this.abort!.signal,AbortSignal.timeout(22000)])});
      const result=await response.json();if(!response.ok||!result.ok||result.catalog!==TOPIC_CATALOG)throw new Error(result.reason||'topics_unavailable');
      const accepted:TopicTicket[]=[];
      for(const raw of (Array.isArray(result.topics)?result.topics:[]).slice(0,6)){
        const ticket=readTopicTicket(raw,this.base.source);if(!ticket)continue;
        if([...excluded,...accepted.map(t=>t.topic.questionJa)].some(s=>similarTopic(s,ticket.topic.questionJa)))continue;accepted.push(ticket);
      }
      this.data.tickets=[...this.data.tickets,...accepted].slice(-60);
      this.status=accepted.length?`新话头准备好了 · ${accepted.length} 个`:'这一批没有足够新意，现有话题仍可聊';this.retryAt=Date.now()+(accepted.length?15000:45000);
    }catch(e){if(this.abort?.signal.aborted)return;this.status=e instanceof Error&&e.message==='topic_generation_limited'?'新话题生成暂时繁忙，已准备的话题仍可用':'新话题暂时没准备好，已有话题和聊天不受影响';this.retryAt=Date.now()+45000;}
    finally{this.flight=null;changed();}})();return this.flight;
  }
  dispose(){this.abort?.abort();}
}
