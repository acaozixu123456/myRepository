/** Normalize presentation wrappers only, never execute model text or accept free-form prose. */
export function turnSupportJson(text:string):unknown {
  if(text.length>2200)throw new Error('oversized_hint');
  let candidate=text.trim().replace(/^\s*>\s?/gm,'').trim();
  candidate=candidate.replace(/^```(?:json)?\s*|\s*```$/g,'').trim();
  if(candidate.startsWith('(')&&candidate.endsWith(')'))candidate=candidate.slice(1,-1).trim();
  if(!candidate.startsWith('{')||!candidate.endsWith('}'))throw new Error('invalid_hint_wrapper');
  return JSON.parse(candidate);
}
