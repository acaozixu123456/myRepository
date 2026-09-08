# Production-only hint formatting observation

Initial production gate 34211768676 verified the exact deployed JS/CSS and voice health, but its real synthetic-audio test failed when a follow-up hint was returned as = followed by an otherwise valid JSON object. The voice remained in listening state, with no voice error. This was not treated as a successful final acceptance.

The bounded presentation normalizer now removes a leading sequence of up to eight equals/arrow/colon characters. It still requires the entire remaining value to be a single JSON object and all original turnKey/request nonce, shape, Japanese text and length validations. It never evaluates code, extracts JSON from prose, or accepts assignments. A local Node test and focused Vitest regression cover the observed value, mismatched turns, prose/assignments and executable suffixes.

The production gate will run again after this change. Its result, not this fix note, determines final runtime acceptance. Prior successful source and real synthetic-voice gate 34211193542 remains the evidence for the unchanged UI, microphone lifecycle, privacy and dialogue policy.
