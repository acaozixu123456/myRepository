import type {VercelRequest,VercelResponse} from '@vercel/node';
/** Additive v3 routing; permanent credentials and operational leases stay in the edge. */
export async function companionProxy(req:VercelRequest,res:VercelResponse,body:Record<string,unknown>,config:{url:string;anonKey:string;clientKey:string}){
  res.setHeader('Cache-Control','no-store');
  const origin=String(req.headers.origin||''),host=String(req.headers.host||'');
  if(origin!==`https://${host}`||req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({ok:false,reason:'same_origin_required'});
  if(JSON.stringify(body).length>100000)return res.status(413).json({ok:false,reason:'request_too_large'});
  const action=String(body.action||'').replace(/^companion_/,'');if(!['health','start','heartbeat','stop','topics','observe','feedback','lesson','demo'].includes(action))return res.status(400).json({ok:false,reason:'invalid_action'});
  try{const r=await fetch(`${config.url}/functions/v1/nihongo-companion`,{method:'POST',headers:{Authorization:`Bearer ${config.anonKey}`,apikey:config.anonKey,'Content-Type':'application/json'},body:JSON.stringify({...body,action,clientKey:config.clientKey}),signal:AbortSignal.timeout(action==='topics'?50000:action==='start'?35000:20000)});const data=await r.json().catch(()=>({ok:false,reason:'service_unavailable'}));return res.status(r.status).json(data);}catch{return res.status(502).json({ok:false,reason:'connection_timeout'});}
}
