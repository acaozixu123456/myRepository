# Exploration slice: supervisor review, 2026-09-06

## Decision and boundary

Reviewer: ChatGPT Sol, direct implementation and evidence review.

- **PASS — limited technical interaction preview**, based on the tests and screenshots below. This is not acceptance of the complete approved game plan.
- **REVISE — final art quality and immersion**. Current street facades repeat, lighting is too bright in places, and the character is a simple procedural model. Do not describe this as finished premium game artwork.
- **NEEDS_ATTENTION — physical-device performance, Safari game rendering/audio, microphone input and a full playable district**. No physical iPhone performance measurements were collected.

Keep `/` as the existing NHK app. The optional preview entry is `/explore.html`. No NHK articles, knowledge records, backup/restore formats or database schemas were changed. Game saves use only `nihongo.explore.yanaka.v1`. Corrupt/future saves are not silently overwritten. The production URL is not considered verified merely because a Git commit or Vercel build succeeds; production smoke must confirm deployed hashes and actual interactions.

## Verified source and evidence

Functional browser source: `51f4055f2f587e1292cd070c1a495c7af498c1e1`.
GitHub Actions run `34003109911`, artifact `nihongo-explore-acceptance-3` (`9980134324`). Typecheck, all **129 unit tests in 18 files**, and production build passed. Eight browser groups passed: desktop real WebGL movement/turning; modal pause/provenance; ambiguous Japanese clarification; warm/no-bag purchase and one-time 650-game-yen charge; reload and untouched synthetic NHK marker; physical shop doorway traversal; simultaneous mobile touch movement/look; no uncaught JS errors. Ten actual renderer screenshots were generated and reviewed, including street, shop, dialogue, receipt and mobile layouts.

The original short doorway check alone does not prove sustained counter blocking; an additional `explore-counter-browser.mjs` test is required by the cleaned read-only verification workflow. Its result must be recorded from the actual run, not assumed here.

Browser tests use fresh synthetic local saves, a software GPU, reduced desktop device pixel ratio, and mocked speech failures. They do not establish target desktop/mobile frame rates, real microphone behavior, or human-perceived pronunciation. These tests made zero real AI requests.

Old NHK regression: run `34002496961`, artifact `nihongo-explore-nhk-regression-1` (`9979929626`). Reliability browser suite: six case groups, six audits, no runtime errors. Calm browser suite: fifteen case groups, forty audits, no runtime errors. The mocked fixtures are test data, not the user's personal records.

Real speech backend check: one request for `お弁当、温めますか。`; HTTP 200, trusted existing storage host, 38,400 MP3 bytes successfully decoded by Chromium AudioContext as approximately 2.40 seconds. This verifies real generation/download/decode, not a human listening test or real-iPhone autoplay behavior. Test output is `explore-real-audio.json` in the NHK regression artifact.

## Real map, fictional game adaptation

The 167.42-meter centerline uses OpenStreetMap Yanaka Ginza ways 737745076 and 671851311, with public GeoJSON, provenance and attribution. Flat ground, road width, buildings, signs, fictional shop/NPC names and interiors are game adaptations. No PLATEAU building models or Google Street View imagery are included. The preview is not a navigation product.

## Current feature limits and next acceptance target

The current purchase is one curated scenario with recognized Japanese variants, hints, meaning explanations, text-linked playback, bookmarks and game inventory. It is not unrestricted AI NPC conversation, pronunciation assessment, spaced review, cloud game storage, or a full 300-meter district. Do not substitute scene size for quality.

Next implementation focus: replace repeated facades and primitive character assets, rebalance light/materials, improve immediate shop discovery, and test the scene on the user's actual desktop and mobile browsers before widening the map. Preserve this real-road/stateful-interaction foundation and all original NHK records. Review speech success and failure on the actual game page, not only the backend.

## Release hygiene

Temporary encoded transfer files, one-off patch scripts and the workspace preparation workflow are removed from the release tree. Verification is read-only and no longer edits or pushes source. No production-secret changes, database migrations, paid asset purchases or user-data deletion are part of this slice.
