import type {Story} from './content';
import {practicePacks} from './practice';
import {inferSemantics} from './playSemantics';

export type PlayClipId = 'listen' | 'replyPrompt' | 'reply' | 'daily' | 'polite' | 'business' | 'scene0' | 'scene1' | 'scene2' | 'scene3' | 'scene4' | 'recall';
export type ClipStyle = 'neutral' | 'casual' | 'polite' | 'business';
export type PlayClip = {id: PlayClipId; text: string; style: ClipStyle};
export type PlayScenario = {emoji: string; cue: string; jp: string; cn: string};
export type PlayPlan = {
  daily: string;
  polite: string;
  business: string;
  businessNote: string;
  replyPrompt: string;
  reply: string;
  scenarios: PlayScenario[];
  clips: Record<PlayClipId, PlayClip>;
};

type Register = {daily: string; polite: string; business: string; businessNote?: string};

const registers: Record<string, Register> = {
  'news-yasai-20260828': {daily: '来月、トマト高くなりそう。', polite: '来月、トマトは高くなりそうです。', business: '来月はトマトの価格が上がる見込みです。', businessNote: '正式说明会把口语预测改成「見込みです」，不是机械加敬语。'},
  'news-rain-20260828': {daily: '電車、遅れるかも。', polite: '電車が遅れるかもしれません。', business: '列車に遅れが生じる可能性があります。', businessNote: '通知/正式表达常把「かも」展开成「可能性があります」。'},
  'news-aete-convenience-20260830': {daily: '便利にできるけど、あえて不便にしてみる。', polite: '便利にできますが、あえて不便にしてみます。', business: '利便性を高めることも可能ですが、あえて不便な設計を採用します。', businessNote: '正式说明会把口语结构展开，核心仍是“明知有普通选项却主动选另一条”。'},
  'pragmatic-nenno-tame-20260830': {daily: '念のため、もう一回確認するね。', polite: '念のため、もう一度確認します。', business: '念のため、改めて確認いたします。', businessNote: '这里可以自然提升礼貌度，交际意图仍然是“为了保险再确认”。'},
  otoshi: {daily: 'これ、お通し？', polite: 'これはお通しですか？', business: 'こちらはお通しでよろしいでしょうか。', businessNote: '同样是确认，在更正式关系里会换成更完整的确认句。'},
  chotto: {daily: '今日はちょっと……。', polite: '今日は少し難しいです。', business: '本日は都合がつかず、難しいです。', businessNote: '正式场合通常不会只靠留白拒绝，而会把“有困难”说清楚一些。'},
  daijobu: {daily: 'うん、大丈夫。', polite: '大丈夫です。ありがとうございます。', business: '今回は不要です。ありがとうございます。', businessNote: '拒绝物品时不要机械升级成「問題ございません」；正式表达会直接说“这次不需要”。'},
  tekitou: {daily: '適当にやっておいて。', polite: '状況を見て対応してください。', business: '状況に応じてご対応をお願いします。', businessNote: '「適当」不能原样敬语化；商务里为了避免“敷衍”歧义，通常换成「状況に応じて」。'},
  sumimasen: {daily: 'ごめん、ありがとう。', polite: 'すみません、ありがとうございます。', business: 'お手数をおかけして申し訳ありません。ありがとうございます。', businessNote: '正式场合把“让你费心了”说得更明确。'},
  ojama: {daily: 'お邪魔します。', polite: '失礼します。お邪魔します。', business: '失礼いたします。', businessNote: '进入客户/公司空间时通常会换成「失礼いたします」，不是把「お邪魔します」硬升级。'},
  otsukare: {daily: 'お疲れ！', polite: 'お疲れ様です。', business: 'いつもお世話になっております。', businessNote: '对外客户一般不用「お疲れ様です」作开场；关系变了，表达也会换成「お世話になっております」。'},
  osaki: {daily: '先に帰るね。', polite: 'お先に失礼します。', business: '恐れ入りますが、お先に失礼いたします。', businessNote: '同一离开意图，在正式场合增加缓冲和更郑重的「失礼いたします」。'},
  bimyou: {daily: 'ちょっと微妙。', polite: '少し微妙ですね。', business: '少し気になる点があります。', businessNote: '商务反馈通常避免直接说「微妙」，改成具体而缓和的“有些在意的点”。'},
  kekkou: {daily: 'いらない、大丈夫。', polite: '結構です。ありがとうございます。', business: '今回は見送らせていただきます。', businessNote: '正式拒绝提案时常直接换成「見送らせていただきます」，不硬用「結構です」。'},
  yoroshiku: {daily: 'よろしく！', polite: 'よろしくお願いします。', business: '何卒よろしくお願いいたします。', businessNote: '这组可以自然提高郑重度，但仍要看请求/合作关系。'},
  gochisou: {daily: 'ごちそうさま！', polite: 'ごちそうさまでした。', business: '本日はごちそうになり、ありがとうございました。', businessNote: '正式感谢会把“承蒙款待”明确说出来。'},
};

const strip = (s: string) => s.split('\n').map(x => x.includes('：') ? x.slice(x.indexOf('：') + 1) : x).filter(Boolean);
const recall = (cloze: string, answer: string) => cloze.replace(/＿+/g, answer);
const distinctPush = (xs: PlayScenario[], x: PlayScenario) => { if (x.jp && !xs.some(v => v.jp === x.jp)) xs.push(x); };

export const buildPlayPlan = (story: Story): PlayPlan | null => {
  const fallback = practicePacks[story.id];
  const base = (story.play?.scenarios?.length ? story.play.scenarios : story.practice?.examples?.length ? story.practice.examples : fallback?.examples) || [];
  if (!base.length) return null;
  const scenarios = base.map(x => ({...x})) as PlayScenario[];
  const recallText = recall(story.review.cloze, story.review.answer);
  const transferText = story.transfer.choices[story.transfer.correct] || '';
  distinctPush(scenarios, {emoji: '🔄', cue: story.transfer.prompt, jp: transferText, cn: story.transfer.feedback});
  distinctPush(scenarios, {emoji: '🧠', cue: story.review.prompt, jp: recallText, cn: story.review.feedback});
  while (scenarios.length < 5) scenarios.push({...scenarios[scenarios.length % base.length]});
  const five = scenarios.slice(0, 5);
  const legacy = registers[story.id];
  const daily = story.play?.daily || legacy?.daily || five[0].jp;
  const polite = story.play?.polite || legacy?.polite || five[1].jp;
  const business = story.play?.business || legacy?.business || five[2].jp;
  const businessNote = story.play?.businessNote || legacy?.businessNote || '正式场合按交际意图选择自然说法，不做机械敬语替换。';
  const dialogue = strip(story.jp);
  const semantics = inferSemantics(story);
  const replyPrompt = story.play?.replyPrompt || (semantics?.interactionType === 'self-observation' ? dialogue[0] : dialogue[0]) || story.key.term;
  const reply = story.play?.reply || story.use.choices[story.use.correct] || polite;
  const clips = {
    listen: {id: 'listen', text: five[0].jp, style: 'neutral'},
    replyPrompt: {id: 'replyPrompt', text: replyPrompt, style: 'neutral'},
    reply: {id: 'reply', text: reply, style: 'polite'},
    daily: {id: 'daily', text: daily, style: 'casual'},
    polite: {id: 'polite', text: polite, style: 'polite'},
    business: {id: 'business', text: business, style: 'business'},
    scene0: {id: 'scene0', text: five[0].jp, style: 'neutral'},
    scene1: {id: 'scene1', text: five[1].jp, style: 'neutral'},
    scene2: {id: 'scene2', text: five[2].jp, style: 'neutral'},
    scene3: {id: 'scene3', text: five[3].jp, style: 'neutral'},
    scene4: {id: 'scene4', text: five[4].jp, style: 'neutral'},
    recall: {id: 'recall', text: recallText, style: 'neutral'},
  } as Record<PlayClipId, PlayClip>;
  return {daily, polite, business, businessNote, replyPrompt, reply, scenarios: five, clips};
};

export const PLAY_CLIP_ORDER: PlayClipId[] = ['listen', 'replyPrompt', 'reply', 'daily', 'polite', 'business', 'scene0', 'scene1', 'scene2', 'scene3', 'scene4', 'recall'];

export const validatePlayPlanClips = (story: Story): string[] => {
  const plan = buildPlayPlan(story);
  if (!plan) return [`${story.id}: missing play plan`];
  const issues: string[] = [];
  const core = [plan.clips.replyPrompt.text, plan.clips.reply.text];
  if (core.some(t => !t.trim())) issues.push(`${story.id}: reply clips must be non-empty`);
  if (new Set(core).size < core.length) issues.push(`${story.id}: replyPrompt and reply must differ`);
  const allTexts = PLAY_CLIP_ORDER.map(id => plan.clips[id].text).filter(Boolean);
  if (allTexts.length < 12) issues.push(`${story.id}: expected 12 clip texts, got ${allTexts.length}`);
  if (story.play?.replyPrompt && plan.clips.replyPrompt.text !== story.play.replyPrompt) {
    issues.push(`${story.id}: replyPrompt clip must match canonical play.replyPrompt`);
  }
  if (story.play?.reply && plan.clips.reply.text !== story.play.reply) {
    issues.push(`${story.id}: reply clip must match canonical play.reply`);
  }
  return issues;
};
