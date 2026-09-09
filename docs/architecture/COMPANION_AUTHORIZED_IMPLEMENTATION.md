# Authorized continuation — 2026-09-09

The user explicitly approved a separate v3 service, reuse of existing server API credentials, and an operational-only lease/usage table after the prior safety block. This submission remains subject to connector safety checks. No production frontend or old voice edge is replaced.

Mobile UI must be carefully designed, warm/fresh, restrained and coherent, not a feature-button wall or generic AI dashboard. One main microphone action, conversation-first reading, contextual help, and secondary sheets. No desktop investment. Warm ivory, botanical accents, editorial typography; no synthetic audio animation.

Implementation choice: the persistent browser controller is the single response scheduler on committed native audio item IDs, never on ASR completion. API auto-response is disabled. This avoids duplicating or losing user replies during short-lived edge monitor handoffs. Server maintains authoritative base session, signed source/session tickets and usage/time protections. Ordinary replies remain in the default native audio conversation, with no detached planning/SAY-only pipeline. Observers run separately and never approve or block replies.

Operational metadata table has RLS/no public policies, service-role-only RPC, fixed 20-minute conversation deadline, heartbeat, fencing owner and bounded idempotent usage IDs. There is no audio/transcript/learner-content column. Rows older than one day past expiry are pruned on service start. Guard takeover does not reconnect WebRTC. Browser closes if heartbeats fail; dedicated tests must verify handoff and stop. This is bounded personal pilot protection, not a guaranteed dollar-exact limit or broad-public account authorization.

No runtime acceptance or deployment is claimed by this source submission. Genuine multi-turn/audio/mobile review follows, and the candidate stays on its own branch until review.
