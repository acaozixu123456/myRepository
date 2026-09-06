# Nihongo exploration: first playable slice

## User-approved direction / scope

2026-09-06: the user approved a first-person Japanese exploration web game, with free movement, stylized real Japanese geography, people/events and meaningful Japanese communication. This supersedes the previous NHK-only product direction but does NOT authorize deletion of NHK data. Continue direct Sol development; do not use Windows/Cursor, old agent transports or AppDeploy.

Repository: acaozixu123456/myRepository; baseline production branch nihongo-vercel at 3e894ec65b0ec6a3cf7d3347947b2ed54d65b1f0. Development branch: nihongo-explore-slice-20260906. Existing production origin: https://nihongo-discovery-v2-20260831.vercel.app. New additive entry: /explore.html. Root remains NHK. Existing Supabase project and speech API are reused without key/model changes.

## Implemented scope

Babylon.js 9.25.0, TypeScript, separate Vite entry. Approximately 167 metres of Yanaka Ginza road centerline, actual attributed OSM way IDs 737745076 and 671851311, excerpt and provenance under public/explore. Widths, flat elevation, all building positions, facades, shop identities, interiors and characters are fictional adaptations. No PLATEAU data or Google Street View assets are used. Procedural architecture, textures and characters are authored for this prototype; they are not final production artwork.

Desktop WASD/arrow movement, mouse look, collision boundaries, one enterable bento shop, shopkeeper, resident, menu, notice and cat interaction points. Mobile landscape dual-touch joystick and look. Modal conversations pause movement. Map, notebook, inventory, pause, return to street start and NHK return link.

Bounded deterministic Japanese phrase recognition for one bento purchase: order, heat, bag, payment. Warm/bag choices affect inventory and total (650 yen plus optional 3 yen bag); one-time charge. Ambiguous unsupported input gets an explicit clarification, not fabricated acceptance. This is not a general AI dialogue engine. TTS calls existing /api/nhk-speech only on interactions/replay, binds audio to exact text, cancels stale requests, offers explicit system Japanese voice fallback; no voice input implemented.

Independent localStorage key nihongo.explore.yanaka.v1. Existing NHK article/knowledge/session keys are not cleared, migrated or rewritten. Unknown/corrupt game saves are preserved read-only. Hints seen for a purchase step persist across reload; seeing a phrase alone is not counted as independently using it. Task-level assisted/independent counts are not proficiency or exact-phrase mastery. Game progress is browser-local, not cross-device cloud sync.

Service-worker navigation cache separates /explore.html from /; a game visit must never replace the offline NHK shell. No fake offline-success message when a missing game page cannot be loaded.

## Acceptance / evidence

Do not equate a successful build with visual approval. Local typecheck and 129 unit tests passed before initial browser gate; browser evidence is produced by scripts/explore-browser.mjs and the exploration verification workflow. Its AI failures are synthetic; real audio transport is a separate production check. Software-GPU FPS is not physical-device performance evidence. Publication and visual acceptance must be confirmed by supervisor review after the test artifacts.

## Not implemented / next work

Final high-quality environment and rigged animated character art; PLATEAU building integration; additional interiors/streets; semantic AI dialogue; press-to-talk speech input; delayed cross-scene retrieval; account/cloud saves; physical iPhone audio, heat/memory/endurance performance. The current slice proves and evaluates foundations; it does not complete the four-phase roadmap.
