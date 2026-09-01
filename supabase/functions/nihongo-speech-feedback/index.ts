import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TRANSCRIPTION_MODEL = "gpt-transcribe";
const FEEDBACK_MODELS = ["gpt-5.6-luna", "gpt-5-mini"];
const MAX_AUDIO_BASE64_LENGTH = 2_000_000;
const MAX_AUDIO_BYTES = 1_500_000;
const MAX_DURATION_SECONDS = 60;
const MIME_EXTENSIONS = new Map([
  ["audio/webm", "webm"],
  ["audio/ogg", "ogg"],
  ["audio/mp4", "mp4"],
  ["audio/mpeg", "mp3"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/aac", "aac"],
  ["audio/flac", "flac"],
]);
const PARTICLES = new Set(["は", "が", "を", "に", "で", "と", "も", "へ", "の"]);

type SpeechMode = "shadow" | "recap";
type Substitution = { expected: string; heard: string };
type ParticleIssue = { expected: string; heard: string; context: string };

type ShadowDiff = {
  omissions: string[];
  substitutions: Substitution[];
  particleIssues: ParticleIssue[];
  retryTip: string;
  accuracyPercent: number;
};

type ShadowFeedback = ShadowDiff & {
  version: 1;
  mode: "shadow";
  expectedText: string;
  transcript: string;
  durationSeconds: number;
  usedFallback: boolean;
};

type RecapFeedback = {
  version: 1;
  mode: "recap";
  expectedText: string;
  transcript: string;
  durationSeconds: number;
  usedFallback: boolean;
  minimalRevision: string;
  naturalJapanese: string;
  missingFacts: string[];
  linkageFeedback: string;
  naturalnessFeedback: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  },
});

// Keep this loader aligned with nihongo-coach: the key stays server-side and can
// come from either the Edge secret or the existing protected RPC.
async function loadApiKey(supabase: any): Promise<string> {
  const envKey = Deno.env.get("OPENAI_API_KEY");
  if (envKey?.startsWith("sk-")) return envKey;
  const { data, error } = await supabase.rpc("get_nihongo_openai_key");
  if (!error && typeof data === "string" && data.startsWith("sk-")) return data;
  return "";
}

const clean = (value: unknown, max = 240): string => typeof value === "string"
  ? value.replace(/\s+/g, " ").trim().slice(0, max)
  : "";

const UNSUPPORTED_SPEECH_MEASUREMENT = /(?:发音|発音|pronunciation).{0,24}(?:分数|评分|点|%|score)|(?:停顿|間|pause).{0,16}\d+(?:\.\d+)?\s*(?:秒|ms|毫秒)|(?:延迟|latency).{0,16}\d+/iu;

const safeCoachingText = (value: unknown, max: number, fallback: string): string => {
  const candidate = clean(value, max);
  return candidate && !UNSUPPORTED_SPEECH_MEASUREMENT.test(candidate) ? candidate : fallback;
};

const boundedTextList = (value: unknown, maxItems: number, maxLength: number): string[] => Array.isArray(value)
  ? value.map(item => clean(item, maxLength)).filter(Boolean).slice(0, maxItems)
  : [];

const decodedByteLength = (value: string): number => {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return value.length / 4 * 3 - padding;
};

const validBase64 = (value: string): boolean => value.length > 0
  && value.length <= MAX_AUDIO_BASE64_LENGTH
  && value.length % 4 === 0
  && /^[A-Za-z0-9+/]+={0,2}$/.test(value)
  && decodedByteLength(value) > 0
  && decodedByteLength(value) <= MAX_AUDIO_BYTES;

const decodeBase64 = (value: string): Uint8Array => {
  const decoded = atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
};

const normalizeForDiff = (value: string): string => value
  .normalize("NFKC")
  .replace(/[\s、。！？!?「」『』（）()［］\[\]・…—―.,:;：；]/g, "")
  .slice(0, 320);

type DiffOperation = { kind: "equal" | "delete" | "insert"; value: string };

function diffCharacters(expectedValue: string, heardValue: string): DiffOperation[] {
  const expected = Array.from(normalizeForDiff(expectedValue));
  const heard = Array.from(normalizeForDiff(heardValue));
  const matrix = Array.from({ length: expected.length + 1 }, () => new Uint16Array(heard.length + 1));
  for (let left = expected.length - 1; left >= 0; left -= 1) {
    for (let right = heard.length - 1; right >= 0; right -= 1) {
      matrix[left][right] = expected[left] === heard[right]
        ? matrix[left + 1][right + 1] + 1
        : Math.max(matrix[left + 1][right], matrix[left][right + 1]);
    }
  }

  const operations: DiffOperation[] = [];
  let left = 0;
  let right = 0;
  while (left < expected.length && right < heard.length) {
    if (expected[left] === heard[right]) {
      operations.push({ kind: "equal", value: expected[left] });
      left += 1;
      right += 1;
    } else if (matrix[left + 1][right] >= matrix[left][right + 1]) {
      operations.push({ kind: "delete", value: expected[left++] });
    } else {
      operations.push({ kind: "insert", value: heard[right++] });
    }
  }
  while (left < expected.length) operations.push({ kind: "delete", value: expected[left++] });
  while (right < heard.length) operations.push({ kind: "insert", value: heard[right++] });
  return operations;
}

const contextFor = (expected: string, value: string): string => {
  const source = normalizeForDiff(expected);
  const index = source.indexOf(value);
  return index < 0 ? value : source.slice(Math.max(0, index - 8), Math.min(source.length, index + value.length + 8));
};

function deterministicShadowDiff(expected: string, transcript: string): ShadowDiff {
  const operations = diffCharacters(expected, transcript);
  const omissions: string[] = [];
  const substitutions: Substitution[] = [];
  const particleIssues: ParticleIssue[] = [];
  let matches = 0;
  let expectedRun = "";
  let heardRun = "";

  const flush = () => {
    if (expectedRun && heardRun) substitutions.push({ expected: expectedRun, heard: heardRun });
    else if (expectedRun) omissions.push(expectedRun);
    const expectedParticles = Array.from(expectedRun).filter(value => PARTICLES.has(value));
    const heardParticles = Array.from(heardRun).filter(value => PARTICLES.has(value));
    const count = Math.max(expectedParticles.length, heardParticles.length);
    for (let index = 0; index < count; index += 1) {
      const expectedParticle = expectedParticles[index] || "（なし）";
      const heardParticle = heardParticles[index] || "（省略）";
      if (expectedParticle === heardParticle) continue;
      particleIssues.push({
        expected: expectedParticle,
        heard: heardParticle,
        context: contextFor(expected, expectedRun || expectedParticle),
      });
    }
    expectedRun = "";
    heardRun = "";
  };

  for (const operation of operations) {
    if (operation.kind === "equal") {
      flush();
      matches += 1;
    } else if (operation.kind === "delete") expectedRun += operation.value;
    else heardRun += operation.value;
  }
  flush();

  const boundedOmissions = omissions.filter(Boolean).slice(0, 8);
  const boundedSubstitutions = substitutions.filter(item => item.expected || item.heard).slice(0, 8);
  const boundedParticles = particleIssues.slice(0, 8);
  const expectedLength = Array.from(normalizeForDiff(expected)).length;
  const retryTip = boundedParticles.length
    ? `先把助词「${boundedParticles[0].expected}」连同前后词一起慢读，再恢复原速。`
    : boundedOmissions.length
      ? `先单独补回「${boundedOmissions[0]}」，再从前一个停顿处整句重说。`
      : boundedSubstitutions.length
        ? `对照「${boundedSubstitutions[0].expected} → ${boundedSubstitutions[0].heard}」，先慢速确认再重试。`
        : "内容已基本对齐；下一次把切分处连起来，保持自然语流。";
  return {
    omissions: boundedOmissions,
    substitutions: boundedSubstitutions,
    particleIssues: boundedParticles,
    retryTip,
    accuracyPercent: expectedLength ? Math.round(matches / expectedLength * 100) : 0,
  };
}

const groundedList = (value: unknown, source: string, fallback: string[]): string[] => {
  if (!Array.isArray(value)) return fallback;
  const normalizedSource = normalizeForDiff(source);
  return boundedTextList(value, 8, 160)
    .filter(item => {
      const normalized = normalizeForDiff(item);
      return normalized.length > 0 && normalizedSource.includes(normalized.slice(0, Math.min(6, normalized.length)));
    });
};

function uniqueBy<T>(values: T[], keyFor: (value: T) => string, maxItems: number): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const value of values) {
    const key = keyFor(value);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
    if (output.length >= maxItems) break;
  }
  return output;
}

function shadowFeedbackFrom(raw: any, transcript: string, expected: string, durationSeconds: number): ShadowFeedback {
  const deterministic = deterministicShadowDiff(expected, transcript);
  const omissions = Array.from(new Set([
    ...groundedList(raw?.omissions, expected, []),
    ...deterministic.omissions,
  ])).slice(0, 8);
  const generatedSubstitutions = Array.isArray(raw?.substitutions)
    ? raw.substitutions.map((item: any) => ({
      expected: clean(item?.expected, 120),
      heard: clean(item?.heard, 120),
    })).filter((item: Substitution) => item.expected && item.heard
      && normalizeForDiff(expected).includes(normalizeForDiff(item.expected))
      && normalizeForDiff(transcript).includes(normalizeForDiff(item.heard))).slice(0, 8)
    : [];
  const substitutions = uniqueBy(
    [...generatedSubstitutions, ...deterministic.substitutions],
    item => `${item.expected}\u0000${item.heard}`,
    8,
  );
  const generatedParticleIssues = Array.isArray(raw?.particleIssues)
    ? raw.particleIssues.map((item: any) => ({
      expected: clean(item?.expected, 24),
      heard: clean(item?.heard, 24),
      context: contextFor(expected, clean(item?.expected, 24)),
    })).filter((item: ParticleIssue) => (PARTICLES.has(item.expected) || item.expected === "（なし）")
      && (PARTICLES.has(item.heard) || item.heard === "（省略）")).slice(0, 8)
    : [];
  const particleIssues = uniqueBy(
    [...generatedParticleIssues, ...deterministic.particleIssues],
    item => `${item.expected}\u0000${item.heard}\u0000${item.context}`,
    8,
  );
  return {
    version: 1,
    mode: "shadow",
    expectedText: expected,
    transcript,
    durationSeconds,
    usedFallback: false,
    omissions,
    substitutions,
    particleIssues,
    retryTip: safeCoachingText(raw?.retryTip, 240, deterministic.retryTip),
    accuracyPercent: deterministic.accuracyPercent,
  };
}

function fallbackShadowFeedback(transcript: string, expected: string, durationSeconds: number): ShadowFeedback {
  return {
    version: 1,
    mode: "shadow",
    expectedText: expected,
    transcript,
    durationSeconds,
    usedFallback: true,
    ...deterministicShadowDiff(expected, transcript),
  };
}

const relatedToTranscript = (candidate: string, transcript: string, minimum = 0.35): boolean => {
  const candidateCharacters = Array.from(new Set(Array.from(normalizeForDiff(candidate))));
  const transcriptCharacters = new Set(Array.from(normalizeForDiff(transcript)));
  if (!candidateCharacters.length || !transcriptCharacters.size) return false;
  const shared = candidateCharacters.filter(value => transcriptCharacters.has(value)).length;
  return shared / candidateCharacters.length >= minimum;
};

function recapFeedbackFrom(
  raw: any,
  transcript: string,
  expected: string,
  context: string,
  durationSeconds: number,
): RecapFeedback {
  const maxRevisionLength = Math.min(900, Math.max(120, transcript.length * 2 + 80));
  const minimalRevision = clean(raw?.minimalRevision, maxRevisionLength);
  const naturalJapanese = clean(raw?.naturalJapanese, 900);
  return {
    version: 1,
    mode: "recap",
    expectedText: expected,
    transcript,
    durationSeconds,
    usedFallback: false,
    minimalRevision: relatedToTranscript(minimalRevision, transcript) ? minimalRevision : transcript,
    naturalJapanese: relatedToTranscript(naturalJapanese, transcript, 0.25) ? naturalJapanese : transcript,
    missingFacts: groundedList(raw?.missingFacts, context, []),
    linkageFeedback: safeCoachingText(
      raw?.linkageFeedback,
      280,
      "先用一个连接表达把原因和结果连起来。",
    ),
    naturalnessFeedback: safeCoachingText(
      raw?.naturalnessFeedback,
      280,
      "保留你实际说出的内容，再逐处做小幅修正。",
    ),
  };
}

function fallbackRecapFeedback(
  transcript: string,
  expected: string,
  context: string,
  durationSeconds: number,
): RecapFeedback {
  const diff = deterministicShadowDiff(expected, transcript);
  const hasLinkage = /(そのため|一方|また|そして|ので|から|けれど|ですが)/.test(transcript);
  return {
    version: 1,
    mode: "recap",
    expectedText: expected,
    transcript,
    durationSeconds,
    usedFallback: true,
    minimalRevision: transcript,
    naturalJapanese: transcript,
    missingFacts: diff.omissions.filter(item => normalizeForDiff(context).includes(normalizeForDiff(item))).slice(0, 6),
    linkageFeedback: hasLinkage
      ? "连接表达已经出现；下一次让前后两句的因果或对比更明确。"
      : "可以加「そのため」「一方で」等一个连接表达，让信息关系更清楚。",
    naturalnessFeedback: "已保留实际转写；反馈生成暂时不可用，请先按缺失信息补说一次。",
  };
}

const shadowSchema = {
  type: "object",
  additionalProperties: false,
  required: ["omissions", "substitutions", "particleIssues", "retryTip"],
  properties: {
    omissions: { type: "array", maxItems: 8, items: { type: "string", maxLength: 120 } },
    substitutions: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["expected", "heard"],
        properties: {
          expected: { type: "string", maxLength: 120 },
          heard: { type: "string", maxLength: 120 },
        },
      },
    },
    particleIssues: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["expected", "heard", "context"],
        properties: {
          expected: { type: "string", maxLength: 24 },
          heard: { type: "string", maxLength: 24 },
          context: { type: "string", maxLength: 120 },
        },
      },
    },
    retryTip: { type: "string", minLength: 1, maxLength: 240 },
  },
};

const recapSchema = {
  type: "object",
  additionalProperties: false,
  required: ["minimalRevision", "naturalJapanese", "missingFacts", "linkageFeedback", "naturalnessFeedback"],
  properties: {
    minimalRevision: { type: "string", minLength: 1, maxLength: 900 },
    naturalJapanese: { type: "string", minLength: 1, maxLength: 900 },
    missingFacts: { type: "array", maxItems: 8, items: { type: "string", maxLength: 160 } },
    linkageFeedback: { type: "string", minLength: 1, maxLength: 280 },
    naturalnessFeedback: { type: "string", minLength: 1, maxLength: 280 },
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

async function transcribe(apiKey: string, bytes: Uint8Array, mimeType: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimeType }), `recording.${MIME_EXTENSIONS.get(mimeType)}`);
  form.append("model", TRANSCRIPTION_MODEL);
  form.append("language", "ja");
  form.append("response_format", "json");
  form.append(
    "prompt",
    "日本語のニュースについて話す成人学習者の音声です。聞こえた内容だけを自然な日本語表記で文字起こしし、不明な語を推測で補わないでください。",
  );
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error("transcription_failed");
  const payload = await response.json();
  const transcript = clean(payload?.text, 900);
  if (!transcript) throw new Error("empty_transcript");
  return transcript;
}

async function generateFeedback(
  apiKey: string,
  mode: SpeechMode,
  transcript: string,
  expectedText: string,
  contextText: string,
): Promise<{ model: string; raw: any }> {
  const instructions = mode === "shadow"
    ? [
      "You are a Japanese shadowing coach for a Chinese-speaking adult.",
      "Compare the completed-audio transcript with the exact source sentence.",
      "List concrete missing spans, concrete source-to-heard substitutions, and particle issues only when grounded in those two strings.",
      "Give exactly one concise retry tip. Do not claim an acoustic pronunciation score, pause timestamp, or latency measurement.",
      "The transcript may contain recognition errors, so phrase feedback as text comparison rather than certainty about pronunciation.",
      "Use concise Chinese for the retry tip and explanations embedded in context.",
    ].join(" ")
    : [
      "You are a Japanese speaking coach for a Chinese-speaking adult.",
      "Evaluate the learner's unaided recap transcript only against the supplied selected-sentence context.",
      "minimalRevision must preserve the learner's meaning and make the smallest grammatical changes possible.",
      "naturalJapanese should be a more natural spoken version of what the learner actually said, never an unrelated model answer.",
      "List only important source facts that are genuinely missing; each missingFacts item must be an exact Japanese span from the supplied context.",
      "Give concise linkage and naturalness feedback.",
      "Do not claim an acoustic pronunciation score, pause timestamp, or latency measurement.",
      "Use concise Chinese for linkage and naturalness feedback; Japanese for missingFacts and the two revisions.",
    ].join(" ");
  const input = `Mode: ${mode}\nExact selected sentence: ${expectedText}\nSelected-sentence context: ${contextText}\nActual transcript: ${transcript}`;

  let lastReason = "feedback_failed";
  for (let index = 0; index < FEEDBACK_MODELS.length; index += 1) {
    const model = FEEDBACK_MODELS[index];
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          reasoning: { effort: "low" },
          input: [
            { role: "system", content: [{ type: "input_text", text: instructions }] },
            { role: "user", content: [{ type: "input_text", text: input }] },
          ],
          text: {
            format: {
              type: "json_schema",
              name: mode === "shadow" ? "nihongo_shadow_feedback" : "nihongo_recap_feedback",
              strict: true,
              schema: mode === "shadow" ? shadowSchema : recapSchema,
            },
          },
          max_output_tokens: mode === "shadow" ? 1_400 : 1_600,
        }),
        signal: AbortSignal.timeout(index === 0 ? 18_000 : 9_000),
      });
      if (!response.ok) {
        lastReason = `feedback_${model}_${response.status}`;
        continue;
      }
      const text = outputText(await response.json());
      if (!text) {
        lastReason = `feedback_${model}_empty`;
        continue;
      }
      return { model, raw: JSON.parse(text) };
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "feedback_failed";
    }
  }
  throw new Error(lastReason);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);
  const contentType = (req.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return json({ ok: false, reason: "content_type" }, 415);

  let body: {
    mode?: unknown;
    mimeType?: unknown;
    durationSeconds?: unknown;
    expectedText?: unknown;
    contextText?: unknown;
    audioBase64?: unknown;
    clientKey?: unknown;
  };
  try { body = await req.json(); } catch { return json({ ok: false, reason: "bad_json" }, 400); }

  const mode = body.mode === "shadow" || body.mode === "recap" ? body.mode : null;
  const mimeType = clean(body.mimeType, 80).split(";", 1)[0].toLowerCase();
  const durationSeconds = Number(body.durationSeconds);
  const expectedText = clean(body.expectedText, 500);
  const contextText = clean(body.contextText, 1_600);
  const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64 : "";
  const clientKey = clean(body.clientKey, 48).toLowerCase();
  if (!mode || !MIME_EXTENSIONS.has(mimeType) || !Number.isFinite(durationSeconds)
    || durationSeconds <= 0 || durationSeconds > MAX_DURATION_SECONDS || !expectedText || !contextText
    || !validBase64(audioBase64) || !/^[a-f0-9]{48}$/.test(clientKey)) {
    return json({ ok: false, reason: "invalid_input" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const day = new Date().toISOString().slice(0, 10);
  const globalQuota = await supabase.rpc("consume_nihongo_coach_quota", {
    p_bucket: `nihongo-speech:global:${day}`,
    p_limit: 240,
    p_window_minutes: 1440,
  });
  if (globalQuota.error || globalQuota.data !== true) return json({ ok: false, reason: "daily_quota" }, 429);

  const perClientQuota = await supabase.rpc("consume_nihongo_coach_quota", {
    p_bucket: `nihongo-speech:client:${clientKey}`,
    p_limit: 12,
    p_window_minutes: 60,
  });
  if (perClientQuota.error || perClientQuota.data !== true) return json({ ok: false, reason: "client_quota" }, 429);

  const apiKey = await loadApiKey(supabase);
  if (!apiKey) return json({ ok: false, reason: "missing_openai_key" }, 503);

  let transcript: string;
  try {
    transcript = await transcribe(apiKey, decodeBase64(audioBase64), mimeType);
  } catch {
    return json({ ok: false, reason: "transcription_failed" }, 502);
  }

  try {
    const generated = await generateFeedback(apiKey, mode, transcript, expectedText, contextText);
    const feedback = mode === "shadow"
      ? shadowFeedbackFrom(generated.raw, transcript, expectedText, Math.round(durationSeconds))
      : recapFeedbackFrom(generated.raw, transcript, expectedText, contextText, Math.round(durationSeconds));
    return json({ ok: true, feedback, model: generated.model, usedFallback: false });
  } catch {
    const feedback = mode === "shadow"
      ? fallbackShadowFeedback(transcript, expectedText, Math.round(durationSeconds))
      : fallbackRecapFeedback(transcript, expectedText, contextText, Math.round(durationSeconds));
    return json({ ok: true, feedback, model: "deterministic-text-diff", usedFallback: true });
  }
});
