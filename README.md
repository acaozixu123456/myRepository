# 日本散步日记 / Nihongo Discovery

## Current user priority — 2026-09-08

**Mobile only.** Do not add desktop layouts, desktop screenshots, mouse/keyboard refinements or desktop acceptance work unless explicitly reauthorized. Do not waste time deleting harmless existing responsive styles. The exploration prototype is retained, not expanded or tested on desktop for this NHK speaking task.

The active goal is minimal effort to speak, now with **random article-related simple chat** rather than a fixed three-turn drill. Preview an easy topic, tap **换个话题** as often as desired, then **陪我说一句**. Local topic browsing does not call an API or open the microphone. In-call topic changes reuse the current connection. Respond to the learner's actual words, accept short/partial/Chinese attempts, use **帮我接** for the latest question, and never end merely because three turns elapsed. Keep the topic connected to the current article and clearly separate personal or hypothetical discussion from news facts.

The topic pool is curated and article-matched, not infinitely many unique AI-generated topics. A pool is exhausted before repeating, avoiding immediate repetition. Longer chats renew the bounded voice transport while preserving the topic and recent in-memory context; a short reconnection pause may occur. Sixty seconds without speech pauses the microphone. Leaving the page, ending or encountering an error must close microphone tracks. No raw audio, transcripts or new scores are persisted by this module.

The old two-starts-in-two-minutes limiter was inappropriate for this interaction and is replaced by abnormal-traffic guards. App burst/hourly/daily protections and OpenAI rate-limit/insufficient-credit failures have distinct messages. Do not describe API usage as unlimited or free. Current backend limits are documented in `docs/product/NHK_RANDOM_CHAT_20260908.md`; individual account authentication is still needed before broad public release.

Sol develops and reviews directly. Do not route this app through Windows Cursor/Codex, legacy Luna, or AppDeploy. The September 7 bounded speaking pilot remains historical evidence; it is not the current interaction specification.

## Entrypoints and source gates

- `/`: NHK study and article-related voice chat.
- `/explore.html`: isolated historical first-person Yanaka street prototype, retained.
- `npm ci && npm run dev`: local development.
- `npm run typecheck && npm test && npm run build`: platform-independent source gates.
- `node scripts/nhk-chat-browser.mjs`: phone-size UI and **mocked** media lifecycle acceptance.
- `scripts/nhk-chat-live.mjs`: real API/WebRTC probe using **synthetic**, not human, speech. Apply its test-fixture diagnostics helper first as the workflow does.
- `scripts/nhk-chat-production.mjs`: deployed chat asset/proxy validation.
- `scripts/explore-browser.mjs`: historical game QA, not a requirement for mobile NHK chat work.

A successful deployment is not final acceptance. Review test scope, source changes, phone screenshots and real voice evidence separately. Do not claim physical-iPhone compatibility, subjective voice quality, pronunciation accuracy or learning benefit from a mock or synthetic-audio run. See `docs/product/NHK_RANDOM_CHAT_20260908.md` and the dated QA record for verified versus unverified facts.

## Non-negotiable data safety

Do not clear localStorage or rewrite existing NHK article, knowledge, learning-history, session, backup or restore schemas. The exploration game uses only `nihongo.explore.yanaka.v1`; corrupt/future-schema saves remain preserved. Game and NHK service-worker navigation shells remain separate.

No database migrations or provider-secret changes are part of this slice. `/api/nhk-speech` retains existing TTS and recording review; chat adds compatible actions. Long-lived OpenAI and Supabase service-role keys remain server-side and must never enter GitHub, frontend code, URLs, chat or durable context. Microphone transmission requires an explicit visible consent action. App recording retention is separate from the provider's API data policies.

## Historical exploration snapshot — 2026-09-06

OpenStreetMap supplies the approximately 167-meter Yanaka Ginza centerline (ways 737745076 and 671851311). Attribution and processing notes remain in `public/explore/`. Width, flat ground, building placement, facades, shop names, characters and interiors are fictional adaptations. No PLATEAU buildings or Google Street View imagery have been integrated.

The isolated exploration slice contains free movement/look, a shop doorway and solid counter, a curated bento purchase, hints, bookmarking, inventory and isolated save/restore. It is not unrestricted AI NPC conversation, photorealistic art, a full district, multi-interior gameplay or cloud game saves. See `docs/product/EXPLORATION_SLICE_20260906.md`. This historical scope never overrides the mobile-only speaking priority.
