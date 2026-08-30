# Nihongo Discovery — Dynamic Content Pipeline

This branch is the app-readable source of truth for continuously published Discovery content.

## Core rule

A Discovery is not limited to vocabulary or news. It may center on:
- important N3/N2/N1 grammar or grammar contrasts;
- pragmatic expressions, semantic traps, workplace or everyday Japanese;
- Japanese-life / culture / system curiosities when they teach usable Japanese;
- recent facts or news when there is a strong learning angle;
- a useful follow-on derived from an existing Discovery.

The learning target can be a word, phrase, grammar pattern, sentence shape, pragmatic signal, or another compact Japanese concept. Prefer rabbit-hole continuity: one Discovery should naturally make the learner want to play the next related one.

## Files

- `nihongo-discovery/content/manifest.json` — canonical manifest consumed by the app backend.
- `nihongo-discovery/content/HOURLY_EDITOR.md` — execution contract for the scheduled content factory.

## Difficulty policy — N3 is the hard floor

Main Discovery content may use only `N3`, `N2`, or `N1`.

Target mix for the growing catalog:
- N3: about 60% — high-frequency real-life nuance, indirectness, modality, workplace/public-service patterns, meaning shifts and useful grammar;
- N2: about 30% — register changes, implication, compact grammar, idiomatic evaluation, formal/casual contrasts;
- N1: about 10% — selective advanced nuance, formal/news expressions, omission and rhetoric.

N4/N5 material must not become a main Discovery by itself unless the real learning target is genuinely N3+ in pragmatic/semantic difficulty.

## Publication lifecycle

There is **no human review or approval stage**. The scheduled editor performs autonomous quality checks and, when the item meets the contract, writes it directly as `status: "published"`.

Legacy manifest statuses may remain for historical compatibility, but the normal new-content path is direct publication.

Audio is independent. New text content normally publishes with `audio.status = "not_ready"`. The UI must not expose a fake audio control when no static audio exists.

## Publishing rules

1. Publish at most one new item per hourly run; publishing zero is correct when nothing is strong enough.
2. Prefer usefulness, memorability and transfer value over filling a quota.
3. Rotate content archetypes and learning targets; do not repeatedly publish the same grammar trick, keyword or headline angle.
4. Build original Nihongo Discovery lessons. When using a news/fact source, use it only as a seed; never copy or lightly rewrite article bodies.
5. Each item should support the play sequence: `听/看一句猜意思 -> 现场该怎么回 -> 换个场景还能说 -> 抓住搞笑错误 -> 再遇一次`.
6. The Japanese target must resolve the curiosity gap or action. Do not bolt unrelated vocabulary onto trivia.
7. Autonomous checks before direct publication: Japanese naturalness, N3+ level, factual accuracy when claims are present, safety tone, duplication, transfer value and complete Story shape.
8. Serious topics must remain respectful; never create joke framing around harm.
9. The hourly content task never changes App source code or production audio behavior.

## Story shape

Each `story` must satisfy the app Story contract:

- `id`, `title`, `category`, `level` (`N3|N2|N1`), `emoji`, `visual`
- `prompt`, `guesses`, `guessCorrect`, `twist`
- `key.term`, `key.reading`, `key.meaning`, `key.insight`, `key.anchor`
- `jp`, `cn`
- `points[]`, `use`, `transfer`, `review`
- `practice`
- `nextId`

For source-driven items, include `news.source`, `news.sourceDate`, `news.sourceTitle`, `news.sourceUrl`, `news.mode`, `news.fact`. For evergreen grammar/expression/curiosity items, `news` is optional.

Stable ids should describe the learning target and date when useful, e.g. `grammar-souda-20260830`, `work-moushiwake-20260830`, `news-rail-20260830`.
