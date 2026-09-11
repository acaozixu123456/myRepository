export type SpeakingPace='natural'|'gentle';
export type TeachingChannel='automatic'|'text';
export function deliveryInstructions(pace:SpeakingPace,channel:TeachingChannel,input:'speech'|'typed'):string{
 return [
  '# Delivery\nUse natural standard Japanese pronunciation and idiomatic adult grammar. Preserve particles, verb endings, mora timing and ordinary connected speech. No synthetic character voice, theatrical whisper, syllable-by-syllable spacing, stretched vowels or forced tiny fragments. Visual cyberpunk style is unrelated to pronunciation.',
  pace==='gentle'?'Speak unhurriedly with short pauses BETWEEN meaningful clauses, not inside words. Keep natural pitch and vowel length; do not mechanically elongate audio.':'Speak at a natural conversational pace with clear, ordinary phrase boundaries. Do not deliberately slow down. The output speed parameter is 1.0.',
  `# Requested teaching delivery\nCurrent learner input is ${input==='typed'?'typed text':'speech'}. `+(channel==='text'?'The learner selected written-only explanations: answer explicit language-learning questions substantively in writing, rather than reading the explanation aloud. Never give a stock promise. Other normal conversation may still be spoken.':input==='typed'?'For a typed language-learning question, answer directly in concise written Chinese and one natural Japanese example. Other normal typed conversation may still be spoken.':'For a spoken language-learning question, answer directly: one short Chinese explanation and, when useful, one natural Japanese example. No special phrase such as 讲给我听 is required. Do not answer only with an acknowledgement or a promise. Then pause; do not force a quiz.'),
 ].join('\n\n');
}
