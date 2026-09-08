# 日本散步日记 / Nihongo Discovery

## Current user priority — 2026-09-08

**Mobile only.** Do not add desktop layouts, screenshots, mouse/keyboard refinements or desktop acceptance work unless explicitly reauthorized. Preserve harmless existing responsive styles and the historical exploration prototype without expanding it.

The goal is minimal effort to start AND continue speaking Japanese. Keep random local topic browsing, voice chat and optional per-turn support. The news provides a starting point, **not a compulsory destination**. Ordinary replies should follow the current utterance and learner meaning, not abruptly pivot from knowing an institution name to prices/policy. An explicit learner question about article contents may use its source. Do not invent missing news facts.

## Patient teacher and actual slower voice

`nhkGentleTeacher.ts` prepares detached, bounded TEXT turns for free replies and simplification. It includes the current utterance and bounded recent conversation, but omits article title/body unless the learner explicitly requests article facts. A checked turn includes one short sentence or acknowledgement plus a tiny prompt: at most 48 Japanese characters, two sentences and one question. Reject malformed/stale, overlong or selected unsolicited pricing/policy/abstract intrusions before generating audio. The checks are mechanical, not a semantic or JLPT-level guarantee. Timeouts and invalid drafts use a short local fallback.

Audio receives only the accepted short text to read, not the news/history. Actual session output speed is 0.80 by default; **慢一点** sets 0.70 and replays the current utterance. Pace survives explicit topic changes and transport renewal. **再简单点** simplifies the current prompt, not the subject. Spoken slow/simplify requests are also supported and do not count as learner answers. Unexpected verbose streamed audio has a best-effort client stop (64 transcript characters / 16 seconds), not an unlimited monologue. These are not guarantees that every generated audio response is exact or ideal.

Use adult tone, accept fragments, yes/no and Chinese support, and help with one small gap at a time. No forced full sentence, repetition, grading, automatic difficulty escalation or fixed three-turn termination. A question is optional; answer learner questions and avoid repeated advice/interrogation. Ordinary word explanations can be short and direct; do not fabricate offline personal experiences.

## Current-turn support and latency

Show at most two optional words/chunks and one unfinished starter; **帮我接** reveals/models one possible answer. These are suggestions, not answer keys or saved preferences. **收起提示 / 显示提示** does not reconnect. A validated teacher plan supplies its matching scaffold when the spoken transcript matches. Otherwise the existing detached optional hint path handles the actual utterance without loading the whole article. Turn/request identity rejects stale results on user speech, next turn, topic switch, hide and exit.

Free replies now require a short planning stage before voice. Do not claim this adds zero delay or makes responses faster. Planning and audio waiting are included in optional service-event timing; this is not the learner's thinking time. Direct opening, repeat/resume and cached help skip planning. Hiding suggestions suppresses separate hint calls but does not disable the checked teacher plan required for a reply.

## Privacy and preservation

**体验记录** stays optional, default OFF, local only. No upload, raw audio, transcripts, article/account identifiers or proficiency scores. Only whitelisted counts, coarse service wait and skippable feedback under `nihongo-chat-experience-v1`, at most 30 records in a rolling 14-day UTC-date window, pruned on use/reopen/export. Disabling/clearing only affects these observations. Preserve corrupt/future records until explicit clearing.

Do not clear localStorage or rewrite existing NHK articles, favorites, history, sessions, backup/restore, quiet study or game saves. Topic preview never opens a microphone or calls an API. In-call shuffle reuses the current peer, coalesces taps and clears previous-thread context. Voice uses existing 110-second transport leases with renewal; a pause is possible. Sixty seconds idle closes the microphone. End/dismiss/background/error closes tracks. Microphone sending requires visible explicit consent.

No new model, key, database, API proxy, edge, quota or TTS/review replacement. Keep `gpt-realtime-2.1`, existing server credentials and usage protections. App guards and provider rate/credit failures remain distinct. The old two-starts-in-two-minutes restriction stays removed. Never claim free/unlimited usage or zero provider retention. Individual account auth remains required before broad public release.

Sol develops/reviews directly through connected GitHub and existing services. No Windows Codex/Cursor, legacy Luna or AppDeploy for this app unless explicitly requested.

## Acceptance and evidence

- `/`: NHK study and mobile guided light chat.
- `/explore.html`: historical Yanaka prototype, retained.
- `npm run typecheck && npm test && npm run build`: platform-independent source gates.
- `scripts/nhk-teacher-browser.mjs`: phone-only UI with explicitly mocked media/provider.
- `scripts/nhk-teacher-live.mjs`: real production API/WebRTC with synthetic Japanese input, not human recordings.
- `scripts/nhk-teacher-production.mjs`: exact promoted assets and existing API checks.

Reproduce institution-name acknowledgement without a pricing jump, same-thread simplification, accepted API pace settings, short-output checks, stale cancellation, current help, random shuffle, renewal and mic cleanup. Deployment success alone is not acceptance. Inspect screenshots and actual response evidence. Mock/synthetic tests do not prove physical-iPhone behavior, natural pauses, perceived speed, semantic perfection or learning effects. See dated product/QA records.

## Historical game (not the current task)

OpenStreetMap supplies a roughly 167m Yanaka Ginza centerline; attribution remains in `public/explore/`. Buildings, width, ground, shops and characters are adaptations. No PLATEAU or Google Street View integration. Existing movement/shop/bento/hints/bookmarks/inventory/save slice and `nihongo.explore.yanaka.v1` data are retained. Historical desktop/game goals never override mobile speaking work.
