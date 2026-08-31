import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, reason: 'method_not_allowed' });
  return res.status(200).json({
    ok: true,
    platform: 'vercel',
    migrationStage: 'supabase-native-audio',
    audioRouting: 'supabase-only',
    nativeBackfill: true,
    appdeployDependency: false,
  });
}
