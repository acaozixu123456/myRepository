# 日本散步日记 / Nihongo Discovery

## Latest directive — visual rebuild, 2026-09-06

The user has explicitly prioritized genuinely high-quality street graphics, lighting and characters. This iteration does not work on NHK and must NOT run NHK regressions or live NHK AI checks. This overrides the earlier every-batch regression requirement. Preserve existing NHK data without spending this iteration on NHK features or regression suites.

Current work branch: `nihongo-visual-quality-20260906`.
Authoritative current scope and visual acceptance: `docs/product/VISUAL_QUALITY_REBUILD_20260906.md`.
The production build at `85134634d7eeb0b593c9b533145711849f7d57b1` remains an interaction prototype; it has NOT passed the user's final art-quality requirement.

Sol develops and reviews this app directly. Do not route it through Windows Cursor/Codex, legacy Luna, or AppDeploy.

## Entrypoints

- `/`: existing NHK study experience, retained but outside the current work scope.
- `/explore.html`: independent playable Yanaka street prototype.
- `npm ci && npm run dev`: local development.
- `npm run typecheck && npx vitest run src/explore && npm run build`: compilation and focused game tests. Do not replace this with the full NHK test suite in the graphics iteration.
- `npm run preview -- --host 127.0.0.1 --port 4173`: serve the production build.
- `node scripts/explore-browser.mjs`: game browser acceptance with Playwright Chromium and WebGL. Synthetic fixtures and mocked speech failures are explicitly reported. Read-only diagnostics are opt-in with `?qa=1`; no gameplay teleport/completion hooks exist.

## Data safety

Do not clear localStorage or rewrite existing NHK article, knowledge, history, session, backup or restore schemas. The game uses only `nihongo.explore.yanaka.v1`. Corrupt or future-schema game saves are preserved rather than silently overwritten. Game and NHK navigation shells remain separate.

No database migrations or provider-secret changes are part of graphics work. Existing speech is retained, not redeveloped in this iteration. Gameplay purchases are fictional, not monetary transactions.

## Geography and adaptation

OpenStreetMap supplies the approximately 167-meter Yanaka Ginza centerline (ways 737745076 and 671851311). GeoJSON, processing explanation and ODbL attribution are under `public/explore/`. Width, ground height, building placement, facades, shop names, characters and interiors are game adaptations. PLATEAU buildings have not yet been integrated. No Google Street View imagery is used.

## Quality and release

Build/deployment success does not mean visual acceptance. The previous art is procedural prototype geometry, not the final art direction. Start with a high-quality desktop visual benchmark; provide a separate mobile quality tier. Do not infer physical-device FPS from software-GPU CI.

Review actual rendered street, storefront, interior and character views, along with a real walking check. Concept images or third-party promotional renders are never implementation evidence. Keep the current released build until new visual assets and lighting have been reviewed. Before promoting game-only changes, ensure inherited NHK production workflows will not run unnecessarily.

Historical implementation boundary: `docs/product/EXPLORATION_SLICE_20260906.md`.
Historical technical preview evidence: `docs/product/EXPLORATION_ACCEPTANCE_20260906.md` and issue #3.
