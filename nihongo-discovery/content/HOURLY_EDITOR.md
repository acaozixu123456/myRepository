# Nihongo Discovery — Hourly Content Factory Contract

This file is the execution contract for the scheduled ChatGPT content task.

## Goal

Each run may publish at most **one** high-quality N3/N2/N1 Discovery into `nihongo-discovery/content/manifest.json`. Publishing zero is correct when no candidate is strong enough.

Content is not limited to news or vocabulary. Good candidates include grammar, important grammar contrasts, pragmatic expressions, semantic traps, workplace/everyday Japanese, Japanese-life curiosities, recent facts/news, and useful follow-ons derived from existing Discoveries.

The App is **Continue Play-first and audio-first**. A Discovery is material for seven compact stages and repeated listening across multiple situations, not an article that must be read before practice. **Do not modify App source code from the hourly task. Do not generate or modify production audio from the hourly task.**

## Required run sequence

1. Read `README.md`, this file, and the latest `manifest.json` from branch `nihongo-content`.
2. Inspect recent manifest items first so the next item continues the catalog intelligently instead of repeating old work.
3. Choose one candidate from either an evergreen language/grammar/pragmatics idea with strong real-life transfer or a fresh Japanese fact/news source with a strong N3+ learning angle.
4. Deduplicate by learning target, grammar pattern, key expression, theme, source URL and near-duplicate angle.
5. Reject material whose real learning point is below N3, mostly trivia, weakly transferable, repetitive, unsafe, too lecture-like, or unable to support meaningful scenario/register variation.
6. Build one complete original playable Story around a compact Japanese target. The learner should meet the same target through different identities, relationships, levels of formality and situations.
7. Build a first-class `story.play` block. It is the authoritative active-play/audio text source and must include a natural register ladder, live-response pair and exactly five useful scenarios.
8. Perform autonomous quality checks: Japanese naturalness, N3+ level, factual accuracy when claims are present, source metadata when used, safety tone, duplication, transfer value, register correctness, five-scenario diversity and Story completeness.
9. There is **no human review or approval stage**. If the autonomous checks pass, append/update exactly one manifest item directly with `status: "published"` and `audio: {"status":"not_ready"}`.
10. Preserve all existing manifest items and set top-level `updatedAt` to the current ISO timestamp.
11. Commit the updated `manifest.json` to branch `nihongo-content`.
12. Re-read the committed manifest and confirm the stable story id exists. Then check the public app `/api/news-content` endpoint and confirm the story is exposed. Use bounded retries for propagation delay. Never create a duplicate replacement because the endpoint is briefly stale.

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
- required first-class `play`

For source-driven items also include `news.source`, `news.sourceDate`, `news.sourceTitle`, `news.sourceUrl`, `news.mode`, `news.fact`. Evergreen grammar/expression/curiosity items do not need `news`.

`use`, `transfer` and `review` remain required for compatibility, memory scheduling and semantic checks. When `play` exists, however, the active seven-stage UI and Play Audio pipeline use `play` as the authoritative sentence source.

## Required `play`

```json
{
  "play": {
    "daily": "朋友/熟人之间最自然的日常说法",
    "polite": "对陌生人、同事、店员等自然的礼貌/敬语说法",
    "business": "面向客户、上司、正式说明或工作文字的商务/正式说法",
    "businessNote": "商务 / 正式通知 / 服务场景（按内容选择）",
    "replyPrompt": "现场另一方实际说出的日语",
    "reply": "学习者在现场最自然的正确回应",
    "scenarios": [
      {"emoji":"...","cue":"情景1","jp":"...","cn":"..."},
      {"emoji":"...","cue":"情景2","jp":"...","cn":"..."},
      {"emoji":"...","cue":"情景3","jp":"...","cn":"..."},
      {"emoji":"...","cue":"情景4","jp":"...","cn":"..."},
      {"emoji":"...","cue":"情景5","jp":"...","cn":"..."}
    ]
  }
}
```

### Register rules

- `daily`, `polite`, and `business` must preserve the same intended meaning while changing relationship/formality.
- `daily` should sound like something a real Japanese speaker would naturally say to a friend/familiar person, including appropriate omission or contraction when natural.
- `polite` should be natural for strangers, normal workplace politeness, service interactions or similar contexts. Do not force textbook honorific complexity when ordinary `です/ます` is more natural.
- `business` should be genuinely usable with a client, superior, formal notice or careful work communication. If a literal business version is unnatural for the target, use the closest useful formal/service/news register and make that explicit in `businessNote`.
- Never create three unrelated sentences merely to fill the ladder.

### Live-response rules

- `replyPrompt` is the exact Japanese the other person says in the scene.
- `reply` is the exact natural Japanese the learner should answer.
- Together they should form a plausible real interaction, because both sides may be heard as static audio in the App.

### Five-scenario rules

- Exactly 5 scenarios for every newly published item.
- All five must train the same target while materially changing person, relationship, place, purpose, consequence, risk or register. Merely swapping one noun is insufficient.
- Include at least one everyday/personal scenario and, when natural for the target, at least one workplace/service/formal scenario.
- Each `jp` must be a complete natural sentence or compact utterance suitable for listening practice.
- Each `cn` must be concise and clarify the intended meaning without becoming a lecture.
- Prefer scenarios that make the learner notice how the expression behaves under pressure, politeness changes or different conversational goals.

## Active seven-stage flow

The App currently plays:

`听一句猜意思 -> 现场怎么回 -> 平时怎么说 -> 敬语怎么说 -> 商务日语怎么说 -> 换个情景(5个) -> 自己说一遍`

The backend derives exactly twelve user-facing static audio targets from the Story/PlayPlan: listening sentence, other-speaker prompt, correct reply, daily, polite, business, five scenario clips and spoken-recall reference. The hourly task supplies text only; the separate backend audio-prep pipeline creates those clips afterward.

`practice` is legacy compatibility only. Do not add or maintain a second authoritative sentence list when a first-class `play` block exists. New items do not need `practice` unless a future contract explicitly requires it.

## Publication rules

- Maximum 1 new item per hourly run.
- 0 items is allowed and better than filler.
- Direct publish after autonomous checks; never wait for human approval.
- Prefer semantic rabbit holes: use `nextId` to connect naturally to related material.
- Do not publish duplicate keys or grammar patterns repeatedly.
- Do not expose or promise audio merely because content is published.
- `audio.status="not_ready"` is normal for newly published dynamic content; the unified App/backend Play Audio pipeline prepares static clips asynchronously.
- Never call learner-time generation endpoints.
- Never generate audio from this task.
- Never change production audio models/cache from this task.
