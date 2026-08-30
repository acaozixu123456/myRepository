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

The product is **Continue Play-first and audio-first**. Content is designed as playable scene material, not as a long article followed by exercises. A complete new item must let the same Japanese target survive changes of relationship, formality and situation.

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

Audio is independent. New text/play content publishes immediately with `audio.status = "not_ready"`. The unified backend Play Audio job later prepares reusable static clips. Learner taps only read cache; missing clips fall back to text and never block play.

## Publishing rules

1. Publish at most one new item per hourly run; publishing zero is correct when nothing is strong enough.
2. Prefer usefulness, memorability, listening value and transfer value over filling a quota.
3. Rotate content archetypes and learning targets; do not repeatedly publish the same grammar trick, keyword or headline angle.
4. Build original Nihongo Discovery lessons. When using a news/fact source, use it only as a seed; never copy or lightly rewrite article bodies.
5. Each item must support the core play sequence: `听/看一句猜意思 -> 现场怎么回 -> 平时怎么说 -> 敬语怎么说 -> 商务日语怎么说 -> 换个情景(5个) -> 自己说一遍`.
6. The same semantic target must remain aligned across everyday, polite/keigo and business/formal registers.
7. Every complete item must include exactly five useful changed scenarios in `story.play.scenarios`; do not pad with near-duplicates.
8. The Japanese target must resolve the curiosity gap or action. Do not bolt unrelated vocabulary onto trivia.
9. Autonomous checks before direct publication: Japanese naturalness, N3+ level, factual accuracy when claims are present, safety tone, duplication, transfer value, register correctness, five-scenario diversity and complete Story shape.
10. Serious topics must remain respectful; never create joke framing around harm.
11. The hourly content task never changes App source code or production audio behavior.

## Story shape

Each `story` must satisfy the app Story contract:

- `id`, `title`, `category`, `level` (`N3|N2|N1`), `emoji`, `visual`
- `prompt`, `guesses`, `guessCorrect`, `twist`
- `key.term`, `key.reading`, `key.meaning`, `key.insight`, `key.anchor`
- `jp`, `cn`
- `points[]`, `use`, `transfer`, `review`
- required first-class `play`
- `nextId`

For source-driven items, include `news.source`, `news.sourceDate`, `news.sourceTitle`, `news.sourceUrl`, `news.mode`, `news.fact`. For evergreen grammar/expression/curiosity items, `news` is optional.

### Required `play` — authoritative play/audio text

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

`play` is the authoritative source for the active App flow and static Play Audio clips. The App/backend derive the same 12 user-facing audio targets from it: listening sentence, other-speaker prompt, correct reply, daily, polite, business, five scenario clips and spoken-recall reference.

Scenario rules:
- exactly 5 scenarios for new content;
- each scenario should materially change person, relationship, place, risk, purpose or register rather than merely swap one noun;
- at least one should be everyday/personal and at least one should be workplace/service/formal when natural for the target;
- `jp` is the exact Japanese the learner should hear/use in that scenario;
- `cn` is a concise meaning, not a lecture.

Register rules:
- `daily`, `polite`, `business` express the same intended meaning at different social levels;
- if a literal business version is unnatural, use the closest genuinely useful formal/service/news register and explain that briefly in `businessNote`;
- do not create three unrelated sentences just to fill the ladder.

`practice` is now legacy compatibility only and is not required for newly published items. Do not maintain a second authoritative sentence list when `play` exists.

Stable ids should describe the learning target and date when useful, e.g. `grammar-souda-20260830`, `work-moushiwake-20260830`, `news-rail-20260830`.
