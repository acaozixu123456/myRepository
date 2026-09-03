import {createHash} from 'node:crypto';
import type {VercelRequest, VercelResponse} from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kivebsjsdfdobxzaokbj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJraXZlYnNqc2RmZG9ieHphb2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzA2NDIsImV4cCI6MjEwMzcwNjQyfQ.rzB2Yhn0vn1WqLJ2cq62WcSTsauNAm9vmn8MfNzgiYM';
const EDGE_URL = `${SUPABASE_URL}/functions/v1/nihongo-coach`;
const TIMEOUT_MS = 57_000;

const clean = (value: unknown, max: number): string => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : '';

const requestBody = (req: VercelRequest): {title?: unknown; sentences?: unknown} => {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) as {title?: unknown; sentences?: unknown}; } catch { return {}; }
  }
  return (req.body || {}) as {title?: unknown; sentences?: unknown};
};

const clientKey = (req: VercelRequest): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded || req.socket?.remoteAddress || 'unknown');
  const userAgent = String(req.headers['user-agent'] || 'unknown');
  return createHash('sha256').update(`${ip}|${userAgent}`).digest('hex').slice(0, 48);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ok: false, reason: 'method_not_allowed'});

  const body = requestBody(req);
  const title = clean(body.title, 180);
  const sentences = Array.isArray(body.sentences)
    ? Array.from(new Set(body.sentences.map(value => clean(value, 280)).filter(Boolean))).slice(0, 16)
    : [];
  if (!title || !sentences.length) return res.status(400).json({ok: false, reason: 'invalid_input'});

  try {
    const response = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({title, sentences, clientKey: clientKey(req)}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = await response.json().catch(() => ({ok: false, reason: `edge_http_${response.status}`}));
    return res.status(response.status).json(payload);
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'coach_timeout' : 'coach_unavailable';
    return res.status(502).json({ok: false, reason});
  }
}
