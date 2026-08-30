# Nihongo Discovery — News Content Pipeline

This branch is the public, app-readable source of truth for daily News Seed content.

## Files

- `nihongo-discovery/content/manifest.json` — canonical manifest consumed by the app backend.
- Future daily drafts may be stored under `nihongo-discovery/content/drafts/YYYY-MM-DD.json` for audit/history.

## Item lifecycle

`draft -> audio_ready -> published`

Optional terminal states: `rejected`, `audio_validation_failed`.

The mobile app must expose only items whose status is `published`.

## Publishing rules

1. News source provides facts/topic only. Do not copy or lightly rewrite the source article body.
2. Each News Seed must be an original Nihongo Discovery lesson with a prediction/reveal, one Japanese key, an original scene, transfer practice, review cue and source metadata.
3. `story.key.term` is the canonical keyword audio text.
4. `story.jp` is the canonical scene audio text. Do not keep hidden alternate scripts.
5. Audio must be generated with `gpt-realtime-1.5` before publication.
6. Normalize whitespace and punctuation only; the generated transcript must otherwise match the canonical Japanese text. A mismatch must not be published.
7. Disaster, accident, death or other safety-sensitive topics use `news.mode = serious` and must not use playful/gamified framing.
8. Prefer 2–3 high-quality News Seeds per day; publishing 0 or 1 is acceptable when quality is insufficient.

## Daily editor workflow

1. Read this file and the current manifest.
2. Review recent published items to avoid repeated themes/keys.
3. Find recent Japanese news candidates, preferring NHK NEWS WEB EASY / やさしいことばニュース when available.
4. Select only candidates with reusable Japanese-learning value.
5. Add candidates to the manifest as `draft` and commit.
6. Trigger the app's News Seed audio preparation endpoint for each draft.
7. Only when key + scene audio both pass exact transcript/provenance validation, update the item to `audio_ready`, then `published` with timestamps.
8. If validation fails, set `audio_validation_failed`; do not publish.

## Required story shape

Each `story` follows the app's `Story` contract and includes at least:

- `id`, `title`, `category`, `level`, `emoji`, `visual`
- `prompt`, `guesses`, `guessCorrect`, `twist`
- `key.term`, `key.reading`, `key.meaning`, `key.insight`, `key.anchor`
- `jp`, `cn`
- `points[]`, `use`, `transfer`, `review`
- `news.source`, `news.sourceDate`, `news.sourceTitle`, `news.sourceUrl`, `news.mode`, `news.fact`
- `nextId`

IDs should use `news-<topic>-YYYYMMDD` and remain stable after publication.
