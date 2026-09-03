import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODELS = ["gpt-5.6-luna", "gpt-5-mini"];
const MAX_SENTENCES = 16;
const CACHE_DAYS = 14;

type Example = {
  ja: string;
  zh: string;
};

type GrammarPoint = {
  id: string;
  pattern: string;
  meaningZh: string;
  formation: string;
  explanationZh: string;
  nuanceZh: string;
  examples: Example[];
};

type VocabularyPoint = {
  id: string;
  word: string;
  reading: string;
  meaningZh: string;
  partOfSpeech: string;
  nuanceZh: string;
  examples: Example[];
};

type Recommendation = {
  sentenceIndex: number;
  sentence: string;
  label: "核心" | "跟读" | "迁移";
  reasonZh: string;
  chunks: string[];
  expression: string;
  meaningZh: string;
  dailyVersion: string;
  workVersion: string;
  translationZh: string;
  structureZh: string;
  grammarPoints: GrammarPoint[];
  vocabularyPoints: VocabularyPoint[];
};

type CoachResult = {
  summaryJa: string;
  summaryZh: string;
  recommendations: Recommendation[];
  opinionQuestion: string;
  // Compatibility fields retained for DailyInputV2 records. The NHK-only UI does not render a fictional world.
  worldSetupZh: string;
  worldPromptJa: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  },
});

async function loadApiKey(supabase: any): Promise<string> {
  const envKey = Deno.env.get("OPENAI_API_KEY");
  if (envKey?.startsWith("sk-")) return envKey;
  const { data, error } = await supabase.rpc("get_nihongo_openai_key");
  if (!error && typeof data === "string" && data.startsWith("sk-")) return data;
  return "";
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

const clean = (value: unknown, max = 500): string => typeof value === "string"
  ? value.replace(/\s+/g, " ").trim().slice(0, max)
  : "";

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const pointId = (kind: "grammar" | "vocabulary", key: string): string =>
  `${kind}-${stableHash(clean(key, 180).toLowerCase())}`;

const chunkSentence = (sentence: string): string[] => {
  const chunks = sentence
    .replace(/([、。！？])/g, "$1|")
    .split("|")
    .map(value => value.trim())
    .filter(Boolean);
  if (chunks.length > 1) return chunks.slice(0, 6);
  if (sentence.length <= 28) return [sentence];
  const midpoint = Math.floor(sentence.length / 2);
  const boundaries = ["は", "が", "を", "に", "で", "と", "から", "ため", "ので"];
  let best = -1;
  for (const boundary of boundaries) {
    const index = sentence.indexOf(boundary, Math.max(8, midpoint - 10));
    if (index > 0 && (best < 0 || Math.abs(index - midpoint) < Math.abs(best - midpoint))) best = index + boundary.length;
  }
  return best > 0 ? [sentence.slice(0, best), sentence.slice(best)] : [sentence];
};

const fallbackExpression = (sentence: string): string => {
  const patterns = [
    /〜?[^。！？]{0,18}を受けて/,
    /[^。！？]{0,18}ことができなくなります/,
    /[^。！？]{0,18}使ってはいけない/,
    /[^。！？]{0,18}ようにする/,
    /[^。！？]{0,18}と考えています/,
    /[^。！？]{0,18}と話しています/,
    /[^。！？]{0,18}ことになっています/,
    /[^。！？]{0,18}によると/,
  ];
  for (const pattern of patterns) {
    const match = sentence.match(pattern)?.[0]?.trim();
    if (match) return match;
  }
  return sentence.replace(/[。！？]+$/, "").slice(0, 48);
};

const grammarFallback = (sentence: string, expression: string): GrammarPoint[] => {
  const templates: Array<{needle: string; point: Omit<GrammarPoint, "id">}> = [
    {
      needle: "てはいけない",
      point: {
        pattern: "〜てはいけない",
        meaningZh: "不可以……；禁止……",
        formation: "动词て形＋はいけない",
        explanationZh: "表示规则、法律或说话人明确禁止某个行为。新闻中常用于说明制度限制。",
        nuanceZh: "语气比「〜ないでください」更强，常见于规定和公共规则。",
        examples: [
          { ja: "ここで写真を撮ってはいけません。", zh: "这里不可以拍照。" },
          { ja: "テスト環境で本番データを使ってはいけません。", zh: "测试环境中不可以使用生产数据。" },
        ],
      },
    },
    {
      needle: "ことができなくな",
      point: {
        pattern: "〜ことができなくなる",
        meaningZh: "变得不能……；以后无法……",
        formation: "动词辞书形＋ことができなくなる",
        explanationZh: "表示权限、能力或制度条件变化，原来能做的事情之后不能再做。",
        nuanceZh: "重点在状态变化，而不是单纯的「できない」。",
        examples: [
          { ja: "来月から、このカードは使うことができなくなります。", zh: "从下个月起，这张卡将无法使用。" },
          { ja: "移行後は旧画面から登録することができなくなります。", zh: "迁移后将无法从旧页面登记。" },
        ],
      },
    },
    {
      needle: "を受けて",
      point: {
        pattern: "〜を受けて",
        meaningZh: "受到……影响；针对……",
        formation: "名词＋を受けて",
        explanationZh: "表示前项事件、决定或指示成为后项行动的直接原因。",
        nuanceZh: "比「ので」正式，常见于新闻和工作汇报。",
        examples: [
          { ja: "発表を受けて、予定を変更しました。", zh: "根据这次发布，我们更改了计划。" },
          { ja: "仕様変更を受けて、テスト項目を追加します。", zh: "针对规格变更，我们将追加测试项目。" },
        ],
      },
    },
    {
      needle: "ようにする",
      point: {
        pattern: "〜ようにする",
        meaningZh: "尽量做到……；设法让……",
        formation: "动词辞书形／ない形＋ようにする",
        explanationZh: "表示有意识地养成习惯、采取措施或让某个状态实现。",
        nuanceZh: "强调持续努力或人为控制，与自然变化的「〜ようになる」不同。",
        examples: [
          { ja: "毎日、日本語のニュースを読むようにしています。", zh: "我尽量每天阅读日语新闻。" },
          { ja: "同じ障害が起きないように、確認手順を追加します。", zh: "为了不再发生同样故障，我们追加确认步骤。" },
        ],
      },
    },
    {
      needle: "ことになって",
      point: {
        pattern: "〜ことになっている",
        meaningZh: "规定为……；按安排要……",
        formation: "动词辞书形／ない形＋ことになっている",
        explanationZh: "说明由规则、组织或既定安排决定的事项，不强调个人意志。",
        nuanceZh: "适合解释制度和运用规则。",
        examples: [
          { ja: "入口で受付をすることになっています。", zh: "规定要在入口办理登记。" },
          { ja: "エラーが出た場合は担当者に連絡することになっています。", zh: "出现错误时，规定要联系负责人。" },
        ],
      },
    },
    {
      needle: "によると",
      point: {
        pattern: "〜によると",
        meaningZh: "根据……；据……所说",
        formation: "信息来源＋によると",
        explanationZh: "明确指出消息来源，后面常接传闻或报道表达。",
        nuanceZh: "新闻中用于区分消息来源与说话人亲自确认的事实。",
        examples: [
          { ja: "気象庁によると、明日は大雨になる見込みです。", zh: "据气象厅消息，预计明天会有大雨。" },
          { ja: "設計書によると、この項目は必須です。", zh: "根据设计书，这一项是必填项。" },
        ],
      },
    },
  ];
  const matched = templates.filter(item => sentence.includes(item.needle)).slice(0, 3);
  if (matched.length) return matched.map(item => ({...item.point, id: pointId("grammar", item.point.pattern)}));
  return [{
    id: pointId("grammar", expression),
    pattern: expression,
    meaningZh: "这句中值得整体记忆的表达",
    formation: "把表达连同原句一起记忆",
    explanationZh: "先确认它在原句中连接了哪些信息，再观察它在延伸例句中的变化。",
    nuanceZh: "新闻日语常通过固定搭配压缩信息，整体记忆比逐字翻译更有效。",
    examples: [
      { ja: sentence, zh: "原文中的用法。" },
      { ja: "この表現を使って、自分の状況を説明してみます。", zh: "试着用这个表达说明自己的情况。" },
    ],
  }];
};

const vocabularyFallback = (sentence: string): VocabularyPoint[] => {
  const lexicon: Array<Omit<VocabularyPoint, "id">> = [
    { word: "政府", reading: "せいふ", meaningZh: "政府", partOfSpeech: "名词", nuanceZh: "新闻中常作为政策、决定或发表的主体。", examples: [{ja:"政府は新しい方針を発表しました。",zh:"政府发布了新方针。"},{ja:"政府の対応が注目されています。",zh:"政府的应对受到关注。"}] },
    { word: "法律", reading: "ほうりつ", meaningZh: "法律", partOfSpeech: "名词", nuanceZh: "常和「成立する／施行される」搭配。", examples: [{ja:"新しい法律が成立しました。",zh:"新法律通过了。"},{ja:"この法律は来月から施行されます。",zh:"这项法律从下个月起实施。"}] },
    { word: "制度", reading: "せいど", meaningZh: "制度；机制", partOfSpeech: "名词", nuanceZh: "表示由组织或社会制定的一套规则和运作方式。", examples: [{ja:"新しい制度が始まります。",zh:"新制度即将开始。"},{ja:"制度の内容を確認してください。",zh:"请确认制度内容。"}] },
    { word: "対象", reading: "たいしょう", meaningZh: "对象；适用范围", partOfSpeech: "名词", nuanceZh: "常见「対象となる／対象外」。", examples: [{ja:"18歳未満が対象です。",zh:"适用对象是未满18岁的人。"},{ja:"このデータは処理対象外です。",zh:"这份数据不在处理范围内。"}] },
    { word: "影響", reading: "えいきょう", meaningZh: "影响", partOfSpeech: "名词・サ变", nuanceZh: "常用「影響が出る／影響を受ける」。", examples: [{ja:"生活への影響が広がっています。",zh:"对生活的影响正在扩大。"},{ja:"既存機能への影響を確認します。",zh:"确认对现有功能的影响。"}] },
    { word: "対応", reading: "たいおう", meaningZh: "应对；处理", partOfSpeech: "名词・サ变", nuanceZh: "可指对问题、客户或制度变化采取行动。", examples: [{ja:"会社は早急に対応しました。",zh:"公司迅速进行了处理。"},{ja:"指摘内容への対応を進めています。",zh:"正在处理指出的问题。"}] },
    { word: "発表", reading: "はっぴょう", meaningZh: "发表；公布", partOfSpeech: "名词・サ变", nuanceZh: "新闻中常见「発表する／発表によると」。", examples: [{ja:"結果は来週発表されます。",zh:"结果将在下周公布。"},{ja:"会社が新しい計画を発表しました。",zh:"公司公布了新计划。"}] },
    { word: "利用", reading: "りよう", meaningZh: "使用；利用", partOfSpeech: "名词・サ变", nuanceZh: "比「使う」正式，常用于服务、设施和系统。", examples: [{ja:"このサービスは無料で利用できます。",zh:"这项服务可以免费使用。"},{ja:"利用条件を確認してください。",zh:"请确认使用条件。"}] },
    { word: "必要", reading: "ひつよう", meaningZh: "必要；需要", partOfSpeech: "名词・ナ形容词", nuanceZh: "「〜必要がある」表示客观需要。", examples: [{ja:"事前に予約する必要があります。",zh:"需要提前预约。"},{ja:"追加テストが必要です。",zh:"需要追加测试。"}] },
    { word: "確認", reading: "かくにん", meaningZh: "确认", partOfSpeech: "名词・サ变", nuanceZh: "可用于事实、状态、内容和影响范围。", examples: [{ja:"内容をもう一度確認します。",zh:"再次确认内容。"},{ja:"反映結果をご確認ください。",zh:"请确认应用结果。"}] },
    { word: "変更", reading: "へんこう", meaningZh: "变更；修改", partOfSpeech: "名词・サ变", nuanceZh: "常用于规则、计划和规格。", examples: [{ja:"予定が変更になりました。",zh:"计划有变更。"},{ja:"仕様変更の影響を確認します。",zh:"确认规格变更的影响。"}] },
    { word: "予定", reading: "よてい", meaningZh: "计划；预定", partOfSpeech: "名词・サ变", nuanceZh: "「〜予定です」表示已有安排但仍可能调整。", examples: [{ja:"来月から始める予定です。",zh:"计划从下个月开始。"},{ja:"本日の作業予定を共有します。",zh:"共享今天的作业计划。"}] },
  ];
  const output = lexicon.filter(item => sentence.includes(item.word)).slice(0, 6)
    .map(item => ({...item, id: pointId("vocabulary", item.word)}));
  const seen = new Set(output.map(item => item.word));
  for (const word of sentence.match(/[一-龯々]{2,6}/g) || []) {
    if (seen.has(word)) continue;
    seen.add(word);
    output.push({
      id: pointId("vocabulary", word),
      word,
      reading: "",
      meaningZh: "结合原句理解",
      partOfSpeech: "新闻词汇",
      nuanceZh: "把这个词和原句中的搭配一起记忆。",
      examples: [
        {ja: sentence, zh: "原文中的用法。"},
        {ja: `${word}について、もう少し調べます。`, zh: `再进一步查一下“${word}”。`},
      ],
    });
    if (output.length >= 5) break;
  }
  return output;
};

const fallbackRecommendation = (sentence: string, sentenceIndex: number, label: Recommendation["label"]): Recommendation => {
  const chunks = chunkSentence(sentence);
  const expression = fallbackExpression(sentence);
  return {
    sentenceIndex,
    sentence,
    label,
    reasonZh: label === "核心" ? "最能代表这条新闻" : label === "跟读" ? "适合练长句切分和语流" : "适合迁移到真实表达",
    chunks,
    expression,
    meaningZh: "先掌握主干，再确认助词、时间条件和句尾。",
    dailyVersion: sentence,
    workVersion: "この内容を受けて、仕事への影響も確認したほうがいいと思います。",
    translationZh: `先按「${chunks.join("｜")}」分块理解，再对照下方语法和词汇确认细节。`,
    structureZh: `语块结构：${chunks.join("｜")}。先找最后的谓语，再向前确认主语、对象、时间和原因。`,
    grammarPoints: grammarFallback(sentence, expression),
    vocabularyPoints: vocabularyFallback(sentence),
  };
};

const sanitizeExamples = (value: unknown, fallback: Example[]): Example[] => {
  if (!Array.isArray(value)) return fallback;
  const examples = value
    .filter(item => item && typeof item === "object")
    .map((item: any) => ({ja: clean(item.ja, 320), zh: clean(item.zh, 320)}))
    .filter(item => item.ja && item.zh)
    .slice(0, 3);
  return examples.length >= 2 ? examples : fallback;
};

const sanitizeGrammar = (value: unknown, fallback: GrammarPoint[]): GrammarPoint[] => {
  if (!Array.isArray(value)) return fallback;
  const output: GrammarPoint[] = [];
  for (const candidate of value) {
    const pattern = clean(candidate?.pattern, 100);
    const meaningZh = clean(candidate?.meaningZh, 240);
    const explanationZh = clean(candidate?.explanationZh, 600);
    if (!pattern || !meaningZh || !explanationZh) continue;
    const base = fallback.find(item => item.pattern === pattern) || fallback[0];
    output.push({
      id: pointId("grammar", pattern),
      pattern,
      meaningZh,
      formation: clean(candidate?.formation, 260) || base?.formation || "",
      explanationZh,
      nuanceZh: clean(candidate?.nuanceZh, 500) || base?.nuanceZh || "",
      examples: sanitizeExamples(candidate?.examples, base?.examples || []),
    });
    if (output.length >= 4) break;
  }
  return output.length ? output : fallback;
};

const sanitizeVocabulary = (value: unknown, fallback: VocabularyPoint[]): VocabularyPoint[] => {
  if (!Array.isArray(value)) return fallback;
  const output: VocabularyPoint[] = [];
  for (const candidate of value) {
    const word = clean(candidate?.word, 80);
    const meaningZh = clean(candidate?.meaningZh, 220);
    if (!word || !meaningZh) continue;
    const base = fallback.find(item => item.word === word);
    output.push({
      id: pointId("vocabulary", word),
      word,
      reading: clean(candidate?.reading, 100) || base?.reading || "",
      meaningZh,
      partOfSpeech: clean(candidate?.partOfSpeech, 100) || base?.partOfSpeech || "词汇",
      nuanceZh: clean(candidate?.nuanceZh, 480) || base?.nuanceZh || "",
      examples: sanitizeExamples(candidate?.examples, base?.examples || []),
    });
    if (output.length >= 8) break;
  }
  return output.length ? output : fallback;
};

function sanitizeResult(raw: any, title: string, sentences: string[]): CoachResult {
  const output: Recommendation[] = [];
  const used = new Set<number>();
  const labels: Recommendation["label"][] = ["核心", "跟读", "迁移"];
  const candidates = Array.isArray(raw?.recommendations) ? raw.recommendations : [];

  for (const candidate of candidates) {
    const index = Number(candidate?.sentenceIndex);
    if (!Number.isInteger(index) || index < 0 || index >= sentences.length || used.has(index)) continue;
    const sentence = sentences[index];
    const label = labels.includes(candidate?.label) ? candidate.label : labels[output.length] || "迁移";
    const fallback = fallbackRecommendation(sentence, index, label);
    const chunks = Array.isArray(candidate?.chunks)
      ? candidate.chunks.map((value: unknown) => clean(value, 100)).filter(Boolean).slice(0, 6)
      : [];
    const chunksValid = chunks.length > 0
      && chunks.join("").replace(/\s/g, "") === sentence.replace(/\s/g, "");
    output.push({
      sentenceIndex: index,
      sentence,
      label,
      reasonZh: clean(candidate?.reasonZh, 120) || fallback.reasonZh,
      chunks: chunksValid ? chunks : fallback.chunks,
      expression: clean(candidate?.expression, 120) || fallback.expression,
      meaningZh: clean(candidate?.meaningZh, 260) || fallback.meaningZh,
      dailyVersion: clean(candidate?.dailyVersion, 240) || fallback.dailyVersion,
      workVersion: clean(candidate?.workVersion, 280) || fallback.workVersion,
      translationZh: clean(candidate?.translationZh, 700) || fallback.translationZh,
      structureZh: clean(candidate?.structureZh, 700) || fallback.structureZh,
      grammarPoints: sanitizeGrammar(candidate?.grammarPoints, fallback.grammarPoints),
      vocabularyPoints: sanitizeVocabulary(candidate?.vocabularyPoints, fallback.vocabularyPoints),
    });
    used.add(index);
    if (output.length >= Math.min(3, sentences.length)) break;
  }

  for (let index = 0; output.length < Math.min(3, sentences.length) && index < sentences.length; index += 1) {
    if (used.has(index)) continue;
    output.push(fallbackRecommendation(sentences[index], index, labels[output.length] || "迁移"));
    used.add(index);
  }

  return {
    summaryJa: clean(raw?.summaryJa, 260) || `${title}についてのニュースです。`,
    summaryZh: clean(raw?.summaryZh, 360) || `这是一条关于“${title}”的新闻。`,
    recommendations: output,
    opinionQuestion: clean(raw?.opinionQuestion, 220) || "このニュースについて、あなたはどう思いますか。理由も一つ言ってください。",
    worldSetupZh: "",
    worldPromptJa: clean(raw?.worldPromptJa, 220) || "このニュースについて、あなたはどう思いますか。",
  };
}

const exampleSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ja", "zh"],
  properties: {
    ja: { type: "string", minLength: 1, maxLength: 320 },
    zh: { type: "string", minLength: 1, maxLength: 320 },
  },
};

const grammarSchema = {
  type: "object",
  additionalProperties: false,
  required: ["pattern", "meaningZh", "formation", "explanationZh", "nuanceZh", "examples"],
  properties: {
    pattern: { type: "string", minLength: 1, maxLength: 100 },
    meaningZh: { type: "string", minLength: 1, maxLength: 240 },
    formation: { type: "string", minLength: 1, maxLength: 260 },
    explanationZh: { type: "string", minLength: 1, maxLength: 600 },
    nuanceZh: { type: "string", minLength: 1, maxLength: 500 },
    examples: { type: "array", minItems: 2, maxItems: 3, items: exampleSchema },
  },
};

const vocabularySchema = {
  type: "object",
  additionalProperties: false,
  required: ["word", "reading", "meaningZh", "partOfSpeech", "nuanceZh", "examples"],
  properties: {
    word: { type: "string", minLength: 1, maxLength: 80 },
    reading: { type: "string", minLength: 1, maxLength: 100 },
    meaningZh: { type: "string", minLength: 1, maxLength: 220 },
    partOfSpeech: { type: "string", minLength: 1, maxLength: 100 },
    nuanceZh: { type: "string", minLength: 1, maxLength: 480 },
    examples: { type: "array", minItems: 2, maxItems: 3, items: exampleSchema },
  },
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summaryJa", "summaryZh", "recommendations", "opinionQuestion", "worldPromptJa"],
  properties: {
    summaryJa: { type: "string", minLength: 1, maxLength: 260 },
    summaryZh: { type: "string", minLength: 1, maxLength: 360 },
    recommendations: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "sentenceIndex", "label", "reasonZh", "chunks", "expression", "meaningZh",
          "dailyVersion", "workVersion", "translationZh", "structureZh", "grammarPoints", "vocabularyPoints",
        ],
        properties: {
          sentenceIndex: { type: "integer", minimum: 0, maximum: 15 },
          label: { type: "string", enum: ["核心", "跟读", "迁移"] },
          reasonZh: { type: "string", minLength: 1, maxLength: 120 },
          chunks: { type: "array", minItems: 1, maxItems: 6, items: { type: "string", minLength: 1, maxLength: 100 } },
          expression: { type: "string", minLength: 1, maxLength: 120 },
          meaningZh: { type: "string", minLength: 1, maxLength: 260 },
          dailyVersion: { type: "string", minLength: 1, maxLength: 240 },
          workVersion: { type: "string", minLength: 1, maxLength: 280 },
          translationZh: { type: "string", minLength: 1, maxLength: 700 },
          structureZh: { type: "string", minLength: 1, maxLength: 700 },
          grammarPoints: { type: "array", minItems: 1, maxItems: 4, items: grammarSchema },
          vocabularyPoints: { type: "array", minItems: 3, maxItems: 8, items: vocabularySchema },
        },
      },
    },
    opinionQuestion: { type: "string", minLength: 1, maxLength: 220 },
    worldPromptJa: { type: "string", minLength: 1, maxLength: 220 },
  },
};

function outputText(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

async function callOpenAI(apiKey: string, title: string, sentences: string[]): Promise<{model: string; value: CoachResult}> {
  const numbered = sentences.map((sentence, index) => `${index}: ${sentence}`).join("\n");
  const instructions = [
    "You are an expert Japanese reading coach for a Chinese-speaking adult living and working in Japan at roughly N3-N2 level.",
    "The product goal is complete comprehension of one NHK news article, not a fictional story or game.",
    "Analyze only the supplied Japanese sentences. Never invent article facts, translations, readings, or grammar claims.",
    "Select up to three different key sentence indices: the article's core information, a syntactically valuable sentence, and a sentence useful for real-life transfer.",
    "sentenceIndex must refer to the exact numbered input. Do not rewrite the source sentence.",
    "translationZh must be a faithful, natural Chinese translation of the complete source sentence, including scope, negation, tense, modality, quotation, and attribution.",
    "structureZh must identify the main predicate and explain how subjects, modifiers, quotations, conditions, causes, time expressions, and particles connect. Be concrete about this exact sentence.",
    "For chunks, split the exact source sentence into natural breath/meaning groups without changing any source characters other than trimming spaces.",
    "For each key sentence, identify 1-4 genuinely useful grammar points. Explain formation, exact function here, contrast or nuance, and provide 2-3 new bilingual examples.",
    "For each key sentence, identify 3-8 useful words or collocations. Supply correct kana reading, concise Chinese meaning, part of speech, contextual nuance/collocation, and 2-3 new bilingual examples.",
    "Do not include trivial particles as vocabulary. Do not force a grammar point that is not present.",
    "expression is the single most reusable pattern or collocation. dailyVersion must be natural spoken Japanese. workVersion must be a realistic Japanese IT workplace sentence.",
    "summaryJa should summarize the article in easy natural Japanese in 1-2 sentences. summaryZh should summarize the article accurately in Chinese in 1-2 sentences.",
    "opinionQuestion should test genuine understanding and invite a short personal answer with one reason. worldPromptJa is retained only for storage compatibility and should repeat a neutral article discussion question without fictional characters.",
    "Use concise but sufficiently detailed Chinese for all Zh fields.",
  ].join(" ");

  let lastReason = "generation_failed";
  for (const model of MODELS) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          reasoning: { effort: "medium" },
          input: [
            { role: "system", content: [{ type: "input_text", text: instructions }] },
            { role: "user", content: [{ type: "input_text", text: `Article title: ${title}\nSentences:\n${numbered}` }] },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "nihongo_article_deep_coach",
              strict: true,
              schema: responseSchema,
            },
          },
          max_output_tokens: 9000,
        }),
        signal: AbortSignal.timeout(52000),
      });
      if (!response.ok) {
        lastReason = `openai_${model}_${response.status}`;
        continue;
      }
      const payload = await response.json();
      const text = outputText(payload);
      if (!text) {
        lastReason = `openai_${model}_empty`;
        continue;
      }
      const raw = JSON.parse(text);
      return { model, value: sanitizeResult(raw, title, sentences) };
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "generation_failed";
    }
  }
  throw new Error(lastReason);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  let body: { title?: unknown; sentences?: unknown; clientKey?: unknown };
  try { body = await req.json(); } catch { return json({ ok: false, reason: "bad_json" }, 400); }

  const title = clean(body.title, 180);
  const sentences = Array.isArray(body.sentences)
    ? Array.from(new Set(body.sentences.map(value => clean(value, 280)).filter(Boolean))).slice(0, MAX_SENTENCES)
    : [];
  const clientKey = clean(body.clientKey, 128).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!title || sentences.length < 1) return json({ ok: false, reason: "invalid_input" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const cacheKey = await sha256(JSON.stringify({ version: 2, title, sentences }));
  const cacheCutoff = new Date(Date.now() - CACHE_DAYS * 86400000).toISOString();
  const { data: cached } = await supabase
    .from("nihongo_coach_cache")
    .select("payload,model,updated_at")
    .eq("cache_key", cacheKey)
    .gte("updated_at", cacheCutoff)
    .maybeSingle();
  if (cached?.payload) return json({ ok: true, coach: sanitizeResult(cached.payload, title, sentences), model: cached.model, cached: true });

  const day = new Date().toISOString().slice(0, 10);
  const globalQuota = await supabase.rpc("consume_nihongo_coach_quota", {
    p_bucket: `global:${day}`,
    p_limit: 200,
    p_window_minutes: 1440,
  });
  if (globalQuota.error || globalQuota.data !== true) return json({ ok: false, reason: "daily_quota" }, 429);

  const perClientQuota = await supabase.rpc("consume_nihongo_coach_quota", {
    p_bucket: `client:${clientKey || "unknown"}`,
    p_limit: 20,
    p_window_minutes: 60,
  });
  if (perClientQuota.error || perClientQuota.data !== true) return json({ ok: false, reason: "client_quota" }, 429);

  const apiKey = await loadApiKey(supabase);
  if (!apiKey) return json({ ok: false, reason: "missing_openai_key" }, 503);

  try {
    const generated = await callOpenAI(apiKey, title, sentences);
    await supabase.from("nihongo_coach_cache").upsert({
      cache_key: cacheKey,
      payload: generated.value,
      model: generated.model,
      updated_at: new Date().toISOString(),
    });
    return json({ ok: true, coach: generated.value, model: generated.model, cached: false });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "generation_failed";
    console.error("nihongo-coach failed", reason);
    return json({ ok: false, reason }, 502);
  }
});
