# NHK one-phrase speaking pilot — 2026-09-07

User goal: make starting to speak as inexpensive in effort as possible. This is an additive, article-scoped module, not a new free-chat page or a replacement for the exploration game.

## Product contract
One visible start action includes explicit realtime-audio consent. Begin with a source-grounded short word, then one clause, then an optional personal feeling. Accept incomplete attempts without claiming correctness. Help, replay, silence, filler, manual finish and Chinese support are not Japanese speaking completions. Three actual ASR-backed attempts end the session. No grade, countdown pressure, XP, or automatic escalation. No new persistence schema and no raw audio or transcript storage; old speech evidence and quiet study remain unchanged. Old longer recap is retained under optional advanced practice.

## Transport and bounds
OpenAI Realtime GA WebRTC, gpt-realtime-2.1 only; no silent model fallback. Reuse the existing Vercel speech route only as an additive action router. A separate Supabase edge signs bounded stop tickets and keeps long-lived provider keys server-side. It uses existing backend credential lookup and atomic quota RPC, not new secrets or migrations. Semantic VAD is patient; automatic responses are disabled; the app explicitly requests each small prompt. Microphone transmission stays disabled during assistant playback and all tracks stop on close, pagehide, visibility loss, failure or deadline. Browser and server-side sideband guard impose a 110-second pilot lifetime, 12 responses, bounded output and token usage. Global start quota is 30/day, per-client 8/hour and 2/two minutes. These are pilot defenses, not a dollar-accurate provider billing cap or guaranteed crash-proof cutoff.

## Limits to communicate honestly
The current personal app uses existing project JWT/proxy protections, not individual account authentication. Before broad public release, add genuine user auth and server-owned session authorization. Client controls are not a security boundary against a modified malicious client. Prompt restrictions and ASR heuristics are not semantic correctness guarantees. Source grounding is relative to the imported article, not external fact verification. No pronunciation, pitch, fluency improvement, physical-device compatibility or human voice-quality claims follow from automated tests. App does not persist recordings; OpenAI processing/retention is governed by the account's API settings, not a claim of zero provider retention.

## Acceptance
Require typecheck, all existing tests/build, new flow/cleanup tests, browser screenshots with mocked media explicitly identified, and a separately labelled real model/SDP/sideband smoke. Production promotion requires supervisor review of results, not merely process completion. Preserve the NHK library, favorites, backups, existing TTS and all exploration files.
