# Nihongo Discovery — Hourly Connected-World Content Factory Contract

This file is the execution contract for the scheduled ChatGPT content task.

## Product goal

The App is now a **connected immersive Japanese world**, not a random hourly knowledge feed.

The hourly task does **not** mean “publish one item every hour”. Publishing zero is correct whenever the active season already has enough prepared episodes or the next episode cannot meet continuity/quality requirements.

The current canonical world and season live in `WORLD_CANON.json`. The active product loop remains Continue Play-first and audio-first; the existing seven-stage PlayPlan, adaptive Review and static audio architecture are preserved.

Do not modify App source code or production audio from this task.

## Required run sequence

1. Read `README.md`, this file, `WORLD_CANON.json`, and the latest `manifest.json` from branch `nihongo-content`.
2. Read the active world/season from `WORLD_CANON.json`; never invent a parallel cast, place, timeline or season id.
3. Inspect the previous episode plus the latest three connected-world episodes and their summaries/callbacks.
4. Inspect the next canonical episode slot in `WORLD_CANON.json`.
5. Count prepared connected-world episodes ahead of the earliest missing slot. If the current prepared buffer is already **3 or more episodes**, publish nothing this hour.
6. Otherwise generate only the earliest missing episode slot. It must:
   - teach at most one new core Japanese target;
   - advance the same plot;
   - naturally reuse two earlier targets when possible;
   - preserve character relationships, time, place and prior events;
   - include first-class `series` metadata and `callbacks`;
   - keep exactly five `play.scenarios`, where the first **3 stay inside the current continuous world** and the last **2 transfer the language to other life contexts**.
7. Run autonomous continuity and quality checks before publishing: timeline, cast, location, register, Japanese naturalness, N3+ usefulness, duplicate target, callback validity, five-scenario diversity, and complete Story shape.
8. There is no human review stage. If all checks pass, append/update exactly one item with `status: "published"` and `audio: {"status":"not_ready"}`. If checks fail, publish nothing.
9. Preserve all existing items and set top-level `updatedAt` to the current ISO timestamp.
10. Commit `manifest.json` to branch `nihongo-content`.
11. Re-read the committed manifest, confirm the stable id exists, then check the public App `/api/news-content` endpoint with bounded retries for propagation. Never create a duplicate because the endpoint is briefly stale.

## Canon and continuity rules

The current canon is `WORLD_CANON.json` and is authoritative for:
- `worldId`, `seasonId`, `canonRevision`;
- fixed cast and each person's relationship/language role;
- known locations;
- season episode count and episode slots;
- the plot beat and intended core target for each slot.

Every connected episode must include:

```json
{
  "series": {
    "worldId": "life-in-japan",
    "worldTitle": "在日本生活和工作的我",
    "seasonId": "release-week-01",
    "seasonTitle": "项目上线前的一周",
    "episodeNo": 4,
    "episodeCount": 12,
    "previousEpisodeId": "release-week-01-ep03",
    "nextEpisodeId": "release-week-01-ep05",
    "locationId": "project-office",
    "locationName": "项目办公室",
    "castIds": ["tanaka", "sato"],
    "canonRevision": "v1",
    "previousSummary": "上一集发生了什么",
    "todayHook": "今天剧情要解决什么",
    "summary": "本集结束后留下的事实摘要"
  },
  "callbacks": [
    {
      "targetId": "release-week-01-ep02",
      "sourceEpisodeId": "release-week-01-ep02",
      "role": "natural_reuse"
    }
  ]
}
```

`summary` must contain only durable story facts needed by later episodes. Do not turn it into a lesson recap or hidden chain-of-thought.

## Language progression

Connected episodes must maintain three lines simultaneously:

1. **Plot line** — recurring people/events continue from earlier episodes.
2. **Language line** — one new target + natural reuse of two earlier targets whenever possible.
3. **Memory line** — callbacks should be usable by the App's local weakness/review state. Do not assume the content factory has access to a specific user's private local mistakes.

The content factory therefore supplies valid callback opportunities; the App decides which callback/review cue to emphasize for a specific learner.

Episode 1–2 may use pre-season/bundled discoveries as callbacks because the season has insufficient earlier episodes. From episode 3 onward, prefer callbacks from this season.

## Story contract

`level` must be exactly `N3`, `N2`, or `N1`.

Each `story` must include:
- `id`, `title`, `category`, `level`, `emoji`, `visual`
- `prompt`, `guesses` (3), `guessCorrect`, `twist`
- `key.term`, `key.reading`, `key.meaning`, `key.insight`, `key.anchor`
- `jp`, `cn`
- `points` (at least 2)
- `use`, `transfer`, `review`
- first-class `play`
- `series`, `callbacks`
- `nextId` for legacy compatibility; for connected episodes it must match `series.nextEpisodeId` when one exists.

For source-driven facts/news, include `news.source`, `news.sourceDate`, `news.sourceTitle`, `news.sourceUrl`, `news.mode`, `news.fact`. Evergreen connected episodes usually do not need `news`.

## Required Play block

The active seven-stage flow stays:

`听一句猜意思 -> 现场怎么回 -> 平时怎么说 -> 敬语怎么说 -> 商务日语怎么说 -> 换个情景(5个) -> 自己说一遍`

Required shape:

```json
{
  "play": {
    "daily": "熟人/朋友自然说法",
    "polite": "普通同事/陌生人自然礼貌说法",
    "business": "客户/上司/正式工作表达",
    "businessNote": "说明关系改变时为什么这样表达",
    "replyPrompt": "另一方实际说出的日语",
    "reply": "学习者最自然的回应",
    "scenarios": [
      {"emoji":"...","cue":"连续世界场景1","jp":"...","cn":"..."},
      {"emoji":"...","cue":"连续世界场景2","jp":"...","cn":"..."},
      {"emoji":"...","cue":"连续世界场景3","jp":"...","cn":"..."},
      {"emoji":"...","cue":"外部迁移场景1","jp":"...","cn":"..."},
      {"emoji":"...","cue":"外部迁移场景2","jp":"...","cn":"..."}
    ]
  }
}
```

Register rules:
- daily/polite/business preserve the same communicative intent;
- do not mechanically keigo-upgrade an expression when Japanese naturally changes the whole sentence;
- business must be genuinely usable with a client/superior/formal notice.

Live-response rules:
- `replyPrompt` and `reply` must form a plausible exchange;
- both may become static audio, so no speaker labels or explanations inside the actual strings.

Scenario rules:
- exactly 5;
- scenarios 1–3 remain in the current world/plot and can carry callbacks;
- scenarios 4–5 leave the world to test genuine transfer;
- each Japanese line must be a complete natural utterance suitable for listening;
- do not pad by swapping nouns only.

## Publication rules

- Maximum 1 new connected episode per hourly run.
- If buffer >= 3, publish 0.
- If the canonical season is complete, publish 0 until a new season is explicitly created in `WORLD_CANON.json`.
- Never publish unrelated standalone content while an active connected season exists.
- Never change canon to make a generated episode easier to fit.
- Never mutate fixed character relationships or past episode facts.
- Never generate audio from this task.
- `audio.status="not_ready"` is normal; the existing bounded Play Audio backfill prepares clips later.
