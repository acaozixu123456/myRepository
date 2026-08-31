import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "nihongo-audio";
const PREFIX = "scene-images-v1";
const MODEL = "gpt-image-1";
const MANIFEST_URL = "https://raw.githubusercontent.com/acaozixu123456/myRepository/nihongo-content/nihongo-discovery/content/manifest.json";
const WORLD_CANON_URL = "https://raw.githubusercontent.com/acaozixu123456/myRepository/nihongo-content/nihongo-discovery/content/WORLD_CANON.json";
const CACHE_MS = 60_000;

type VisualMeta = {
  imagePrompt?: string;
  locationId?: string;
  castInScene?: string[];
};

type ManifestStory = {
  id?: string;
  visualMeta?: VisualMeta;
  series?: { worldId?: string; seasonId?: string };
};

type ManifestItem = { status?: string; story?: ManifestStory };

type CanonCast = {
  id: string;
  name?: string;
  visualDescriptor?: string;
};

type CanonLocation = {
  id: string;
  name?: string;
};

type WorldCanon = {
  world?: {
    id?: string;
    styleBible?: {
      visual?: string;
      castConsistency?: string;
      palette?: string;
    };
    cast?: CanonCast[];
    locations?: CanonLocation[];
  };
};

type CanonSnapshot = {
  worldId: string;
  visualStyle: string;
  castConsistency: string;
  palette: string;
  castById: Map<string, CanonCast>;
  locationById: Map<string, CanonLocation>;
};

let manifestCache: { at: number; byId: Map<string, ManifestStory> } | null = null;
let canonCache: { at: number; value: CanonSnapshot } | null = null;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {"content-type":"application/json; charset=utf-8","cache-control":"no-store"},
});

async function loadApiKey(supabase: any) {
  const envKey = Deno.env.get("OPENAI_API_KEY");
  if (envKey?.startsWith("sk-")) return envKey;
  const { data, error } = await supabase.rpc("get_nihongo_openai_key");
  if (!error && typeof data === "string" && data.startsWith("sk-")) return data;
  return "";
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function loadWorldCanon(): Promise<CanonSnapshot> {
  const now = Date.now();
  if (canonCache && now - canonCache.at < CACHE_MS) return canonCache.value;

  const res = await fetch(`${WORLD_CANON_URL}?ts=${now}`, {
    headers: {Accept: "application/json", "Cache-Control": "no-cache"},
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`canon_http_${res.status}`);

  const canon = await res.json() as WorldCanon;
  const world = canon.world;
  if (!world?.id) throw new Error("canon_missing_world");

  const value: CanonSnapshot = {
    worldId: world.id,
    visualStyle: world.styleBible?.visual?.trim() || "warm modern Japanese editorial illustration, anime-inspired, cinematic but clean, soft lighting, no text in image, not photorealistic",
    castConsistency: world.styleBible?.castConsistency?.trim() || "Recurring cast must keep the same face, hair, and outfit descriptors across episodes and seasons",
    palette: world.styleBible?.palette?.trim() || "muted warm neutrals with one accent color per scene",
    castById: new Map((world.cast || []).map(c => [c.id, c])),
    locationById: new Map((world.locations || []).map(l => [l.id, l])),
  };
  canonCache = {at: now, value};
  return value;
}

async function loadCanonicalStories(worldId: string): Promise<Map<string, ManifestStory>> {
  const now = Date.now();
  if (manifestCache && now - manifestCache.at < CACHE_MS) return manifestCache.byId;

  const res = await fetch(`${MANIFEST_URL}?ts=${now}`, {
    headers: {Accept: "application/json", "Cache-Control": "no-cache"},
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`manifest_http_${res.status}`);

  const manifest = await res.json() as {items?: ManifestItem[]};
  const byId = new Map<string, ManifestStory>();
  for (const item of manifest.items || []) {
    const story = item.story;
    const imagePrompt = story?.visualMeta?.imagePrompt?.trim();
    if (item.status !== "published") continue;
    if (!story?.id || story.series?.worldId !== worldId || !story.series?.seasonId || !imagePrompt) continue;
    byId.set(story.id, story);
  }
  manifestCache = {at: now, byId};
  return byId;
}

function buildCanonicalPrompt(story: ManifestStory, canon: CanonSnapshot): string {
  const visual = story.visualMeta!;
  const castIds = visual.castInScene || [];
  const unknownCast = castIds.filter(id => !canon.castById.has(id));
  if (unknownCast.length) throw new Error(`unknown_cast:${unknownCast.join(",")}`);

  const locationId = visual.locationId;
  if (locationId && !canon.locationById.has(locationId)) throw new Error(`unknown_location:${locationId}`);

  const cast = castIds
    .map(id => canon.castById.get(id)!)
    .map(c => `${c.name || c.id}: ${c.visualDescriptor || "use the established recurring appearance"}`)
    .join("; ");
  const location = locationId ? canon.locationById.get(locationId) : undefined;

  return [
    canon.visualStyle,
    canon.castConsistency,
    `Palette guidance: ${canon.palette}`,
    location ? `Canonical location: ${location.name || location.id} (${location.id})` : "",
    cast ? `Canonical recurring cast in this scene: ${cast}` : "",
    "Preserve these canonical character descriptors exactly; do not redesign recurring characters.",
    "No readable text, captions, speech bubbles, UI, logos, or watermarks in the image.",
    `Scene action and mood: ${visual.imagePrompt!.trim()}`,
  ].filter(Boolean).join(". ");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ok:false,reason:"method_not_allowed"},405);
  let body: {storyId?: string};
  try { body = await req.json(); } catch { return json({ok:false,reason:"bad_json"},400); }

  const storyId = String(body.storyId || "");
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(storyId)) return json({ok:false,reason:"invalid_story"},400);

  let canon: CanonSnapshot;
  let canonical: ManifestStory | undefined;
  try {
    canon = await loadWorldCanon();
    canonical = (await loadCanonicalStories(canon.worldId)).get(storyId);
  } catch {
    return json({ok:false,reason:"canonical_context_unavailable"},503);
  }
  if (!canonical?.visualMeta?.imagePrompt?.trim()) return json({ok:false,reason:"not_eligible",storyId},403);

  let prompt: string;
  try {
    prompt = buildCanonicalPrompt(canonical, canon);
  } catch {
    return json({ok:false,reason:"canonical_visual_mismatch",storyId},409);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {auth:{persistSession:false,autoRefreshToken:false}},
  );
  const path = `${PREFIX}/${storyId}.webp`;
  const { data: existing } = await supabase.storage.from(BUCKET).download(path);
  if (existing) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return json({ok:true,status:"ready",storyId,url:data.publicUrl,cached:true});
  }

  const apiKey = await loadApiKey(supabase);
  if (!apiKey) return json({ok:false,reason:"missing_openai_key"},503);

  let imageRes: Response;
  try {
    imageRes = await fetch("https://api.openai.com/v1/images/generations", {
      method:"POST",
      headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:MODEL,
        prompt,
        size:"1024x1024",
        quality:"medium",
        output_format:"webp",
        output_compression:75,
      }),
      signal:AbortSignal.timeout(55000),
    });
  } catch {
    return json({ok:false,reason:"generation_timeout"},502);
  }
  if (!imageRes.ok) return json({ok:false,reason:"generation_failed",status:imageRes.status},502);
  const payload = await imageRes.json() as {data?: Array<{b64_json?: string}>};
  const b64 = payload.data?.[0]?.b64_json;
  if (!b64) return json({ok:false,reason:"missing_image_data"},502);
  const bytes = decodeBase64(b64);
  if (bytes.length < 4096) return json({ok:false,reason:"image_too_small"},502);
  if (bytes.length > 9_500_000) return json({ok:false,reason:"image_too_large",bytes:bytes.length},502);

  const imageBlob = new Blob([bytes], { type: "image/webp" });
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, imageBlob, {
    contentType:"image/webp",
    cacheControl:"31536000",
    upsert:true,
  });
  if (uploadError) return json({ok:false,reason:"upload_failed",detail:uploadError.message,bytes:bytes.length},502);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return json({ok:true,status:"ready",storyId,url:data.publicUrl,generated:true,model:MODEL,bytes:bytes.length});
});