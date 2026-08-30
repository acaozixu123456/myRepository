# Nihongo Discovery — Hourly Content Factory Contract

This file is the execution contract for the scheduled ChatGPT content task.

## Goal

Each run may publish at most **one** high-quality N3/N2/N1 Discovery into `nihongo-discovery/content/manifest.json`. Publishing zero is correct when no candidate is strong enough.

Content is not limited to news or vocabulary. Good candidates include grammar, important grammar contrasts, pragmatic expressions, semantic traps, workplace/everyday Japanese, Japanese-life curiosities, recent facts/news, and useful follow-ons derived from existing Discoveries.

The App is now **Continue Play-first**. A Discovery is material for a compact multi-scene play run, not an article that must be read before practice. **Do not modify App source code from the hourly task. Do not generate or modify production audio from the hourly task.**

## Required run sequence

1. Read `README.md`, this file, and the latest `manifest.json` from branch `nihongo-content`.
2. Inspect recent manifest items first so the next item continues the catalog intelligently instead of repeating old work.
3. Choose one candidate from either an evergreen language/grammar/pragmatics idea with strong real-life transfer or a fresh Japanese fact/news source with a strong N3+ learning angle.
4. Deduplicate by learning target, grammar pattern, key expression, theme, source URL and near-duplicate angle.
5. Reject material whose real learning point is below N3, mostly trivia, weakly transferable, repetitive, unsafe, or too lecture-like.
6. Build one complete original playable Story around a compact Japanese target. The learner should be able to meet the same target through different identities, relationships and situations.
7. Perform autonomous quality checks: Japanese naturalness, N3+ level, factual accuracy when claims are present, source metadata when used, safety tone, duplication, transfer value, register correctness and Story completeness.
8. There is **no human review or approval stage**. If the autonomous checks pass, append/update exactly one manifest item directly with `status: "published"` and `audio: {"status":"not_ready"}`.
9. Preserve all existing manifest items and set top-level `updatedAt` to the current ISO timestamp.
10. Commit the updated `manifest.json` to branch `nihongo-content`.
11. Re-read the committed manifest and confirm the stable story id exists. Then check the public app `/api/news-content` endpoint and confirm the story is exposed. Use bounded retries for propagation delay. Never create a duplicate replacement because the endpoint is briefly stale.

## Story contract

`level` must be exactly `N3`, `N2`, or `N1`. Use a stable descriptive id such as `grammar-souda-20260830`, `work-yappari-20260830`, or `news-rail-20260830`.

Each `story` must include:
- `id`, `title`, `category`, `level`, `emoji`, `visual`
- `prompt`, `guesses` (3), `guessCorrect`, `twist`
- `key.term`, `key.reading`, `key.meaning`, `key.insight`, `key.anchor`
- `jp`, `cn`
- `points` (at least 2)
- `use`, `transfer`, `review`
- `nextId`
- `practice`

For source-driven items also include `news.source`, `news.sourceDate`, `news.sourceTitle`, `news.sourceUrl`, `news.mode`, `news.fact`. Evergreen grammar/expression/curiosity items do not need `news`.

### Required inline `practice`

```json
{
  "practice": {
    "examples": [
      {"emoji":"...","cue":"日常/朋友场景","jp":"自然的日常说法","cn":"..."},
      {"emoji":"...","cue":"礼貌/敬语场景","jp":"自然的礼貌或敬语说法","cn":"..."},
      {"emoji":"...","cue":"商务/正式场景","jp":"自然的商务或正式说法","cn":"..."}
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

The three examples now have a strict register role for the primary play flow:
1. `examples[0]` = everyday/casual natural Japanese for the target.
2. `examples[1]` = polite/keigo version appropriate for strangers, service encounters or normal workplace politeness.
3. `examples[2]` = business/formal version appropriate for clients, superiors, formal notices or careful written communication.

Keep the semantic target aligned across the three variants. Do not create three unrelated example sentences just to fill slots. When a literal business version would be unnatural for the topic, use the closest useful formal/service/news register and make the cue explicit.

The active seven-stage App flow is:
`听/看一句猜意思 -> 现场怎么回 -> 平时怎么说 -> 敬语怎么说 -> 商务日语怎么说 -> 换个情景 -> 自己说一遍`.

`story.use` powers the live-response stage, `practice.examples` power the register contrast, `story.transfer` powers the changed-scene stage, and `story.review` powers final spoken/open recall. `practice.fun` remains for backward compatibility and possible future optional games, but it is no longer the required core path.

## Publication rules

- Maximum 1 new item per hourly run.
- 0 items is allowed and better than filler.
- Direct publish after autonomous checks; never wait for human approval.
- Prefer semantic rabbit holes: use `nextId` to connect naturally to related material.
- Do not publish duplicate keys or grammar patterns repeatedly.
- Do not expose an audio button merely because content is published.
- `audio.status="not_ready"` is normal for newly published dynamic content; the App/backend audio-prep pipeline is separate.
- Never call learner-time generation endpoints.
- Never change production audio models/cache from this task.
