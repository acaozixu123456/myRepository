import {readFileSync,writeFileSync} from 'node:fs';
// Bounded, reviewable integration into large existing files. Never touches storage or game sources.
const replaceOnce=(source,from,to)=>{if(source.split(from).length!==2)throw new Error(`Integration anchor is not unique: ${from.slice(0,90)}`);return source.replace(from,to);};
let page=readFileSync('src/NhkMorningPage.tsx','utf8');
if(!page.includes("import NhkSpeakingCoach from './NhkSpeakingCoach';")){
  page=replaceOnce(page,"import NhkBackupPanel from './NhkBackupPanel';","import NhkSpeakingCoach from './NhkSpeakingCoach';\nimport NhkBackupPanel from './NhkBackupPanel';");
  page=replaceOnce(page,'        <div className="nhk-article-detail-actions">','        <NhkSpeakingCoach key={`speaking-${activeArticle.id}`} article={activeArticle} preferredSentence={activeRecommendation?.sentence}/>\n\n        <div className="nhk-article-detail-actions">');
  page=replaceOnce(page,'          </NhkSentenceInsight>','          </NhkSentenceInsight>\n          <NhkSpeakingCoach key={`speaking-${studyArticle.id}-${activeRecommendation.sentence}`} article={studyArticle} preferredSentence={activeRecommendation.sentence}/>');
  page=replaceOnce(page,'        {step === 2 && (\n          <div className="nhk-study-step">\n            <div className="nhk-step-intro">\n              <span>OUTPUT</span>','        {step === 2 && (\n          <div className="nhk-study-step">\n            <NhkSpeakingCoach key={`speaking-${studyArticle.id}`} article={studyArticle} preferredSentence={primaryRecommendation?.sentence}/>\n            <details className="nhk-speaking-advanced"><summary>进阶：自己复述整篇（可选）</summary>\n            <div className="nhk-step-intro">\n              <span>OUTPUT</span>');
  page=replaceOnce(page,'          </div>\n        )}\n      </section>\n    );\n  }\n\n  return (','            </details>\n          </div>\n        )}\n      </section>\n    );\n  }\n\n  return (');
  writeFileSync('src/NhkMorningPage.tsx',page);
}
let api=readFileSync('api/nhk-speech.ts','utf8');
if(!api.includes('handleSpeakingProxy')){
  api="import {handleSpeakingProxy} from '../server/nhkSpeakingProxy.js';\n"+api;
  api=replaceOnce(api,'  const action = clean(body.action, 16);',"  const action = clean(body.action, 16);\n  if (['speaking_start', 'speaking_stop', 'speaking_health'].includes(action)) {\n    return handleSpeakingProxy(req, res, body, {url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, clientKey: clientKey(req)});\n  }");
  writeFileSync('api/nhk-speech.ts',api);
}
if(readFileSync('src/nhkSpeaking.ts','utf8')!==readFileSync('supabase/functions/nihongo-speaking-session/contract.ts','utf8'))throw new Error('Client/server speaking contracts differ');
console.log('Bounded article, sentence, optional-output and existing speech-proxy integration ready.');
