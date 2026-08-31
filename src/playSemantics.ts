import type {Story} from './content';

export type InteractionType = 'exchange' | 'self-observation' | 'system-announcement';
export type SpeakerRole = 'learner' | 'other' | 'system' | 'narrator';

export type PlaySemantics = {
  interactionType: InteractionType;
  promptSpeaker: SpeakerRole;
  promptSpeakerId?: string;
  learnerRole: 'respond' | 'observe' | 'decide';
  promptSpeakerLabel?: string;
  uiCue: string;
};

export type SemanticsIssue = {code: string; message: string};

const CAST_NAMES: Record<string, string> = {
  tanaka: '田中',
  sato: '佐藤',
  yamamoto: '山本',
  mika: '美香',
  'public-service': '站务员',
};

const DEFAULT_EXCHANGE_CUE = '先听对方说什么，再决定你怎么回。';
const DEFAULT_SELF_CUE = '先听当下的判断，再想你会怎么做。';
const DEFAULT_SYSTEM_CUE = '先听广播或通知，再想你会怎么回应。';

export const speakerLabel = (semantics: PlaySemantics): string => {
  if (semantics.promptSpeakerLabel) return semantics.promptSpeakerLabel;
  if (semantics.promptSpeakerId && CAST_NAMES[semantics.promptSpeakerId]) return CAST_NAMES[semantics.promptSpeakerId];
  if (semantics.promptSpeaker === 'learner') return '你的判断';
  if (semantics.promptSpeaker === 'system') return '广播';
  return '对方';
};

export const resolveStep2Cue = (story: Story): string => {
  const semantics = story.play?.semantics;
  if (semantics?.uiCue) return semantics.uiCue;
  if (semantics?.interactionType === 'self-observation') return DEFAULT_SELF_CUE;
  if (semantics?.interactionType === 'system-announcement') return DEFAULT_SYSTEM_CUE;
  const label = semantics ? speakerLabel(semantics) : '对方';
  if (semantics?.interactionType === 'exchange') return `先听${label}说什么，再决定你怎么回。`;
  return DEFAULT_EXCHANGE_CUE;
};

export const inferSemantics = (story: Story): PlaySemantics | null => {
  const explicit = story.play?.semantics;
  if (explicit) return explicit;
  const castIds = (story as Story & {series?: {castIds?: string[]}}).series?.castIds || [];
  const replyPrompt = story.play?.replyPrompt || '';
  const reply = story.play?.reply || '';
  if (!replyPrompt || !reply) return null;
  const jpLines = story.jp.split('\n').map(s => s.trim()).filter(Boolean);
  const looksSelf = jpLines.length >= 2 && jpLines[0] === replyPrompt && !castIds.some(id => id !== 'public-service');
  if (looksSelf && story.id.endsWith('-ep01')) {
    return {
      interactionType: 'self-observation',
      promptSpeaker: 'learner',
      learnerRole: 'decide',
      uiCue: DEFAULT_SELF_CUE,
    };
  }
  const otherId = castIds.find(id => id !== 'public-service') || castIds[0];
  return {
    interactionType: 'exchange',
    promptSpeaker: 'other',
    promptSpeakerId: otherId,
    learnerRole: 'respond',
    uiCue: otherId ? `先听${speakerLabel({interactionType: 'exchange', promptSpeaker: 'other', promptSpeakerId: otherId, learnerRole: 'respond', uiCue: ''})}说什么，再决定你怎么回。` : DEFAULT_EXCHANGE_CUE,
  };
};

export const validatePlaySemantics = (story: Story): SemanticsIssue[] => {
  const issues: SemanticsIssue[] = [];
  const play = story.play;
  if (!play?.replyPrompt || !play.reply) {
    issues.push({code: 'missing_reply_pair', message: `${story.id}: replyPrompt and reply are required`});
    return issues;
  }
  const semantics = inferSemantics(story);
  if (!semantics) {
    issues.push({code: 'missing_semantics', message: `${story.id}: could not resolve play semantics`});
    return issues;
  }
  if (semantics.interactionType === 'self-observation' && semantics.uiCue.includes('对方')) {
    issues.push({code: 'self_observation_other_label', message: `${story.id}: self-observation must not call prompt "对方"`});
  }
  if (semantics.interactionType === 'exchange') {
    if (semantics.promptSpeaker !== 'other' && semantics.promptSpeaker !== 'system') {
      issues.push({code: 'exchange_prompt_speaker', message: `${story.id}: exchange episodes need promptSpeaker other/system`});
    }
    const castIds = (story as Story & {series?: {castIds?: string[]}}).series?.castIds || [];
    if (semantics.promptSpeaker === 'other' && semantics.promptSpeakerId && castIds.length && !castIds.includes(semantics.promptSpeakerId)) {
      issues.push({code: 'speaker_not_in_cast', message: `${story.id}: promptSpeakerId ${semantics.promptSpeakerId} not in castIds`});
    }
    if (play.replyPrompt === play.reply) {
      issues.push({code: 'identical_reply_pair', message: `${story.id}: replyPrompt and reply must differ in exchange`});
    }
  }
  if (semantics.interactionType === 'self-observation' && play.replyPrompt === play.reply) {
    issues.push({code: 'identical_self_pair', message: `${story.id}: self-observation prompt and reply must differ`});
  }
  const clipTexts = [play.replyPrompt, play.reply, play.daily, play.polite, play.business].filter(Boolean) as string[];
  const unique = new Set(clipTexts);
  if (clipTexts.length < 4 || unique.size < 3) {
    issues.push({code: 'thin_register_clips', message: `${story.id}: register clips should be non-empty and mostly distinct`});
  }
  return issues;
};
