# OpenWolf 2.5.2 release verification

The 2.5.2 release candidate is prepared locally. Cross-platform CI and the full live Claude/Codex round trip remain unverified; this is not a claim that every release gate passed.

Scope: context handover and recovery, recorded usage/pricing, durable journals and archival, safe anatomy refresh, compatible runtime updates, quiet activity receipts and synchronized dashboard content. Contributor roles and original commit attribution are retained in CREDITS.md and docs/audit/.

Protected durable memory remains disabled in ordinary user-owned npm installations. Independent administrator provisioning is required to activate protected instruction injection. Handover evidence, activity receipts, archival and usage reporting work without that provisioning.

Existing 2.5.1 installations require a package refresh and `openwolf update` once to acquire the updater/bootstrap changes. Restart project daemons and start new sessions. Later compatible runtime updates prepare hooks/plugins for new sessions; they do not update the global CLI or a running daemon.

## Verified locally — 2026-09-15

- macOS, Node 24.15.0: production build, plugin/dashboard type checks, documentation build and all 322 tests in 72 suites passed without failures or skips.
- Actual npm tarball installation and published 2.5.1 → candidate 2.5.2 upgrade passed on Node 24.15.0 and Node 20.20.2. Existing memory and a custom Claude status command survived. Claude/Codex/OpenCode helpers were refreshed; Grok added no duplicate registration.
- The packaged daemon served authenticated dashboard activity, rejected unauthenticated requests and retained counts across restart. The dashboard was also checked in Chrome during visibility implementation. The installed package's production dependency audit reported zero vulnerabilities.
- Native Codex 0.154.0 displayed `OpenWolf · Restored saved task context`. The following model turn recovered a saved objective marker and unresolved item without reading files or using tools. Session-end hook timeout now respects Codex's three-second limit.
- That native Codex session's report matched its saved provider counters: 33,030 input tokens including 16,128 cached input tokens, 119 output tokens including 80 reasoning tokens, and 33,149 total tokens. Codex's exit summary separately displayed 16,902 fresh input plus 16,128 cached input. OpenWolf prices those input categories separately.
- Native OpenCode 1.18.29 loaded the plugin and displayed `OpenWolf · Archived 1 old session · restorable` after actual archival and an empty test session's deletion. The shared five-minute cooldown suppressed the first attempt and delivered the queued notice after the interval. No model request was needed. Bun 1.4.2 also passed a plugin-entrypoint lifecycle/toast/deduplication check using a mocked SDK.
- Native Grok Build 1.0.13 loaded the existing Claude-compatible settings and recorded its SessionStart with agent `grok`. Terminal activity receipts are intentionally unsupported for Grok; history remains available in the dashboard.
- Native Claude Code 2.1.270 executed SessionStart and UserPromptSubmit hooks. Inference was refused because subscription access had expired. No successful Claude coding turn or complete handover round trip is claimed.

## Outstanding verification and activation

The Linux/macOS/Windows Node 24 matrix and Linux Node 20 runtime job are defined in `.github/workflows/validate.yml`. Each job builds and exercises the packed package; Node 24 jobs also run the regression suite. Local test imports use file URLs so Windows drive paths do not become unsupported ESM protocols. The validation-branch push was refused because the GitHub OAuth credential lacks `workflow` scope. CI results are pending until an authorized push can start them.

The live Claude → Codex → Claude coding round trip, Claude status-line rendering, compaction/restart checks across native harnesses, and paired long-session quality/token-efficiency evaluation remain outstanding. The owner confirmed that the Claude subscription is over; no additional credential or subscription setup is assumed. Deterministic handover/recovery tests and a native Codex checkpoint check do not substitute for those evaluations. Automatic handover import stays off.

Protected durable instruction authority remains unavailable until independent administrator deployment and review. `openwolf operations prepare --output <new-directory>` creates a versioned deployment review manifest; it does not provision or approve the protected runtime. Ordinary handover evidence and activity features remain usable without it.

No npm version was published or tagged during these checks. Reproduce the package/upgrade/daemon checks after building with `node scripts/release-smoke.mjs`; the script uses disposable projects and an isolated process-local home lookup, and cleans up its own daemon.
