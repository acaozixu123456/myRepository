# 日本散步日记 / Nihongo Discovery

## Current user priority — 2026-09-09

**Mobile only.** No desktop layouts/screenshots, keyboard/mouse work or historical game QA. Sol implements/reviews directly through connected GitHub and the app's existing services, not Windows Codex/Cursor, Luna or AppDeploy unless the user explicitly changes that.

Make it easy to start AND continue Japanese speaking: article-based fresh topic openings, gentle adult conversation, optional current-turn help, and explicit microphone control. News supplies an opening, not a compulsory destination. Ordinary replies follow the learner's current thread; article facts enter only when explicitly requested. Never invent missing news facts or turn an institution-name acknowledgement into an unsolicited pricing/policy lesson.

## Explicit microphone and honest activity

Entering 陪我说一句 is receive-only. **No microphone request until 开启麦克风 is tapped.** Tap 关闭麦克风 to stop real input tracks and transmission, not just change an icon. Keep this mute through replay, help, shuffle and renewal. An already-spoken pending utterance may be answered after mute. While enabled, sending temporarily pauses during AI output/planning to avoid echo, then resumes unless manually muted. Permission denial leaves playback usable; late permission after mute/close immediately stops the returned tracks. End/background/error disposes input, peer, audio analyser and timers.

Separate self/opponent indicators distinguish muted, requesting, receiving/ready, preparing and actual playing. Waveform amplitude comes from actual RMS samples. Silent/unavailable audio does not get an invented waveform; state text remains. Stream playback events are not proof of a physical speaker's audibility. Physical-iPhone certification requires real device feedback.

## Replenishable topic pool

Initial curated preview is local and instant. Explicit 换个话题 now requests a batch only when needed, generating up to six short, concrete article-linked openings through the existing backend (Responses API, gpt-4.1-mini, store:false). Prefer unseen generated candidates, exclude recent near-text duplicates and refill in bounded batches. Do not silently auto-switch the current topic when new candidates arrive. Failures leave cached/curated topics and chat usable; in-call changes reuse the peer. Preview cycling now MAY trigger a billable text request, but never a microphone request. This intentionally replaces the prior fixed-only/offline-every-shuffle rule.

Server validates lengths, simple-question shape and exact article-source quote, then HMAC-signs the entire topic/source/expiry. Verify signatures before starting a voice call. Node proxy must remain independent of Deno/client imports; the edge owns signature/canonical validation. Tab cache only, no new localStorage transcript/article persistence. Not an infinite uniqueness or perfect semantic relevance guarantee. New topic quotas and bounded retries are documented in docs/product/NHK_MIC_TOPICS_20260909.md; existing voice quotas and distinct app/provider error messages remain.

## Patient short teacher and support (preserved)

Voice remains gpt-realtime-2.1. nhkGentleTeacher.ts prepares detached bounded text plans for free replies/simplification before audio: <=48 Japanese characters,two sentences,one optional question. Ordinary plans omit the full article/title; explicit article requests may include source. Invalid/stale/overlong or selected unsolicited abstract/policy drafts use a small concrete fallback. These checks are not semantic/JLPT guarantees. Audio receives only checked text to read. Default actual output speed0.80; 慢一点 sets0.70 and replays. 再简单点 simplifies the same prompt. Pace survives topic changes/renewal. Best-effort client stop for unexpected verbose audio remains.

Keep adult tone, fragments, yes/no, Chinese support, no required reasons/full sentences/repetition/grading/automatic difficulty escalation/fixed three turns. At most two optional words plus one starter follow the current utterance; 帮我接 reveals/models one possible reply, never a saved belief. Show/hide does not reconnect. Turn/request identity prevents stale help overwrites. Planning adds waiting; never claim zero latency. Current transport leases are110seconds with renewal and possible pauses;60seconds idle closes the session.

## Privacy and preservation

体验记录 remains optional, default OFF, local only, no upload/audio/transcripts/article/account identifiers/proficiency scores. Whitelisted coarse service waiting, support counts and skippable feedback only; at most30 rows within14-day UTC date window, pruned on use/reopen/export. Preserve corrupt/future records until explicit clearing.

Never clear localStorage or rewrite existing NHK article/favorite/history/session/backup/restore/quiet-study/game schemas. Do not remove old TTS/review or historical exploration data. No database migrations or new secret setup in this slice. Permanent OpenAI/Supabase credentials remain server-side; keep JWT and origin validation. API provider retention is separate from app non-persistence. Individual account authentication is still absent: bounded personal pilot, not broad public release. No free/unlimited API claims.

## Acceptance

- `/`: NHK study and mobile voice chat.
- `/explore.html`: retained historical prototype, no new desktop effort.
- `npm run typecheck && npm test && npm run build`: platform-independent regression.
- `scripts/nhk-mic-topics-browser.mjs`:390x844 touch UI, MOCK media/provider, actual mocked track lifecycle.
- `scripts/nhk-mic-topics-live.mjs`:real topic/API/WebRTC with SYNTHETIC Japanese input and measured RMS, not human microphone or physical phone certification.
- `scripts/nhk-mic-topics-production.mjs`:exact promoted assets, preserved teacher/TTS, origin/validation gates.

Deployment success is not final acceptance. Review the actual generated topics, short replies, screenshots, input/output meter evidence and remaining risks. Preserve prior failure evidence. See dated product/QA records and durable supervisor state.
