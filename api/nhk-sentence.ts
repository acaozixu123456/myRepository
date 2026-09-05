import {createHash} from 'node:crypto';
import type {VercelRequest, VercelResponse} from '@vercel/node';

// Keep this serverless entry independent of extensionless browser-module imports.
// Parity with the frontend validator is tested in nhkSentenceProxy.test.ts.
type SentenceInput = {title:string;sentence:string;sentenceIndex:number;before:string[];after:string[]};
export function validProxySentenceRequest(value: unknown): value is SentenceInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string,unknown>;
  return typeof v.title === 'string' && !!v.title.trim() && v.title.length <= 300
    && typeof v.sentence === 'string' && !!v.sentence.trim() && v.sentence.length <= 8000
    && Number.isInteger(v.sentenceIndex) && Number(v.sentenceIndex) >= 0 && Number(v.sentenceIndex) <= 10000
    && [v.before,v.after].every(a => Array.isArray(a) && a.length <= 2 && a.every(s => typeof s === 'string' && s.length <= 8000));
}
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kivebsjsdfdobxzaokbj.supabase.co';
// Public anon configuration, not a service-role or OpenAI secret.
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdmVic2pzZGZkb2J4emFva2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzA2NDIsImV4cCI6MjEwMzcwNjY0Mn0.rzB2Yhn0vn1WqLJ2cq62WcSTsauNAm9vmn8MfNzgiYM';
const EDGE_URL = `${SUPABASE_URL}/functions/v1/nihongo-sentence`;
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({ok:false,reason:'method_not_allowed'});
  let body: unknown;
  try {body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;} catch {return res.status(400).json({ok:false,reason:'bad_json'});}
  if (!validProxySentenceRequest(body)) return res.status(400).json({ok:false,reason:'invalid_or_oversized_sentence'});
  const clientKey = createHash('sha256').update(`${req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'}|${req.headers['user-agent'] || 'unknown'}`).digest('hex').slice(0,48);
  try {
    const response = await fetch(EDGE_URL,{method:'POST',headers:{Authorization:`Bearer ${SUPABASE_ANON_KEY}`,apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({...body,clientKey}),signal:AbortSignal.timeout(57000)});
    const payload = await response.json();return res.status(response.status).json(payload);
  } catch {return res.status(502).json({ok:false,reason:'sentence_coach_unavailable'});}
}
