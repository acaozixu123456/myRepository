import {createHash} from 'node:crypto';
import type {VercelRequest, VercelResponse} from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kivebsjsdfdobxzaokbj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdmVic2pzZGZkb2J4emFva2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzA2NDIsImV4cCI6MjEwMzcwNjY0Mn0.rzB2Yhn0vn1WqLJ2cq62WcSTsauNAm9vmn8MfNzgiYM';
const EDGE_URL = `${SUPABASE_URL}/functions/v1/nihongo-speech-coach`;
const MAX_AUDIO_BASE64_LENGTH = 3_800_000;

const clean = (value: unknown, max: number): string => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : '';

const requestBody = (req: VercelRequest): Record<string, unknown> => {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) as Record<string, unknown>; } catch { return {}; }
  }
  return (req.body || {}) as Record<string, unknown>;
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
  const action = clean(body.action, 16);
  let payload: Record<string, unknown>;

  if (action === 'tts') {
    const text = clean(body.text, 400);
    if (!text) return res.status(400).json({ok: false, reason: 'invalid_text'});
    payload = {action, text, clientKey: clientKey(req)};
  } else if (action === 'review') {
    const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64.trim() : '';
    const mimeType = clean(body.mimeType, 80).toLowerCase();
    const mode = clean(body.mode, 16);
    const referenceText = clean(body.referenceText, 2400);
    if (!audioBase64 || audioBase64.length > MAX_AUDIO_BASE64_LENGTH || !mimeType.startsWith('audio/') || !referenceText) {
      return res.status(400).json({ok: false, reason: 'invalid_review_input'});
    }
    if (!['shadow', 'recap', 'world', 'recall'].includes(mode)) {
      return res.status(400).json({ok: false, reason: 'invalid_review_mode'});
    }
    payload = {
      action,
      audioBase64,
      mimeType,
      mode,
      referenceText,
      summary: clean(body.summary, 1200),
      question: clean(body.question, 800),
      targetExpression: clean(body.targetExpression, 400),
      durationSeconds: Math.max(1, Math.min(90, Number(body.durationSeconds) || 1)),
      clientKey: clientKey(req),
    };
  } else {
    return res.status(400).json({ok: false, reason: 'invalid_action'});
  }

  try {
    const response = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(action === 'review' ? 58_000 : 32_000),
    });
    const result = await response.json().catch(() => ({ok: false, reason: `edge_http_${response.status}`}));
    return res.status(response.status).json(result);
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError'
      ? 'speech_timeout'
      : 'speech_unavailable';
    return res.status(502).json({ok: false, reason});
  }
}
