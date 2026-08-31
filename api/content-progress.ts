import type {VercelRequest, VercelResponse} from '@vercel/node';

const MANIFEST_URL =
  'https://raw.githubusercontent.com/acaozixu123456/myRepository/nihongo-content/nihongo-discovery/content/manifest.json';
const WORLD_ID = 'life-in-japan';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kivebsjsdfdobxzaokbj.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdmVic2pzZGZkb2J4emFva2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzA2NDIsImV4cCI6MjEwMzcwNjY0Mn0.rzB2Yhn0vn1WqLJ2cq62WcSTsauNAm9vmn8MfNzgiYM';

type CanonicalStory = {
  id?: string;
  series?: {
    worldId?: string;
    seasonId?: string;
    episodeNo?: number;
  };
};

type ManifestItem = {status?: string; story?: CanonicalStory};
type ProgressRow = {
  world_id?: string;
  season_id?: string;
  completed_episode_no?: number;
  updated_at?: string | null;
};

let manifestCache: {at: number; byId: Map<string, CanonicalStory>} | null = null;

async function loadPublishedStories(): Promise<Map<string, CanonicalStory>> {
  const now = Date.now();
  if (manifestCache && now - manifestCache.at < 60_000) return manifestCache.byId;
  const upstream = await fetch(`${MANIFEST_URL}?ts=${now}`, {
    headers: {Accept: 'application/json', 'Cache-Control': 'no-cache'},
  });
  if (!upstream.ok) throw new Error(`manifest_http_${upstream.status}`);
  const manifest = await upstream.json() as {items?: ManifestItem[]};
  const byId = new Map<string, CanonicalStory>();
  for (const item of manifest.items || []) {
    const story = item.story;
    if (
      item.status === 'published' &&
      story?.id &&
      story.series?.worldId === WORLD_ID &&
      story.series?.seasonId &&
      Number.isInteger(story.series?.episodeNo)
    ) {
      byId.set(story.id, story);
    }
  }
  manifestCache = {at: now, byId};
  return byId;
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`progress_rpc_${name}_${response.status}`);
  return await response.json() as T;
}

function validSeasonId(value: string) {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const seasonId = String(req.query.seasonId || '');
      if (!validSeasonId(seasonId)) return res.status(400).json({ok: false, reason: 'invalid_season'});
      const rows = await rpc<ProgressRow[]>('get_nihongo_content_progress', {
        p_world_id: WORLD_ID,
        p_season_id: seasonId,
      });
      const row = rows?.[0];
      return res.status(200).json({
        ok: true,
        worldId: WORLD_ID,
        seasonId,
        completedEpisodeNo: Number(row?.completed_episode_no || 0),
        updatedAt: row?.updated_at || null,
      });
    }

    if (req.method === 'POST') {
      const storyId = String(req.body?.storyId || '');
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(storyId)) return res.status(400).json({ok: false, reason: 'invalid_story'});
      const story = (await loadPublishedStories()).get(storyId);
      const seasonId = story?.series?.seasonId;
      const episodeNo = story?.series?.episodeNo;
      if (!story || !seasonId || !Number.isInteger(episodeNo) || Number(episodeNo) < 1) {
        return res.status(403).json({ok: false, reason: 'not_canonical_published_story'});
      }
      const rows = await rpc<ProgressRow[]>('advance_nihongo_content_progress', {
        p_world_id: WORLD_ID,
        p_season_id: seasonId,
        p_completed_episode_no: episodeNo,
      });
      const row = rows?.[0];
      return res.status(200).json({
        ok: true,
        worldId: WORLD_ID,
        seasonId,
        completedEpisodeNo: Number(row?.completed_episode_no || episodeNo),
        updatedAt: row?.updated_at || null,
      });
    }

    return res.status(405).json({ok: false, reason: 'method_not_allowed'});
  } catch (error) {
    console.error('content-progress failed', error);
    return res.status(503).json({ok: false, reason: 'progress_unavailable'});
  }
}
