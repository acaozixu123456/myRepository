# HITOKOTO Codex Pro bridge (alpha)

This is the first implementation of the user's requested **Codex subscription channel**. It does not automate chatgpt.com and it does not reuse browser cookies. A local loopback process launches the official `codex app-server` over stdio and lets the existing HITOKOTO web UI use it.

## What is redirected

When HITOKOTO is opened through `http://127.0.0.1:43127/`, every `/api/nhk-speech` companion action is handled locally. There is **no fallback to the production metered companion API**. The rest of the static app and non-companion endpoints are fetched from the existing production site.

The local bridge uses official app-server methods:

- `account/read` and `account/rateLimits/read`
- `thread/start`
- experimental `thread/realtime/start` with browser WebRTC
- `thread/realtime/appendText`, `appendSpeech`, `stop`
- text `turn/start` for teacher notes / exercises / selected-text explanations

Realtime WebRTC is experimental in Codex app-server. CI can verify protocol behavior with a fake app-server, but a real ChatGPT-authenticated smoke test on the user's machine is required before treating this as the default production channel.

## Start on macOS

1. Ensure the current Codex CLI/Desktop is already logged in with **ChatGPT**, not an API key.
2. Double-click `start-mac.command`, or run:

   `node local/codex-bridge/server.mjs`

3. Open `http://127.0.0.1:43127/`.

The Codex desktop window does not need to stay open. The bridge process and computer do need to stay running.

## Start on Windows

Run `local/codex-bridge/start-windows.ps1`, or run `node local/codex-bridge/server.mjs` and open the same localhost URL.

## Status

Open `http://127.0.0.1:43127/__hitokoto_codex/status?refresh=1` to see whether Codex is logged in and, when available, its current rate-limit snapshot. The response intentionally contains no auth token.

## Safety / cost behavior

- binds only to `127.0.0.1`
- never reads `auth.json` itself and never exports ChatGPT credentials
- does not silently fall back to the metered companion API
- uses a separate empty temporary workspace and `readOnly` sandbox for text teacher turns
- exact-text TTS demo (`companion_demo`) is intentionally unavailable in this alpha rather than secretly calling the paid API
- non-companion endpoints such as older NHK tooling are not yet migrated and can still use their existing server behavior
