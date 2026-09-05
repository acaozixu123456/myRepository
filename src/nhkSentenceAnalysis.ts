import type {NhkCoachRecommendation} from './nhkCoach';
export type SentenceAnalysis = {version: 1; model: string; generatedAt: number; recommendation: NhkCoachRecommendation};
export type SentenceRequest = {title: string; sentence: string; sentenceIndex: number; before: string[]; after: string[]};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const texts = (v: Record<string, unknown>, keys: string[]) => keys.every(k => typeof v[k] === 'string');
const examples = (v: unknown) => Array.isArray(v) && v.every(item => record(item) && texts(item, ['ja','zh']));
export function isSentenceAnalysis(value: unknown): value is SentenceAnalysis {
  if (!record(value) || value.version !== 1 || typeof value.model !== 'string' || !Number.isFinite(value.generatedAt)) return false;
  const r = value.recommendation;
  if (!record(r) || !Number.isInteger(r.sentenceIndex) || Number(r.sentenceIndex) < 0 || !texts(r, ['sentence','translationZh','structureZh','label','reasonZh','expression','meaningZh','dailyVersion','workVersion'])) return false;
  if (!r.sentence || !r.translationZh || !r.structureZh || !Array.isArray(r.chunks) || !r.chunks.every(x => typeof x === 'string')) return false;
  if (r.chunks.join('').replace(/\s/g,'') !== String(r.sentence).replace(/\s/g,'')) return false;
  return Array.isArray(r.grammarPoints) && r.grammarPoints.every(g => record(g) && texts(g,['id','pattern','meaningZh','formation','explanationZh','nuanceZh']) && examples(g.examples))
    && Array.isArray(r.vocabularyPoints) && r.vocabularyPoints.every(v => record(v) && texts(v,['id','word','reading','meaningZh','partOfSpeech','nuanceZh']) && examples(v.examples));
}
export function sentenceRequest(title: string, sentences: string[], index: number): SentenceRequest {
  if (!Number.isInteger(index) || !sentences[index]) throw new Error('invalid_sentence');
  if (sentences[index].length > 8000) throw new Error('sentence_too_long');
  return {title, sentence:sentences[index], sentenceIndex:index, before:sentences.slice(Math.max(0,index-2),index), after:sentences.slice(index+1,index+3)};
}
export function validSentenceRequest(value: unknown): value is SentenceRequest {
  if (!record(value) || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 300
    || typeof value.sentence !== 'string' || !value.sentence.trim() || value.sentence.length > 8000
    || !Number.isInteger(value.sentenceIndex) || Number(value.sentenceIndex) < 0 || Number(value.sentenceIndex) > 10000) return false;
  return [value.before,value.after].every(v => Array.isArray(v) && v.length <= 2 && v.every(s => typeof s === 'string' && s.length <= 8000));
}
export function findSentenceAnalysis(entries: SentenceAnalysis[] | undefined, sentence: string, index: number): SentenceAnalysis | undefined {
  return entries?.filter(entry => isSentenceAnalysis(entry) && entry.recommendation.sentence === sentence && entry.recommendation.sentenceIndex === index)
    .sort((a,b)=>b.generatedAt-a.generatedAt)[0];
}
