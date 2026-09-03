export type NhkCoachLabel = '核心' | '跟读' | '迁移';

export type NhkCoachExample = {
  ja: string;
  zh: string;
};

export type NhkGrammarPoint = {
  id: string;
  pattern: string;
  meaningZh: string;
  formation: string;
  explanationZh: string;
  nuanceZh: string;
  examples: NhkCoachExample[];
};

export type NhkVocabularyPoint = {
  id: string;
  word: string;
  reading: string;
  meaningZh: string;
  partOfSpeech: string;
  nuanceZh: string;
  examples: NhkCoachExample[];
};

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
  translationZh: string;
  structureZh: string;
  grammarPoints: NhkGrammarPoint[];
  vocabularyPoints: NhkVocabularyPoint[];
};

export type NhkCoachResult = {
  summaryJa: string;
  summaryZh: string;
  recommendations: NhkCoachRecommendation[];
  opinionQuestion: string;
  // Kept for compatibility with DailyInputV2 records created before the NHK-only redesign.
  worldSetupZh: string;
  worldPromptJa: string;
};

const LABEL_ORDER: NhkCoachLabel[] = ['核心', '跟读', '迁移'];
const compact = (value: string): string => value.replace(/\s+/g, ' ').trim();
const sentenceKey = (value: string): string => compact(value).replace(/\s/g, '');

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const pointId = (kind: 'grammar' | 'vocabulary', key: string): string =>
  `${kind}-${stableHash(compact(key).toLowerCase())}`;

const normalizeExamples = (value: unknown, fallback: NhkCoachExample[]): NhkCoachExample[] => {
  if (!Array.isArray(value)) return fallback;
  const examples = value
    .filter(item => item && typeof item === 'object')
    .map(item => item as Partial<NhkCoachExample>)
    .map(item => ({ja: compact(String(item.ja || '')), zh: compact(String(item.zh || ''))}))
    .filter(item => item.ja && item.zh)
    .slice(0, 3);
  return examples.length ? examples : fallback;
};

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
  if (sentence.includes('ことになって')) return ['〜ことになっている', 'この建物では、夜十時以降は静かにすることになっています。', '障害が発生した場合は、担当者へ連絡することになっています。'];
  if (sentence.includes('によると')) return ['〜によると', '天気予報によると、午後から雨だそうです。', '設計書によると、この項目は必須です。'];
  return [
    sentence.replace(/[。！？]+$/, '').slice(0, 48),
    sentence,
    'この内容について、仕事への影響も確認したほうがいいと思います。',
  ];
};

type GrammarTemplate = Omit<NhkGrammarPoint, 'id'> & {match: (sentence: string) => boolean};

const GRAMMAR_TEMPLATES: GrammarTemplate[] = [
  {
    match: sentence => sentence.includes('てはいけない'),
    pattern: '〜てはいけない',
    meaningZh: '不可以……；禁止……',
    formation: '动词て形＋はいけない',
    explanationZh: '表示规则、法律或说话人明确禁止某个行为。新闻中常用于说明制度限制。',
    nuanceZh: '语气比「〜ないでください」更强，常见于规定、注意事项和公共规则。',
    examples: [
      {ja: 'ここで写真を撮ってはいけません。', zh: '这里不可以拍照。'},
      {ja: 'テスト環境で本番データを使ってはいけません。', zh: '测试环境中不可以使用生产数据。'},
    ],
  },
  {
    match: sentence => sentence.includes('ことができなくな'),
    pattern: '〜ことができなくなる',
    meaningZh: '变得不能……；以后无法……',
    formation: '动词辞书形＋ことができなくなる',
    explanationZh: '表示能力、权限或制度条件发生变化，原来可以做的事情之后不再可以。',
    nuanceZh: '重点在“状态变化”，不是单纯的「できない」。新闻中常与日期、制度变更一起出现。',
    examples: [
      {ja: '来月から、このカードは使うことができなくなります。', zh: '从下个月起，这张卡将无法使用。'},
      {ja: '移行後は旧画面から登録することができなくなります。', zh: '迁移后将无法从旧页面进行登记。'},
    ],
  },
  {
    match: sentence => sentence.includes('を受けて'),
    pattern: '〜を受けて',
    meaningZh: '受到……影响；针对……',
    formation: '名词＋を受けて',
    explanationZh: '表示前项事件、决定或指示成为后项行动的直接原因。新闻和商务日语中使用频率很高。',
    nuanceZh: '比「ので」更正式，强调“接到某种信息或变化之后采取行动”。',
    examples: [
      {ja: '発表を受けて、予定を変更しました。', zh: '根据这次发布，我们更改了计划。'},
      {ja: '仕様変更を受けて、テスト項目を追加します。', zh: '针对规格变更，我们将追加测试项目。'},
    ],
  },
  {
    match: sentence => sentence.includes('ようにする'),
    pattern: '〜ようにする',
    meaningZh: '尽量做到……；设法让……',
    formation: '动词辞书形／ない形＋ようにする',
    explanationZh: '表示有意识地养成习惯、采取措施，或让某个状态实现。',
    nuanceZh: '强调持续努力或人为控制，与表示自然变化的「〜ようになる」不同。',
    examples: [
      {ja: '毎日、日本語のニュースを読むようにしています。', zh: '我尽量每天阅读日语新闻。'},
      {ja: '同じ障害が起きないように、確認手順を追加します。', zh: '为了不再发生相同故障，我们追加确认步骤。'},
    ],
  },
  {
    match: sentence => sentence.includes('ことになって'),
    pattern: '〜ことになっている',
    meaningZh: '规定为……；按安排要……',
    formation: '动词辞书形／ない形＋ことになっている',
    explanationZh: '说明由规则、组织或既定安排决定的事项，不强调个人意志。',
    nuanceZh: '适合解释制度和运用规则；个人决定通常用「〜ことにしている」。',
    examples: [
      {ja: 'この施設では、入口で受付をすることになっています。', zh: '这个设施规定要在入口办理登记。'},
      {ja: 'エラーが出た場合は、担当者に連絡することになっています。', zh: '出现错误时，规定要联系负责人。'},
    ],
  },
  {
    match: sentence => sentence.includes('によると'),
    pattern: '〜によると',
    meaningZh: '根据……；据……所说',
    formation: '信息来源＋によると',
    explanationZh: '明确指出消息来源，后面常接「〜そうだ／という／とのことだ」等传闻表达。',
    nuanceZh: '新闻中用于区分事实来源，避免把转述内容说成说话人亲自确认的事实。',
    examples: [
      {ja: '気象庁によると、明日は大雨になる見込みです。', zh: '据气象厅消息，预计明天会有大雨。'},
      {ja: '設計書によると、この項目は必須です。', zh: '根据设计书，这一项是必填项。'},
    ],
  },
  {
    match: sentence => /ため(?:に|、|です|で)/.test(sentence),
    pattern: '〜ため（に）',
    meaningZh: '因为……；为了……',
    formation: '普通形／名词＋の＋ため（に）',
    explanationZh: '既可以表示原因，也可以表示目的。要根据后项是结果还是行动来判断。',
    nuanceZh: '比「から／ので」更书面，新闻报道里经常用于客观说明原因。',
    examples: [
      {ja: '大雪のため、電車が遅れています。', zh: '因为大雪，电车晚点。'},
      {ja: '安全を確認するために、もう一度テストします。', zh: '为了确认安全性，再测试一次。'},
    ],
  },
  {
    match: sentence => sentence.includes('について'),
    pattern: '〜について',
    meaningZh: '关于……',
    formation: '名词＋について',
    explanationZh: '把某个主题作为说明、调查、讨论或思考的对象。',
    nuanceZh: '常见搭配有「〜について説明する／調べる／話す／検討する」。',
    examples: [
      {ja: '新しい制度について説明します。', zh: '说明一下新制度。'},
      {ja: '影響範囲について確認させてください。', zh: '请允许我确认一下影响范围。'},
    ],
  },
];

const NEWS_VOCABULARY: Array<Omit<NhkVocabularyPoint, 'id'> & {word: string}> = [
  {word: '政府', reading: 'せいふ', meaningZh: '政府', partOfSpeech: '名词', nuanceZh: '新闻中常作为政策、决定或发表的主体。', examples: [{ja: '政府は新しい方針を発表しました。', zh: '政府发布了新方针。'}, {ja: '政府の対応が注目されています。', zh: '政府的应对受到关注。'}]},
  {word: '法律', reading: 'ほうりつ', meaningZh: '法律', partOfSpeech: '名词', nuanceZh: '常和「法律ができる／成立する／施行される」搭配。', examples: [{ja: '新しい法律が成立しました。', zh: '新法律通过了。'}, {ja: 'この法律は来月から施行されます。', zh: '这项法律从下个月起实施。'}]},
  {word: '制度', reading: 'せいど', meaningZh: '制度；机制', partOfSpeech: '名词', nuanceZh: '表示由组织或社会制定的一套规则和运作方式。', examples: [{ja: '新しい制度が始まります。', zh: '新制度即将开始。'}, {ja: '制度の内容を確認してください。', zh: '请确认制度内容。'}]},
  {word: '対象', reading: 'たいしょう', meaningZh: '对象；适用范围', partOfSpeech: '名词', nuanceZh: '新闻和工作中常用「対象となる」「対象外」。', examples: [{ja: '18歳未満が対象です。', zh: '适用对象是未满18岁的人。'}, {ja: 'このデータは処理対象外です。', zh: '这份数据不在处理范围内。'}]},
  {word: '影響', reading: 'えいきょう', meaningZh: '影响', partOfSpeech: '名词・サ变', nuanceZh: '常用「影響が出る／影響を受ける／影響する」。', examples: [{ja: '生活への影響が広がっています。', zh: '对生活的影响正在扩大。'}, {ja: '既存機能への影響を確認します。', zh: '确认对现有功能的影响。'}]},
  {word: '対応', reading: 'たいおう', meaningZh: '应对；处理', partOfSpeech: '名词・サ变', nuanceZh: '可指对问题、客户、制度变化采取行动。', examples: [{ja: '会社は早急に対応しました。', zh: '公司迅速进行了处理。'}, {ja: '指摘内容への対応を進めています。', zh: '正在处理指出的问题。'}]},
  {word: '発表', reading: 'はっぴょう', meaningZh: '发表；公布', partOfSpeech: '名词・サ变', nuanceZh: '新闻中常见「発表する」「発表によると」。', examples: [{ja: '結果は来週発表されます。', zh: '结果将在下周公布。'}, {ja: '会社が新しい計画を発表しました。', zh: '公司公布了新计划。'}]},
  {word: '開始', reading: 'かいし', meaningZh: '开始；启动', partOfSpeech: '名词・サ变', nuanceZh: '比「始める」更正式，适合制度、服务和处理流程。', examples: [{ja: 'サービスは10月に開始します。', zh: '服务将于10月开始。'}, {ja: 'テストを予定どおり開始しました。', zh: '测试按计划开始了。'}]},
  {word: '利用', reading: 'りよう', meaningZh: '使用；利用', partOfSpeech: '名词・サ变', nuanceZh: '比「使う」正式，常见于服务、设施、系统规则。', examples: [{ja: 'このサービスは無料で利用できます。', zh: '这项服务可以免费使用。'}, {ja: '利用条件を確認してください。', zh: '请确认使用条件。'}]},
  {word: '禁止', reading: 'きんし', meaningZh: '禁止', partOfSpeech: '名词・サ变', nuanceZh: '常见于法律、设施规则和系统运用限制。', examples: [{ja: 'この地域では花火が禁止されています。', zh: '这个地区禁止燃放烟花。'}, {ja: '本番環境での直接修正は禁止です。', zh: '禁止直接修改生产环境。'}]},
  {word: '必要', reading: 'ひつよう', meaningZh: '必要；需要', partOfSpeech: '名词・ナ形容词', nuanceZh: '「〜必要がある」表示客观需要做某事。', examples: [{ja: '事前に予約する必要があります。', zh: '需要提前预约。'}, {ja: '追加テストが必要です。', zh: '需要追加测试。'}]},
  {word: '確認', reading: 'かくにん', meaningZh: '确认', partOfSpeech: '名词・サ变', nuanceZh: '工作日语核心词，可用于事实、状态、内容和影响范围。', examples: [{ja: '内容をもう一度確認します。', zh: '再次确认内容。'}, {ja: '反映結果をご確認ください。', zh: '请确认应用结果。'}]},
  {word: '変更', reading: 'へんこう', meaningZh: '变更；修改', partOfSpeech: '名词・サ变', nuanceZh: '比「変える」正式，常用于规则、计划、规格。', examples: [{ja: '予定が変更になりました。', zh: '计划有变更。'}, {ja: '仕様変更の影響を確認します。', zh: '确认规格变更的影响。'}]},
  {word: '予定', reading: 'よてい', meaningZh: '计划；预定', partOfSpeech: '名词・サ变', nuanceZh: '「〜予定です」表示已安排但仍可能调整。', examples: [{ja: '来月から始める予定です。', zh: '计划从下个月开始。'}, {ja: '本日の作業予定を共有します。', zh: '共享今天的作业计划。'}]},
];

const fallbackGrammarPoints = (sentence: string, expression: string): NhkGrammarPoint[] => {
  const matched = GRAMMAR_TEMPLATES.filter(template => template.match(sentence)).slice(0, 3);
  const points = matched.map(({match: _match, ...template}) => ({...template, id: pointId('grammar', template.pattern)}));
  if (points.length) return points;
  return [{
    id: pointId('grammar', expression),
    pattern: expression,
    meaningZh: '这句中值得整体记忆的表达',
    formation: '请把表达连同原句一起记忆',
    explanationZh: '先在原句中确认它连接了哪些信息，再观察它在日常和工作例句中的变化。',
    nuanceZh: '新闻日语往往通过固定搭配压缩信息，整体记忆比逐字翻译更有效。',
    examples: [
      {ja: sentence, zh: '原文中的用法。'},
      {ja: 'この表現を使って、自分の状況を一文で説明してみます。', zh: '试着用这个表达，用一句话说明自己的情况。'},
    ],
  }];
};

const fallbackVocabularyPoints = (sentence: string): NhkVocabularyPoint[] => {
  const known = NEWS_VOCABULARY
    .filter(item => sentence.includes(item.word))
    .slice(0, 6)
    .map(item => ({...item, id: pointId('vocabulary', item.word)}));
  if (known.length >= 3) return known;

  const seen = new Set(known.map(item => item.word));
  const compounds = sentence.match(/[一-龯々]{2,8}/g) || [];
  for (const word of compounds) {
    if (seen.has(word) || word.length > 6) continue;
    seen.add(word);
    known.push({
      id: pointId('vocabulary', word),
      word,
      reading: '',
      meaningZh: '请结合原句确认含义',
      partOfSpeech: '新闻词汇',
      nuanceZh: '先把它和原句中的搭配一起保存；AI 精讲完成后会补充更准确的读音和语感。',
      examples: [
        {ja: sentence, zh: '原文中的用法。'},
        {ja: `${word}について、もう少し調べてみます。`, zh: `我再进一步查一下“${word}”。`},
      ],
    });
    if (known.length >= 5) break;
  }
  return known;
};

const score = (sentence: string): number => {
  let value = sentence.length >= 24 && sentence.length <= 95 ? 30 : 12;
  if (sentence.includes('、')) value += 8;
  if (/(を受けて|ことができなく|使ってはいけない|ようにする|と考えて|ことになって|によると)/.test(sentence)) value += 20;
  return value;
};

export const buildRecommendationForSentence = (
  sentence: string,
  sentenceIndex: number,
  label: NhkCoachLabel = '核心',
  reasonZh?: string,
): NhkCoachRecommendation => {
  const cleanSentence = compact(sentence);
  const chunks = chunksFor(cleanSentence);
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
    chunks,
    expression,
    meaningZh: '先抓主干，再留意助词、否定、时间条件和句尾。',
    dailyVersion,
    workVersion,
    translationZh: `这句是本文的重要信息。先按「${chunks.join('｜')}」分块理解，再对照下方语法和词汇确认细节。`,
    structureZh: `语块结构：${chunks.join('｜')}。先找最后的谓语，再向前确认主语、对象、时间和原因。`,
    grammarPoints: fallbackGrammarPoints(cleanSentence, expression),
    vocabularyPoints: fallbackVocabularyPoints(cleanSentence),
  };
};

const normalizeGrammarPoints = (
  value: unknown,
  fallback: NhkGrammarPoint[],
): NhkGrammarPoint[] => {
  if (!Array.isArray(value)) return fallback;
  const result = value
    .filter(item => item && typeof item === 'object')
    .map(item => item as Partial<NhkGrammarPoint>)
    .map(item => {
      const pattern = compact(String(item.pattern || ''));
      if (!pattern) return null;
      const base = fallback.find(candidate => candidate.pattern === pattern) || fallback[0];
      const examples = normalizeExamples(item.examples, base?.examples || []);
      return {
        id: pointId('grammar', pattern),
        pattern,
        meaningZh: compact(String(item.meaningZh || base?.meaningZh || '')),
        formation: compact(String(item.formation || base?.formation || '')),
        explanationZh: compact(String(item.explanationZh || base?.explanationZh || '')),
        nuanceZh: compact(String(item.nuanceZh || base?.nuanceZh || '')),
        examples,
      };
    })
    .filter((item): item is NhkGrammarPoint => Boolean(item?.meaningZh && item.explanationZh))
    .slice(0, 4);
  return result.length ? result : fallback;
};

const normalizeVocabularyPoints = (
  value: unknown,
  fallback: NhkVocabularyPoint[],
): NhkVocabularyPoint[] => {
  if (!Array.isArray(value)) return fallback;
  const result = value
    .filter(item => item && typeof item === 'object')
    .map(item => item as Partial<NhkVocabularyPoint>)
    .map(item => {
      const word = compact(String(item.word || ''));
      if (!word) return null;
      const base = fallback.find(candidate => candidate.word === word);
      const examples = normalizeExamples(item.examples, base?.examples || []);
      return {
        id: pointId('vocabulary', word),
        word,
        reading: compact(String(item.reading || base?.reading || '')),
        meaningZh: compact(String(item.meaningZh || base?.meaningZh || '')),
        partOfSpeech: compact(String(item.partOfSpeech || base?.partOfSpeech || '')),
        nuanceZh: compact(String(item.nuanceZh || base?.nuanceZh || '')),
        examples,
      };
    })
    .filter((item): item is NhkVocabularyPoint => Boolean(item?.meaningZh))
    .slice(0, 8);
  return result.length ? result : fallback;
};

const normalizeRecommendation = (
  value: Partial<NhkCoachRecommendation> | undefined,
  fallback: NhkCoachRecommendation,
): NhkCoachRecommendation => ({
  sentenceIndex: fallback.sentenceIndex,
  sentence: fallback.sentence,
  label: LABEL_ORDER.includes(value?.label as NhkCoachLabel) ? value!.label as NhkCoachLabel : fallback.label,
  reasonZh: compact(String(value?.reasonZh || fallback.reasonZh)),
  chunks: Array.isArray(value?.chunks)
    && chunksMatchSentence(value!.chunks.map(item => compact(String(item))).filter(Boolean), fallback.sentence)
    ? value!.chunks.map(item => compact(String(item))).filter(Boolean)
    : fallback.chunks,
  expression: compact(String(value?.expression || fallback.expression)),
  meaningZh: compact(String(value?.meaningZh || fallback.meaningZh)),
  dailyVersion: compact(String(value?.dailyVersion || fallback.dailyVersion)),
  workVersion: compact(String(value?.workVersion || fallback.workVersion)),
  translationZh: compact(String(value?.translationZh || fallback.translationZh)),
  structureZh: compact(String(value?.structureZh || fallback.structureZh)),
  grammarPoints: normalizeGrammarPoints(value?.grammarPoints, fallback.grammarPoints),
  vocabularyPoints: normalizeVocabularyPoints(value?.vocabularyPoints, fallback.vocabularyPoints),
});

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
    index === 0 ? '最能代表新闻重点' : index === 1 ? '适合练句子切分' : '容易迁移到真实表达',
  ));
  return {
    summaryJa: recommendations[0]?.sentence || `${title}についてのニュースです。`,
    summaryZh: `这条新闻主要围绕“${title}”展开。`,
    recommendations,
    opinionQuestion: 'このニュースについて、あなたはどう思いますか。理由も一つ言ってください。',
    worldSetupZh: '',
    worldPromptJa: 'このニュースについて、あなたはどう思いますか。',
  };
};

export const isNhkCoachResult = (value: unknown): value is NhkCoachResult => {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<NhkCoachResult>;
  return typeof result.summaryJa === 'string'
    && typeof result.summaryZh === 'string'
    && typeof result.opinionQuestion === 'string'
    && Array.isArray(result.recommendations)
    && result.recommendations.length > 0
    && result.recommendations.every(item => typeof item?.sentence === 'string'
      && typeof item?.expression === 'string'
      && Array.isArray(item?.chunks));
};

export const normalizeNhkCoachResult = (
  value: unknown,
  title: string,
  sentences: string[],
): NhkCoachResult => {
  const fallback = buildFallbackCoach(title, sentences);
  if (!isNhkCoachResult(value)) return fallback;
  const source = value as NhkCoachResult;
  const candidates = sentences.map(compact);
  const used = new Set<number>();
  const recommendations: NhkCoachRecommendation[] = [];

  for (const item of source.recommendations) {
    const sentenceIndex = Number.isInteger(item.sentenceIndex)
      && item.sentenceIndex >= 0
      && item.sentenceIndex < candidates.length
      ? item.sentenceIndex
      : candidates.findIndex(candidate => sentenceKey(candidate) === sentenceKey(item.sentence));
    if (sentenceIndex < 0 || used.has(sentenceIndex)) continue;
    used.add(sentenceIndex);
    const label = LABEL_ORDER[recommendations.length] || '迁移';
    const base = buildRecommendationForSentence(candidates[sentenceIndex], sentenceIndex, label);
    recommendations.push(normalizeRecommendation({...item, label}, base));
    if (recommendations.length >= Math.min(3, candidates.length)) break;
  }

  for (const item of fallback.recommendations) {
    if (recommendations.length >= Math.min(3, candidates.length)) break;
    if (used.has(item.sentenceIndex)) continue;
    used.add(item.sentenceIndex);
    recommendations.push(item);
  }

  return {
    summaryJa: compact(source.summaryJa) || fallback.summaryJa,
    summaryZh: compact(source.summaryZh) || fallback.summaryZh,
    recommendations,
    opinionQuestion: compact(source.opinionQuestion) || fallback.opinionQuestion,
    worldSetupZh: compact(source.worldSetupZh || ''),
    worldPromptJa: compact(source.worldPromptJa || '') || fallback.worldPromptJa,
  };
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
    return normalizeRecommendation({
      ...matched,
      sentenceIndex: fallback.sentenceIndex,
      sentence,
      label,
    }, fallback);
  });
};

export const pickCoachRecommendation = (
  coach: NhkCoachResult | null,
  selectedSentences: string[],
  candidateSentences: string[] = selectedSentences,
): NhkCoachRecommendation | null => alignCoachRecommendations(coach, selectedSentences, candidateSentences)[0] || null;

export const coachKnowledgeCounts = (coach: NhkCoachResult | null): {grammar: number; vocabulary: number} => {
  if (!coach) return {grammar: 0, vocabulary: 0};
  return coach.recommendations.reduce((total, recommendation) => ({
    grammar: total.grammar + recommendation.grammarPoints.length,
    vocabulary: total.vocabulary + recommendation.vocabularyPoints.length,
  }), {grammar: 0, vocabulary: 0});
};
