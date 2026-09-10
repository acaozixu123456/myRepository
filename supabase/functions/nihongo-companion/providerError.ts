/** Safe, content-free error classification. Never retry billing limits as temporary throttling. */
export type ProviderFault={status:number;code:string;param:string;type:string;retryAfterSeconds?:number};
export function classifyProviderError(status:number,error:unknown,retryAfter:string|null=null){
 const raw=error&&typeof error==='object'?error as Record<string,unknown>:{};
 const safe=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9_.\[\]-]{1,100}$/.test(v)?v:'';
 const code=safe(raw.code),param=safe(raw.param),type=safe(raw.type);
 const fault:ProviderFault={status,code,param,type};
 const delay=retryAfter&&/^\d+(\.\d+)?$/.test(retryAfter)?Number(retryAfter):NaN;
 if(Number.isFinite(delay)&&delay>=0&&delay<=86400)fault.retryAfterSeconds=Math.ceil(delay);
 let reason:string;
 if(code==='credit_balance_exhausted'||code==='insufficient_quota'||(!code&&type==='insufficient_quota'))reason='provider_credit';
 else if(['organization_spend_limit_exceeded','project_spend_limit_exceeded'].includes(code))reason='provider_spend_limit';
 else if(code==='organization_usage_limit_exceeded')reason='provider_usage_limit';
 else if(status===429)reason='provider_busy';
 else if(status===404)reason='model_unavailable';
 else reason='provider_request_failed';
 return {reason,status:status===429?429:502,fault,retryable:reason==='provider_busy'};
}
