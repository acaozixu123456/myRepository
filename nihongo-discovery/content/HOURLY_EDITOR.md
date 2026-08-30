# Nihongo Discovery — Hourly Editor Contract

This file is the execution contract for the ChatGPT hourly content task.

## Goal

Each run may publish at most **one** high-quality current News Seed into `nihongo-discovery/content/manifest.json`. Publishing zero is correct when no candidate is strong enough.

The app reads this manifest dynamically. **Do not modify App source code from the hourly task. Do not generate or modify audio from the hourly task.**

## Required run sequence

1. Read `README.md`, this file, and the latest `manifest.json` from branch `nihongo-content`.
2. Search recent Japanese-language news/fact sources. Prefer NHK NEWS WEB EASY / NHK やさしいことばニュース when available; other trustworthy Japanese sources are allowed when NHK has no suitable fresh candidate.
3. Deduplicate against existing manifest items by source URL, topic, key expression, and near-duplicate learning angle.
4. Reject material whose best learning point is below N3, is mostly trivia, has weak transfer value, or cannot sustain playful practice.
5. Build one complete original Nihongo Discovery story. The source is a fact/topic seed only; do not copy or lightly rewrite the source article body.
6. Fact-check the story, Japanese naturalness, level, source date/title/URL, and safety tone.
7. If it passes, append/update exactly one manifest item with `status: "published"` and `audio: {"status":"not_ready"}`. Text publication does **not** imply audio readiness.
8. Preserve all existing manifest items and set top-level `updatedAt` to the current ISO timestamp.
9. Commit the updated `manifest.json` to branch `nihongo-content`.
10. Re-read the committed manifest and confirm the new stable story id exists. Then check the public app's `/api/news-content` endpoint and confirm the story is exposed. If the endpoint is briefly stale, retry once; never rewrite the item merely because of a short cache delay.

## Story contract

Use a stable id `news-<topic>-YYYYMMDD`. `level` must be exactly `N3`, `N2`, or `N1`.

Each `story` must include:

- `id`, `title`, `category: "今日发生"`, `level`, `emoji`, `visual`
- `prompt`, `guesses` (3), `guessCorrect`, `twist`
- `key.term`, `key.reading`, `key.meaning`, `key.insight`, `key.anchor`
- `jp`, `cn`
- `points` (at least 2)
- `use`, `transfer`, `review`
- `news.source`, `news.sourceDate`, `news.sourceTitle`, `news.sourceUrl`, `news.mode`, `news.fact`
- `nextId`
- `practice`

### Required inline `practice`

Dynamic News content must carry its own practice pack so it becomes playable without an App redeploy:

```json
{
  "practice": {
    "examples": [
      {"emoji":"...","cue":"...","jp":"...","cn":"..."},
      {"emoji":"...","cue":"...","jp":"...","cn":"..."},
      {"emoji":"...","cue":"...","jp":"...","cn":"..."}
    ],
    "fun": {
      "prompt":"...",
      "choices":["...","...","..."],
      "correct":0,
      "feedback":"..."
    }
  }
}
```

The three examples power the play sequence:

1. `听/看一句猜意思`
2. `现场该怎么回`
3. `换个场景还能说`

The `fun` block powers `抓住搞笑错误`. After it, the App routes the learner to `再遇一次` review.

Make the wrong answer memorable and playful, but never joke about deaths, disasters, victims, crime victims, or other harm. Serious news uses `news.mode = "serious"`.

## Publication rules

- Maximum 1 new item per hourly run.
- Prefer quality over recency; 0 items is allowed.
- Do not publish duplicate keys repeatedly just because the headline changed.
- Do not expose an audio button merely because content is published.
- `audio.status="not_ready"` is the normal state for hourly text publication.
- Never call learner-time generation endpoints.
- Never change the current production audio model/cache from this task.
