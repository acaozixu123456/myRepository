import type {NhkArticleRecord, NhkKnowledgeItem} from './nhkLibrary';
import {toDateKey} from './nhkMorning';

export type GentleRating = 'again' | 'good';
export type GentleProgress = {
  version: 1;
  lastArticleId: string;
  articles: Record<string, {focus: string; read: string[]; checked: string[]; updatedAt: number}>;
  activity: {day: string; key: string; kind: 'sentence' | 'review'; rating: GentleRating}[];
};
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export const GENTLE_KEY = 'nihongo-nhk-gentle-progress-v1';
const empty = (): GentleProgress => ({version: 1, lastArticleId: '', articles: {}, activity: []});
const safeKey = (id: string) => id !== '__proto__' && id !== 'constructor' && id !== 'prototype';
const clean = (s: unknown) => typeof s === 'string' ? s.slice(0, 8000) : '';
const strings = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string').map(s => s.slice(0, 8000)))] : [];
const getStorage = (storage?: StorageLike) => storage || (typeof localStorage === 'undefined' ? null : localStorage);

export function loadGentle(storage?: StorageLike): GentleProgress {
  try {
    const raw = JSON.parse(getStorage(storage)?.getItem(GENTLE_KEY) || 'null');
    if (!raw || raw.version !== 1) return empty();
    const articles: GentleProgress['articles'] = {};
    if (raw.articles && typeof raw.articles === 'object' && !Array.isArray(raw.articles)) {
      for (const [id, input] of Object.entries(raw.articles)) {
        if (!safeKey(id) || !input || typeof input !== 'object') continue;
        const value = input as Record<string, unknown>;
        articles[id] = {focus: clean(value.focus), read: strings(value.read), checked: strings(value.checked), updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : 0};
      }
    }
    const activity: GentleProgress['activity'] = Array.isArray(raw.activity) ? raw.activity.filter((e: unknown) => {
      if (!e || typeof e !== 'object') return false;
      const event = e as Record<string, unknown>;
      return typeof event.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.day) && typeof event.key === 'string'
        && (event.kind === 'sentence' || event.kind === 'review') && (event.rating === 'again' || event.rating === 'good');
    }).slice(-5000).map((e: GentleProgress['activity'][number]) => ({day: e.day, key: clean(e.key), kind: e.kind, rating: e.rating})) : [];
    return {version: 1, lastArticleId: clean(raw.lastArticleId), articles, activity};
  } catch { return empty(); }
}

export function saveGentle(value: GentleProgress, storage?: StorageLike): boolean {
  try { const target = getStorage(storage); if (!target) return false; target.setItem(GENTLE_KEY, JSON.stringify(value)); return true; } catch { return false; }
}

export function focusGentle(value: GentleProgress, id: string, sentence: string, now = Date.now()): GentleProgress {
  if (!id || !safeKey(id)) return value;
  const old = value.articles[id] || {focus: '', read: [], checked: [], updatedAt: 0};
  return {...value, lastArticleId: id, articles: {...value.articles, [id]: {...old, focus: sentence, updatedAt: now}}};
}

function activity(value: GentleProgress, key: string, kind: 'sentence' | 'review', rating: GentleRating, now: number): GentleProgress['activity'] {
  const day = toDateKey(new Date(now));
  return [...value.activity.filter(e => !(e.day === day && e.key === key && e.kind === kind)), {day, key, kind, rating}].slice(-5000);
}

export function checkGentleSentence(value: GentleProgress, id: string, sentence: string, rating: GentleRating, now = Date.now()): GentleProgress {
  if (!id || !sentence || !safeKey(id)) return value;
  const next = focusGentle(value, id, sentence, now);
  const article = next.articles[id];
  return {...next, articles: {...next.articles, [id]: {...article, read: [...new Set([...article.read, sentence])], checked: rating === 'good' ? [...new Set([...article.checked, sentence])] : article.checked.filter(s => s !== sentence)}}, activity: activity(next, `${id}|${sentence}`, 'sentence', rating, now)};
}

export function recordGentleReview(value: GentleProgress, id: string, rating: GentleRating, now = Date.now()): GentleProgress {
  return {...value, activity: activity(value, id, 'review', rating, now)};
}

export function gentleReviewBatch(items: NhkKnowledgeItem[], now = Date.now(), limit = 3): NhkKnowledgeItem[] {
  const size = Number.isFinite(limit) ? Math.max(1, Math.min(10, Math.trunc(limit))) : 3;
  return items.filter(item => item.nextReviewAt <= now).sort((a, b) => a.nextReviewAt - b.nextReviewAt || a.savedAt - b.savedAt).slice(0, size);
}

export function gentleContinueArticle(articles: NhkArticleRecord[], value: GentleProgress): NhkArticleRecord | undefined {
  return articles.find(a => a.id === value.lastArticleId) || articles[0];
}

export function gentleWeek(value: GentleProgress, today = new Date()): {day: string; label: string; active: boolean}[] {
  return Array.from({length: 7}, (_, index) => {
    const date = new Date(today); date.setDate(date.getDate() - 6 + index);
    const day = toDateKey(date);
    return {day, label: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()], active: value.activity.some(e => e.day === day)};
  });
}
