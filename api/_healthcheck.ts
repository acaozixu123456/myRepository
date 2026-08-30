import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  return res.status(200).json({
    ok: true,
    platform: 'vercel',
    migrationStage: 'frontend-and-content-api',
    audioRouting: 'appdeploy-compat-proxy',
  });
}
