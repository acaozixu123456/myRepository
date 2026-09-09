# ひとこと — Japanese conversation companion / independent v3 preview

## Current scope — 2026-09-09

Mobile only. Sol develops and reviews directly using the connected repository and existing services. No Windows Codex/Cursor, Luna, AppDeploy, desktop UI or historical game work. This branch is an independent candidate; PR #5 remains a draft. Do not replace the production NHK app merely because a deployment or transport test is green.

The user explicitly authorized the separate `nihongo-companion` Supabase service, operational-only lease/usage table, and reuse of existing server credentials. This is not permission to store recordings, full transcripts or cloud learning profiles. Existing NHK articles/favorites/history/backups/quiet-study/TTS remain unchanged.

## Product and UI

One coherent adult Japanese partner also teaches. Follow the learner's actual statement, question, correction and negation first. Start with a word if useful, then invite a small extension when there is evidence; no permanent beginner ceiling or arbitrary level-up. Explain Japanese questions briefly in Chinese when needed. Help means providing a usable short expression now, not offering to help later.

`/companion.html` is the independent mobile entry, without an NHK prerequisite. Warm ivory and muted botanical green, generous whitespace, restrained type and small original decorative shapes. One topic card before chatting; one primary microphone during the conversation. Secondary controls live in a sheet. No feature/button wall, AI dashboard, compulsory grading or placement questionnaire.

Explicit mic consent: entering chat is receive-only. Only tap-to-enable requests the mic. Tap again stops real input tracks; mute persists through help, replay, topic switch and monitor handoff. Real RMS drives each side's activity; silence stays flat, preparation is distinct from playback. End/background/error closes resources. Actual iPhone audibility and usability require human feedback, not an emulated viewport.

## Conversation core

`src/companion/connection.ts` maintains ONE native stateful Realtime conversation using `gpt-realtime-2.1`. Ordinary replies use original audio in the default conversation; no detached ASR-to-text-plan-to-SAY gate. Auxiliary transcripts never become duplicate native input. The client committed-item gate is the sole response scheduler; server VAD `create_response=false`. Late, corrected and interrupted items are handled separately.

`prompt.ts` is shared byte-for-byte between client policy updates and server initialization. Typical replies are small by instruction, not rejected solely because of a universal 48-character rule. Optional observer runs asynchronously, distinguishes assistance/imitation from independent evidence, and never substitutes a canned response. Its capability hypotheses are not validated JLPT or fluency scores.

A signed operational lease and fencing monitor ownership keep the same voice connection alive while short backend workers hand off. Current maximum is 20 minutes, with an idle pause and usage protection; do not describe an unlimited or crash-proof connection. Permanent provider keys stay server-side. JWT/origin/signature checks remain enabled. The deployment is a bounded personal preview without individual cloud-account memory.

## Topics and sources

Local openings are instant; generated batches provide interest, work, imagination and curiosity topics. Non-news questions must not assert unsourced facts. News discovery uses search only to locate URLs. Allowed publisher pages must be fetched with restricted redirects, recent publication metadata and actual title/body material. News candidates need an exact source quote and a separate title/background alignment check. A failed source/date/check returns explicit `news_unavailable`; it cannot fabricate a fresh headline. This is stronger provenance, not a guarantee of every semantic judgment. No scraping of employer files or emails.

## Preservation and learning memory

No raw audio or full conversation is persisted by this app. Optional local learning memory is default OFF, separate from old diagnostics. The user can inspect/clear it; schema whitelists capability metadata and excludes native message IDs. Never clear existing localStorage, alter old learning schemas, or infer interests from an example or roleplay. Provider retention is separate from app persistence.

## Acceptance

- `npm run typecheck && npm test && npm run build`: source and regression, not learning outcomes.
- `scripts/companion-phone.mjs`: actual UI at 390x844 and 375x667, mocked transport/media.
- `scripts/companion-live.mjs`: real native audio transport, synthetic Japanese plus typed questions, explicit semantic review pending.
- `scripts/companion-quality.mjs`: word/fragment progression and direct help; mechanical assertions never replace reading the actual replies.
- `scripts/companion-preview-access.mjs`: public preview asset/health check. It must report authentication failures, never disable or work around deployment protection.

Before promotion, review replies for continuity, negation, corrections, immediate help and appropriate scaffolding; inspect phone screenshots, resource cleanup and source provenance. Preserve failing evidence rather than claiming all workflows passed. Full architecture: `docs/architecture/ADAPTIVE_JAPANESE_COMPANION_V3_20260909.md`. Historical production README remains in `docs/history/README-before-companion-v3.md` and must not override v3.
