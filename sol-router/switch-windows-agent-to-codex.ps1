param()

$ErrorActionPreference = 'Stop'
throw @'
CODEX_ROLLOUT_REVIEW_IN_PROGRESS

The previous one-command bootstrap has been disabled because it could terminate an active executor worker and did not provide a verified health/canary rollback gate.

Do not use the old Cursor-to-Codex rollout script. The reviewed installer will be promoted here only after:
- the current non-terminal migration run is recovered;
- the integrated protocol 2.6 source passes validation;
- active-run fail-closed, ChatGPT-only auth, watchdog, backup/rollback, health and isolated canary gates are verified.
'@
