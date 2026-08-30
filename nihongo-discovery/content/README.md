# Nihongo Discovery — News Content Pipeline

This branch is the public, app-readable source of truth for daily News Seed content.

## Files

- `nihongo-discovery/content/manifest.json` — canonical manifest consumed by the app backend.
- Future daily drafts may be stored under `nihongo-discovery/content/drafts/YYYY-MM-DD.json` for audit/history.

## Content level policy — N3 is the hard floor

Main Discovery content may use only `N3`, `N2`, or `N1`.

Target mix for the growing catalog:
- N3: about 60% — high-frequency real-life nuance, indirectness, modality, workplace/public-service patterns, meaning shifts that beginners often misread.
- N2: about 30% — register changes, implication, news connectors, compact grammar, idiomatic evaluation and reusable formal/casual contrasts.
- N1: about 10% — selective advanced nuance, formal/news expressions, omission and rhetoric. Do not add obscure trivia merely because it is difficult.

N4/N5 grammar or vocabulary must not become a main Discovery by itself. A superficially easy expression may be accepted only when the learning target is genuinely N3+ in pragmatic/semantic difficulty, such as a context-dependent meaning reversal, culturally important omission, indirect refusal, or register shift.

NHK NEWS WEB EASY / やさしいことばニュース can be used as a fact/topic source, but the extracted Japanese learning key must satisfy this N3+ rule. Reject a news candidate when its only teachable point is basic N4/N5 grammar.

## Item lifecycle

Text/content lifecycle: `draft -> reviewed -> published`.

Audio is a separate asset gate. An item with unavailable audio may be surfaced as text-only when the lesson itself is reviewed and valid; it must not show a fake audio control. When audio is required for a particular game, that game stays unavailable until its static asset is ready.

Optional terminal states include `rejected` and `audio_validation_failed`.

## Publishing rules

1. News source provides facts/topic only. Do not copy or lightly rewrite the source article body.
2. Each News Seed must be an original Nihongo Discovery lesson built around a prediction/reveal, one N3+ Japanese key, original situations, playful transfer games, review cue and source metadata.
3. Prefer play over lecture after the reveal: `听一句猜意思 -> 现场该怎么回 -> 换个场景/词还能不能说 -> 抓住搞笑错误 -> 再遇一次`.
4. `story.key.term` is the canonical keyword audio text; `story.jp` is the canonical core scene text. Do not keep hidden alternate scripts.
5. Learner playback must use pre-generated static audio only. Never generate model audio on a learner click.
6. Production scene audio uses the validated v3 per-speaker composition (`gpt-4o-mini-tts-2025-12-15`, role-aware turns, static WAV). Practice utterances are generated as separate static single-turn assets.
7. Audio assets are versioned by canonical text/model/voice/prompt version and must be readable/decodable before their playback control is exposed.
8. Disaster, accident, death or other safety-sensitive topics use `news.mode = serious` and must not use joke framing around harm. Language practice may remain interactive but respectful.
9. Prefer 2–3 high-quality News Seeds per day; publishing 0 or 1 is acceptable when quality is insufficient.

## Daily editor workflow

1. Read this file and the current manifest.
2. Review recent items to avoid repeated themes/keys.
3. Find recent Japanese news candidates, preferring NHK NEWS WEB EASY / やさしいことばニュース when available.
4. Reject candidates whose best learning point is below N3 or has weak transfer value.
5. Score remaining candidates for surprise/ambiguity, real-life usefulness, scene potential, and ability to sustain multiple playful interactions.
6. Add selected candidates as drafts and commit.
7. Review fact accuracy, Japanese naturalness, source metadata, and N3+ level before content publication.
8. Generate required static key/scene/practice audio out of band and validate availability/decodability. Audio failure never triggers learner-time generation or silent device-speech fallback.

## Required story shape

Each `story` follows the app's `Story` contract and includes at least:

- `id`, `title`, `category`, `level` (`N3|N2|N1`), `emoji`, `visual`
- `prompt`, `guesses`, `guessCorrect`, `twist`
- `key.term`, `key.reading`, `key.meaning`, `key.insight`, `key.anchor`
- `jp`, `cn`
- `points[]`, `use`, `transfer`, `review`
- `news.source`, `news.sourceDate`, `news.sourceTitle`, `news.sourceUrl`, `news.mode`, `news.fact`
- `nextId`

IDs should use `news-<topic>-YYYYMMDD` and remain stable after publication.
