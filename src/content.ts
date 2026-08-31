import type {PlaySemantics} from './playSemantics';

export type VisualMeta = {
  sceneId?: string;
  palette?: [string, string, string?];
  gradient?: string;
  imagePrompt?: string;
  locationId?: string;
  castInScene?: string[];
  imageUrl?: string;
};

export type SeriesMeta = {
  worldId?: string;
  worldTitle?: string;
  seasonId?: string;
  seasonTitle?: string;
  episodeNo?: number;
  episodeCount?: number;
  previousEpisodeId?: string | null;
  nextEpisodeId?: string | null;
  locationId?: string;
  locationName?: string;
  castIds?: string[];
  canonRevision?: string;
  previousSummary?: string;
  todayHook?: string;
  summary?: string;
};

export type CallbackRef = {targetId: string; sourceEpisodeId: string; role: string};

export type Story = {
  id: string;
  title: string;
  category: string;
  level: 'N3' | 'N2' | 'N1';
  emoji: string;
  visual: string;
  visualMeta?: VisualMeta;
  prompt: string;
  guesses: string[];
  guessCorrect: number;
  twist: string;
  key: {term: string; reading: string; meaning: string; insight: string; anchor: string};
  jp: string;
  cn: string;
  points: {term: string; reading: string; meaning: string; note: string}[];
  use: {prompt: string; choices: string[]; correct: number; feedback: string};
  transfer: {prompt: string; choices: string[]; correct: number; feedback: string};
  review: {prompt: string; cloze: string; answer: string; feedback: string};
  practice?: {examples: Array<{emoji: string; cue: string; jp: string; cn: string}>; fun: {prompt: string; choices: string[]; correct: number; feedback: string}};
  play?: {
    daily?: string;
    polite?: string;
    business?: string;
    businessNote?: string;
    replyPrompt?: string;
    reply?: string;
    semantics?: PlaySemantics;
    scenarios?: Array<{emoji: string; cue: string; jp: string; cn: string}>;
  };
  series?: SeriesMeta;
  callbacks?: CallbackRef[];
  news?: {source: string; sourceDate: string; sourceTitle: string; sourceUrl: string; mode: 'discovery' | 'serious'; fact: string};
  audioAvailable?: boolean;
  playAudio?: {ready: number; total: number; complete: boolean};
  nextId: string;
};

export {stories, categories} from './content.bundled';
