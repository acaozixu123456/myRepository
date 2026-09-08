# NHK turn support — mobile-only next iteration, 2026-09-08

User approved only three priorities: a small scaffold for each actual utterance, less interview-like responses, and minimal optional UX observation. No new modes, personal-sentence memory, desktop work, games or reward systems in this slice.

## Experience
Every assistant utterance receives its own support frame. Default hints are at most two short Japanese keyword options and one unfinished starter, never a full answer sheet. Help reveals/models one optional example tied to the CURRENT question. The learner may collapse hints without ending the call. Showing a prompt is not evidence of mastery, and a sample is not a saved preference. Questions stop being mandatory: after two question turns ask for a short reaction, and answer the learner's questions directly. These are prompt constraints, not a proof that every generated reply will obey.

## Voice and responsiveness
Keep the existing gpt-realtime-2.1 model, WebRTC transport, edge authentication, call quotas, timeout renewal, idle pause, source validation and original TTS/review. No key, database, API proxy or edge runtime changes required. Detached TEXT responses prepare a small JSON hint for the actual audio transcript. Existing audio completion and mic lifecycle never await that text; optional failures stay optional. Match purpose, turn key and request nonce; reject late, oversized, malformed or old-topic completions. Cancel hint work when speaking begins, hints collapse, a new question arrives, the topic changes or the peer closes. Count hint requests in the existing client response budget and renew before server guards. Additional text generation is paid API usage, not free; hiding hints suppresses those extra requests.

Official protocol basis: https://developers.openai.com/api/docs/guides/realtime-conversations (out-of-band responses, conversation:none, explicit input and metadata). Realtime JSON here is parsed/validated by the app, not claimed to be schema-guaranteed Structured Outputs. Word meaning and pedagogical fit remain model-generated and require human feedback.

## Privacy and observation
New own localStorage key nihongo-chat-experience-v1 only, default OFF. Explicit opt-in stores whitelisted aggregate rows: UTC day, service-event wait estimates, help/answer-after-help counts, hint visibility, shuffles, renewals and optional effort category. No recordings, transcriptions, article names/IDs, questions, answers, network identifiers or account IDs. No metrics upload. At most 30 recent sessions, with a 14-day retention window applied during use. User can export or clear only this owned data; disabling removes observations. Failed/corrupt/future records must not overwrite old article/library/history keys or block speaking.

Timing excludes permission dialog and learner thinking. It measures provider playback-start events, not actual acoustic onset, pronunciation or human reaction speed. Answer after help only means an ASR-backed attempt followed help, not semantic correctness or fluency improvement. Optional feedback is occasional and cannot block exit. Actual benefit is unproven until real phone feedback.

## Gates
All prior unit tests, new prompt/freshness/race/privacy tests, build, phone-only UI screenshots with mocks clearly labelled, real API detached-text + synthetic speech multi-turn checks, then supervisor review. Promote only after review; verify deployed assets and existing proxy on the same production alias. Never clear user browser data. Preserve the original random topic behavior and no three-turn ending. Desktop tests are not a gate.
