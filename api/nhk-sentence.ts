import {createHash} from 'node:crypto';
import type {VercelRequest, VercelResponse} from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kivebsjsdfdobxzaokbj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJraXZlYnNqc2RmZG9ieHphb2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzA2NDIsImV4cCI6MjEwMzcwNjQyfQ.rzB2Yhn0vn1WqLJ2cq62WcSTsauNAm9vmn8MfNzgiYM';
import {validSentenceRequest} from '../src/nhkSentenceAnalysis';
const EDGE_URL = `${SUPABASE_URL}/functions/v1/nihongo-sentence`;
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({ok:false,reason:'method_not_allowed'});
  let body: unknown;
  try {body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;} catch {return res.status(400).json({ok:false,reason:'bad_json'});}
  if (!validSentenceRequest(body)) return res.status(400).json({ok:false,reason:'invalid_or_oversized_sentence'});
  const clientKey = createHash('sha256').update(`${req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'}|${req.headers['user-agent'] || 'unknown'}`).digest('hex').slice(0,48);
  try {
    const response = await fetch(EDGE_URL,{method:'POST',headers:{Authorization:`Bearer ${SUPABASE_ANON_KEY}`,apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({...body,clientKey}),signal:AbortSignal.timeout(57000)});
    const payload = await response.json();return res.status(response.status).json(payload);
  } catch {return res.status(502).json({ok:false,reason:'sentence_coach_unavailable'});}
}
