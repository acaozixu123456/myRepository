# Mobile microphone control and replenishable topics — 2026-09-09

## User contract
The user requested richer article-based random topics, explicit tap-to-open / tap-to-close microphone control, and clear visual input/output activity. This changes the previous automatic microphone-on-at-chat-start behavior. Mobile only.

A chat starts receive-only: no getUserMedia until the visible microphone button is pressed. Press again to disable transmission immediately, stop the actual local input tracks and remove them from the sender. AI playback continues independently. An already spoken, pending utterance may still be processed after muting; no new sound is captured. Keep mute across assistant responses, topic changes and transport renewal. While explicitly enabled, input is temporarily disabled during the assistant's playback/planning to avoid echo; it becomes available afterwards until the user mutes. Denied/late permissions must not leak tracks or end listening-only playback. End/background/error closes tracks and meter resources.

Two separate input/output indicators use real waveform RMS samples, not random CSS oscillation. Input has muted, requesting, paused, ready/receiving and device-muted states. Output distinguishes preparation from actual playback using Realtime buffer events AND the native media playing state; the waveform follows local inbound samples. Silence is flat; unavailable analysis falls back to state text rather than fake levels. This does not prove the phone speaker is audible, provider recognition is correct, or every physical iPhone is compatible.

## Topic behavior
Initial curated preview remains instant and offline. Explicit 换个话题 starts a coalesced, bounded request when fresh candidates are running low. The server uses Responses API with gpt-4.1-mini, structured output, store:false, up to six concrete easy openings, two optional short replies and an exact source quote. Voice remains gpt-realtime-2.1 with existing slower-pace and checked teacher turns. Generated output is validated and HMAC-signed against the complete source/topic; changed questions or different articles fail verification before a voice call.

The tab caches up to ten article pools, sixty tickets each, for at most the signed twelve-hour lifetime. No new article/transcript cache is persisted. Prefer unseen generated topics, exclude normalized and near-text duplicates, and pass recent questions to subsequent generation. This is NOT an infinite uniqueness guarantee or semantic relevance proof. Newly arrived topics never force-switch the current conversation. Generation errors/limits keep existing topics and voice usable; in-call topic switches reuse the current voice peer. Fixed fallback matching no longer interprets 米国 as a food keyword.

New topic-generation guards are separate from existing voice-start guards: six requests/minute/client,24/hour/client,120/day/app. At least15seconds between accepted replenishments and45seconds after failures; shared in-flight requests; short server cache. Topic generation is billable text usage, not free/unlimited. No new key, database migration, auth disable or old TTS/review replacement. Keep JWT verification, origin checks and existing per-segment voice controls.

## Acceptance
Require source regression, phone-only UI/actual track lifecycle, two real generated batches with source anchors, tampered-topic rejection, real receive-only opening, synthetic Japanese ASR, real nonzero RMS on BOTH sides, manual mute/reopen, same-peer shuffle, renewal preserving mute and cleanup. Mock UI is distinct from synthetic-media API checks and neither certifies a physical phone. Supervisor reviews actual content/screenshots/evidence before promotion and again after exact deployed asset and proxy checks.

Existing NHK articles/favorites/history/backups/quiet-study/game and default-off local UX observations remain unchanged. No desktop work, raw audio storage, conversation archive, new scores or automatic preference learning.
