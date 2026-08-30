# Nihongo Discovery — Connected Immersion Content Pipeline

This branch is the app-readable source of truth for continuously published Nihongo Discovery content.

## Current product model

New content is organized as a **connected immersive world**, not a random feed.

Canonical structure:

`World -> Season -> Episode -> Callback -> Transfer`

The active canon is stored in `WORLD_CANON.json`. The first world is `life-in-japan` (“在日本生活和工作的我”), and the first season is `release-week-01` (“项目上线前的一周”). Stable cast, locations, relationships and prior events persist across episodes.

Old standalone Discoveries remain valid legacy/catalog content. Do not rewrite or delete them just to fit the new world. They may still be used by Atlas, Review and as early callback material.

## Files

- `nihongo-discovery/content/WORLD_CANON.json` — authoritative world/season/cast/location/episode-slot canon.
- `nihongo-discovery/content/manifest.json` — canonical published dynamic Story manifest consumed by the App backend.
- `nihongo-discovery/content/HOURLY_EDITOR.md` — execution contract for the scheduled content factory.

## Core learning rule

Each connected episode must maintain three lines:

1. **Plot continuity** — people, time and events continue from earlier episodes.
2. **Language progression** — at most one new core target, plus natural callback opportunities to earlier targets.
3. **Memory retrieval** — the App can prioritize callback/review cues using the learner's local weakness state; the content factory supplies valid callback links but does not require private learner history.

The product remains **Continue Play-first and audio-first**. The existing seven-stage loop is preserved:

`听一句猜意思 -> 现场怎么回 -> 平时怎么说 -> 敬语怎么说 -> 商务日语怎么说 -> 换个情景(5个) -> 自己说一遍`

For the five changed scenarios in a connected episode:
- scenarios 1–3 stay inside the current continuous world/plot;
- scenarios 4–5 leave that world and test genuine transfer to other life situations.

## Hourly publication behavior

“Runs every hour” does not mean “publishes every hour”.

The editor must:
1. read `WORLD_CANON.json`, the prior episode and recent summaries;
2. locate the earliest missing canonical episode slot;
3. publish nothing when the prepared forward buffer is already 3 episodes or more;
4. otherwise generate at most one earliest-missing episode;
5. validate cast/time/location/register/callback continuity;
6. direct-publish after autonomous checks, with no human approval stage;
7. save a compact durable episode summary for the next run.

While an active connected season exists, do not generate unrelated standalone filler. If the season is complete, publish zero until a new season is added to canon.

## Story shape for connected episodes

Every new connected Story keeps the existing Story/Play compatibility fields and adds:
- `series`: world/season/episode ids, previous/next episode ids, location, cast, canon revision, previous summary, today hook and durable episode summary;
- `callbacks`: earlier episodes/Discoveries naturally reused by this episode.

`nextId` remains only for legacy compatibility. Connected navigation is controlled by `series.nextEpisodeId`.

`play` remains the authoritative text source for the active UI and static audio pipeline. It must contain natural `daily`, `polite`, `business`, `businessNote`, `replyPrompt`, `reply`, and exactly five scenarios.

## Difficulty and quality

Main content uses `N3`, `N2` or `N1`; N3 is the hard floor for a standalone learning target. Prefer useful real-life nuance, modality, indirectness, workplace communication and register shifts.

Before publishing, autonomously check:
- Japanese naturalness and N3+ learning value;
- one-new-target discipline;
- canonical plot/cast/time/location consistency;
- valid callback links and non-repetitive reuse;
- communicative-intent alignment across daily/polite/business registers;
- exactly 5 meaningful changed scenarios with the 3+2 continuity/transfer split;
- factual/source accuracy when external claims are used;
- duplication and safety.

Publishing zero is better than filler.

## Audio boundary

The hourly content task never generates or changes production audio. Newly published text uses `audio.status = "not_ready"`; the existing bounded Play Audio backfill later prepares reusable static clips. Learner taps remain cache-only and missing audio falls back to text.
