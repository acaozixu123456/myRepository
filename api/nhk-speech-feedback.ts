import {createHash} from 'node:crypto';
import type {VercelRequest, VercelResponse} from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kivebsjsdfdobxzaokbj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdmVic2pzZGZkb2J4emFva2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzA2NDIsImV4cCI6MjEwMzcwNjY0Mn0.rzB2Yhn0vn1WqLJ2cq62WcSTsauNAm9vmn8MfNzgiYM';
const EDGE_URL = `${SUPABASE_URL}/functions/v1/nihongo-speech-feedback`;
const TIMEOUT_MS = 55_000;
const MAX_AUDIO_BASE64_LENGTH = 2_000_000;
const MAX_AUDIO_BYTES = 1_500_000;
const MIME_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/flac',
]);

type SpeechRequestBody = {
  mode?: unknown;
  mimeType?: unknown;
  durationSeconds?: unknown;
  expectedText?: unknown;
  contextText?: unknown;
  audioBase64?: unknown;
};

export type ValidatedSpeechRequest = {
  mode: 'shadow' | 'recap';
  mimeType: string;
  durationSeconds: number;
  expectedText: string;
  contextText: string;
  audioBase64: string;
};

const clean = (value: unknown, max: number): string => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, max)
  : '';

const requestBody = (req: VercelRequest): SpeechRequestBody => {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) as SpeechRequestBody; } catch { return {}; }
  }
  return req.body && typeof req.body === 'object' ? req.body as SpeechRequestBody : {};
};

const clientKey = (req: VercelRequest): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = Array.isArray(forwarded) ? forwarded[0] : (forwarded || req.socket?.remoteAddress || 'unknown');
  const ip = String(rawIp).split(',', 1)[0].trim();
  const userAgent = String(req.headers['user-agent'] || 'unknown').slice(0, 512);
  return createHash('sha256').update(`${ip}|${userAgent}`).digest('hex').slice(0, 48);
};

const decodedByteLength = (value: string): number => {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return value.length / 4 * 3 - padding;
};

export const validateSpeechRequest = (value: unknown): ValidatedSpeechRequest | null => {
  if (!value || typeof value !== 'object') return null;
  const body = value as SpeechRequestBody;
  const mode = body.mode === 'shadow' || body.mode === 'recap' ? body.mode : null;
  const mimeType = clean(body.mimeType, 80).split(';', 1)[0].toLowerCase();
  const durationSeconds = Number(body.durationSeconds);
  const expectedText = clean(body.expectedText, 500);
  const contextText = clean(body.contextText, 1_600);
  const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64 : '';
  const validAudio = audioBase64.length > 0
    && audioBase64.length <= MAX_AUDIO_BASE64_LENGTH
    && audioBase64.length % 4 === 0
    && /^[A-Za-z0-9+/]+={0,2}$/.test(audioBase64)
    && decodedByteLength(audioBase64) > 0
    && decodedByteLength(audioBase64) <= MAX_AUDIO_BYTES;
  if (!mode || !MIME_TYPES.has(mimeType) || !Number.isFinite(durationSeconds)
    || durationSeconds <= 0 || durationSeconds > 60 || !expectedText || !contextText || !validAudio) return null;
  return {
    mode,
    mimeType,
    durationSeconds: Math.round(durationSeconds),
    expectedText,
    contextText,
    audioBase64,
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ok: false, reason: 'method_not_allowed'});
  const contentType = String(req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') return res.status(415).json({ok: false, reason: 'content_type'});

  const validated = validateSpeechRequest(requestBody(req));
  if (!validated) return res.status(400).json({ok: false, reason: 'invalid_input'});

  try {
    const response = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...validated,
        clientKey: clientKey(req),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = await response.json().catch(() => ({ok: false, reason: `edge_http_${response.status}`}));
    return res.status(response.status).json(payload);
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'speech_timeout' : 'speech_unavailable';
    return res.status(502).json({ok: false, reason});
  }
}
