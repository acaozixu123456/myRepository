import {describe,it,expect} from 'vitest';
import {createNhkSession,upsertNhkSession,loadNhkSessions,saveNhkSessions} from './nhkMorning';
import {createNhkArticleRecord,loadNhkArticleRecords,saveNhkArticleRecords,mergeNhkArticlesWithSessions} from './nhkLibrary';
import {loadGentle} from './nhkGentle';
import {newSentenceAttempt,upsertSentenceAttempt,savePracticeHistory,loadPracticeHistory} from './nhkPracticeHistory';
import {parseStudyBackup,serializeStudyBackup,mergeStudyBackup,commitStudyRestore,recoverStudyRestore,DATA_KEYS,RESTORE_JOURNAL,type StudyData} from './nhkBackup';
import {buildRecommendationForSentence,normalizeNhkCoachResult} from './nhkCoach';
import {isSentenceAnalysis,findSentenceAnalysis,sentenceRequest,validSentenceRequest} from './nhkSentenceAnalysis';
function store() {const data=new Map<string,string>();return {data,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};}
const sentence='図書館は、来月から夜も利用できるようになります。';
function empty():StudyData {return {articles:[],knowledge:[],sessions:[],gentleProgress:loadGentle(store()),history:{version:1,attempts:[]}};}
function fixture():StudyData {
  const article=createNhkArticleRecord({sourceUrl:'https://www.mojidict.com/article/reliable',title:'図書館の利用',sentences:[sentence],importedAt:100});
  const session={...createNhkSession('2026-09-05','quiet'),sourceUrl:article.sourceUrl,title:article.title,recapText:'夜も利用できます。'};
  const attempt={...newSentenceAttempt(article.id,sentence,'下个月可以在夜间使用。',100),answer:'来月からです。',rating:'good' as const,completedAt:200};
  return {...empty(),articles:[article],sessions:[session],history:{version:1,attempts:[attempt]}};
}
describe('NHK reliable records and restore',()=>{
  it('same-day study attempts have independent identities',()=>{
    const first=createNhkSession('2026-09-05'), second=createNhkSession('2026-09-05');
    expect(first.id).not.toBe(second.id);expect(upsertNhkSession(upsertNhkSession([],first),second)).toHaveLength(2);
  });
  it('does not let legacy daily IDs overwrite another article',()=>{
    const a={...createNhkSession('2026-09-05'),id:'nhk-2026-09-05',sourceUrl:'https://www.mojidict.com/article/a',recapText:'first'};
    const b={...a,sourceUrl:'https://www.mojidict.com/article/b',recapText:'second'};
    const both=upsertNhkSession([a],b);expect(both).toHaveLength(2);expect(both.map(s=>s.recapText).sort()).toEqual(['first','second']);
    const target=store();saveNhkSessions(both,target);expect(loadNhkSessions(target)).toHaveLength(2);
  });
  it('round-trips all current study records and real learner answers',()=>{
    const before=fixture();const loaded=parseStudyBackup(serializeStudyBackup(before));
    expect(loaded.history.attempts[0].answer).toBe('来月からです。');expect(loaded.sessions[0].recapText).toBe('夜も利用できます。');
    expect(loaded.articles[0].sentences).toEqual([sentence]);
  });
  it('accepts old version-1 exports without manufacturing answer history',()=>{
    const f=fixture();const old=JSON.stringify({schemaVersion:1,articles:f.articles,knowledge:[],sessions:f.sessions});
    expect(parseStudyBackup(old).history.attempts).toEqual([]);
  });
  it('preserves distinct answers with the same ID and deduplicates repeated imports',()=>{
    const current=fixture(),incoming=parseStudyBackup(serializeStudyBackup(current));
    incoming.sessions[0].recapText='another answer';incoming.history.attempts[0].answer='another recall';
    const once=mergeStudyBackup(current,incoming), twice=mergeStudyBackup(once,incoming);
    expect(once.sessions).toHaveLength(2);expect(once.history.attempts).toHaveLength(2);
    expect(twice.sessions).toHaveLength(2);expect(twice.history.attempts).toHaveLength(2);expect(twice.articles).toHaveLength(1);
  });
  it('rejects malformed, unsupported and unsafe backups before writing',()=>{
    for(const value of ['{', '{"schemaVersion":99}',JSON.stringify({...fixture(),schemaVersion:1,articles:[{id:'a',sourceUrl:'javascript:alert(1)',sentences:[]}]}),'{"schemaVersion":1,"__proto__":{},"articles":[],"knowledge":[],"sessions":[]}']) expect(()=>parseStudyBackup(value)).toThrow();
  });
  it('rejects a conflicting source snapshot instead of overwriting original text',()=>{
    const current=fixture(),incoming=parseStudyBackup(serializeStudyBackup(current));incoming.articles[0].sentences=['別の記事です。'];
    expect(()=>mergeStudyBackup(current,incoming)).toThrow(/正文版本/);expect(current.articles[0].sentences).toEqual([sentence]);
  });
  it('commits a validated restore and removes the transaction journal',()=>{
    const storage=store();expect(commitStudyRestore(fixture(),storage)).toBe(true);
    expect(storage.getItem(RESTORE_JOURNAL)).toBeNull();expect(loadPracticeHistory(storage).attempts[0].answer).toBe('来月からです。');
  });
  it('rolls back every key when a write fails in the middle',()=>{
    const storage=store();for(const key of Object.values(DATA_KEYS))storage.setItem(key,`before:${key}`);
    const before=new Map(storage.data);let calls=0;
    const failing={...storage,setItem:(k:string,v:string)=>{if(++calls===3)throw new Error('quota');storage.setItem(k,v);}};
    expect(commitStudyRestore(fixture(),failing)).toBe(false);expect(storage.data).toEqual(before);
  });
  it('recovers an interrupted transaction before normal app storage loads',()=>{
    const storage=store();const before=Object.fromEntries(Object.values(DATA_KEYS).map(k=>[k,null]));
    storage.setItem(RESTORE_JOURNAL,JSON.stringify({version:1,before}));storage.setItem(DATA_KEYS.articles,'partially written');
    expect(recoverStudyRestore(storage)).toBe(true);expect(storage.data.size).toBe(0);
  });
  it('leaves original values unchanged when a journal cannot be written',()=>{
    const storage=store();storage.setItem(DATA_KEYS.articles,'keep');
    expect(commitStudyRestore(fixture(),{...storage,setItem:()=>{throw new Error('quota');}})).toBe(false);
    expect(storage.getItem(DATA_KEYS.articles)).toBe('keep');
  });
  it('saves unfinished text and never overwrites a completed attempt',()=>{
    const attempt=newSentenceAttempt('a',sentence,'meaning',100);let history=upsertSentenceAttempt({version:1,attempts:[]},{...attempt,answer:'draft'});
    const storage=store();savePracticeHistory(history,storage);expect(loadPracticeHistory(storage).attempts[0].answer).toBe('draft');
    history=upsertSentenceAttempt(history,{...attempt,answer:'finished',completedAt:200,rating:'good'});
    history=upsertSentenceAttempt(history,{...attempt,answer:'accidental overwrite'});expect(history.attempts[0].answer).toBe('finished');
  });
  it('does not clip archive sentences or remove repeated source lines',()=>{
    const long='これからの図書館について詳しく説明します、'.repeat(30)+'利用できます。';
    const sentences=[...Array.from({length:70},(_,i)=>`第${i}のニュースです。`),long,long];
    const article=createNhkArticleRecord({sourceUrl:'https://www.mojidict.com/article/long',title:'長い記事',sentences});
    const storage=store();saveNhkArticleRecords([article],storage);expect(loadNhkArticleRecords(storage)[0].sentences).toEqual(sentences);
  });
});
describe('exact on-demand sentence analysis',()=>{
  it('can request sentence 20 with adjacent context and no 280-character truncation',()=>{
    const source=Array.from({length:22},(_,i)=>`${i}番の文です。`);source[19]=sentence.repeat(20);
    const input=sentenceRequest('test',source,19);expect(input.sentence).toBe(source[19]);expect(input.before).toEqual(source.slice(17,19));expect(validSentenceRequest(input)).toBe(true);
  });
  it('rejects over-limit input explicitly instead of truncating',()=>{
    expect(()=>sentenceRequest('test',['日'.repeat(8001)],0)).toThrow('sentence_too_long');
    expect(validSentenceRequest({title:'test',sentence:'x',sentenceIndex:-1,before:[],after:[]})).toBe(false);
  });
  it('validates exact chunk alignment and ignores stale cached sentence indices',()=>{
    const recommendation={...buildRecommendationForSentence(sentence,2),chunks:[sentence]};
    const analysis={version:1 as const,model:'test',generatedAt:100,recommendation};
    expect(isSentenceAnalysis(analysis)).toBe(true);expect(findSentenceAnalysis([analysis],sentence,3)).toBeUndefined();
    expect(isSentenceAnalysis({...analysis,recommendation:{...recommendation,chunks:['wrong']}})).toBe(false);
  });
  it('persists analyzed sentences beyond the original three recommendations',()=>{
    const a=fixture().articles[0];const analysis={version:1 as const,model:'test',generatedAt:100,recommendation:{...buildRecommendationForSentence(sentence,0),chunks:[sentence]}};
    a.sentenceAnalyses=[analysis];const storage=store();saveNhkArticleRecords([a],storage);expect(loadNhkArticleRecords(storage)[0].sentenceAnalyses?.[0]).toEqual(analysis);
  });
});

it('sessions never replace archived source snapshots',()=>{
  const data=fixture(); const original=data.articles[0]; original.sentences=[sentence,'第二の文です。'];
  const old={...data.sessions[0],selectedSentences:[sentence],shadowText:sentence};
  const result=mergeNhkArticlesWithSessions([original],[old]);
  expect(result[0].sentences).toEqual(original.sentences);
  expect(mergeNhkArticlesWithSessions([], [old])[0].sentences).toEqual([sentence]);
});

it('numeric indices cannot attach explanations to different source text',()=>{
  const source=[sentence,'別の文です。',sentence];
  const point={...buildRecommendationForSentence(sentence,1),translationZh:'SOURCE_BOUND_TRANSLATION'};
  const input={summaryJa:'test',summaryZh:'test',opinionQuestion:'test',recommendations:[point]};
  const result=normalizeNhkCoachResult(input,'test',source);
  const bound=result.recommendations.find(r=>r.translationZh==='SOURCE_BOUND_TRANSLATION');
  expect(bound?.sentence).toBe(sentence);expect(bound?.sentenceIndex).toBe(0);
});
