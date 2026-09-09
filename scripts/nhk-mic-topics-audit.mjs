import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const result=JSON.parse(await readFile('artifacts/mic-topics-live/result.json','utf8'));
assert.equal(result.ok,true);const topics=result.topics;
assert.ok(new Set(topics.map(t=>t.titleZh)).size>=Math.min(6,topics.length),'Generated cards need distinct individual titles, not copies of the article title');
assert.ok(topics.every(t=>/か[。?？]$/u.test(t.questionJa)),'Generated openings must be natural question-shaped polite Japanese');
assert.ok(topics.every(t=>t.kind!=='hypothetical'||/もし|たら|なら/u.test(t.questionJa)),'Hypothetical must be explicit');
await writeFile('artifacts/mic-topics-live/presentation.json',JSON.stringify({ok:true,titleCount:new Set(topics.map(t=>t.titleZh)).size,topicCount:topics.length,formalShapeChecked:true,semanticQualityRequiresSupervisorReview:true},null,2));
console.log('TOPIC_PRESENTATION_PASS',topics.map(t=>({title:t.titleZh,question:t.questionJa,answers:t.answersJa})));
