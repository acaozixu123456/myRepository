# Implementation checkpoint — not a release

The approved v3 architecture remains the target. The first actual implementation adds article-independent topic seeds, a single native-conversation prompt, a separate adaptive support evidence model, ordered auxiliary transcript metadata and explicit minimal local-learning-memory helpers. These are not yet wired to a microphone, UI or a production API. The new tests cover these pure contracts, not dialogue quality or physical-phone behavior.

The next backend submission was blocked by a tool safety check on 2026-09-09. It was NOT retried through another tool, split into equivalent submissions or deployed. No backend function, database schema, API credentials or production frontend reference has been changed. The blocked proposal is not part of this checkpoint. The proposed database lease migration was also removed from this candidate pending review; no migration has been applied.

Backend design needing resolution: retain a continuous native Realtime session while renewing only its server-side monitoring worker. This requires a small operational lease table containing expiry/ownership/usage counters, not audio or learner records, plus a separate v3 service using the already configured server-side API credential. Existing NHK and voice paths remain untouched.

Do not call this foundation a usable voice companion, do not promote it and do not interpret passing unit tests as solved semantic relevance. The next gate is an authorized backend implementation, a native microphone client, actual multi-turn relevance/correction/help evaluation, phone UI and explicit human validation. Continue to distinguish unverified design, implemented source and verified runtime facts.
