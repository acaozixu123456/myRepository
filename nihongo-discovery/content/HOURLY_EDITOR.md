# Nihongo Discovery — Hourly Connected-World Content Factory Contract

This file is the execution contract for the scheduled ChatGPT content task.

## Product goal

The App is a **connected immersive Japanese world**, not a random hourly knowledge feed.

Publishing zero is correct whenever the active season already has enough prepared episodes or the next episode cannot meet continuity/quality requirements.

Canon lives in `WORLD_CANON.json` with:
- `activeSeasonId` — the season the hourly task should extend
- `seasons[]` — durable season bibles (do not fork parallel worlds)
- `world.cast[]` — canonical recurring people and their fixed visual descriptors
- `world.locations[]` — canonical recurring locations
- `world.styleBible` — shared visual + cast consistency rules for scene images

Do not modify App source code or production audio from this task.

## Required run sequence

1. Read `README.md`, this file, `WORLD_CANON.json`, and the latest `manifest.json` from branch `nihongo-content`.
2. Resolve `activeSeasonId` and the matching season entry in `WORLD_CANON.json`.
3. Inspect the previous episode plus the latest three connected-world episodes and their summaries/callbacks.
4. Inspect the next canonical episode slot for the active season only.
5. Count prepared connected-world episodes ahead of the earliest missing slot in the active season. If buffer >= `bufferTarget` (default 3), publish nothing.
6. Otherwise generate only the earliest missing episode slot. It must:
   - teach at most one new core Japanese target;
   - advance the same plot timeline;
   - naturally reuse two earlier targets when possible;
   - reuse only canonical cast/location IDs from `WORLD_CANON.json`;
   - include first-class `series`, `callbacks`, `play.semantics`, and `visualMeta`;
   - keep exactly five `play.scenarios` (3 in-world, 2 transfer).
7. Run autonomous continuity and quality checks before publishing (`node scripts/validate-connected-episode.mjs`). The validator reads `WORLD_CANON.json`; do not bypass it by inventing local cast/location IDs.
8. If all checks pass, append/update exactly one item with `status: "published"` and `audio: {"status":"not_ready"}`.
9. Commit `manifest.json` to branch `nihongo-content`.
10. Re-read the committed manifest and verify `/api/news-content` propagation.

## Play semantics contract (required for connected episodes)

Step 2 of the seven-stage flow is **not** always “listen to the other speaker”. Each episode must declare:

```json
{
  "play": {
    "replyPrompt": "canonical utterance for the prompt clip — must match audio exactly",
    "reply": "canonical learner response — must match audio exactly",
    "semantics": {
      "interactionType": "exchange | self-observation | system-announcement",
      "promptSpeaker": "learner | other | system | narrator",
      "promptSpeakerId": "tanaka",
      "learnerRole": "respond | observe | decide",
      "uiCue": "Renderer-facing short instruction; self-observation must not say 对方"
    }
  }
}
```

Rules:
- `exchange`: `replyPrompt` is the other speaker and `promptSpeakerId` must be a canonical cast ID also present in `series.castIds`; `reply` is the learner; pair must be plausible.
- `self-observation`: `replyPrompt` is the learner's judgment/observation; UI must not label it as 对方.
- `system-announcement`: station/broadcast voice; learner responds in `reply`.
- Audio text must remain **identical** to the canonical displayed utterance for each clip.

## Visual metadata (required for connected episodes)

```json
{
  "visualMeta": {
    "sceneId": "release-week-ep01",
    "palette": ["#3d5a80", "#6b9ac4", "#dbe7f3"],
    "locationId": "station",
    "castInScene": ["public-service"],
    "imagePrompt": "Rainy station platform at dawn; protagonist checks the delay while the station staff watches the platform; anxious but restrained mood; no text"
  }
}
```

Rules:
- `series.locationId` and `visualMeta.locationId` must be the same canonical location ID from `WORLD_CANON.json`.
- Every `series.castIds` and `visualMeta.castInScene` entry must exist in `WORLD_CANON.json`; visual cast must also be part of the episode's `series.castIds`.
- `imagePrompt` describes **scene action, framing, weather/light, and mood only**. Do **not** redesign hair, face, outfit, age, or other recurring-character appearance inside each episode.
- Runtime image generation injects `world.styleBible`, canonical location name, and each recurring character's `visualDescriptor` from `WORLD_CANON.json`. This is the source of truth for visual continuity.
- Never place readable Japanese/Chinese/English copy, captions, UI, speech bubbles, logos, or watermarks in the image.
- The App lazy-loads scene images and never blocks learning on missing art.

## Season progression

- Season 1 (`release-week-01`) is complete (12/12). Do not republish it.
- Season 2 (`life-beyond-work-02`) is active with 12 planned slots; publish at most one episode per run and keep buffer at 3.
- Future seasons remain hooks in `WORLD_CANON.json` until explicitly activated via `activeSeasonId`.

## Story / series contract

Every connected episode must include `series` with `worldId`, `seasonId`, `episodeNo`, `castIds`, `locationId`, `previousSummary`, `todayHook`, `summary`, and `callbacks`.

`summary` must contain only durable story facts for later episodes: what actually happened, relationship changes, promises/plans, and other facts a future episode should know. Do not copy teaching prose into the durable story summary.

## Memory / callback contract

- Prefer callbacks that can naturally reappear in the current plot; never insert an old expression only to satisfy a quota.
- Reuse up to two earlier targets in a way that changes what the learner must understand or say now.
- A callback must point to an actual prior episode/source and must not expose internal episode IDs in UI-facing text.
- Keep the new episode centered on one new core target; callbacks are retrieval, not extra lessons.

## Publication rules

- Maximum 1 new connected episode per hourly run for the active season.
- If active-season buffer >= 3, publish 0.
- Never publish unrelated standalone content while a connected season is active.
- Never generate audio from this task (`audio.status="not_ready"` is normal).
- Never publish an episode that fails `validate-connected-episode.mjs`; fix the content or publish zero.
