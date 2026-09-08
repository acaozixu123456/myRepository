/** Normalize presentation wrappers only; never evaluate generated text. */
export function turnSupportJson(text:string):unknown {
  if(text.length>2200)throw new Error('oversized_hint');
  let candidate=text.trim().replace(/^\s*>\s?/gm,'').trim();
  // A bare equals/arrow prefix was observed in an otherwise valid model response.
  // Accept only bounded punctuation, never a variable assignment or prose prefix.
  candidate=candidate.replace(/^[=>:]{1,8}\s*/u,'').trim();
  candidate=candidate.replace(/^```(?:json)?\s*|\s*```$/g,'').trim();
  if(candidate.startsWith('(')&&candidate.endsWith(')'))candidate=candidate.slice(1,-1).trim();
  if(!candidate.startsWith('{')||!candidate.endsWith('}'))throw new Error('invalid_hint_wrapper');
  return JSON.parse(candidate);
}
