#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = process.argv[2] || join(root, 'nihongo-discovery/content/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const episodes = (manifest.items || []).filter((i) => i.story?.id?.startsWith('release-week-01-ep'));

const SEMANTICS = {
  'release-week-01-ep01': {interactionType: 'self-observation', promptSpeaker: 'learner', learnerRole: 'decide', uiCue: '先听当下的判断，再想你会怎么做。'},
  'release-week-01-ep02': {interactionType: 'exchange', promptSpeaker: 'other', promptSpeakerId: 'tanaka', learnerRole: 'respond', uiCue: '先听田中说什么，再决定你怎么回。'},
  'release-week-01-ep03': {interactionType: 'exchange', promptSpeaker: 'other', promptSpeakerId: 'tanaka', learnerRole: 'respond', uiCue: '先听田中说什么，再决定你怎么回。'},
  'release-week-01-ep04': {interactionType: 'exchange', promptSpeaker: 'other', promptSpeakerId: 'sato', learnerRole: 'respond', uiCue: '先听佐藤说什么，再决定你怎么回。'},
  'release-week-01-ep05': {interactionType: 'exchange', promptSpeaker: 'other', promptSpeakerId: 'tanaka', learnerRole: 'respond', uiCue: '先听田中说什么，再决定你怎么回。'},
  'release-week-01-ep06': {interactionType: 'exchange', promptSpeaker: 'other', promptSpeakerId: 'tanaka', learnerRole: 'respond', uiCue: '先听同事说什么，再决定你怎么回。'},
  'release-week-01-ep07': {interactionType: 'exchange', promptSpeaker: 'other', promptSpeakerId: 'yamamoto', learnerRole: 'respond', uiCue: '先听山本说什么，再决定你怎么回。'},
  'release-week-01-ep08': {interactionType: 'exchange', promptSpeaker: 'other', promptSpeakerId: 'tanaka', learnerRole: 'respond', uiCue: '先听田中说什么，再决定你怎么回。'},
  'release-week-01-ep09': {interactionType: 'exchange', promptSpeaker: 'other', promptSpeakerId: 'yamamoto', learnerRole: 'respond', uiCue: '先听山本说什么，再决定你怎么回。'},
  'release-week-01-ep10': {interactionType: 'exchange', promptSpeaker: 'other', promptSpeakerId: 'yamamoto', learnerRole: 'respond', uiCue: '先听对方说什么，再决定你怎么回。'},
  'release-week-01-ep11': {interactionType: 'exchange', promptSpeaker: 'other', promptSpeakerId: 'sato', learnerRole: 'respond', uiCue: '先听佐藤说什么，再决定你怎么回。'},
  'release-week-01-ep12': {interactionType: 'exchange', promptSpeaker: 'other', promptSpeakerId: 'tanaka', learnerRole: 'respond', uiCue: '先听同事说什么，再决定你怎么回。'},
};

const VISUALS = {
  'release-week-01-ep01': {sceneId: 'release-week-ep01', palette: ['#3d5a80', '#6b9ac4', '#dbe7f3'], locationId: 'station', castInScene: ['public-service'], imagePrompt: 'Rainy Tokyo station platform at dawn, young professional with umbrella checking train delay on phone, warm editorial anime style, cinematic, no text'},
  'release-week-01-ep02': {sceneId: 'release-week-ep02', palette: ['#4f6d7a', '#89a7b1', '#e8f1f4'], locationId: 'station', castInScene: ['tanaka'], imagePrompt: 'Crowded train interior, smartphone message conversation glow, commuter holding strap, warm editorial illustration, no text'},
  'release-week-01-ep03': {sceneId: 'release-week-ep03', palette: ['#5c6b4a', '#a8b88a', '#eef2e4'], locationId: 'project-office', castInScene: ['tanaka', 'sato'], imagePrompt: 'Modern project office morning meeting area, colleagues near whiteboard, warm clean illustration, no text'},
  'release-week-01-ep04': {sceneId: 'release-week-ep04', palette: ['#6b5b4f', '#b39a8a', '#f3ebe4'], locationId: 'project-office', castInScene: ['tanaka', 'sato'], imagePrompt: 'Office desk with checklist and laptop before launch, focused calm mood, editorial anime style, no text'},
  'release-week-01-ep05': {sceneId: 'release-week-ep05', palette: ['#5a4a6b', '#9a8ab3', '#ece8f3'], locationId: 'project-office', castInScene: ['tanaka'], imagePrompt: 'Office after hours invitation to drinks, two colleagues chatting near desks, warm evening light, no text'},
  'release-week-01-ep06': {sceneId: 'release-week-ep06', palette: ['#4a5a6b', '#8aa0b3', '#e8eef3'], locationId: 'project-office', castInScene: ['tanaka', 'sato'], imagePrompt: 'Office at night, one colleague leaving with bag while others still working, cinematic clean illustration, no text'},
  'release-week-01-ep07': {sceneId: 'release-week-ep07', palette: ['#4a566b', '#8a9bb3', '#e6ebf3'], locationId: 'project-office', castInScene: ['sato', 'yamamoto'], imagePrompt: 'Business email send moment, laptop with attachment icon, professional calm atmosphere, no text'},
  'release-week-01-ep08': {sceneId: 'release-week-ep08', palette: ['#5a6b4a', '#9ab38a', '#edf3e8'], locationId: 'project-office', castInScene: ['tanaka', 'sato'], imagePrompt: 'Developer fixing UI layout issue on monitor before launch, focused teamwork, no text'},
  'release-week-01-ep09': {sceneId: 'release-week-ep09', palette: ['#4a5a52', '#8aa39a', '#e8f3ef'], locationId: 'client-office', castInScene: ['sato', 'yamamoto'], imagePrompt: 'Client meeting room handshake beginning, polite business atmosphere, warm editorial style, no text'},
  'release-week-01-ep10': {sceneId: 'release-week-ep10', palette: ['#3d6b4f', '#7ab39a', '#e4f3ec'], locationId: 'project-office', castInScene: ['tanaka', 'sato', 'yamamoto'], imagePrompt: 'Launch success on monitoring dashboard with relieved team, celebratory but calm, no text'},
  'release-week-01-ep11': {sceneId: 'release-week-ep11', palette: ['#5a5a4a', '#b3b38a', '#f3f3e8'], locationId: 'meeting-room', castInScene: ['tanaka', 'sato'], imagePrompt: 'Post-launch retrospective meeting with notes on table, thoughtful mood, no text'},
  'release-week-01-ep12': {sceneId: 'release-week-ep12', palette: ['#4a4a6b', '#8a8ab3', '#ececf3'], locationId: 'meeting-room', castInScene: ['tanaka', 'sato', 'yamamoto'], imagePrompt: 'Season finale team moment after successful release, warm gratitude atmosphere, editorial anime style, no text'},
};

let issues = [];
for (const item of episodes) {
  const story = item.story;
  const id = story.id;
  story.play = story.play || {};
  story.play.semantics = SEMANTICS[id];
  story.visualMeta = VISUALS[id];
  if (!story.play.replyPrompt || !story.play.reply) issues.push(`${id}: missing reply pair`);
  if (story.play.semantics?.interactionType === 'self-observation' && story.play.semantics.uiCue.includes('对方')) issues.push(`${id}: bad self cue`);
  const clips = [story.play.replyPrompt, story.play.reply, story.play.daily, story.play.polite, story.play.business].filter(Boolean);
  if (new Set(clips).size < 3) issues.push(`${id}: register clips too similar`);
}

if (issues.length) {
  console.error('VALIDATION FAILED');
  issues.forEach((i) => console.error(' -', i));
  process.exit(1);
}

manifest.updatedAt = new Date().toISOString();
import {writeFileSync} from 'node:fs';
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Patched ${episodes.length} connected episodes in ${manifestPath}`);
