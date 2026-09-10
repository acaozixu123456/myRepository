from pathlib import Path
p=Path('supabase/functions/nihongo-companion/content.ts');s=p.read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,(a[:80],s.count(a));s=s.replace(a,b)
rep('.filter(t=>t.length>=20)',".filter(t=>t.length>=45&&!/Image Processing|Image Credit|Optical:|X-ray:|Credit:|NASA\\/CXC|^;|^Read more/i.test(t))")
rep('model:TEXT_MODEL,max_output_tokens:2400',"model:lane==='news'?'gpt-5.4-mini':TEXT_MODEL,...(lane==='news'?{reasoning:{effort:'low'}}:{}),max_output_tokens:3000")
rep('model:TEXT_MODEL,max_output_tokens:350',"model:'gpt-5.4-mini',reasoning:{effort:'low'},max_output_tokens:1200")
rep('Check every claimed benefit, not just entity names.', 'Check every claimed benefit, not just entity names. The exact original quote attached as 原文依据 must support the main claim, not just photo credits. Do not confuse the start date of a predecessor research program with the age of this specific named satellite series.')
p.write_text(s)
# A healthy native run can return no automatic note; explicit help must still yield a usable phrase.
p=Path('scripts/companion-written-live.mjs');s=p.read_text();s=s.replace('reason:result.data.reason,note:', 'reason:result.data.reason,disposition:result.data.disposition,model:result.data.model,note:');p.write_text(s)
print('Source-aligned news quality uses the reviewed reasoning text model; no change to native voice model.')
