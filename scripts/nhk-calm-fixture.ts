// Synthetic acceptance fixture. Not an NHK article, not user data, never shipped into the UI.
import {writeFileSync} from 'node:fs';
import {buildFallbackCoach} from '../src/nhkCoach';
import {createNhkArticleRecord, toggleNhkKnowledge, knowledgePointFromGrammar, knowledgePointFromVocabulary, type NhkKnowledgeItem} from '../src/nhkLibrary';
const title = '町の図書館　夜も利用できるように';
const sentences = ['町の図書館は、来月から夜も利用できるようになります。','図書館によると、仕事のあとに本を読みたいという声が多かったそうです。','館内では、大きな声で話してはいけません。'];
const coach = buildFallbackCoach(title, sentences);
coach.summaryJa = '町の図書館が、来月から夜も開くことになりました。';
coach.summaryZh = '镇上的图书馆将从下个月起延长至晚间开放。';
coach.recommendations.sort((a,b) => a.sentenceIndex - b.sentenceIndex);
const first = coach.recommendations[0];
Object.assign(first, {label: '核心', translationZh: '镇上的图书馆从下个月开始，晚上也能使用了。', structureZh: '先找到主语「図書館は」。接着是时间「来月から」，最后的「利用できるようになります」说明从不能到能的变化。', chunks: ['町の図書館は、','来月から','夜も利用できるようになります。'], expression: '〜ようになる', meaningZh: '变得能够……；出现新的状态', reasonZh:'从变化中读懂新闻重点', dailyVersion:'少しずつ、日本語が聞き取れるようになりました。', workVersion:'来月から、新しいシステムを利用できるようになります。', grammarPoints: [{id:'fixture-g1', pattern:'〜ようになる', meaningZh:'变得能够……；出现新的状态', formation:'动词辞书形／可能形／ない形＋ようになる', explanationZh:'描述以前与现在不同的状态变化。这里接可能形「利用できる」，表示今后晚上也能使用。', nuanceZh:'「〜ようにする」侧重主动努力或安排；「〜ようになる」侧重状态变化。', examples:[{ja:'毎日聞いていたら、少しずつ分かるようになりました。',zh:'每天听着听着，渐渐就能听懂了。'},{ja:'新しい図書館で、夜も勉強できるようになります。',zh:'在新的图书馆，晚上也能学习了。'}]}], vocabularyPoints:[{id:'fixture-v1',word:'利用',reading:'りよう',meaningZh:'使用；利用',partOfSpeech:'名词・する动词',nuanceZh:'常用于设施、服务等的使用。',examples:[{ja:'駅の近くの図書館を利用しています。',zh:'我常使用车站附近的图书馆。'}]}]});
const article = createNhkArticleRecord({sourceUrl:'https://www.mojidict.com/article/calm-fixture',title,sentences,selectedSentences:[sentences[0]],coach,coachModel:'test-fixture-not-ai',dateKey:'2026-09-04',importedAt:Date.UTC(2026,8,4,1)});
const source = {articleId:article.id,articleTitle:article.title,sourceUrl:article.sourceUrl,sentence:sentences[0],sentenceIndex:0};
let knowledge: NhkKnowledgeItem[] = [];
knowledge = toggleNhkKnowledge(knowledge,knowledgePointFromGrammar(first.grammarPoints[0]),source,1);
knowledge = toggleNhkKnowledge(knowledge,knowledgePointFromVocabulary(first.vocabularyPoints[0]),source,2);
for (let i=2; i<5; i++) knowledge=toggleNhkKnowledge(knowledge,{kind:'vocabulary',key:`fixture-${i}`,title:['図書館','館内','来月'][i-2],reading:['としょかん','かんない','らいげつ'][i-2],meaningZh:['图书馆','馆内','下个月'][i-2],examples:[]},source,i+1);
writeFileSync(process.env.FIXTURE_OUT || '/tmp/nhk-calm-fixture.json', JSON.stringify({article,knowledge,coach,sentences,title},null,2));
