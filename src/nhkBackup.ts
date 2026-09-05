import {loadNhkArticleRecords, loadNhkKnowledge, type NhkArticleRecord, type NhkKnowledgeItem} from './nhkLibrary';
import {loadNhkSessions, type NhkMorningSession} from './nhkMorning';
import {loadGentle, type GentleProgress} from './nhkGentle';
import {HISTORY_KEY, isSentenceAttempt, type PracticeHistory} from './nhkPracticeHistory';

export const BACKUP_MAX_BYTES = 10 * 1024 * 1024;
export const RESTORE_JOURNAL = 'nihongo-nhk-restore-journal-v1';
export const DATA_KEYS = {
  articles: 'nihongo-nhk-article-library-v1', knowledge: 'nihongo-nhk-knowledge-library-v1',
  sessions: 'nihongo-nhk-morning-v2', gentleProgress: 'nihongo-nhk-gentle-progress-v1', history: HISTORY_KEY,
} as const;
export type StudyData = {
  articles: NhkArticleRecord[]; knowledge: NhkKnowledgeItem[]; sessions: NhkMorningSession[];
  gentleProgress: GentleProgress; history: PracticeHistory;
};
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const number = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const text = (x: unknown): x is string => typeof x === 'string';
const safeId = (x: unknown): x is string => text(x) && !!x && x.length <= 1000 && !['__proto__','prototype','constructor'].includes(x);
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every(text);
const url = (x: unknown) => {try {return text(x) && ['http:', 'https:'].includes(new URL(x).protocol);} catch {return false;}};
function assert(ok: unknown, message: string): asserts ok {if (!ok) throw new Error(message);}
const asStore = (data: Record<string, unknown>) => ({getItem: (key: string) => JSON.stringify(data[key] ?? null), setItem: () => {}});

function validateTree(root: unknown) {
  let nodes = 0;
  const walk = (value: unknown, depth: number) => {
    assert(++nodes < 250000 && depth < 32, '备份结构过大或过深，未导入。');
    if (Array.isArray(value)) {for (const v of value) walk(v, depth + 1);}
    else if (object(value)) for (const [key, v] of Object.entries(value)) {
      assert(!['__proto__', 'constructor', 'prototype'].includes(key), '备份含有不安全的字段，未导入。');
      if (key === 'sourceUrl' && v) assert(url(v), '备份包含无效的原文地址，未导入。');
      walk(v, depth + 1);
    }
  };
  walk(root, 0);
}
export function parseStudyBackup(serialized: string): StudyData {
  assert(new TextEncoder().encode(serialized).byteLength <= BACKUP_MAX_BYTES, '备份超过 10 MB，未导入。');
  let data: unknown;
  try {data = JSON.parse(serialized.replace(/^\uFEFF/, ''));} catch {throw new Error('文件不是有效的 JSON 备份，未导入。');}
  validateTree(data);
  assert(object(data), '备份格式不正确。');
  assert(data.schemaVersion === 1 || (data.schemaVersion === 2 && data.app === 'nhk-study'), '不支持这个备份版本，未导入。');
  for (const key of ['articles','knowledge','sessions']) assert(Array.isArray(data[key]), `备份缺少 ${key}，未导入。`);
  const records = data.articles as unknown[], bookmarks = data.knowledge as unknown[], sessions = data.sessions as unknown[];
  assert(records.every(a => object(a) && safeId(a.id) && url(a.sourceUrl) && text(a.title) && strings(a.sentences)
    && (a.version === undefined || a.version === 1) && number(a.importedAt)
    && (a.selectedSentences === undefined || strings(a.selectedSentences))), '文章数据损坏，未导入。');
  assert(bookmarks.every(k => object(k) && safeId(k.id) && (k.kind === 'grammar' || k.kind === 'vocabulary')
    && text(k.title) && text(k.key) && text(k.meaningZh) && number(k.nextReviewAt) && number(k.savedAt)
    && number(k.reviewCount) && number(k.mastery) && Array.isArray(k.sources) && Array.isArray(k.examples)), '收藏数据损坏，未导入。');
  assert(sessions.every(s => object(s) && safeId(s.id) && text(s.dateKey) && /^\d{4}-\d{2}-\d{2}$/.test(s.dateKey)
    && ['sourceUrl','title','shadowText','recapText','opinion','keyExpression'].every(k => s[k] === undefined || text(s[k]))
    && (s.schemaVersion === undefined || s.schemaVersion === 1 || s.schemaVersion === 2)), '练习记录损坏，未导入。');
  const gentle = data.gentleProgress;
  assert(gentle === undefined || (object(gentle) && gentle.version === 1 && object(gentle.articles) && Array.isArray(gentle.activity)), '学习进度格式不正确。');
  const history = data.history;
  assert(history === undefined || (object(history) && history.version === 1 && Array.isArray(history.attempts) && history.attempts.every(isSentenceAttempt)), '回答历史格式不正确。');
  const store = asStore({[DATA_KEYS.articles]:records,[DATA_KEYS.knowledge]:bookmarks,[DATA_KEYS.sessions]:sessions,[DATA_KEYS.gentleProgress]:gentle});
  const result: StudyData = {articles:loadNhkArticleRecords(store),knowledge:loadNhkKnowledge(store),sessions:loadNhkSessions(store),gentleProgress:loadGentle(store),history:history as PracticeHistory || {version:1,attempts:[]}};
  assert(result.articles.length === records.length && result.knowledge.length === bookmarks.length && result.sessions.length === sessions.length, '有记录无法完整读取，未导入。');
  return result;
}
export function serializeStudyBackup(data: StudyData): string {
  return JSON.stringify({schemaVersion: 2, app: 'nhk-study', exportedAt: new Date().toISOString(), ...data}, null, 2);
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
function unique<T>(values: T[]): T[] {const seen = new Set<string>(); return values.filter(v => {const key = stable(v); if (seen.has(key)) return false; seen.add(key); return true;});}
// Differing answers sharing a legacy ID are retained as independent records.
function mergeHistory<T extends {id: string}>(existing: T[], incoming: T[]): T[] {
  const result = [...existing];
  for (const row of incoming) {
    let candidate = row; let suffix = 0;
    while (true) {
      const same = result.find(value => value.id === candidate.id);
      if (!same) {result.push(candidate); break;}
      if (stable({...same, id:row.id}) === stable(row)) break;
      candidate = {...row, id:`${row.id}-restored-${++suffix}`};
    }
  }
  return result;
}
export function mergeStudyBackup(current: StudyData, incoming: StudyData): StudyData {
  const articles = [...current.articles];
  for (const record of incoming.articles) {
    const index = articles.findIndex(value => value.id === record.id);
    if (index < 0) {articles.push(record); continue;}
    const old = articles[index];
    assert(old.sourceUrl === record.sourceUrl && stable(old.sentences) === stable(record.sentences), '同一文章的正文版本有冲突；为保留两份原文，本次没有写入。请保留备份文件。');
    const newer = old.updatedAt >= record.updatedAt ? old : record;
    articles[index] = {...old, ...newer, importedAt:Math.min(old.importedAt,record.importedAt),
      studyDateKeys:unique([...old.studyDateKeys,...record.studyDateKeys]),
      lastOpenedAt:Math.max(old.lastOpenedAt,record.lastOpenedAt), completedAt:Math.max(old.completedAt || 0,record.completedAt || 0) || undefined,
      sentenceAnalyses:unique([...(old.sentenceAnalyses || []),...(record.sentenceAnalyses || [])])};
  }
  const knowledge = [...current.knowledge];
  for (const item of incoming.knowledge) {
    const index = knowledge.findIndex(v => v.id === item.id);
    if (index < 0) {knowledge.push(item); continue;}
    const old = knowledge[index];
    const newer = (old.lastReviewedAt || old.updatedAt) >= (item.lastReviewedAt || item.updatedAt) ? old : item;
    knowledge[index] = {...old, sources:unique([...old.sources,...item.sources]), examples:unique([...old.examples,...item.examples]),
      mastery:newer.mastery,nextReviewAt:newer.nextReviewAt,lastReviewedAt:newer.lastReviewedAt,
      reviewCount:Math.max(old.reviewCount,item.reviewCount),updatedAt:Math.max(old.updatedAt,item.updatedAt)};
  }
  const progress = {...current.gentleProgress.articles};
  for (const [id, value] of Object.entries(incoming.gentleProgress.articles)) {
    const old = progress[id];
    progress[id] = old ? {...(old.updatedAt >= value.updatedAt ? old : value),read:unique([...old.read,...value.read])} : value;
  }
  return {articles:articles.sort((a,b)=>b.importedAt-a.importedAt),knowledge,
    sessions:mergeHistory(current.sessions,incoming.sessions),
    gentleProgress:{version:1,lastArticleId:current.gentleProgress.lastArticleId || incoming.gentleProgress.lastArticleId, articles:progress,
      activity:unique([...current.gentleProgress.activity,...incoming.gentleProgress.activity])},
    history:{version:1,attempts:mergeHistory(current.history.attempts,incoming.history.attempts)}};
}
export function recoverStudyRestore(storage: Store): boolean {
  const raw = storage.getItem(RESTORE_JOURNAL);
  if (!raw) return true;
  try {
    const journal = JSON.parse(raw);
    assert(journal.version === 1 && object(journal.before), 'bad journal');
    for (const key of Object.values(DATA_KEYS)) {
      const value = journal.before[key]; assert(value === null || text(value), 'bad journal');
      if (value === null) storage.removeItem(key); else storage.setItem(key, value);
    }
    storage.removeItem(RESTORE_JOURNAL); return true;
  } catch {return false;}
}
export function commitStudyRestore(data: StudyData, storage: Store): boolean {
  if (!recoverStudyRestore(storage)) return false;
  const before: Record<string,string|null> = {};
  try {
    for (const key of Object.values(DATA_KEYS)) before[key] = storage.getItem(key);
    storage.setItem(RESTORE_JOURNAL, JSON.stringify({version:1,before}));
    for (const [name,key] of Object.entries(DATA_KEYS)) {
      const value = JSON.stringify(data[name as keyof StudyData]);
      storage.setItem(key,value);
      if (storage.getItem(key) !== value) throw new Error('write_not_verified');
    }
    storage.removeItem(RESTORE_JOURNAL); return true;
  } catch {
    // On an interrupted restore, the journal survives and is recovered before app boot.
    recoverStudyRestore(storage); return false;
  }
}
