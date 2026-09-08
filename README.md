# 日本散步日记 / Nihongo Discovery

## Current user priority — 2026-09-08

**Mobile only.** Do not add desktop layouts, desktop screenshots, mouse/keyboard refinements or desktop acceptance work unless explicitly reauthorized. Do not waste time deleting harmless existing responsive styles. The exploration prototype is retained, not expanded or tested on desktop for this NHK speaking task.

The active goal is minimal effort to speak through **random article-related simple chat plus current-turn support**, not a fixed three-turn drill. Preview an easy topic, tap **换个话题** as often as desired, then **陪我说一句**. Local topic browsing does not call an API or open the microphone. In-call changes reuse the current connection. Respond to the learner's actual words, accept short/partial/Chinese attempts, and never end merely because three turns elapsed. Keep the topic connected to the current article and separate personal or hypothetical discussion from news facts.

## Current-turn support

Each completed assistant utterance can show up to two short keyword options and one unfinished Japanese starter. These are optional speaking aids, not buttons the learner must choose, an answer key or proof of mastery. **帮我接** offers an optional short example for the actual current question. **收起提示 / 显示提示** controls the lightweight scaffold without reconnecting. The example is not shown as a default full answer sheet and must not become a saved learner preference.

Audio and hints are separate: the voice lifecycle never waits for a hint request. Detached realtime TEXT responses prepare bounded hint JSON; purpose, turn key and per-request identity gate every completion. Late hints are discarded on topic change, new utterance, learner speech, hiding or closing. Known hint failures must not kill the microphone. Plain/fenced/blockquote/single-parenthesis JSON presentation is normalized without evaluation; all field/type/length and turn checks remain mandatory. No provider schema-guarantee is claimed.

Conversation should not become an interview. After consecutive questions prefer a brief relevant reaction; answer the learner's own simple questions directly. At most one question is allowed, but a question is not mandatory. Keep adult tone and preserve intended meaning; do not fabricate AI personal experiences, inflate difficulty or score the learner. These are model instructions, not a guarantee that every generated utterance obeys.

**体验记录 is optional, default OFF, local only.** Explicit opt-in stores only whitelisted UX counts and coarse service-wait estimates under `nihongo-chat-experience-v1`, at most 30 records within the rolling 14-day UTC-date window, pruned on use/reopen/export. There is no upload, recording, transcript, article identity or account identifier. Turning it off or clearing removes only this module's observations, never the NHK library. Corrupt/future records are preserved until explicit clearing. Occasional effort feedback is skippable. Service timing is not acoustic onset, learner thinking speed, pronunciation or learning evidence. See `docs/product/NHK_TURN_SUPPORT_20260908.md` and the acceptance record.

The finite article-matched topic pool is exhausted before repeating. Longer chats renew bounded voice transport with recent in-memory context; a brief pause may occur. Sixty seconds without speech pauses the microphone. Ending, leaving or errors must close tracks. No new chat recordings, transcripts or proficiency scores are persisted.

The overly strict two-starts-per-two-minutes limiter remains removed. Existing abnormal-use guards and differentiated App/OpenAI failures remain unchanged. Hints add paid text generation; collapsing them suppresses new hint calls. Never claim unlimited/free service or zero provider retention. Individual account authentication is still required before broad public release.

Sol develops and reviews directly. Do not route this app through Windows Cursor/Codex, legacy Luna or AppDeploy. The September 7 three-turn pilot is historical, not the current specification.

## Entrypoints and acceptance

- `/`: NHK study, random light chat and current-turn support.
- `/explore.html`: historical Yanaka street prototype, retained.
- `npm ci && npm run dev`: local development.
- `npm run typecheck && npm test && npm run build`: platform-independent gates.
- `scripts/nhk-turn-support-browser.mjs`: phone-only UI with explicitly mocked media/provider.
- `scripts/nhk-turn-support-live.mjs`: actual API and synthetic, not human, speech; apply `scripts/nhk-chat-live-diagnostics.mjs` first as CI does.
- `scripts/nhk-turn-support-production.mjs`: exact promoted asset hashes and existing voice proxy.

Deployment success is not final acceptance. Review source, phone screenshots, unit and actual API evidence separately. Do not claim physical-iPhone compatibility, perceived voice quality, latency improvement or learning benefit from mock/synthetic checks. Historical desktop game QA is not a requirement for this task.

## Data safety

Do not clear localStorage or rewrite existing NHK article, knowledge, learning-history, session, backup/restore or quiet-study schemas. Game data remains under `nihongo.explore.yanaka.v1`; corrupt/future-schema saves are preserved. Game and NHK navigation shells remain separate.

No database migrations, key changes or server speech replacements are part of this iteration. The existing `gpt-realtime-2.1`, JWT-protected edge, Vercel speech proxy, TTS/review, transport lifetime and usage guards remain in place. Long-lived OpenAI and Supabase service-role keys stay server-side and out of GitHub, frontend code, URLs and chat. Microphone transmission requires visible explicit consent.

## Historical exploration snapshot — 2026-09-06

OpenStreetMap supplies the approximately 167-meter Yanaka Ginza centerline (ways 737745076 and 671851311). Attribution remains under `public/explore/`. Width, ground, buildings, shops, people and interiors are fictional adaptations. No PLATEAU or Google Street View integration. The isolated street, shop, bento purchase, hints, bookmarks, inventory and saves are retained without expanding scope. See `docs/product/EXPLORATION_SLICE_20260906.md`; historical game goals never override mobile-only speaking priorities.
