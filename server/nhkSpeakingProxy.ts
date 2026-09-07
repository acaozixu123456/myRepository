import type {VercelRequest,VercelResponse} from '@vercel/node';
import {SPEAKING_CONSENT,validateSpeakingPlan} from '../src/nhkSpeaking.js';
type Config={url:string;anonKey:string;clientKey:string};
export async function handleSpeakingProxy(req:VercelRequest,res:VercelResponse,body:Record<string,unknown>,config:Config){
  res.setHeader('Cache-Control','no-store');const action=String(body.action||'');let payload:Record<string,unknown>;
  if(action==='speaking_health')payload={action:'health'};
  else{
    const origin=String(req.headers.origin||''),host=String(req.headers.host||'');
    if(!origin||origin!==`https://${host}`||req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({ok:false,reason:'same_origin_required'});
    if(action==='speaking_start'){
      const plan=validateSpeakingPlan(body.plan),sdp=typeof body.sdp==='string'?body.sdp:'',clientRequestId=typeof body.clientRequestId==='string'?body.clientRequestId:'';
      if(body.consent!==SPEAKING_CONSENT)return res.status(400).json({ok:false,reason:'explicit_audio_consent_required'});
      if(!plan||!sdp.startsWith('v=0')||!sdp.includes('m=audio')||sdp.length>64000||!/^[a-zA-Z0-9-]{16,80}$/.test(clientRequestId))return res.status(400).json({ok:false,reason:'invalid_speaking_input'});
      payload={action:'start',consent:SPEAKING_CONSENT,plan,sdp,clientRequestId,clientKey:config.clientKey};
    }else if(action==='speaking_stop'){
      if(typeof body.callId!=='string'||!/^rtc_[a-zA-Z0-9_-]{4,200}$/.test(body.callId)||typeof body.stopToken!=='string'||!/^[a-f0-9]{64}$/.test(body.stopToken)||!Number.isFinite(body.expiresAt))return res.status(400).json({ok:false,reason:'invalid_stop_ticket'});
      payload={action:'stop',callId:body.callId,stopToken:body.stopToken,expiresAt:body.expiresAt};
    }else return res.status(400).json({ok:false,reason:'invalid_action'});
  }
  try{const upstream=await fetch(`${config.url}/functions/v1/nihongo-speaking-session`,{method:'POST',headers:{Authorization:`Bearer ${config.anonKey}`,apikey:config.anonKey,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(action==='speaking_start'?26000:12000)});const result=await upstream.json().catch(()=>({ok:false,reason:'speaking_service_unavailable'}));return res.status(upstream.status).json(result);}catch{return res.status(502).json({ok:false,reason:'speaking_timeout'});}
}
