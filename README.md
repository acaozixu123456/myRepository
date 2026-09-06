# 日本散步日记 / Nihongo Discovery

This branch implements the user-approved 2026-09-06 direction: a first-person Japanese-life exploration web game. Sol develops and reviews directly. Do not route this app through Windows Cursor/Codex, legacy Luna, or AppDeploy.

## Entrypoints

- `/`: existing NHK study experience, retained.
- `/explore.html`: isolated first playable Yanaka street slice.
- `npm ci && npm run dev`: start local development.
- `npm run typecheck && npm test && npm run build`: source gates.
- `npm run preview -- --host 127.0.0.1 --port 4173`: serve the production build.
- `node scripts/explore-browser.mjs`: browser acceptance, requires Playwright Chromium and a functional WebGL environment. Synthetic fixtures and mocked speech failures are explicitly reported. Read-only diagnostics are opt-in with `?qa=1`; no gameplay teleport/completion hooks exist.

## Non-negotiable data safety

Do not clear localStorage or rewrite the existing NHK article, knowledge, learning-history, session, backup or restore schemas as part of game work. The game uses only `nihongo.explore.yanaka.v1`. Corrupt or future-schema game saves are preserved rather than silently overwritten. Game and NHK service-worker navigation shells must remain separate.

No database migrations or provider-secret changes are part of this slice. Existing speech is reused through `/api/nhk-speech`; generated text and audio must stay bound to the same line. These are fictional gameplay purchases, not monetary transactions.

## Real geography versus game adaptation

OpenStreetMap supplies the approximately 167-meter Yanaka Ginza centerline (ways 737745076 and 671851311). The extract, processing explanation and ODbL attribution are shipped under `public/explore/`. Street width, level ground, building placement, facades, shop names, characters and interiors are fictional game adaptations. No PLATEAU buildings have yet been integrated. No Google Street View imagery is used.

## Current scope and quality gate

The initial slice contains free movement/look, a shop doorway and solid counter, a curated multi-step Japanese bento purchase, hints, bookmarking, inventory and isolated save/restore. It does not yet include unrestricted AI NPC conversation, speech input, photorealistic or production-grade character assets, a full district, multiple interiors, delayed-review scheduling or cloud game saves.

A successful build or deployment is not final acceptance. Review renderer screenshots, collision/control evidence, purchase outcomes, old NHK regressions, audio success/failure handling, and unverified device risks. Current generated geometry is an interaction prototype, not the final art direction. Never claim physical-device FPS based on software-GPU CI tests.

See `docs/product/EXPLORATION_SLICE_20260906.md` for the implementation boundary and subsequent verified review documents for acceptance status. Preserve the existing production entrypoint until review gates pass. Promote reviewed source only; never auto-promote merely because an execution process ended.
