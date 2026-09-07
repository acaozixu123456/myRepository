# 日本散步日记 / Nihongo Discovery

## Current user priority — 2026-09-08

**Mobile only.** The user explicitly said desktop is not needed and not to spend time on it. This supersedes earlier desktop-first or desktop-and-mobile plans. Do not add desktop layouts, desktop screenshot runs, mouse/keyboard refinements or desktop acceptance work unless the user explicitly reauthorizes them. Do not spend time deleting otherwise harmless existing responsive styles either.

The active NHK speaking goal is minimal effort to start: open the current article, tap **陪我说一句**, try a word or short clause, use **帮我接** when stuck, and stop after three short exchanges. Focus future work on phone portrait touch use, mobile microphone permission/audio playback, patient pauses, help and immediate microphone cleanup. `scripts/nhk-speaking-browser.mjs` now runs only the phone viewport. A mocked phone-size browser check is not a physical-iPhone or real-human microphone certification.

The speaking pilot was promoted as runtime source `db01434920f127b81e45c1f73bbf9d3d72c93ce6`. Production acceptance run `34137708557` completed successfully, including deployed assets and real OpenAI audio through the Vercel proxy. Source/mobile-flow verification is recorded in run `34136897037`; its historical desktop result is not a requirement going forward. See `docs/product/NHK_SPEAKING_20260907.md` and `docs/qa/nhk-speaking-review-20260907.json`. Subsequent mobile-scope edits affect QA/documentation only, not the deployed speaking runtime. Real human input, physical iPhone/Safari behavior and learning benefit remain unverified.

Sol develops and reviews directly. Do not route this app through Windows Cursor/Codex, legacy Luna, or AppDeploy.

## Entrypoints

- `/`: NHK study and article-bound short speaking practice.
- `/explore.html`: isolated first playable Yanaka street slice, retained without expanding scope.
- `npm ci && npm run dev`: start local development.
- `npm run typecheck && npm test && npm run build`: platform-independent source gates.
- `node scripts/nhk-speaking-browser.mjs`: phone-size speaking UI and mocked media lifecycle acceptance. Real-device limitations must remain explicit.
- `npm run preview -- --host 127.0.0.1 --port 4173`: serve the production build.
- `scripts/explore-browser.mjs`: historical exploration acceptance; do not run its desktop suite for mobile NHK speaking work. Read-only diagnostics are opt-in with `?qa=1`; no gameplay teleport/completion hooks exist.

## Non-negotiable data safety

Do not clear localStorage or rewrite the existing NHK article, knowledge, learning-history, session, backup or restore schemas as part of game or speaking work. The game uses only `nihongo.explore.yanaka.v1`. Corrupt or future-schema game saves are preserved rather than silently overwritten. Game and NHK service-worker navigation shells must remain separate.

No database migrations or provider-secret changes are part of these slices. Existing speech is reused through `/api/nhk-speech`; short speaking adds actions without replacing existing TTS or recording review. Generated text and audio must stay bound to the same line. Speaking starts only after explicit visible consent; the App does not persist realtime recordings or transcripts. These are fictional gameplay purchases, not monetary transactions.

## Exploration snapshot — 2026-09-06

This branch also retains the previously approved first-person Japanese-life exploration prototype. Its historical scope does not override the mobile-only priority above.

OpenStreetMap supplies the approximately 167-meter Yanaka Ginza centerline (ways 737745076 and 671851311). The extract, processing explanation and ODbL attribution are shipped under `public/explore/`. Street width, level ground, building placement, facades, shop names, characters and interiors are fictional game adaptations. No PLATEAU buildings have yet been integrated. No Google Street View imagery is used.

The exploration slice contains free movement/look, a shop doorway and solid counter, a curated multi-step Japanese bento purchase, hints, bookmarking, inventory and isolated save/restore. The exploration game does not yet include unrestricted AI NPC conversation, speech input, photorealistic or production-grade character assets, a full district, multiple interiors, delayed-review scheduling or cloud game saves. The separate NHK page now has the bounded speaking pilot described above.

A successful build or deployment is not final acceptance. Review evidence within the authorized mobile scope and document unverified device risks. Current generated geometry is an interaction prototype, not the final art direction. Never claim physical-device FPS or voice quality based on CI tests.

See `docs/product/EXPLORATION_SLICE_20260906.md` for the historical implementation boundary and subsequent verified review documents for acceptance status. Preserve existing production entrypoints and data. Promote reviewed source only; never auto-promote merely because an execution process ended.
