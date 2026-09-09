# ひとこと — Japanese conversation companion / independent v3 preview

## Scope and current acceptance — 2026-09-09

Mobile only. Sol develops/reviews directly through connected GitHub and existing services. No Windows Codex/Cursor, Luna, AppDeploy, desktop layouts or historical game work. PR #5 remains a draft; production NHK branch `nihongo-vercel` remains at313a538df99835165062ffff77bd7c6fb2a18b33. Deployment success is not conversational acceptance.

The independent `/companion.html` preview is available for personal voice/help feedback. Source, mobile UI, public preview assets and two real synthetic/typed dialogue probes passed their scoped checks. Full release remains REVISE: optional real-news card generation still returns `news_unavailable`, some native replies can be too long or imply personal habits, and adaptive learning/human-phone quality is not proven. See `docs/qa/COMPANION_PREVIEW_REVIEW_20260909_0915.json` for actual replies and failures; do not erase older failed evidence.

The user explicitly authorized the separate `nihongo-companion` Supabase service, operational-only lease/usage table and reuse of existing server credentials. This never authorizes storing recordings, full transcripts, employer data or cloud learning profiles. Preserve original articles, favorites, history, backups, quiet-study, TTS and historical game data.

## Product and interface

One coherent adult Japanese companion also teaches. First understand the learner's exact statement, correction, negation or question; then offer a small useful extension. A word can start a conversation, but is not a permanent ceiling. No quiz loop, forced full sentences, automatic speed escalation, scores or placement questionnaire. Brief Chinese explanations are allowed when asked. Assistance and imitation are not independent mastery.

Warm ivory, muted botanical green, whitespace and restrained typography. One topic card before chatting; one primary microphone while chatting; secondary controls in a sheet, not a button wall. No NHK prerequisite. Topics may lead to interests, work, everyday experience or imagination; the learner's thread takes precedence over the opening.

Entering chat is receive-only. Only tap-to-enable requests microphone permission. Tapping again stops actual input tracks and transmission; mute survives help, repeat, topic changes and monitor handoff. Real RMS samples drive both sound indicators; silence stays flat and preparation is distinct from playback. End/background/error cleans up media. Physical speaker audibility and real iPhone usability need human feedback.

## Native conversation core

`src/companion/connection.ts` keeps one stateful `gpt-realtime-2.1` conversation with original user audio. Ordinary replies omit detached `conversation:none/input:[]`; auxiliary transcription is not added as duplicate native input. The client committed-item gate is the sole response scheduler; VAD `create_response=false`. Respect turn identity, corrections, late items and interrupted/unplayed speech.

`prompt.ts` is shared byte-for-byte between client and server. Usual answers are short by instruction, not rejected by a universal48-character cap. `requestedTurn.ts` gives Help/repeat/simpler/repair a focused response-specific instruction using delivered current context, without fabricating a new user message. Help supplies one usable Japanese phrase now, not an offer to help later. Do not restore the detached teacher-planner/SAY pipeline to satisfy a format test.

The optional learning observer runs asynchronously, never blocks or substitutes a chat response, and separates independent/prompted/imitated evidence. Capability updates are tentative heuristics, not validated fluency or JLPT scores. A signed operational lease and fenced monitor handoff retain the voice peer across short workers; maximum20minutes plus idle/usage guards is not unlimited or crash-proof.

## Topic sources

Local openings are instant; bounded generated batches cover interests, work, imagination and curiosity. Non-news prompts must not assert unsourced trivia. News currently discovers URLs from fixed public NASA/JPL feeds, then independently fetches allowed publisher pages with redirect limits, date/body validation, exact source quotes and alignment review. Feed metadata alone is not factual proof. XML entity/DTD declarations are rejected; inert article HTML inside CDATA is not treated as an executable declaration.

The public-source diagnostic now finds current publisher material, but the full deployed news action has not yet produced a verified card after the latest fix. Keep this failure explicit. Do not invent news, override source gates, use unapproved URLs, bypass a publisher403, or claim search coverage beyond implemented sources. Old optional provider-search compatibility handling is not a working news feed. News must pass a separate end-to-end acceptance before being called complete.

## Privacy and preservation

No raw audio or whole conversation is persisted by this app. Minimal local learning memory is separately opt-in/defaultOFF, inspectable and clearable. Do not infer interests from examples or roleplay. Do not clear existing localStorage or modify old data schemas. Provider processing/retention is separate from app non-persistence.

Provider/service credentials remain server-side. Preserve JWT, same-origin checks, signed tickets/topic integrity and usage protection. Operational table contains only call/expiry/monitor/counter metadata. No cloud profile without separate user identity and authorization. Personal preview only.

## Verification

`npm run typecheck && npm test && npm run build` covers source regression, not learning efficacy. `scripts/companion-phone.mjs` exercises actual UI at390x844 and375x667 with mocked media. `scripts/companion-quality.mjs` reviews original synthetic Japanese and typed help across cat/work/correction/coffee contexts. `scripts/companion-live.mjs` covers native transport/handoff; `scripts/companion-preview-access.mjs` verifies public page/asset hashes and proxy health without bypassing deployment protection. News has a separate deliberately failing gate until actual sourced cards succeed.

Read actual responses and source failures, not only green checks. Full approved design remains `docs/architecture/ADAPTIVE_JAPANESE_COMPANION_V3_20260909.md`. Historical production README is in `docs/history/README-before-companion-v3.md` and must not override this scope.
