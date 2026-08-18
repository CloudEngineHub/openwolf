# Changelog

All notable changes to OpenWolf are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and OpenWolf uses
[Semantic Versioning](https://semver.org/).

## [2.0.4] - 2026-08-18

The repair release. A full audit against the Claude Code hooks reference
found that most of OpenWolf's guidance never reached the model, that the
measurement layer inflated and misattributed numbers, and that anatomy.md
could destroy hand-written content. This release fixes all of it.

### Fixed

- Every hook nudge now actually reaches the model. Anatomy hints, symbol
  slice hints, repeated-read notes, cerebrum Do-Not-Repeat warnings, buglog
  matches, and edit-count warnings were written to stderr with exit code 0,
  which Claude Code sends to the debug log only; the model never saw any of
  them, in 1.x or 2.x. They now flow through the documented
  `hookSpecificOutput.additionalContext` channel.
- End-of-turn reminders no longer burn a full extra model turn each. The Stop
  hook queues them and a new UserPromptSubmit hook delivers them with the next
  user prompt. Reminders fire at most once per session, and the STATUS.md
  staleness nudge (previously stderr-only, a no-op) joins the same queue.
- The token ledger is idempotent. The Stop hook fires every turn, and the old
  flush appended a cumulative session entry each time while re-adding running
  totals (including full-transcript measured usage) to lifetime, producing
  duplicate entries and quadratically inflated metrics. Session entries are
  now upserted by id, lifetime is derived from the retained sessions plus an
  archived baseline, sessions are capped at 200, and `openwolf update`
  repairs existing inflated ledgers. A new SessionEnd hook writes the single
  memory.md session summary that used to be appended once per turn.
- Read-token tracking works again: the post-read hook read a `tool_output`
  field that does not exist in the PostToolUse payload; it now parses
  `tool_response` in all its shapes.
- Savings are honest. The old formula credited 200 tokens per anatomy hit and
  the full token count of every repeated read that in fact went through and
  was paid for. Savings are now credited only for duplicate reads OpenWolf
  verifiably prevented, and `openwolf report` leads with measured transcript
  usage instead of estimates.
- anatomy.md no longer destroys hand-written content above the first section
  heading (#61, including the follow-up report): preambles survive rewrites,
  hand-written indented notes are preserved, and an empty or unreadable
  anatomy.md can no longer wipe preserved content on import.
- The OpenCode plugin is de-forked from the canonical hook logic, closing a
  cluster of already-fixed bugs it still shipped: pre-#61 anatomy data loss,
  an .env-only sensitive-file guard (#54), missing outside-root guard, stale
  read warnings after edits (#41), boundary-less path matching, ledger
  inflation, and crashes on pre-2.0 ledger files.
- Windows installs get working hooks: `$CLAUDE_PROJECT_DIR` never expands
  under cmd.exe, which silently disabled all hooks; settings now use the
  platform's own variable syntax.
- `openwolf scan --check` no longer reports out-of-date immediately after a
  scan; it compares against the exact merged render a scan would write.
- Scanner lock contention no longer clobbers curated descriptions; the write
  is skipped and the next scan converges.
- Daemon and dashboard reliability: the launcher reuses this project's own
  daemon instead of forking an orphan per invocation and persists the served
  port; a bind race no longer kills the daemon silently; `/api/health`
  reports real degraded states; AI cron tasks no longer freeze the daemon
  event loop for up to two minutes; cron-state and token-ledger writers are
  file-locked against each other; `daemon stop` kills every listener on the
  port; memory consolidation is idempotent across runs.
- Dashboard data: live anatomy.md updates no longer wipe symbol data derived
  from the index; the anatomy metadata regex is anchored; memory table rows
  with empty cells no longer shift columns.
- CLI paper cuts: `openwolf restore` works from subdirectories; the Node 20
  version guard runs before the CLI loads; registry writes are atomic and
  read-only listings no longer unregister projects on unmounted volumes;
  buglog ids no longer collide after manual deletions; the daemon staleness
  threshold respects the configured heartbeat interval.
- The Codex adapter merges `.codex/hooks.json` instead of clobbering user
  hooks, and skill/rule installs never overwrite user-customized files.

### Changed

- The always-on context bill is much smaller. anatomy.md no longer renders
  symbol sub-bullets (symbols stay in `anatomy-index.json` and reach the
  model through the per-file pre-read hint), roughly halving the rendered
  index. OPENWOLF.md is rewritten at about a third of its size; DesignQC and
  Reframe move to on-demand skills (`/designqc` is new). The navigation rule
  is now "grep anatomy.md for the path", never "read anatomy.md".
- New config `openwolf.reads.duplicate_mode`: `warn` (default) injects a
  context note on a repeated unchanged full-file read; `deny` blocks it with
  a reason the model sees (never for ranged reads, never in subagents, never
  after compaction, at most once per file per session); `off` only counts.

Thanks to prghbla and laihenyi (#61) for the anatomy data-loss reports and
analyses that triggered the full audit.

### Fixed

- The post-write hook no longer crashes on every write. `symbol-extractor.js`
  was imported by the installed hook but missing from the install, update, and
  status file lists, which silently disabled write tracking, memory.md logging,
  and anatomy.md updates on every v2 install. `openwolf status` now checks all
  11 hook files, and a regression test verifies that every file imported by an
  installed hook is present in the copy lists. Reported with a full root-cause
  analysis by Laptopcorei7 (#68).
- The Stop hook no longer reports "no semantic summary was written" on every
  session. `countSemanticEntries()` looked for a UTC date prefix that no writer
  ever emits; it now counts entries under the newest session heading. This also
  fixes sessions that cross midnight looping forever on the reminder. Reported
  by statik1 (#62) and Laptopcorei7 (#68).
- End-of-turn reminders now fire at most twice per session, so a reminder whose
  condition cannot be cleared degrades into a stale message instead of a
  non-terminating loop (#68).
- The buglog reminder now checks buglog.json's modification time. The old check
  read a session list that buglog.json could never appear in, so the reminder
  fired even right after the file was updated (#68).
- On Windows, files on a different drive than the project are no longer indexed
  into anatomy (#68).
- Auto-detected buglog entries now name the file they refer to. Error-handling
  detection requires a real catch/except construct instead of a substring match,
  so a comment containing the word "catch" no longer files a bug, and test
  files are skipped by the error-handling and guard-clause rules. Reported with
  verified repros by spignataro (#73).
- The anatomy store now preserves anatomy.md lines it does not recognize, such
  as prose notes or entries sized in GB/MB instead of tokens, instead of
  silently deleting them on the next write. Reported with a proposed patch by
  prghbla (#61).
- The repeated-read notice only fires when the file is unchanged since the last
  read. A file modified during the session, by the agent or externally, can be
  re-read without a false warning, and writing a file clears its read record.
  The notice wording now leaves the gist-vs-exact decision to the model.
  Reported by 1re2turn1 (#41).
- `openwolf cron list` and `openwolf status` now say when the scheduler cannot
  run (pm2 missing, daemon not running, or heartbeat stale) instead of showing
  tasks as enabled that will never fire. Reported by Esturban (#75).

### Added

- `openwolf daemon status` shows whether the daemon is running.
- `openwolf cron enable <id>` and `openwolf cron disable <id>` toggle tasks
  without hand-editing cron-manifest.json.

## [2.0.2] - 2026-07-15

### Added

- Antigravity agent adapter (beta, context-level via `AGENTS.md`).
  `openwolf init --agent antigravity` and `--agent all` now include it, and
  auto-detection picks it up when Antigravity is installed.

### Changed

- Documentation and website refreshed to reflect v2 throughout: the seven
  lifecycle hooks including PreCompact, the durable anatomy store with
  symbol-level reads, measured token usage, the redesigned dashboard, the
  `/reframe` skill, and per-project dashboard ports. Retired Design QC
  content removed. Positioning generalized across supported agents.

## [2.0.1] - 2026-07-15

### Fixed

- Dashboard no longer white-screens when the server rejects the token. A 401
  now renders a clear "token rejected" message with guidance instead of
  crashing the page. Root cause: `StatusBadge` threw on an undefined status,
  and failed API responses were being fed into component state.
- Multi-project port collisions resolved. Projects upgraded from 1.x all kept
  the shared default dashboard and daemon ports, so only the first project's
  dashboard would ever open. Three fixes work together: `openwolf update`
  reassigns a free port pair when a project's ports collide with another
  registered project, `openwolf dashboard` starts this project's server on a
  free port when the configured one is held by another project's daemon
  (instead of opening a URL that gets a 401), and the daemon accepts an
  `OPENWOLF_DASHBOARD_PORT` override. Fresh installs already received unique
  ports; this brings upgraded projects to parity.

## [2.0.0] - 2026-07-15

OpenWolf 2.0 turns the second brain for Claude Code into a context layer for
every AI coding assistant, with verifiable token measurement, a hardened
security posture, and a re-architected project index.

### Added

Multi-agent support:

- Agent adapter architecture: `openwolf init` now auto-detects the coding
  agents installed on your machine and wires each of them to the same `.wolf/`
  brain. Explicit control via `--agent codex opencode gemini cursor`, `--agent all`,
  or `--agent claude` to opt out.
- Codex CLI integration: project-level lifecycle hooks via `.codex/hooks.json`
  plus an `AGENTS.md` protocol block.
- OpenCode integration: a native plugin installed to `.opencode/plugin/` that
  maps OpenCode tool events onto the `.wolf/` state.
- Gemini CLI integration: `GEMINI.md` protocol block.
- Cursor integration: an always-applied rule at `.cursor/rules/openwolf.mdc`.
- Protocol blocks are marker-fenced and idempotent: your own content in
  `AGENTS.md` or `GEMINI.md` is never modified, and re-running init never
  duplicates anything.

Measured token usage:

- The Stop hook reads real API usage from the harness transcript (input,
  output, cache read, cache write tokens, and API call count) into the token
  ledger. Estimates and measurements are reported side by side.
- New `openwolf report` command: estimated vs measured usage in the terminal.
- Per-agent session attribution: every ledger session records which agent ran it.

Context management:

- Session digest: at session start, a token-budget-capped digest of the most
  valuable state (STATUS.md next phase, Do-Not-Repeat list, recent bug fixes,
  anatomy pointer) is injected directly into the model's context.
  Budgets are configurable per agent in `config.json`.
- Compaction survival: a new PreCompact lifecycle hook
  snapshots in-flight session state, and session start after compaction
  re-injects a digest of the files already modified. Session state is no
  longer wiped on resume or compaction.
- Anatomy staleness detection: scans pin the git HEAD; if the HEAD moves or
  the scan ages past the configured interval, the agent is told to rescan
  before trusting the index.
- End-of-turn reminders now reach the model through the `additionalContext`
  channel instead of invisible stderr.
- `STATUS.md` session handoff document: resume any session in one small read.

Anatomy re-architecture:

- Durable store: the source of truth for the project index moved from
  `anatomy.md` itself to `.wolf/anatomy-index.json`, with `anatomy.md`
  rendered from it. Concurrent writers now coordinate through a
  cross-platform lock; simultaneous edits no longer lose entries.
- Version-skew safe: markdown written by older hooks or edited by hand is
  detected by content hash and absorbed additively into the store.
- Symbol-level entries: files above 500 estimated tokens index their
  top-level functions and classes with line ranges and per-slice token
  estimates (TypeScript, JavaScript, Python, Go, Rust). The pre-read hint
  points agents at exact line ranges so they can read one function with
  offset/limit instead of the whole file. Hints are suppressed automatically
  if the file on disk has changed since indexing.

Skills and tooling:

- Bundled skills installed on init for Claude Code, Codex, and OpenCode:
  `/security-audit` (layered audit: dependencies, secrets, injection
  surfaces, authorization, ranked report) and `/reframe` (framework
  selection and migration plus a design audit/fix mode).
- `scripts/openwolf-check.mjs`: a standalone, read-only inspector that
  reports whether OpenWolf is installed in a project, which agents are
  wired, recency, and lifetime plus recent-session statistics.
- `openwolf update` now has parity with init: it creates missing files,
  re-runs the recorded agent adapters, refreshes bundled skills, and
  performs one-time data migrations, all after taking a timestamped backup.

Dashboard 2.0:

- Complete redesign: monochrome dot-matrix design system with a single
  signal-red accent, top navigation, bento stat tiles, and hash-based deep
  links to panels.
- Surfaces the 2.0 data: measured vs estimated tokens, cache economics,
  per-agent breakdown table, wired-agents widget, context health (scan
  freshness, pinned git HEAD, digest budget), and the STATUS.md handoff.
- Reliable Run Now for cron tasks over authenticated HTTP with visible
  running/queued/failed feedback.

### Changed

- Reframe now leads with an anti-generic design mandate: a blocklist of the
  recognizable AI-generated aesthetic plus positive principles, applied to
  every framework migration prompt. Distinctiveness is an acceptance criterion.
- Astryx added as the 13th framework in the Reframe knowledge base.
- Contributors are credited in the README; detailed attribution lives in
  commit trailers.
- STATUS.md template localized to English.

### Fixed

- CRLF line endings no longer wipe `anatomy.md` on Windows (#50, #24).
- Concurrent post-write hooks no longer lose anatomy entries.
- Old `config.json` files without newer sections no longer crash commands (#26, #27).
- `openwolf init` and `openwolf update` no longer reset per-project ports;
  fresh projects get a free port pair automatically (#37, #38).
- `bug search` is null-safe across buglog schema drift (#44).
- `EPERM` on WSL2 with EFS-encrypted directories fixed via a copy shim (#33).
- Files outside the project root no longer pollute the index (#56).
- Documentation and config edits are no longer mislogged as bug fixes, and
  auto-detection can be disabled (#28, #57).
- Dart language support in the scanner (#10).

### Security

- Dashboard binds to 127.0.0.1 by default and requires a per-project token
  (timing-safe comparison) for all API and WebSocket access (#30, #34).
- Command injection eliminated: every dynamic process invocation uses
  argument arrays; a shell-mode spawn was removed from the cron engine.
- Path traversal guards (realpath-based, symlink-safe) on cron AI task file access.
- File-watcher broadcasts capped at 1 MB to prevent memory abuse.
- Secret-bearing files (keys, keystores, credential files, `.npmrc`, and
  more, not just `.env`) are excluded from all index and memory capture (#54).
- A security regression test suite runs with `pnpm test`, including a guard
  test that fails the build if injectable process calls ever return.

### Removed

- Design QC screenshot capture (agents capture and read their own
  screenshots now); the `puppeteer-core` dependency is gone.
- The unverifiable token comparison chart in the dashboard; only measured
  numbers or clearly labeled estimates are shown.

## [1.0.4] - 2026-03-20

Final 1.x release. Claude Code only.
