import type { VercelRequest, VercelResponse } from '@vercel/node';

const STYLE_BIBLE =
  'warm modern Japanese editorial illustration, anime-inspired, cinematic but clean, soft lighting, no text in image, not photorealistic, consistent recurring cast';
const CANARY_STORY_IDS = new Set(['release-week-01-ep01']);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kivebsjsdfdobxzaokbj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SCENE_BUCKET = 'nihongo-audio';
const SCENE_PREFIX = 'scene-images-v1';

const DEFAULT_GRADIENT = 'linear-gradient(145deg, #4a6fa5 0%, #7ba7d9 55%, #c9d6e8 100%)';

async function getOpenAIKey(): Promise<string | null> {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (!SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_vault_secret`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({secret_name: 'nihongo_openai_api_key'}),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {value?: string};
    return data?.value || null;
  } catch {
    return null;
  }
}

async function cachedImageUrl(storyId: string): Promise<string | null> {
  const path = `${SCENE_PREFIX}/${storyId}.webp`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SCENE_BUCKET}/${path}`;
  try {
    const head = await fetch(publicUrl, {method: 'HEAD', signal: AbortSignal.timeout(2500)});
    return head.ok ? publicUrl : null;
  } catch {
    return null;
  }
}

async function generateAndStore(storyId: string, prompt: string): Promise<string | null> {
  const key = await getOpenAIKey();
  if (!key || !SUPABASE_SERVICE_ROLE_KEY) return null;
  const imageRes = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: `${STYLE_BIBLE}. ${prompt}`,
      size: '1024x1024',
      quality: 'medium',
      output_format: 'webp',
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!imageRes.ok) return null;
  const payload = await imageRes.json() as {data?: Array<{b64_json?: string}>};
  const b64 = payload.data?.[0]?.b64_json;
  if (!b64) return null;
  const bytes = new Uint8Array(Buffer.from(b64, 'base64'));
  const path = `${SCENE_PREFIX}/${storyId}.webp`;
  const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/${SCENE_BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
    },
    body: bytes,
    signal: AbortSignal.timeout(10000),
  });
  if (!upload.ok) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${SCENE_BUCKET}/${path}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ok: false, reason: 'method_not_allowed'});
  const storyId = String(req.query.storyId || '');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(storyId)) return res.status(400).json({ok: false, reason: 'invalid_story'});

  const cached = await cachedImageUrl(storyId);
  if (cached) {
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return res.status(200).json({ok: true, status: 'ready', url: cached, storyId});
  }

  const canGenerate = CANARY_STORY_IDS.has(storyId) && req.query.canary === '1';
  let canaryBlocker: string | undefined;
  if (canGenerate) {
    const prompt = String(req.query.prompt || 'Rainy Tokyo station commute morning, young professional checking phone, cinematic editorial illustration');
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      canaryBlocker = 'missing_supabase_service_role';
    } else if (!await getOpenAIKey()) {
      canaryBlocker = 'missing_openai_key';
    } else {
      const url = await generateAndStore(storyId, prompt);
      if (url) {
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.status(200).json({ok: true, status: 'ready', url, storyId, generated: true});
      }
      canaryBlocker = 'generation_failed';
    }
  }

  res.setHeader('Cache-Control', 'public, max-age=60');
  return res.status(200).json({
    ok: true,
    status: 'fallback',
    storyId,
    gradient: DEFAULT_GRADIENT,
    palette: ['#4a6fa5', '#7ba7d9', '#c9d6e8'],
    ...(canaryBlocker ? {canaryAttempted: true, canaryBlocker} : {}),
  });
}
