# NHK roadmap batch 1: reliable records and focused sentence explanations

## Context and authoritative locations

User approved implementation after the 2026-09-05 product review. Keep NHK as the sole core and preserve the calm UI; do not reintroduce fictional worlds, AppDeploy, or the Windows executor for this app.
Repository: acaozixu123456/myRepository. Production source: nihongo-vercel. Production URL: https://nihongo-discovery-v2-20260831.vercel.app. Baseline: b92bb9ee263dc2d61cc837bcaba8856c0ad16f00. Supabase project: kivebsjsdfdobxzaokbj.

## Implemented in this batch

- Every output practice uses a distinct ID, including multiple articles on the same day. Existing date-keyed sessions remain readable. Changing a target after typing or recording forks a new session rather than attaching an old answer to a new sentence.
- Sentence recall drafts, answer text, reveal time, self-rating and submitted attempts are persisted separately. Submitted recall attempts are immutable. Article detail exposes recent practice records; full history is included in backups.
- Backup v2 includes articles, knowledge, sessions, gentle progress and answer history. Import supports existing schema-v1 backups, previews contents, downloads a pre-restore backup, merges conservatively, rejects unsafe/malformed/version-unknown files, keeps conflicting answer versions and is idempotent on repeated import. Source conflicts fail explicitly instead of overwriting a saved article.
- Restore uses a journal, read-back checks and rollback; interrupted restores are recovered before the main page mounts. This is NOT multi-device cloud sync or a guarantee against all browser/device failure. Import files remain in the browser.
- Existing article snapshots take priority over legacy practice extracts during startup. The article library no longer truncates its supplied sentence arrays/long sentences or removes repeated source sentences.
- Any sentence in the saved article body can be opened with its original index and two adjacent sentences on either side. Focused explanations are explicitly requested and persist with that article. Old top-three recommendations still exist, but a non-recommended sentence is no longer passed off as a fully generated explanation.
- New proxy api/nhk-sentence.ts calls the protected nihongo-sentence edge function. Exact sentence/index/chunk alignment is verified before storing output. Invalid/oversized inputs and failed model output are explicit errors, not fabricated success. Maximum focused input is 8,000 characters; larger inputs are rejected, not silently trimmed.
- Existing coach recommendation normalization now checks source text before trusting a numeric sentence index.

## Real backend review and cost controls

A copied old public anon fallback was malformed. The new proxy uses the enabled public anon configuration read back from the connected project; JWT verification remains enabled. No service-role or OpenAI secret is exposed or rotated.
The initially selected gpt-5-mini returned model_not_found. gpt-5.6-luna produced a response but manual review found imprecise change-of-state teaching and Chinese glosses embedded in Japanese example fields. The focused endpoint uses gpt-5.6-terra with clearer schema/prompt constraints; this changes ONLY the explicitly requested focused explanation, not the existing article-generation or audio models.
Cache namespace sentence-v3-terra, 14-day server cache, per-article local cache. New generation is capped at 40/day globally and 10/hour per client key, separate from the old coach quota. A public anon JWT is transport authorization, not end-user identity; client identifiers are not tamper-proof. Account authentication/abuse-resistant quotas are later work.
One synthetic sentence exercises double negation and an original index of 19. A successful endpoint test is only structural/transport evidence. Content must still be reviewed, and one reviewed example does not establish correctness for every NHK article.

## Verification gates

Feature gate: .github/workflows/nhk-reliability-verify.yml. Real-only diagnosis: nhk-sentence-live-check.yml. Production gate: nhk-calm-production-smoke.yml.
Feature run 33943595032 verified 96 unit tests, six new grouped browser cases plus six accessibility audits, and the old 15 grouped cases plus 40 state audits on Chromium/WebKit. After final backend/source changes, the final gate and production gate remain authoritative for the published revision.
Production gate compares actual JavaScript/CSS content hashes and exact service-worker bytes with a build from the release commit, runs isolated browser flows with mocked AI, then separately invokes the REAL production sentence proxy. No actual learner data is used in CI. Browser fixtures intentionally do not prove translation accuracy.

## Still not implemented / next priorities

1. Optional account-based backup and cross-device sync with identity, conflict handling and recovery tests. Current data is still browser-local, with manual export/import.
2. Complete-source import audit: upstream MOJi extraction and the old initial whole-article coach still have separate limits. This batch preserves supplied content; it does NOT certify every remote article was imported in full.
3. Individual word/span questions and a representative real-article teaching regression set, not just one synthetic example.
4. Delayed recall for light sentence practice without forcing permanent bookmarks; preserve the distinction between self-report and demonstrated understanding.
5. Cross-article knowledge re-encounters, listening-first optional flow, practical transfer and evidence-based personalization.
6. Real iPhone audio/recording, PWA share handoff and long-term learning effectiveness remain separate validation needs.

## Release invariants

Do not clear localStorage or tell the user to clear site data for a UI refresh. Do not overwrite raw article snapshots from practice sessions. Do not treat a click or self-rating as proven mastery. Do not publish based on mocked UI tests alone. Do not call this batch cloud synchronization, full-text extraction completion, or completion of the entire four-stage roadmap.
