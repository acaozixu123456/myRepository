# ひとこと — Japanese conversation companion

## Current release — 2026-09-10

Personal production release is available at:
https://nihongo-discovery-v2-20260831.vercel.app/companion.html

The original NHK library remains at `/`; no articles, favorites, history, backups, quiet-study or game data were migrated or cleared. PR #5 was merged; its old draft description and earlier preview failure reports are historical, not the current release state.

**Latest functional decision: PASS_FOR_PERSONAL_PRODUCTION_RELEASE.** Read `docs/qa/COMPANION_PRODUCTION_LIVE_RESTORED_20260910.json` for the exact evidence and limits. Run34439718111 passed actual production native audio, silent written feedback, seven semantic fixtures, fault isolation, microphone/exit, continuity and sourced-news checks. Its four audio inputs are synthetic and six inputs are typed: it is NOT a human iPhone or learning-outcome study. Full unit suite, typecheck/build and exact deployed assets also passed. Historical credit exhaustion and failed attempts remain recorded; credit recovery was established by real generation, not model metadata health alone.

Mobile only. Sol develops/reviews directly through connected GitHub and the existing Supabase service. No Windows Codex/Cursor, Luna, AppDeploy, desktop layouts or historical game work. Do not claim that a successful deployment, green format check or longer model-generated sentence proves learner progress.

## Experience and teaching boundaries

One coherent adult Japanese partner follows the learner's actual meaning. Low effort to start does not impose a permanent low ceiling. Topics need no NHK prerequisite and can concern interests, everyday life, work, imagination or sourced news.

Warm ivory, muted botanical green, whitespace and restrained typography. One topic card before chat, one primary microphone while chatting, secondary choices in a sheet. Do not add a dashboard or a wall of buttons.

**Voice chats; the text lane teaches quietly.** `WrittenNoteCard` retains the original utterance and can show one minimal correction, an optional extension, a requested phrase or a short Chinese language explanation. Natural short answers and successful self-repairs may need no note. Ordinary notes do not demand repetition or launch speech. `接不上` requests written help, not an extra voice lesson. Audible explanation remains possible only when explicitly requested.

Requested help distinguishes known learner intent from unknown illustrative answers and open starters. Examples are labelled in Japanese and Chinese, not certified as personal facts. Preserve dates, precise time windows, negation and the latest correction; do not narrow 午前 to 朝 just to simplify a sentence.

## Native voice and independent text

`src/companion/connection.ts` keeps one stateful `gpt-realtime-2.1` conversation with original user audio. The client committed-item gate is the sole response scheduler; VAD automatic responses are disabled. Auxiliary transcription is fallible and is not duplicated as another native user message. Do not restore a detached ASR/text-plan/SAY pipeline for normal conversation.

`WrittenLane` owns optional text request cancellation, stable anchors, source/epoch validation, reading deferral and stale-note removal. It cannot operate audio or cancel a voice reply. The real production test deliberately stalled and failed a feedback request while native chat continued. The unused `quietFeedback.ts` draft is NOT a replacement to integrate again.

The optional observer is asynchronous and separates independent, prompted and imitated evidence. Visible notes do not prove independent mastery. Manual difficulty changes and assistance updates fence out stale proposals. Learning policy is a conservative heuristic, not a JLPT or fluency grade; human feedback remains necessary.

## Microphone, privacy and operations

Entering chat is receive-only. Only the user's microphone tap requests access. Closing it stops real input tracks; help, topic changes and monitor handoff do not silently reopen it. Real RMS drives sound indicators; silence is flat and preparation differs from playback. Exit, background and errors clean up media.

No raw audio, whole transcript or text notes are persisted by the app. Minimal learning memory is separately opt-in, OFF by default, local, inspectable and clearable. Do not infer user interests from roleplay or example sentences. Never clear old localStorage or silently add cloud learning profiles. Provider retention is separate from app non-persistence.

The explicitly authorized `nihongo-companion` backend uses an operational-only lease/usage table and existing server credentials. Version15 pins `f0cb874fd29da2bfe9ee85a1b0dff6f570de5a77`. Keep JWT, same-origin checks, signed tickets/topics, bounded time/usage and credential isolation. No recharge, spend-limit change or silent model switch was performed. The 20-minute maximum and idle/usage guards are limits, not unlimited or crash-proof promises.

## Topic sources and honest limits

Instant local openings and bounded generated batches support non-news chat. News discovers public publisher material, fetches allowed pages and checks dates, excerpts and source alignment. The latest real production request returned four dated cards from two NASA science/nature pages. This closes the previous end-to-end news availability blocker, not all possible content-quality concerns.

Coverage remains narrow, not full-web news. Some openings may still be technical or refer too much to source pictures; improve self-contained accessible openings rather than claiming every card is ideal. Source gates do not guarantee universal factual correctness. Never fabricate current events, weaken evidence checks to obtain a green test, bypass publisher403 responses or confuse retrieval date with publication date.

## Verification and recovery

`npm run typecheck && npm test && npm run build`

- `scripts/companion-phone.mjs`:390x844 and375x667 actual UI with mocked media; not a real iPhone.
- `scripts/companion-release-live.mjs`:actual public native audio and independent text/news checks. `scripts/release-test-diagnostics.py` applies whitelisted diagnostics and verifies the existing microphone accessible name before aligning the test locator.
- `scripts/companion-preview-access.mjs`:exact served asset hashes and basic proxy checks, not paid generation readiness by itself.

Use the latest release audit and canonical durable task state in `acaozixu123456/sol-luna-accelerator`, command branch `sol-router-gateway-v0.1`, task `nihongo-discovery-app`. The approved architecture remains `docs/architecture/ADAPTIVE_JAPANESE_COMPANION_V3_20260909.md`; subsequent quiet-text decisions supersede its original spoken-help behavior. Keep all older failure evidence and clearly state human-phone, generative-variability and long-term learning limits.
