/** Requested support is not the same task as correcting a known user statement. */
export const HELP_PROPERTIES = {
  keyword: {type:'string',description:'One useful Japanese keyword, not the full answer, max40 characters.'},
  starter: {type:'string',description:'An unfinished Japanese beginning, NOT a complete sentence; max80 characters.'},
  suggestion: {type:'string',description:'One short Japanese phrase the learner can borrow for the CURRENT question. Not a voice-assistant response.'},
  basis: {type:'string',enum:['learner_intent','illustrative','open_starter'],description:'learner_intent only when the answer/meaning was actually stated; illustrative for a possible but UNKNOWN answer; open_starter for an unfinished neutral beginning.'},
  contextRespected: {type:'boolean',description:'True when no known meaning, time, negation or latest correction is contradicted. A clearly labelled hypothetical answer to an unknown question can be true; this does NOT certify it as a real fact about the learner.'},
};
export function prepareWrittenHelp(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object')return {kind:'none'};
  const raw=value as Record<string,unknown>;
  if(typeof raw.suggestion!=='string'||!raw.suggestion.trim()||!['learner_intent','illustrative','open_starter'].includes(String(raw.basis))||typeof raw.contextRespected!=='boolean')return {kind:'none'};
  const text=raw.suggestion.trim();
  const illustrative=raw.basis==='illustrative';
  const suggestion=illustrative&&!/^例えば[、，,\s]/u.test(text)?`例えば、${text}`:text;
  return {
    kind:'wording',certainty:'clear',
    // In help mode this validates respect for the context. Illustrative text is
    // labelled in BOTH languages and is never inserted as an actual user turn.
    meaningPreserved:raw.contextRespected,
    suggestion,
    reasonZh:illustrative?'这是一个回答示例，不代表你的实际情况；按自己的意思换就好。':raw.basis==='open_starter'?'先借这个开头，后面接你自己的意思就好。':'先借用这一句，仍然可以按自己的意思说。',
    detailZh:'',supportBasis:raw.basis,...(typeof raw.keyword==='string'&&typeof raw.starter==='string'?{scaffold:{keyword:raw.keyword,starter:raw.starter}}:{}),
  };
}
