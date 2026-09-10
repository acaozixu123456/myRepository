from pathlib import Path

def replace(path,before,after):
 p=Path(path);s=p.read_text()
 if after in s:return
 if s.count(before)!=1:raise RuntimeError('Non-unique billing clarity anchor: '+path)
 p.write_text(s.replace(before,after))
replace('supabase/functions/nihongo-companion/service.ts',"type ProviderFault={status:number;code:string;param:string};", "import {classifyProviderError,type ProviderFault} from './providerError.ts';")
p=Path('supabase/functions/nihongo-companion/service.ts');s=p.read_text()
start=s.index(' if(!r.ok){const body=await r.json()')
end=s.index('}return r;',start)
s=s[:start]+''' if(!r.ok){const body=await r.json().catch(()=>({}));const result=classifyProviderError(r.status,body?.error,r.headers.get('retry-after'));
  console.warn(JSON.stringify({event:'companion_provider_error',...result.fault}));
  throw new ServiceError(result.reason,result.status,result.fault);
 '''+s[end:]
p.write_text(s)
replace('src/companion/api.ts',"if(/provider_credit/u.test(reason))return 'OpenAI API 账户的可用额度不足，暂时无法继续语音。';", "if(/provider_credit/u.test(reason))return 'OpenAI API 预付余额已用完，语音和文字服务暂时不可用。需要在 API 账单页充值，反复重试不会恢复。';\n  if(/provider_spend_limit/u.test(reason))return 'OpenAI API 项目或组织的费用上限已达到。需要由账户管理者检查费用上限，不是临时繁忙。';\n  if(/provider_usage_limit/u.test(reason))return 'OpenAI API 账户的用量上限已达到，需要在平台检查限制。反复重试不会恢复。';")
replace('src/companion/CompanionApp.tsx',"setTopicNote(wanted==='news'?'这次消息来源或内容校验没接好，原话题仍可聊。':'新话头稍后再来，现有的话题照样能聊。');", "setTopicNote(e instanceof Error&&/provider_credit|provider_spend_limit|provider_usage_limit/.test(e.message)?friendlyError(e.message):wanted==='news'?'这次消息来源或内容校验没接好，原话题仍可聊。':'新话头稍后再来，现有的话题照样能聊。');")
print('Billing is classified truthfully. No credit purchase, spending-limit, credential, model or quota changes.')
