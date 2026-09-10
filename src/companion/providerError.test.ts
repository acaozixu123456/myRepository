import {describe,it,expect} from 'vitest';
import {classifyProviderError} from '../../supabase/functions/nihongo-companion/providerError';
import {friendlyError} from './api';
describe('account balance is not temporary server congestion',()=>{
 it.each(['credit_balance_exhausted','insufficient_quota'])('does not suggest retrying %s',code=>{const r=classifyProviderError(429,{code,type:'insufficient_quota'});expect(r.reason).toBe('provider_credit');expect(r.retryable).toBe(false);expect(friendlyError(r.reason)).toContain('余额');});
 it('recognizes old type-only insufficient quota',()=>expect(classifyProviderError(429,{type:'insufficient_quota'}).reason).toBe('provider_credit'));
 it.each(['project_spend_limit_exceeded','organization_spend_limit_exceeded'])('does not raise or bypass %s',code=>{const r=classifyProviderError(429,{code});expect(r.reason).toBe('provider_spend_limit');expect(r.retryable).toBe(false);expect(friendlyError(r.reason)).toContain('费用上限');});
 it('separates the assigned usage limit',()=>{const r=classifyProviderError(429,{code:'organization_usage_limit_exceeded'});expect(r.reason).toBe('provider_usage_limit');expect(r.retryable).toBe(false);});
 it('retains bounded temporary retry guidance',()=>{const r=classifyProviderError(429,{code:'rate_limit_exceeded'},'12');expect(r.reason).toBe('provider_busy');expect(r.retryable).toBe(true);expect(r.fault.retryAfterSeconds).toBe(12);});
 it('never echoes provider message, org, key or raw headers',()=>{const r=classifyProviderError(429,{code:'credit_balance_exhausted',message:'sensitive full provider message',apiKey:'never-print'},'secret-header');expect(JSON.stringify(r)).not.toMatch(/sensitive|never-print|secret-header/);expect(r.fault.retryAfterSeconds).toBeUndefined();});
 it('does not change model silently on not-found',()=>expect(classifyProviderError(404,{}).reason).toBe('model_unavailable'));
});
