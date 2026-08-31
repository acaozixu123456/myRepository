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

const compact = (value: string): string => value.replace(/\s+/g, ' ').trim();

const chunksFor = (sentence: string): string[] => {
  const chunks = compact(sentence).replace(/([、。！？])/g, '$1|').split('|').map(value => value.trim()).filter(Boolean);
  return chunks.length > 1 ? chunks.slice(0, 6) : [compact(sentence)];
};

const transferFor = (sentence: string) => {
  if (sentence.includes('を受けて')) return ['〜を受けて', 'その話を受けて、もう一度考えました。', '仕様変更を受けて、テストケースを見直しています。'];
  if (sentence.includes('使ってはいけない')) return ['〜てはいけない', 'ここでは写真を撮ってはいけません。', 'テスト環境では、本番データを使ってはいけないことになっています。'];
  if (sentence.includes('ことができなくな')) return ['〜ことができなくなる', '来月から、このサービスを使うことができなくなります。', '来月から、旧システムを使うことができなくなります。'];
  if (sentence.includes('ようにする')) return ['〜ようにする', '毎日、日本語を声に出すようにしています。', '同じ問題が起きないように、確認手順を追加します。'];
  return [sentence.replace(/[。！？]+$/, '').slice(0, 48), sentence, 'この内容について、仕事への影響も確認したほうがいいと思います。'];
};

const score = (sentence: string): number => {
  let value = sentence.length >= 24 && sentence.length <= 95 ? 30 : 12;
  if (sentence.includes('、')) value += 8;
  if (/(を受けて|ことができなく|使ってはいけない|ようにする|と考えて)/.test(sentence)) value += 20;
  return value;
};

export const buildFallbackCoach = (title: string, sentences: string[]): NhkCoachResult => {
  const labels: NhkCoachLabel[] = ['核心', '跟读', '迁移'];
  const ranked = sentences.map((sentence, sentenceIndex) => ({sentence: compact(sentence), sentenceIndex}))
    .filter(item => item.sentence)
    .sort((a, b) => score(b.sentence) - score(a.sentence) || a.sentenceIndex - b.sentenceIndex)
    .slice(0, Math.min(3, sentences.length));
  const recommendations = ranked.map((item, index) => {
    const [expression, dailyVersion, workVersion] = transferFor(item.sentence);
    return {
      ...item,
      label: labels[index],
      reasonZh: index === 0 ? '最能代表新闻重点' : index === 1 ? '适合练句子切分' : '容易迁移到真实场景',
      chunks: chunksFor(item.sentence),
      expression,
      meaningZh: '先抓主干，再留意助词、否定和句尾。',
      dailyVersion,
      workVersion,
    };
  });
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
  return typeof result.summaryJa === 'string' && typeof result.summaryZh === 'string'
    && typeof result.opinionQuestion === 'string' && typeof result.worldSetupZh === 'string'
    && typeof result.worldPromptJa === 'string' && Array.isArray(result.recommendations)
    && result.recommendations.length > 0
    && result.recommendations.every(item => typeof item?.sentence === 'string' && typeof item?.expression === 'string');
};

export const pickCoachRecommendation = (coach: NhkCoachResult | null, selectedSentences: string[]): NhkCoachRecommendation | null => {
  if (!coach) return null;
  const selected = new Set(selectedSentences);
  return coach.recommendations.find(item => item.label === '核心' && selected.has(item.sentence))
    || coach.recommendations.find(item => selected.has(item.sentence))
    || coach.recommendations[0]
    || null;
};
