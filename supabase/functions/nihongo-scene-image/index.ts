/**
 * Supabase Edge Function nihongo-scene-image v4 proposal.
 * Deploy via supervisor only. Secrets stay in Supabase (OPENAI_API_KEY, service role).
 * Validates storyId against the public nihongo-content manifest; ignores caller prompts.
 */
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const MANIFEST_URL =
  'https://raw.githubusercontent.com/acaozixu123456/myRepository/nihongo-content/nihongo-discovery/content/manifest.json';
const STYLE_BIBLE =
  'warm modern Japanese editorial illustration, anime-inspired, cinematic but clean, soft lighting, no text in image, not photorealistic, consistent recurring cast';
const BUCKET = 'nihongo-audio';
const PREFIX = 'scene-images-v1';
const ALLOWED = new Set(['published', 'audio_validation_failed']);

type ManifestStory = {
  id: string;
  visualMeta?: {imagePrompt?: string};
};

let manifestCache: {at: number; map: Map<string, ManifestStory>} | null = null;

async function canonicalStory(storyId: string): Promise<ManifestStory | null> {
  const now = Date.now();
  if (!manifestCache || now - manifestCache.at > 60_000) {
    const res = await fetch(`${MANIFEST_URL}?ts=${now}`, {headers: {Accept: 'application/json'}});
    if (!res.ok) return null;
    const manifest = await res.json() as {items?: Array<{status?: string; story?: ManifestStory}>};
    const map = new Map<string, ManifestStory>();
    for (const item of manifest.items || []) {
      if (item.story?.id && ALLOWED.has(item.status || '')) map.set(item.story.id, item.story);
    }
    manifestCache = {at: now, map};
  }
  return manifestCache.map.get(storyId) || null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ok: false, reason: 'method_not_allowed'}), {status: 405});
  let body: {storyId?: string};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ok: false, reason: 'invalid_json'}), {status: 400});
  }
  const storyId = String(body.storyId || '');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(storyId)) {
    return new Response(JSON.stringify({ok: false, reason: 'invalid_story'}), {status: 400});
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const objectPath = `${PREFIX}/${storyId}.webp`;

  const {data: existing} = await supabase.storage.from(BUCKET).createSignedUrl(objectPath, 3600);
  if (existing?.signedUrl) {
    const head = await fetch(existing.signedUrl, {method: 'HEAD'}).catch(() => null);
    if (head?.ok) {
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${objectPath}`;
      return new Response(JSON.stringify({ok: true, status: 'cached', url: publicUrl, storyId}), {status: 200});
    }
  }

  const story = await canonicalStory(storyId);
  const imagePrompt = story?.visualMeta?.imagePrompt?.trim();
  if (!imagePrompt) {
    return new Response(JSON.stringify({ok: false, reason: 'not_eligible', storyId}), {status: 403});
  }

  const prompt = `${STYLE_BIBLE}. ${imagePrompt}`;
  const imageRes = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: 'gpt-image-1', prompt, size: '1024x1024', n: 1}),
  });
  if (!imageRes.ok) {
    const err = await imageRes.text();
    return new Response(JSON.stringify({ok: false, reason: 'openai_failed', detail: err.slice(0, 200)}), {status: 502});
  }
  const imagePayload = await imageRes.json() as {data?: Array<{b64_json?: string}>};
  const b64 = imagePayload.data?.[0]?.b64_json;
  if (!b64) return new Response(JSON.stringify({ok: false, reason: 'empty_image'}), {status: 502});

  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const {error: uploadError} = await supabase.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType: 'image/webp',
    upsert: true,
  });
  if (uploadError) {
    return new Response(JSON.stringify({ok: false, reason: 'upload_failed', detail: uploadError.message}), {status: 502});
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${objectPath}`;
  return new Response(JSON.stringify({ok: true, status: 'generated', url: publicUrl, storyId}), {status: 200});
});
