export type NhkCoachLabel = '核心' | '跟读' | '迁移';

export type NhkCoachRecommendation = {
  sentenceIndex: number;
  sentence: string;
  label: NhkCoachLabel;
  reasonZh: string;
  chunks: string[];
  expression: string;
  meaningZh: string;
  dailyVersion: string;
  workVersion: string;
};

export type NhkCoachResult = {
  summaryJa: string;
  summaryZh: string;
  recommendations: NhkCoachRecommendation[];
  opinionQuestion: string;
  worldSetupZh: string;
  worldPromptJa: string;
};

const LABEL_ORDER: NhkCoachLabel[] = ['核心', '跟读', '迁移'];
const compact = (value: string): string => value.replace(/\s+/g, ' ').trim();
const sentenceKey = (value: string): string => compact(value).replace(/\s/g, '');

const chunksFor = (sentence: string): string[] => {
  const compactSentence = compact(sentence);
  const chunks = compactSentence
    .replace(/([、。！？])/g, '$1|')
    .split('|')
    .map(value => value.trim())
    .filter(Boolean);
  if (chunks.length > 1) return chunks.slice(0, 6);
  if (compactSentence.length <= 28) return [compactSentence];

  const midpoint = Math.floor(compactSentence.length / 2);
  const boundaries = ['は', 'が', 'を', 'に', 'で', 'と', 'から', 'ため', 'ので'];
  let best = -1;
  for (const boundary of boundaries) {
    const index = compactSentence.indexOf(boundary, Math.max(8, midpoint - 10));
    if (index > 0 && (best < 0 || Math.abs(index - midpoint) < Math.abs(best - midpoint))) {
      best = index + boundary.length;
    }
  }
  return best > 0
    ? [compactSentence.slice(0, best), compactSentence.slice(best)]
    : [compactSentence];
};

const chunksMatchSentence = (chunks: string[], sentence: string): boolean =>
  chunks.length > 0 && sentenceKey(chunks.join('')) === sentenceKey(sentence);

const transferFor = (sentence: string): [string, string, string] => {
  if (sentence.includes('を受けて')) return ['〜を受けて', 'その話を受けて、もう一度考えました。', '仕様変更を受けて、テストケースを見直しています。'];
  if (sentence.includes('使ってはいけない')) return ['〜てはいけない', 'ここでは写真を撮ってはいけません。', 'テスト環境では、本番データを使ってはいけないことになっています。'];
  if (sentence.includes('ことができなくな')) return ['〜ことができなくなる', '来月から、このサービスを使うことができなくなります。', '来月から、旧システムを使うことができなくなります。'];
  if (sentence.includes('ようにする')) return ['〜ようにする', '毎日、日本語を声に出すようにしています。', '同じ問題が起きないように、確認手順を追加します。'];
  return [
    sentence.replace(/[。！？]+$/, '').slice(0, 48),
    sentence,
    'この内容について、仕事への影響も確認したほうがいいと思います。',
  ];
};

const score = (sentence: string): number => {
  let value = sentence.length >= 24 && sentence.length <= 95 ? 30 : 12;
  if (sentence.includes('、')) value += 8;
  if (/(を受けて|ことができなく|使ってはいけない|ようにする|と考えて)/.test(sentence)) value += 20;
  return value;
};

export const buildRecommendationForSentence = (
  sentence: string,
  sentenceIndex: number,
  label: NhkCoachLabel = '核心',
  reasonZh?: string,
): NhkCoachRecommendation => {
  const cleanSentence = compact(sentence);
  const [expression, dailyVersion, workVersion] = transferFor(cleanSentence);
  return {
    sentenceIndex,
    sentence: cleanSentence,
    label,
    reasonZh: reasonZh || (label === '核心'
      ? '你选择的今日核心句'
      : label === '跟读'
        ? '适合轻量跟读并在后续回收'
        : '适合放进新的生活或工作场景'),
    chunks: chunksFor(cleanSentence),
    expression,
    meaningZh: '先抓主干，再留意助词、否定和句尾。',
    dailyVersion,
    workVersion,
  };
};

export const buildFallbackCoach = (title: string, sentences: string[]): NhkCoachResult => {
  const ranked = sentences
    .map((sentence, sentenceIndex) => ({sentence: compact(sentence), sentenceIndex}))
    .filter(item => item.sentence)
    .sort((a, b) => score(b.sentence) - score(a.sentence) || a.sentenceIndex - b.sentenceIndex)
    .slice(0, Math.min(3, sentences.length));
  const recommendations = ranked.map((item, index) => buildRecommendationForSentence(
    item.sentence,
    item.sentenceIndex,
    LABEL_ORDER[index] || '迁移',
    index === 0 ? '最能代表新闻重点' : index === 1 ? '适合练句子切分' : '容易迁移到真实场景',
  ));
  return {
    summaryJa: recommendations[0]?.sentence || `${title}についてのニュースです。`,
    summaryZh: `这条新闻主要围绕“${title}”展开。`,
    recommendations,
    opinionQuestion: 'このニュースについて、あなたはどう思いますか。',
    worldSetupZh: '午休时，田中看到这条新闻，想听听你的看法。',
    worldPromptJa: 'このニュースは、私たちの生活や仕事にも関係があると思いますか。',
  };
};

export const isNhkCoachResult = (value: unknown): value is NhkCoachResult => {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<NhkCoachResult>;
  return typeof result.summaryJa === 'string'
    && typeof result.summaryZh === 'string'
    && typeof result.opinionQuestion === 'string'
    && typeof result.worldSetupZh === 'string'
    && typeof result.worldPromptJa === 'string'
    && Array.isArray(result.recommendations)
    && result.recommendations.length > 0
    && result.recommendations.every(item => typeof item?.sentence === 'string'
      && typeof item?.expression === 'string'
      && Array.isArray(item?.chunks));
};

export const alignCoachRecommendations = (
  coach: NhkCoachResult | null,
  selectedSentences: string[],
  candidateSentences: string[] = selectedSentences,
): NhkCoachRecommendation[] => {
  const candidates = candidateSentences.map(compact);
  const selected = Array.from(new Set(selectedSentences.map(compact).filter(Boolean))).slice(0, 3);

  return selected.map((sentence, order) => {
    const label = LABEL_ORDER[order] || '迁移';
    const candidateIndex = candidates.findIndex(candidate => sentenceKey(candidate) === sentenceKey(sentence));
    const matched = coach?.recommendations.find(item => sentenceKey(item.sentence) === sentenceKey(sentence));
    const fallback = buildRecommendationForSentence(
      sentence,
      candidateIndex >= 0 ? candidateIndex : matched?.sentenceIndex ?? order,
      label,
      order === 0 ? '你选择的今日核心句' : undefined,
    );

    if (!matched) return fallback;
    return {
      sentenceIndex: candidateIndex >= 0 ? candidateIndex : matched.sentenceIndex,
      sentence,
      label,
      reasonZh: compact(matched.reasonZh) || fallback.reasonZh,
      chunks: chunksMatchSentence(matched.chunks, sentence) ? matched.chunks.map(compact).filter(Boolean) : fallback.chunks,
      expression: compact(matched.expression) || fallback.expression,
      meaningZh: compact(matched.meaningZh) || fallback.meaningZh,
      dailyVersion: compact(matched.dailyVersion) || fallback.dailyVersion,
      workVersion: compact(matched.workVersion) || fallback.workVersion,
    };
  });
};

export const pickCoachRecommendation = (
  coach: NhkCoachResult | null,
  selectedSentences: string[],
  candidateSentences: string[] = selectedSentences,
): NhkCoachRecommendation | null => alignCoachRecommendations(coach, selectedSentences, candidateSentences)[0] || null;
