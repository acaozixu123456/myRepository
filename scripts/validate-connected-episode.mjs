#!/usr/bin/env node
/**
 * Pre-publish validator for connected-world episodes in manifest.json.
 * Usage: node scripts/validate-connected-episode.mjs [path/to/manifest.json] [storyId]
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = process.argv[2] || join(root, 'nihongo-discovery/content/manifest.json');
const onlyId = process.argv[3];
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const CAST_NAMES = new Set(['tanaka', 'sato', 'yamamoto', 'mika', 'public-service']);

const issues = [];

const inferSemantics = (story) => {
  if (story.play?.semantics) return story.play.semantics;
  const castIds = story.series?.castIds || [];
  if (story.play?.replyPrompt && story.id.endsWith('-ep01')) {
    return {interactionType: 'self-observation', promptSpeaker: 'learner', learnerRole: 'decide'};
  }
  return {interactionType: 'exchange', promptSpeaker: 'other', promptSpeakerId: castIds.find(id => id !== 'public-service') || castIds[0], learnerRole: 'respond'};
};

const validateStory = (story, item) => {
  const id = story.id;
  if (!id) return;
  if (onlyId && id !== onlyId) return;
  if (!story.series?.seasonId || !story.series?.episodeNo) {
    issues.push(`${id}: missing series.seasonId or episodeNo`);
    return;
  }
  if (!story.series.todayHook?.trim()) issues.push(`${id}: missing series.todayHook`);
  if (!story.series.summary?.trim()) issues.push(`${id}: missing series.summary`);
  if (!story.visualMeta?.imagePrompt?.trim()) issues.push(`${id}: missing visualMeta.imagePrompt`);
  if (!story.visualMeta?.sceneId) issues.push(`${id}: missing visualMeta.sceneId`);
  if (!story.play?.replyPrompt?.trim() || !story.play?.reply?.trim()) {
    issues.push(`${id}: missing play.replyPrompt/reply`);
  }
  const semantics = inferSemantics(story);
  if (!story.play?.semantics) issues.push(`${id}: missing explicit play.semantics`);
  if (semantics.interactionType === 'self-observation' && semantics.uiCue?.includes('对方')) {
    issues.push(`${id}: self-observation uiCue must not say 对方`);
  }
  if (semantics.interactionType === 'exchange') {
    if (story.play.replyPrompt === story.play.reply) issues.push(`${id}: exchange replyPrompt and reply must differ`);
    if (semantics.promptSpeakerId && story.series.castIds?.length && !story.series.castIds.includes(semantics.promptSpeakerId)) {
      issues.push(`${id}: promptSpeakerId not in castIds`);
    }
  }
  const scenarios = story.play?.scenarios || [];
  if (scenarios.length !== 5) issues.push(`${id}: expected exactly 5 play.scenarios, got ${scenarios.length}`);
  const inWorld = scenarios.filter(s => /^剧情｜/.test(s.cue || ''));
  const transfer = scenarios.filter(s => /^迁移｜/.test(s.cue || ''));
  if (inWorld.length < 3) issues.push(`${id}: expected at least 3 in-world scenarios (剧情｜), got ${inWorld.length}`);
  if (transfer.length < 2) issues.push(`${id}: expected at least 2 transfer scenarios (迁移｜), got ${transfer.length}`);
  if ((story.series.episodeNo || 0) > 1 && (!story.callbacks?.length || story.callbacks.length < 1)) {
    issues.push(`${id}: episode > 1 must include callbacks`);
  }
  for (const cb of story.callbacks || []) {
    if (!cb.targetId || !cb.sourceEpisodeId) issues.push(`${id}: callback missing targetId/sourceEpisodeId`);
  }
  const clips = [story.play?.replyPrompt, story.play?.reply, story.play?.daily, story.play?.polite, story.play?.business].filter(Boolean);
  if (new Set(clips).size < 3) issues.push(`${id}: register clips too similar`);
  if (item.status === 'published' && !story.key?.term) issues.push(`${id}: published story missing key.term`);
  for (const castId of story.series.castIds || []) {
    if (!CAST_NAMES.has(castId) && !castId.startsWith('release-week')) {
      issues.push(`${id}: unknown castId ${castId}`);
    }
  }
};

for (const item of manifest.items || []) {
  if (!item.story?.series?.seasonId) continue;
  validateStory(item.story, item);
}

if (issues.length) {
  console.error('VALIDATION FAILED');
  issues.forEach(i => console.error(' -', i));
  process.exit(1);
}

const checked = onlyId ? 1 : (manifest.items || []).filter(i => i.story?.series?.seasonId).length;
console.log(`Validated ${checked} connected episode(s) in ${manifestPath}`);
