# OpenWolf 2.5.2 release verification

OpenWolf 2.5.2 passed automated build, regression, package-install, upgrade and daemon checks across Linux, macOS and Windows. Native Codex recovery and OpenCode notifications were also verified. The full live Claude/Codex round trip remains unavailable because Claude model access was unavailable.

Scope: context handover and recovery, recorded usage/pricing, durable journals and archival, safe anatomy refresh, compatible runtime updates, quiet activity receipts and synchronized dashboard content. Contributor roles and original commit attribution are retained in CREDITS.md and docs/audit/.

Protected durable memory remains disabled in ordinary user-owned npm installations. Independent administrator provisioning is required to activate protected instruction injection. Handover evidence, activity receipts, archival and usage reporting work without that provisioning.

Existing 2.5.1 installations require a package refresh and `openwolf update` once to acquire the updater/bootstrap changes. Restart project daemons and start new sessions. Later compatible runtime updates prepare hooks/plugins for new sessions; they do not update the global CLI or a running daemon.

## Verified locally: 2026-09-15

- macOS, Node 24.15.0: production build, plugin/dashboard type checks, documentation build and all 322 tests in 72 suites passed without failures or skips.
- Actual npm tarball installation and published 2.5.1 → candidate 2.5.2 upgrade passed on Node 24.15.0 and Node 20.20.2. Existing memory and a custom Claude status command survived. Claude/Codex/OpenCode helpers were refreshed; Grok added no duplicate registration.
- The packaged daemon served authenticated dashboard activity, rejected unauthenticated requests and retained counts across restart. The dashboard was also checked in Chrome during visibility implementation. The installed package's production dependency audit reported zero vulnerabilities.
- Native Codex 0.154.0 displayed `OpenWolf · Restored saved task context`. Model turns recovered a saved objective marker and unresolved item without reading files or using tools, including after native resume and compaction. The PreCompact hook succeeded. Session-end hook timeout now respects Codex's three-second limit.
- That native Codex session's report matched its saved provider counters after resume/compaction: 50,393 input tokens including 28,800 cached input tokens, 146 output tokens including 80 reasoning tokens, and 50,539 total tokens. Codex's exit summary separately displayed 21,593 fresh input plus 28,800 cached input. OpenWolf prices those input categories separately.
- Native OpenCode 1.18.29 loaded the plugin and displayed `OpenWolf · Archived 1 old session · restorable` after actual archival and an empty test session's deletion. The shared five-minute cooldown suppressed the first attempt and delivered the queued notice after the interval. No model request was needed. Bun 1.4.2 also passed a plugin-entrypoint lifecycle/toast/deduplication check using a mocked SDK.
- Native Grok Build 1.0.13 loaded the existing Claude-compatible settings and recorded its SessionStart with agent `grok`. Terminal activity receipts are intentionally unsupported for Grok; history remains available in the dashboard.
- Native Claude Code 2.1.270 executed SessionStart and UserPromptSubmit hooks. Inference was refused because subscription access had expired. No successful Claude coding turn or complete handover round trip is claimed.

## Outstanding verification and activation

The Linux/macOS/Windows Node 24 matrix and Linux Node 20 runtime job are defined in `.github/workflows/validate.yml`. All four jobs passed in [validation run 34894539164](https://github.com/cytostack/openwolf/actions/runs/34894539164) at runtime commit `87a59c5` on `release/openwolf-2.5.2`. Each job built and exercised the packed package; Node 24 jobs also passed all 322 regression tests. Subsequent documentation updates do not change the validated runtime.

Windows validation found and verified fixes for ordinary-file owner ID zero incorrectly disabling runtime updates, and a native watcher crash when using abbreviated project paths. The daemon now resolves the native project path before starting watchers. ESM file URLs and platform-correct shell-path, line-ending and transcript-path fixtures also passed. The package smoke test checks the daemon's canonical project identity as well as authenticated activity and restart persistence.

The live Claude → Codex → Claude coding round trip, Claude status-line rendering, compaction/restart checks for the other native harnesses, and paired long-session quality/token-efficiency evaluation remain outstanding. Deterministic handover/recovery tests and a native Codex resume/compaction check do not substitute for those evaluations. Automatic handover import stays off.

Protected durable instruction authority remains unavailable until independent administrator deployment and review. `openwolf operations prepare --output <new-directory>` creates a versioned deployment review manifest; it does not provision or approve the protected runtime. Ordinary handover evidence and activity features remain usable without it.

The checks above ran before publication. OpenWolf 2.5.2 was published on 2026-09-15 from commit `571bd1a`. See the [npm package](https://www.npmjs.com/package/openwolf/v/2.5.2) and [GitHub release](https://github.com/cytostack/openwolf/releases/tag/v2.5.2). Reproduce the package/upgrade/daemon checks after building with `node scripts/release-smoke.mjs`; the script uses disposable projects and an isolated process-local home lookup, and cleans up its own daemon.
