import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODELS = ["gpt-5.6-luna", "gpt-5-mini"];
const MAX_SENTENCES = 16;
const CACHE_DAYS = 7;

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
};

type CoachResult = {
  summaryJa: string;
  summaryZh: string;
  recommendations: Recommendation[];
  opinionQuestion: string;
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

const clean = (value: unknown, max = 240): string => typeof value === "string"
  ? value.replace(/\s+/g, " ").trim().slice(0, max)
  : "";

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
  ];
  for (const pattern of patterns) {
    const match = sentence.match(pattern)?.[0]?.trim();
    if (match) return match;
  }
  return sentence.replace(/[。！？]+$/, "").slice(0, 48);
};

const fallbackRecommendation = (sentence: string, sentenceIndex: number, label: Recommendation["label"]): Recommendation => ({
  sentenceIndex,
  sentence,
  label,
  reasonZh: label === "核心" ? "最能代表这条新闻" : label === "跟读" ? "适合练长句切分和语流" : "容易迁移到生活或工作",
  chunks: chunkSentence(sentence),
  expression: fallbackExpression(sentence),
  meaningZh: "先掌握这句话的主干，再关注助词和句尾。",
  dailyVersion: sentence,
  workVersion: "この内容を受けて、仕事への影響も確認したほうがいいと思います。",
});

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
    const chunks = Array.isArray(candidate?.chunks)
      ? candidate.chunks.map((value: unknown) => clean(value, 100)).filter(Boolean).slice(0, 6)
      : [];
    output.push({
      sentenceIndex: index,
      sentence,
      label,
      reasonZh: clean(candidate?.reasonZh, 100) || fallbackRecommendation(sentence, index, label).reasonZh,
      chunks: chunks.length ? chunks : chunkSentence(sentence),
      expression: clean(candidate?.expression, 100) || fallbackExpression(sentence),
      meaningZh: clean(candidate?.meaningZh, 180) || "先抓主干，再确认助词和句尾。",
      dailyVersion: clean(candidate?.dailyVersion, 180) || sentence,
      workVersion: clean(candidate?.workVersion, 220) || "この内容を受けて、仕事への影響も確認したほうがいいと思います。",
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
    summaryJa: clean(raw?.summaryJa, 180) || `${title}についてのニュースです。`,
    summaryZh: clean(raw?.summaryZh, 180) || `这是一条关于“${title}”的新闻。`,
    recommendations: output,
    opinionQuestion: clean(raw?.opinionQuestion, 180) || "このニュースについて、あなたはどう思いますか。",
    worldSetupZh: clean(raw?.worldSetupZh, 180) || "午休时，田中看到这条新闻，想听听你的看法。",
    worldPromptJa: clean(raw?.worldPromptJa, 180) || "このニュースは、私たちの生活や仕事にも関係があると思いますか。",
  };
}

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summaryJa", "summaryZh", "recommendations", "opinionQuestion", "worldSetupZh", "worldPromptJa"],
  properties: {
    summaryJa: { type: "string", minLength: 1, maxLength: 180 },
    summaryZh: { type: "string", minLength: 1, maxLength: 180 },
    recommendations: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sentenceIndex", "label", "reasonZh", "chunks", "expression", "meaningZh", "dailyVersion", "workVersion"],
        properties: {
          sentenceIndex: { type: "integer", minimum: 0, maximum: 15 },
          label: { type: "string", enum: ["核心", "跟读", "迁移"] },
          reasonZh: { type: "string", minLength: 1, maxLength: 100 },
          chunks: { type: "array", minItems: 1, maxItems: 6, items: { type: "string", minLength: 1, maxLength: 100 } },
          expression: { type: "string", minLength: 1, maxLength: 100 },
          meaningZh: { type: "string", minLength: 1, maxLength: 180 },
          dailyVersion: { type: "string", minLength: 1, maxLength: 180 },
          workVersion: { type: "string", minLength: 1, maxLength: 220 },
        },
      },
    },
    opinionQuestion: { type: "string", minLength: 1, maxLength: 180 },
    worldSetupZh: { type: "string", minLength: 1, maxLength: 180 },
    worldPromptJa: { type: "string", minLength: 1, maxLength: 180 },
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
    "You are a Japanese learning coach for a Chinese-speaking adult living and working in Japan.",
    "Analyze only the supplied Japanese news sentences. Never invent facts that are not in them.",
    "Recommend up to three different sentence indices: one core sentence, one useful shadowing sentence, and one sentence with strong transfer value.",
    "The sentenceIndex must refer to the exact numbered input. Do not rewrite the source sentence.",
    "For chunks, split the exact source sentence into natural shadowing breath groups without changing any characters other than trimming spaces.",
    "expression should be the reusable grammar or collocation worth remembering, not necessarily the whole sentence.",
    "dailyVersion must be natural spoken Japanese. workVersion must be a realistic Japanese IT workplace sentence useful in meetings, testing, specifications, schedules, or customer communication.",
    "opinionQuestion and worldPromptJa must invite a short personal answer in natural Japanese at roughly N3-N2 level.",
    "Use concise Chinese for reasonZh, meaningZh, summaryZh, and worldSetupZh.",
  ].join(" ");

  let lastReason = "generation_failed";
  for (const model of MODELS) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          reasoning: { effort: "low" },
          input: [
            { role: "system", content: [{ type: "input_text", text: instructions }] },
            { role: "user", content: [{ type: "input_text", text: `Article title: ${title}\nSentences:\n${numbered}` }] },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "nihongo_morning_coach",
              strict: true,
              schema: responseSchema,
            },
          },
          max_output_tokens: 2200,
        }),
        signal: AbortSignal.timeout(30000),
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

  const cacheKey = await sha256(JSON.stringify({ version: 1, title, sentences }));
  const cacheCutoff = new Date(Date.now() - CACHE_DAYS * 86400000).toISOString();
  const { data: cached } = await supabase
    .from("nihongo_coach_cache")
    .select("payload,model,updated_at")
    .eq("cache_key", cacheKey)
    .gte("updated_at", cacheCutoff)
    .maybeSingle();
  if (cached?.payload) return json({ ok: true, coach: cached.payload, model: cached.model, cached: true });

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
