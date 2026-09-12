# HITOKOTO Codex subscription bridge

Goal: allow the existing HITOKOTO UI to use a locally running, ChatGPT-authenticated `codex app-server` instead of the metered OpenAI API. This mode is explicitly opt-in, never silently falls back to API billing, and requires the user's computer to remain online.

## Architecture

`https://nihongo-discovery-v2-20260831.vercel.app` -> loopback-only HITOKOTO bridge -> `codex app-server --listen stdio://` -> ChatGPT/Codex subscription.

The local bridge binds only `127.0.0.1`, accepts only the production HITOKOTO origin plus explicit localhost development origins, and never reads or exports ChatGPT/Codex auth files. `codex app-server` owns the account session.

The browser owns WebRTC. It creates an SDP offer and sends it to the local bridge. The bridge calls the experimental official `thread/realtime/start` WebRTC method and returns the `thread/realtime/sdp` answer. Bridge notifications are exposed to the browser as server-sent events. No browser automation, cookies, DOM scraping, or private ChatGPT web endpoints are used.

## Cost and safety contract

- Codex mode does not call `/api/nhk-speech` for model generation.
- API fallback is off by default and must never happen implicitly.
- The UI displays the active channel and `account/rateLimits/read` data when available.
- If the local bridge or Codex login is unavailable, the session fails closed with an explanation.
- `codex app-server` realtime WebRTC is experimental; this cannot be declared production-ready until tested on the user's real ChatGPT-authenticated Codex installation.

## Delivery stages

1. Local bridge + fake-app-server protocol tests.
2. Web UI opt-in channel + no-API-fallback tests.
3. Real local ChatGPT-authenticated smoke test on the user's computer.
4. Only after step 3, make Codex the user's default channel.
