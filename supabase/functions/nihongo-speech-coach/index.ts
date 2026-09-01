import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "nihongo-audio";
const CONTRACT_VERSION = "nhk-speech-coach-v2";
const TTS_CACHE_PREFIX = "nhk-tts-v1";
const TTS_MODELS = ["gpt-4o-mini-tts-2025-12-15", "gpt-4o-mini-tts"];
const TTS_VOICE = "marin";
const TRANSCRIPTION_MODELS = ["gpt-transcribe", "gpt-4o-mini-transcribe", "gpt-4o-transcribe", "whisper-1"];
const FEEDBACK_MODELS = ["gpt-5.6-luna", "gpt-5-mini"];
const MAX_AUDIO_BYTES = 2_800_000;
const MAX_AUDIO_BASE64_LENGTH = 3_800_000;
const MAX_RECORDING_SECONDS = 90;
const AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
]);
const PARTICLES = new Set(["は", "が", "を", "に", "で", "と", "へ", "も", "の", "から", "まで", "より"]);
const TRANSCRIPTION_HINT = [
  "成人の日本語学習者が、ニュース、日常生活、または仕事について日本語で話しています。",
  "実際に聞こえた内容だけを自然な日本語表記で文字起こししてください。",
  "聞き取れない語を文脈から補ったり、模範文を推測したりしないでください。",
].join(" ");

type SpeechMode = "shadow" | "recap" | "world" | "recall";
type Difference = { heard: string; expected: string; noteZh: string };
type Omission = { expected: string; noteZh: string };
type ReviewInput = {
  mode: SpeechMode;
  referenceText: string;
  summary: string;
  question: string;
  targetExpression: string;
  durationSeconds: number;
};
type Feedback = {
  summaryZh: string;
  strengthsZh: string[];
  omissions: Omission[];
  substitutions: Difference[];
  particles: Difference[];
  pauseAdviceZh: string[];
  minimalRevisionJa: string;
  naturalVersionJa: string;
  characterReactionJa: string;
  characterReactionZh: string;
  contentScore: number;
  targetExpressionUsed: boolean;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  },
});

const clean = (value: unknown, max = 240): string => typeof value === "string"
  ? value.replace(/\s+/g, " ").trim().slice(0, max)
  : "";

const clamp = (value: unknown, minimum: number, maximum: number, fallback = minimum): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.max(minimum, Math.min(maximum, Math.round(numeric)))
    : fallback;
};

const normalizeMime = (value: unknown): string =>
  typeof value === "string" ? value.split(";", 1)[0].trim().toLowerCase() : "";

const isSpeechMode = (value: string): value is SpeechMode =>
  value === "shadow" || value === "recap" || value === "world" || value === "recall";

const normalizedJapanese = (value: string): string => value
  .normalize("NFKC")
  .toLocaleLowerCase("ja-JP")
  .replace(/[\s\u3000、。！？!?「」『』（）()［］\[\]・…—―〜～,.，]/g, "");

const validBase64 = (value: string): boolean => {
  const normalized = value.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  return Boolean(
    normalized
    && normalized.length <= MAX_AUDIO_BASE64_LENGTH
    && normalized.length % 4 === 0
    && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)
  );
};

async function loadApiKey(supabase: any): Promise<string> {
  const envKey = Deno.env.get("OPENAI_API_KEY");
  if (envKey?.startsWith("sk-")) return envKey;
  const { data, error } = await supabase.rpc("get_nihongo_openai_key");
  if (!error && typeof data === "string" && data.startsWith("sk-")) return data;
  return "";
}

async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

const outputText = (payload: any): string => {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
};

const consumeQuota = async (
  supabase: any,
  bucket: string,
  limit: number,
  windowMinutes: number,
): Promise<boolean> => {
  const result = await supabase.rpc("consume_nihongo_coach_quota", {
    p_bucket: bucket,
    p_limit: limit,
    p_window_minutes: windowMinutes,
  });
  return !result.error && result.data === true;
};

const publicUrl = (supabase: any, path: string): string =>
  supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

async function generateTts(apiKey: string, text: string): Promise<{model: string; bytes: Uint8Array}> {
  let lastReason = "tts_generation_failed";
  for (const model of TTS_MODELS) {
    try {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          voice: TTS_VOICE,
          input: text,
          instructions: "Read exactly the supplied Japanese once. Do not add, remove, translate, explain, repeat, or paraphrase. Use natural modern standard Japanese with clear connected speech.",
          response_format: "mp3",
          speed: 1,
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) {
        lastReason = `tts_${model}_${response.status}`;
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 1024) {
        lastReason = `tts_${model}_empty`;
        continue;
      }
      return {model, bytes};
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "tts_generation_failed";
    }
  }
  throw new Error(lastReason);
}

async function handleTts(supabase: any, apiKey: string, text: string, clientKey: string): Promise<Response> {
  const cacheKey = await sha256(JSON.stringify({version: "exact-ja-v1", text}));
  const path = `${TTS_CACHE_PREFIX}/${cacheKey}.mp3`;
  const {data: existing} = await supabase.storage.from(BUCKET).download(path);
  if (existing) {
    return json({
      ok: true,
      contractVersion: CONTRACT_VERSION,
      url: publicUrl(supabase, path),
      cached: true,
    });
  }

  const day = new Date().toISOString().slice(0, 10);
  if (!await consumeQuota(supabase, `speech-tts-global:${day}`, 150, 1440)) {
    return json({ok: false, reason: "daily_quota"}, 429);
  }
  if (!await consumeQuota(supabase, `speech-tts-client:${clientKey || "unknown"}`, 30, 60)) {
    return json({ok: false, reason: "client_quota"}, 429);
  }

  try {
    const generated = await generateTts(apiKey, text);
    const {error} = await supabase.storage.from(BUCKET).upload(path, generated.bytes, {
      contentType: "audio/mpeg",
      upsert: true,
      cacheControl: "31536000",
    });
    if (error) return json({ok: false, reason: "audio_upload_failed"}, 502);
    return json({
      ok: true,
      contractVersion: CONTRACT_VERSION,
      url: publicUrl(supabase, path),
      cached: false,
      model: generated.model,
      voice: TTS_VOICE,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "tts_generation_failed";
    console.error("nihongo speech tts failed", reason);
    return json({ok: false, reason}, 502);
  }
}

const decodeBase64 = (value: string): Uint8Array => {
  const normalized = value.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const extensionFor = (mimeType: string): string => {
  if (mimeType === "audio/mp4") return "m4a";
  if (mimeType === "audio/ogg") return "ogg";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") return "wav";
  return "webm";
};

async function transcribe(
  apiKey: string,
  bytes: Uint8Array,
  mimeType: string,
  deadline: number,
): Promise<{model: string; text: string}> {
  let lastReason = "transcription_failed";
  for (const model of TRANSCRIPTION_MODELS) {
    const remaining = deadline - Date.now();
    if (remaining < 3_000) break;
    try {
      const form = new FormData();
      form.set("file", new File([bytes], `recording.${extensionFor(mimeType)}`, {type: mimeType}));
      form.set("model", model);
      form.set("language", "ja");
      form.set("response_format", "json");
      form.set("prompt", TRANSCRIPTION_HINT);
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {Authorization: `Bearer ${apiKey}`},
        body: form,
        signal: AbortSignal.timeout(Math.min(22_000, remaining)),
      });
      if (!response.ok) {
        lastReason = `transcription_${model}_${response.status}`;
        continue;
      }
      const payload = await response.json();
      const text = clean(payload?.text, 2400);
      if (!text) {
        lastReason = `transcription_${model}_empty`;
        continue;
      }
      return {model, text};
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "transcription_failed";
    }
  }
  throw new Error(lastReason);
}

type EditOperation =
  | {type: "match"; expected: string; heard: string}
  | {type: "delete"; expected: string; heard: ""}
  | {type: "insert"; expected: ""; heard: string}
  | {type: "replace"; expected: string; heard: string};

const editOperations = (reference: string, transcript: string): EditOperation[] => {
  const expected = Array.from(normalizedJapanese(reference));
  const heard = Array.from(normalizedJapanese(transcript));
  const rows = expected.length + 1;
  const columns = heard.length + 1;
  const matrix = Array.from({length: rows}, () => Array<number>(columns).fill(0));
  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let column = 0; column < columns; column += 1) matrix[0][column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = expected[row - 1] === heard[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      );
    }
  }

  const operations: EditOperation[] = [];
  let row = expected.length;
  let column = heard.length;
  while (row > 0 || column > 0) {
    if (row > 0 && column > 0 && expected[row - 1] === heard[column - 1]) {
      operations.push({type: "match", expected: expected[row - 1], heard: heard[column - 1]});
      row -= 1;
      column -= 1;
      continue;
    }
    if (row > 0 && column > 0 && matrix[row][column] === matrix[row - 1][column - 1] + 1) {
      operations.push({type: "replace", expected: expected[row - 1], heard: heard[column - 1]});
      row -= 1;
      column -= 1;
      continue;
    }
    if (row > 0 && matrix[row][column] === matrix[row - 1][column] + 1) {
      operations.push({type: "delete", expected: expected[row - 1], heard: ""});
      row -= 1;
      continue;
    }
    operations.push({type: "insert", expected: "", heard: heard[column - 1] || ""});
    column -= 1;
  }
  return operations.reverse();
};

const deterministicDifferences = (reference: string, transcript: string) => {
  const operations = editOperations(reference, transcript);
  const omissions: Omission[] = [];
  const substitutions: Difference[] = [];
  const particles: Difference[] = [];
  let deleted = "";
  let inserted = "";

  const flush = () => {
    if (!deleted && !inserted) return;
    if (deleted && !inserted) {
      omissions.push({expected: deleted, noteZh: "转写中没有出现这一段。"});
    } else if (deleted || inserted) {
      const difference = {
        heard: inserted,
        expected: deleted,
        noteZh: "先确认这一处是否是漏听、替换或助词变化。",
      };
      if (PARTICLES.has(deleted) || PARTICLES.has(inserted)) particles.push(difference);
      else substitutions.push(difference);
    }
    deleted = "";
    inserted = "";
  };

  for (const operation of operations) {
    if (operation.type === "match") {
      flush();
    } else if (operation.type === "delete") {
      deleted += operation.expected;
    } else if (operation.type === "insert") {
      inserted += operation.heard;
    } else {
      deleted += operation.expected;
      inserted += operation.heard;
    }
  }
  flush();

  return {
    omissions: omissions.slice(0, 5),
    substitutions: substitutions.slice(0, 5),
    particles: particles.slice(0, 5),
  };
};

const textAccuracy = (reference: string, transcript: string): number => {
  const operations = editOperations(reference, transcript);
  const edits = operations.filter(operation => operation.type !== "match").length;
  const length = Math.max(normalizedJapanese(reference).length, normalizedJapanese(transcript).length, 1);
  return Math.max(0, Math.round((1 - edits / length) * 100));
};

const feedbackSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summaryZh", "strengthsZh", "omissions", "substitutions", "particles",
    "pauseAdviceZh", "minimalRevisionJa", "naturalVersionJa",
    "characterReactionJa", "characterReactionZh", "contentScore", "targetExpressionUsed",
  ],
  properties: {
    summaryZh: {type: "string", minLength: 1, maxLength: 220},
    strengthsZh: {type: "array", maxItems: 3, items: {type: "string", minLength: 1, maxLength: 100}},
    omissions: {
      type: "array", maxItems: 5,
      items: {
        type: "object", additionalProperties: false, required: ["expected", "noteZh"],
        properties: {
          expected: {type: "string", maxLength: 120},
          noteZh: {type: "string", maxLength: 120},
        },
      },
    },
    substitutions: {
      type: "array", maxItems: 5,
      items: {
        type: "object", additionalProperties: false, required: ["heard", "expected", "noteZh"],
        properties: {
          heard: {type: "string", maxLength: 100},
          expected: {type: "string", maxLength: 100},
          noteZh: {type: "string", maxLength: 120},
        },
      },
    },
    particles: {
      type: "array", maxItems: 5,
      items: {
        type: "object", additionalProperties: false, required: ["heard", "expected", "noteZh"],
        properties: {
          heard: {type: "string", maxLength: 60},
          expected: {type: "string", maxLength: 60},
          noteZh: {type: "string", maxLength: 120},
        },
      },
    },
    pauseAdviceZh: {type: "array", maxItems: 4, items: {type: "string", minLength: 1, maxLength: 140}},
    minimalRevisionJa: {type: "string", maxLength: 500},
    naturalVersionJa: {type: "string", maxLength: 500},
    characterReactionJa: {type: "string", maxLength: 180},
    characterReactionZh: {type: "string", maxLength: 180},
    contentScore: {type: "integer", minimum: 0, maximum: 100},
    targetExpressionUsed: {type: "boolean"},
  },
};

const strings = (value: unknown, maxItems: number, maxLength: number): string[] => Array.isArray(value)
  ? value.map(item => clean(item, maxLength)).filter(Boolean).slice(0, maxItems)
  : [];

const groundedOmissions = (value: unknown, reference: string): Omission[] => {
  const normalizedReference = normalizedJapanese(reference);
  if (!Array.isArray(value)) return [];
  return value.map((item: any) => ({
    expected: clean(item?.expected, 120),
    noteZh: clean(item?.noteZh, 120),
  })).filter(item => item.expected && normalizedReference.includes(normalizedJapanese(item.expected))).slice(0, 5);
};

const groundedDifferences = (
  value: unknown,
  reference: string,
  transcript: string,
  particleOnly = false,
): Difference[] => {
  if (!Array.isArray(value)) return [];
  const normalizedReference = normalizedJapanese(reference);
  const normalizedTranscript = normalizedJapanese(transcript);
  return value.map((item: any) => ({
    heard: clean(item?.heard, 100),
    expected: clean(item?.expected, 100),
    noteZh: clean(item?.noteZh, 120),
  })).filter(item => {
    if (!item.heard && !item.expected) return false;
    if (item.expected && !normalizedReference.includes(normalizedJapanese(item.expected))) return false;
    if (item.heard && !normalizedTranscript.includes(normalizedJapanese(item.heard))) return false;
    return !particleOnly || PARTICLES.has(item.expected) || PARTICLES.has(item.heard);
  }).slice(0, 5);
};

const targetUsed = (target: string, transcript: string): boolean => {
  const normalizedTarget = normalizedJapanese(target);
  return Boolean(normalizedTarget && normalizedJapanese(transcript).includes(normalizedTarget));
};

const fallbackFeedback = (
  input: ReviewInput,
  transcript: string,
  accuracy: number,
  deterministic: ReturnType<typeof deterministicDifferences>,
): Feedback => {
  const exactMode = input.mode === "shadow" || input.mode === "recall";
  const used = targetUsed(input.targetExpression, transcript);
  const contentScore = exactMode
    ? accuracy
    : transcript.length >= 20 ? (used ? 78 : 65) : transcript.length >= 8 ? 50 : 30;
  const issueCount = deterministic.omissions.length + deterministic.substitutions.length + deterministic.particles.length;
  return {
    summaryZh: transcript
      ? issueCount
        ? "已完成转写。先修正下面最明确的文本差异，再录一次。"
        : "已完成转写，暂未发现明确的文本差异。"
      : "没有识别出清楚的日语，请靠近麦克风再说一次。",
    strengthsZh: transcript ? ["你已经用声音完成了主动输出，而不是只做选择题。"] : [],
    omissions: exactMode ? deterministic.omissions : [],
    substitutions: exactMode ? deterministic.substitutions : [],
    particles: exactMode ? deterministic.particles : [],
    pauseAdviceZh: input.mode === "shadow" ? ["按页面语块分段说清，再逐步连接成整句。"] : [],
    minimalRevisionJa: transcript,
    naturalVersionJa: transcript,
    characterReactionJa: input.mode === "world" ? "なるほど。理由もよく分かりました。" : "",
    characterReactionZh: input.mode === "world" ? "田中理解了你的立场，并记住了这次回答。" : "",
    contentScore,
    targetExpressionUsed: used,
  };
};

const sanitizeFeedback = (
  raw: any,
  input: ReviewInput,
  transcript: string,
  accuracy: number,
  deterministic: ReturnType<typeof deterministicDifferences>,
): Feedback => {
  const fallback = fallbackFeedback(input, transcript, accuracy, deterministic);
  const exactMode = input.mode === "shadow" || input.mode === "recall";
  const omissions = groundedOmissions(raw?.omissions, input.referenceText);
  const substitutions = groundedDifferences(raw?.substitutions, input.referenceText, transcript);
  const particles = groundedDifferences(raw?.particles, input.referenceText, transcript, true);
  return {
    summaryZh: clean(raw?.summaryZh, 220) || fallback.summaryZh,
    strengthsZh: strings(raw?.strengthsZh, 3, 100),
    omissions: exactMode ? (omissions.length ? omissions : fallback.omissions) : omissions,
    substitutions: exactMode ? (substitutions.length ? substitutions : fallback.substitutions) : substitutions,
    particles: exactMode ? (particles.length ? particles : fallback.particles) : particles,
    pauseAdviceZh: strings(raw?.pauseAdviceZh, 4, 140),
    minimalRevisionJa: clean(raw?.minimalRevisionJa, 500) || fallback.minimalRevisionJa,
    naturalVersionJa: clean(raw?.naturalVersionJa, 500) || fallback.naturalVersionJa,
    characterReactionJa: input.mode === "world"
      ? clean(raw?.characterReactionJa, 180) || fallback.characterReactionJa
      : "",
    characterReactionZh: input.mode === "world"
      ? clean(raw?.characterReactionZh, 180) || fallback.characterReactionZh
      : "",
    contentScore: clamp(raw?.contentScore, 0, 100, fallback.contentScore),
    targetExpressionUsed: targetUsed(input.targetExpression, transcript),
  };
};

async function generateFeedback(
  apiKey: string,
  input: ReviewInput,
  transcript: string,
  accuracy: number,
  deterministic: ReturnType<typeof deterministicDifferences>,
  deadline: number,
): Promise<{model: string; value: Feedback}> {
  const modeInstructions: Record<SpeechMode, string> = {
    shadow: "Compare the transcript with the exact reference. Report only grounded omissions, substitutions, and particle differences.",
    recap: "Judge whether the learner conveyed the main facts. Preserve the learner's wording in the minimal revision and change only what is necessary.",
    world: "Judge whether the answer responds to the question and uses the target expression naturally. Generate a short believable reaction from Tanaka based only on the learner's actual stance.",
    recall: "Judge active recall in the new situation. Compare against the reference without demanding harmless punctuation differences.",
  };
  const instructions = [
    "You are a precise Japanese speaking coach for a Chinese-speaking adult at roughly N3-N2 level who lives and works in Japan.",
    modeInstructions[input.mode],
    "Use concise Chinese for explanations and Japanese for revised sentences and character reaction.",
    "Never claim to have acoustically measured pitch, accent, pronunciation, exact pause timestamps, or response latency.",
    "The transcript was produced without seeing the reference. Treat harmless ASR variants conservatively.",
    "Every reported expected phrase must occur in the reference. Every reported heard phrase must occur in the transcript.",
    "If the learner's sentence is already natural, the minimal revision may be identical.",
  ].join(" ");
  const userText = [
    `Mode: ${input.mode}`,
    `Reference or target text: ${input.referenceText}`,
    `News summary: ${input.summary || "(none)"}`,
    `Question: ${input.question || "(none)"}`,
    `Target expression: ${input.targetExpression || "(none)"}`,
    `Transcript: ${transcript}`,
    `Recording duration: ${input.durationSeconds} seconds`,
    `Deterministic text similarity for exact-text modes: ${accuracy}%`,
  ].join("\n");

  let lastReason = "feedback_failed";
  for (const model of FEEDBACK_MODELS) {
    const remaining = deadline - Date.now();
    if (remaining < 3_000) break;
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          reasoning: {effort: "low"},
          store: false,
          input: [
            {role: "system", content: [{type: "input_text", text: instructions}]},
            {role: "user", content: [{type: "input_text", text: userText}]},
          ],
          text: {
            format: {
              type: "json_schema",
              name: "nihongo_speech_review",
              strict: true,
              schema: feedbackSchema,
            },
          },
          max_output_tokens: 1800,
        }),
        signal: AbortSignal.timeout(Math.min(20_000, remaining)),
      });
      if (!response.ok) {
        lastReason = `feedback_${model}_${response.status}`;
        continue;
      }
      const payload = await response.json();
      const text = outputText(payload);
      if (!text) {
        lastReason = `feedback_${model}_empty`;
        continue;
      }
      return {
        model,
        value: sanitizeFeedback(JSON.parse(text), input, transcript, accuracy, deterministic),
      };
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "feedback_failed";
    }
  }
  throw new Error(lastReason);
}

async function handleReview(
  supabase: any,
  apiKey: string,
  input: ReviewInput,
  audioBase64: string,
  mimeType: string,
  clientKey: string,
): Promise<Response> {
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(audioBase64);
  } catch {
    return json({ok: false, reason: "invalid_audio"}, 400);
  }
  if (bytes.length < 600 || bytes.length > MAX_AUDIO_BYTES) {
    return json({ok: false, reason: "invalid_audio_size"}, 400);
  }

  const day = new Date().toISOString().slice(0, 10);
  if (!await consumeQuota(supabase, `speech-review-global:${day}`, 250, 1440)) {
    return json({ok: false, reason: "daily_quota"}, 429);
  }
  if (!await consumeQuota(supabase, `speech-review-client:${clientKey || "unknown"}`, 18, 60)) {
    return json({ok: false, reason: "client_quota"}, 429);
  }

  try {
    const deadline = Date.now() + 52_000;
    const transcription = await transcribe(apiKey, bytes, mimeType, deadline);
    const exactMode = input.mode === "shadow" || input.mode === "recall";
    const deterministic = deterministicDifferences(input.referenceText, transcription.text);
    const accuracy = exactMode ? textAccuracy(input.referenceText, transcription.text) : 0;

    let feedbackModel = "deterministic-fallback";
    let feedback = fallbackFeedback(input, transcription.text, accuracy, deterministic);
    try {
      const generated = await generateFeedback(
        apiKey,
        input,
        transcription.text,
        accuracy,
        deterministic,
        deadline,
      );
      feedbackModel = generated.model;
      feedback = generated.value;
    } catch (error) {
      console.error(
        "nihongo speech feedback fallback",
        error instanceof Error ? error.message : "feedback_failed",
      );
    }

    const referenceLength = Math.max(1, normalizedJapanese(input.referenceText).length);
    const omittedLength = feedback.omissions.reduce(
      (sum, item) => sum + normalizedJapanese(item.expected).length,
      0,
    );
    const omissionRate = exactMode
      ? Math.min(100, Math.round(omittedLength / referenceLength * 100))
      : 0;
    const transcriptLength = normalizedJapanese(transcription.text).length;
    const audioHash = await sha256(bytes);
    const reviewId = await sha256(`${audioHash}:${input.mode}:${CONTRACT_VERSION}`);

    return json({
      ok: true,
      contractVersion: CONTRACT_VERSION,
      audioPersisted: false,
      review: {
        id: reviewId.slice(0, 32),
        mode: input.mode,
        transcript: transcription.text,
        summaryZh: feedback.summaryZh,
        strengthsZh: feedback.strengthsZh,
        omissions: feedback.omissions,
        substitutions: feedback.substitutions,
        particles: feedback.particles,
        pauseAdviceZh: feedback.pauseAdviceZh,
        minimalRevisionJa: feedback.minimalRevisionJa,
        naturalVersionJa: feedback.naturalVersionJa,
        characterReactionJa: feedback.characterReactionJa,
        characterReactionZh: feedback.characterReactionZh,
        metrics: {
          textAccuracy: accuracy,
          contentScore: exactMode ? accuracy : feedback.contentScore,
          omissionRate,
          substitutionCount: feedback.substitutions.length,
          particleIssueCount: feedback.particles.length,
          targetExpressionUsed: feedback.targetExpressionUsed,
          charactersPerSecond: Number((transcriptLength / Math.max(1, input.durationSeconds)).toFixed(2)),
        },
        analyzedAt: Date.now(),
        transcriptionModel: transcription.model,
        feedbackModel,
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "review_failed";
    console.error("nihongo speech review failed", reason);
    return json({ok: false, reason}, 502);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ok: false, reason: "method_not_allowed"}, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ok: false, reason: "bad_json"}, 400);
  }

  const action = clean(body?.action, 16);
  if (action === "health") {
    return json({
      ok: true,
      contractVersion: CONTRACT_VERSION,
      audioPersisted: false,
      maxRecordingSeconds: MAX_RECORDING_SECONDS,
    });
  }

  const clientKey = clean(body?.clientKey, 64).replace(/[^a-f0-9]/g, "");
  if (clientKey.length !== 48) return json({ok: false, reason: "invalid_client"}, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {auth: {persistSession: false, autoRefreshToken: false}},
  );

  if (action === "tts") {
    const text = clean(body?.text, 400);
    if (!text) return json({ok: false, reason: "invalid_text"}, 400);
    const apiKey = await loadApiKey(supabase);
    if (!apiKey) return json({ok: false, reason: "missing_openai_key"}, 503);
    return handleTts(supabase, apiKey, text, clientKey);
  }

  if (action === "review") {
    const mode = clean(body?.mode, 16);
    const audioBase64 = typeof body?.audioBase64 === "string" ? body.audioBase64.trim() : "";
    const mimeType = normalizeMime(body?.mimeType);
    const referenceText = clean(body?.referenceText, 2400);
    const durationSeconds = Number(body?.durationSeconds);
    if (!isSpeechMode(mode)
      || !validBase64(audioBase64)
      || !AUDIO_MIME_TYPES.has(mimeType)
      || !referenceText
      || !Number.isFinite(durationSeconds)
      || durationSeconds < 1
      || durationSeconds > MAX_RECORDING_SECONDS) {
      return json({ok: false, reason: "invalid_review_input"}, 400);
    }

    const apiKey = await loadApiKey(supabase);
    if (!apiKey) return json({ok: false, reason: "missing_openai_key"}, 503);
    return handleReview(
      supabase,
      apiKey,
      {
        mode,
        referenceText,
        summary: clean(body?.summary, 1200),
        question: clean(body?.question, 800),
        targetExpression: clean(body?.targetExpression, 400),
        durationSeconds: clamp(durationSeconds, 1, MAX_RECORDING_SECONDS, 1),
      },
      audioBase64,
      mimeType,
      clientKey,
    );
  }

  return json({ok: false, reason: "invalid_action"}, 400);
});
