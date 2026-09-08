/** Canonicalize only an exact pair of short alternatives into ONE question.
 * The result still passes the usual length, question-count and topic checks.
 * Never merge two independent questions or rewrite arbitrary model prose.
 */
export function singleChoiceQuestion(say:string,words:readonly string[]):string {
  if(words.length!==2||words[0]===words[1])return say;
  const clean=(s:string)=>s.trim();
  const a=clean(words[0]),b=clean(words[1]);
  if(!a||!b||a.length>14||b.length>14||[a,b].some(w=>/[。.!！?？]|(?:ですか|ますか|ましたか|でしたか)|(?:どこ|なぜ|どうして|いつ|何時)/u.test(w)))return say;
  const m=say.trim().match(/^([^?？]+)[?？]\s*([^?？]+)[?？]$/u);
  if(!m||clean(m[1])!==a||clean(m[2])!==b)return say;
  const result=`${a}、${b}、どちらですか。`;
  return result.length<=48?result:say;
}
