import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "nihongo-audio";
const CONTRACT_VERSION = "nhk-speech-coach-v1";
const TTS_CACHE_PREFIX = "nhk-tts-v1";
const TTS_MODELS = ["gpt-4o-mini-tts-2025-12-15", "gpt-4o-mini-tts"];
const TTS_VOICE = "marin";
const TRANSCRIPTION_MODELS = ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "whisper-1"];
const FEEDBACK_MODELS = ["gpt-5.6-luna", "gpt-5-mini"];
const MAX_AUDIO_BYTES = 2_800_000;
const MAX_AUDIO_BASE64_LENGTH = 3_800_000;

type SpeechMode = "shadow" | "recap" | "world" | "recall";

type ReviewInput = {
  mode: SpeechMode;
  referenceText: string;
  summary: string;
  question: string;
  targetExpression: string;
  durationSeconds: number;
};

type Difference = {
  heard: string;
  expected: string;
  noteZh: string;
};

type Omission = {
  expected: string;
  noteZh: string;
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

const isSpeechMode = (value: string): value is SpeechMode =>
  value === "shadow" || value === "recap" || value === "world" || value === "recall";

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

const normalizeJapanese = (value: string): string => value
  .normalize("NFKC")
  .toLocaleLowerCase("ja-JP")
  .replace(/[\s\u3000、。！？!?「」『』（）()［］\[\]・…—―〜～,.，]/g, "");

const levenshtein = (left: string, right: string): number => {
  const a = Array.from(left);
  const b = Array.from(right);
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + cost,
      );
    }
    previous = current;
  }
  return previous[b.length];
};

const textAccuracy = (reference: string, transcript: string): number => {
  const expected = normalizeJapanese(reference);
  const actual = normalizeJapanese(transcript);
  if (!expected.length) return actual.length ? 0 : 100;
  const distance = levenshtein(expected, actual);
  return Math.max(0, Math.round((1 - distance / Math.max(expected.length, actual.length, 1)) * 100));
};

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

async function generateTts(apiKey: string, text: string): Promise<{ model: string; bytes: Uint8Array }> {
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
          instructions: "Read exactly the supplied Japanese once. Do not add, remove, translate, explain, repeat, or paraphrase. Use natural modern standard Japanese with clear connected speech and calm news-like phrasing.",
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
      return { model, bytes };
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "tts_generation_failed";
    }
  }
  throw new Error(lastReason);
}

async function handleTts(
  supabase: any,
  apiKey: string,
  text: string,
  clientKey: string,
): Promise<Response> {
  const cacheKey = await sha256(JSON.stringify({ version: CONTRACT_VERSION, text }));
  const path = `${TTS_CACHE_PREFIX}/${cacheKey}.mp3`;
  const { data: existing } = await supabase.storage.from(BUCKET).download(path);
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
    return json({ ok: false, reason: "daily_quota" }, 429);
  }
  if (!await consumeQuota(supabase, `speech-tts-client:${clientKey || "unknown"}`, 30, 60)) {
    return json({ ok: false, reason: "client_quota" }, 429);
  }

  try {
    const generated = await generateTts(apiKey, text);
    const { error } = await supabase.storage.from(BUCKET).upload(path, generated.bytes, {
      contentType: "audio/mpeg",
      upsert: true,
      cacheControl: "31536000",
    });
    if (error) return json({ ok: false, reason: "audio_upload_failed" }, 502);
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
    return json({ ok: false, reason }, 502);
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
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
};

async function transcribe(
  apiKey: string,
  bytes: Uint8Array,
  mimeType: string,
  prompt: string,
  deadline: number,
): Promise<{ model: string; text: string }> {
  let lastReason = "transcription_failed";
  for (const model of TRANSCRIPTION_MODELS) {
    const remaining = deadline - Date.now();
    if (remaining < 3_000) break;
    try {
      const form = new FormData();
      form.set("file", new File([bytes], `recording.${extensionFor(mimeType)}`, { type: mimeType.split(";")[0] }));
      form.set("model", model);
      form.set("language", "ja");
      form.set("response_format", "json");
      if (prompt) form.set("prompt", prompt.slice(0, 600));
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
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
      return { model, text };
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "transcription_failed";
    }
  }
  throw new Error(lastReason);
}

const feedbackSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summaryZh",
    "strengthsZh",
    "omissions",
    "substitutions",
    "particles",
    "pauseAdviceZh",
    "minimalRevisionJa",
    "naturalVersionJa",
    "characterReactionJa",
    "characterReactionZh",
    "contentScore",
    "targetExpressionUsed",
  ],
  properties: {
    summaryZh: { type: "string", minLength: 1, maxLength: 220 },
    strengthsZh: {
      type: "array",
      maxItems: 3,
      items: { type: "string", minLength: 1, maxLength: 100 },
    },
    omissions: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["expected", "noteZh"],
        properties: {
          expected: { type: "string", maxLength: 120 },
          noteZh: { type: "string", maxLength: 120 },
        },
      },
    },
    substitutions: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heard", "expected", "noteZh"],
        properties: {
          heard: { type: "string", maxLength: 100 },
          expected: { type: "string", maxLength: 100 },
          noteZh: { type: "string", maxLength: 120 },
        },
      },
    },
    particles: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heard", "expected", "noteZh"],
        properties: {
          heard: { type: "string", maxLength: 60 },
          expected: { type: "string", maxLength: 60 },
          noteZh: { type: "string", maxLength: 120 },
        },
      },
    },
    pauseAdviceZh: {
      type: "array",
      maxItems: 4,
      items: { type: "string", minLength: 1, maxLength: 140 },
    },
    minimalRevisionJa: { type: "string", maxLength: 500 },
    naturalVersionJa: { type: "string", maxLength: 500 },
    characterReactionJa: { type: "string", maxLength: 180 },
    characterReactionZh: { type: "string", maxLength: 180 },
    contentScore: { type: "integer", minimum: 0, maximum: 100 },
    targetExpressionUsed: { type: "boolean" },
  },
};

const sanitizeDifferences = (value: unknown): Difference[] => Array.isArray(value)
  ? value.map((item: any) => ({
    heard: clean(item?.heard, 100),
    expected: clean(item?.expected, 100),
    noteZh: clean(item?.noteZh, 120),
  })).filter(item => item.heard || item.expected).slice(0, 5)
  : [];

const sanitizeOmissions = (value: unknown): Omission[] => Array.isArray(value)
  ? value.map((item: any) => ({
    expected: clean(item?.expected, 120),
    noteZh: clean(item?.noteZh, 120),
  })).filter(item => item.expected).slice(0, 5)
  : [];

const sanitizeStrings = (value: unknown, maxItems: number, maxLength: number): string[] => Array.isArray(value)
  ? value.map(item => clean(item, maxLength)).filter(Boolean).slice(0, maxItems)
  : [];

const fallbackFeedback = (
  input: ReviewInput,
  transcript: string,
  accuracy: number,
): Feedback => {
  const normalizedTarget = normalizeJapanese(input.targetExpression);
  const targetUsed = Boolean(normalizedTarget && normalizeJapanese(transcript).includes(normalizedTarget));
  const contentScore = input.mode === "shadow"
    ? accuracy
    : input.mode === "recall"
      ? (targetUsed ? 82 : transcript.length >= 12 ? 52 : 30)
      : transcript.length >= 20 ? (targetUsed ? 78 : 65) : 45;
  return {
    summaryZh: transcript
      ? "已完成转写。先对照系统听到的内容，再补最明显的遗漏。"
      : "没有识别出清楚的日语，请靠近麦克风再说一次。",
    strengthsZh: transcript ? ["已经完整说出一段日语，而不是只做选择题。"] : [],
    omissions: [],
    substitutions: [],
    particles: [],
    pauseAdviceZh: input.mode === "shadow"
      ? ["按页面给出的语块分段跟读，再逐步连接。"]
      : [],
    minimalRevisionJa: transcript,
    naturalVersionJa: transcript,
    characterReactionJa: input.mode === "world"
      ? "なるほど。もう少し詳しく聞かせてください。"
      : "",
    characterReactionZh: input.mode === "world"
      ? "田中理解了你的立场，并想继续追问。"
      : "",
    contentScore,
    targetExpressionUsed: targetUsed,
  };
};

const sanitizeFeedback = (
  raw: any,
  input: ReviewInput,
  transcript: string,
  accuracy: number,
): Feedback => {
  const fallback = fallbackFeedback(input, transcript, accuracy);
  return {
    summaryZh: clean(raw?.summaryZh, 220) || fallback.summaryZh,
    strengthsZh: sanitizeStrings(raw?.strengthsZh, 3, 100),
    omissions: sanitizeOmissions(raw?.omissions),
    substitutions: sanitizeDifferences(raw?.substitutions),
    particles: sanitizeDifferences(raw?.particles),
    pauseAdviceZh: sanitizeStrings(raw?.pauseAdviceZh, 4, 140),
    minimalRevisionJa: clean(raw?.minimalRevisionJa, 500) || fallback.minimalRevisionJa,
    naturalVersionJa: clean(raw?.naturalVersionJa, 500) || fallback.naturalVersionJa,
    characterReactionJa: input.mode === "world"
      ? clean(raw?.characterReactionJa, 180) || fallback.characterReactionJa
      : "",
    characterReactionZh: input.mode === "world"
      ? clean(raw?.characterReactionZh, 180) || fallback.characterReactionZh
      : "",
    contentScore: clamp(raw?.contentScore, 0, 100, fallback.contentScore),
    targetExpressionUsed: typeof raw?.targetExpressionUsed === "boolean"
      ? raw.targetExpressionUsed
      : fallback.targetExpressionUsed,
  };
};

async function generateFeedback(
  apiKey: string,
  input: ReviewInput,
  transcript: string,
  accuracy: number,
  deadline: number,
): Promise<{ model: string; value: Feedback }> {
  const modeInstructions: Record<SpeechMode, string> = {
    shadow: "Compare the transcript against the exact reference. Identify only clear missing phrases, replacements, and particle differences. Ignore harmless punctuation and transcription variants.",
    recap: "Judge whether the learner conveyed the main facts. Do not demand verbatim reproduction. Preserve the learner's wording in the minimal revision and repair only what is necessary.",
    world: "Judge whether the answer responds to the question and naturally uses the target expression. Generate a short believable reaction from Tanaka that follows from the learner's actual stance. Do not invent private facts.",
    recall: "Compare the recalled expression against the target and focus on whether it can be actively produced in the new situation.",
  };
  const instructions = [
    "You are a precise Japanese speaking coach for a Chinese-speaking adult at roughly N3-N2 level who lives and works in Japan.",
    modeInstructions[input.mode],
    "Use concise Chinese for explanations and Japanese for revised sentences and character reaction.",
    "Never claim to have acoustically measured pitch, accent, pronunciation, exact pauses, or response latency; you only have the transcript and total duration.",
    "pauseAdviceZh may suggest natural phrase boundaries based on syntax, but must not present invented timing measurements.",
    "Report no issue when a difference may be a harmless ASR variant. Keep feedback concrete and encouraging.",
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
          reasoning: { effort: "low" },
          store: false,
          input: [
            { role: "system", content: [{ type: "input_text", text: instructions }] },
            { role: "user", content: [{ type: "input_text", text: userText }] },
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
        value: sanitizeFeedback(JSON.parse(text), input, transcript, accuracy),
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
    return json({ ok: false, reason: "invalid_audio" }, 400);
  }
  if (bytes.length < 600 || bytes.length > MAX_AUDIO_BYTES) {
    return json({ ok: false, reason: "invalid_audio_size" }, 400);
  }

  const day = new Date().toISOString().slice(0, 10);
  if (!await consumeQuota(supabase, `speech-review-global:${day}`, 250, 1440)) {
    return json({ ok: false, reason: "daily_quota" }, 429);
  }
  if (!await consumeQuota(supabase, `speech-review-client:${clientKey || "unknown"}`, 18, 60)) {
    return json({ ok: false, reason: "client_quota" }, 429);
  }

  try {
    const deadline = Date.now() + 52_000;
    const transcription = await transcribe(
      apiKey,
      bytes,
      mimeType,
      `${input.targetExpression}\n${input.referenceText}`,
      deadline,
    );
    const accuracy = input.mode === "shadow"
      ? textAccuracy(input.referenceText, transcription.text)
      : 0;

    let feedbackModel = "deterministic-fallback";
    let feedback = fallbackFeedback(input, transcription.text, accuracy);
    try {
      const generated = await generateFeedback(apiKey, input, transcription.text, accuracy, deadline);
      feedbackModel = generated.model;
      feedback = generated.value;
    } catch (error) {
      console.error(
        "nihongo speech feedback fallback",
        error instanceof Error ? error.message : "feedback_failed",
      );
    }

    const referenceLength = Math.max(1, normalizeJapanese(input.referenceText).length);
    const transcriptLength = normalizeJapanese(transcription.text).length;
    const omittedLength = feedback.omissions.reduce(
      (sum, item) => sum + normalizeJapanese(item.expected).length,
      0,
    );
    const deterministicLengthDeficit = input.mode === "shadow"
      ? Math.max(0, Math.round((referenceLength - transcriptLength) / referenceLength * 100))
      : 0;
    const omissionRate = Math.min(100, Math.max(
      deterministicLengthDeficit,
      Math.round(omittedLength / referenceLength * 100),
    ));
    const contentScore = input.mode === "shadow" ? accuracy : feedback.contentScore;
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
          contentScore,
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
    return json({ ok: false, reason }, 502);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ ok: false, reason: "method_not_allowed" }, 405);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "bad_json" }, 400);
  }

  const action = clean(body?.action, 16);
  const clientKey = clean(body?.clientKey, 128).replace(/[^a-zA-Z0-9_-]/g, "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  if (action === "health") {
    return json({ ok: true, contractVersion: CONTRACT_VERSION, audioPersisted: false });
  }

  if (action === "tts") {
    const text = clean(body?.text, 400);
    if (!text) return json({ ok: false, reason: "invalid_text" }, 400);
    const apiKey = await loadApiKey(supabase);
    if (!apiKey) return json({ ok: false, reason: "missing_openai_key" }, 503);
    return handleTts(supabase, apiKey, text, clientKey);
  }

  if (action === "review") {
    const mode = clean(body?.mode, 16);
    const audioBase64 = typeof body?.audioBase64 === "string" ? body.audioBase64.trim() : "";
    const mimeType = clean(body?.mimeType, 80).toLowerCase();
    const referenceText = clean(body?.referenceText, 2400);
    if (!isSpeechMode(mode)
      || !audioBase64
      || audioBase64.length > MAX_AUDIO_BASE64_LENGTH
      || !mimeType.startsWith("audio/")
      || !referenceText) {
      return json({ ok: false, reason: "invalid_review_input" }, 400);
    }
    const apiKey = await loadApiKey(supabase);
    if (!apiKey) return json({ ok: false, reason: "missing_openai_key" }, 503);
    return handleReview(
      supabase,
      apiKey,
      {
        mode,
        referenceText,
        summary: clean(body?.summary, 1200),
        question: clean(body?.question, 800),
        targetExpression: clean(body?.targetExpression, 400),
        durationSeconds: clamp(body?.durationSeconds, 1, 90, 1),
      },
      audioBase64,
      mimeType,
      clientKey,
    );
  }

  return json({ ok: false, reason: "invalid_action" }, 400);
});
