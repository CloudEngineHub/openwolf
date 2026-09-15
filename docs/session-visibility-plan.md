# Useful, quiet OpenWolf visibility

Status: available in [OpenWolf 2.5.2](https://github.com/cytostack/openwolf/releases/tag/v2.5.2), with automated contract tests and Chrome dashboard verification. Native Codex recovery receipts and OpenCode archive toasts were verified for 2.5.2; Grok's compatible SessionStart also ran successfully. Claude inference is unavailable because model access was unavailable. See the [release verification record](release-2.5.2.md) for versions and outstanding checks. Updating this checkout does not activate copied hooks in other projects.

## Implemented behavior

Set `openwolf.visibility.mode` in `.wolf/config.json` to `quiet` (default), `off`, or `verbose`. `OPENWOLF_VISIBILITY=off` disables new receipts and visibility notices for that process. Malformed configuration fails silent. Existing functional protection messages and the compatible-release update policy are independent of this display setting.

- Claude: an OpenWolf status-line segment is installed when no existing project, parent-project or user status-line setting is found. Existing commands are preserved. Users with a custom status line can explicitly compose `node "/absolute/project/.wolf/hooks/visibility-statusline.js"` into their own command; OpenWolf never executes or wraps their command automatically. The segment expires after five minutes and is session scoped.
- Claude and Codex: rare recovery receipts use supported synchronous `systemMessage` output at existing startup/prompt/stop boundaries. Quiet mode keeps routine work in the Claude status line and dashboard; verbose permits routine boundary receipts under the same limits. Codex retains its existing hook `statusMessage` labels while work runs.
- OpenCode: an informational SDK toast is sent at an existing idle/error/deleted boundary, coalesced to one message. No rendering promise is awaited. Missing, throwing and rejected TUI implementations silently retain dashboard history. The shared helper is checked against the installed 1.18.30 SDK.
- Grok: `--agent grok` selects the existing Claude-compatible settings route. It creates no second hook registration and adds no terminal receipts. Documented `GROK_HOOK_EVENT`, `GROK_SESSION_ID`, and `GROK_WORKSPACE_ROOT` identify compatible hook invocations; native project trust and enabled Claude compatibility are prerequisites. Custom Claude settings paths are not automatically made discoverable by Grok.
- Dashboard: the overview activity card reads authenticated `/api/activity` every 15 seconds. Last completed action, recorded counts, bootstrap version, update status and expandable history use the same materialized receipt state. Operational readiness also reports the visibility mode.

Receipts are attached to committed semantic/compaction checkpoints, verified packet export/import persistence, restored active context, completed archival, committed partial-map retention, nonempty relevant prior fixes, verified reviewed-memory reads, actual emitted read denials, and verified ready updates. Imported packets are reported as saved context; restoration is reported when active context is emitted to a supported hook. A receipt describes OpenWolf's completed operation, not independent proof that a harness displayed or consumed it. Read-denial receipts remain dashboard-only to avoid duplicating their functional protection message. Update-ready receipts also remain dashboard-only because the existing release/state notice handles terminal delivery.

### Storage and performance boundaries

`.wolf/activity/` is machine-local and gitignored. Producers add small immutable receipt files without shared-lock waits, network, model calls, transcript reads or extra source-file hashing. Evidence and session identities are hashed; receipt text comes from fixed templates and contains no project filenames, transcript excerpts, rule contents or task titles. Evidence hashes correlate operations; they are not memory approval or cryptographic proof of harness delivery.

The queue has 4,096 fixed slots. Boundary reduction reads at most 32 slots; dashboard reduction can drain the entire queue. Materialized history retains 100 actions and pending delivery retains 256 actions for at most 24 hours. Cumulative counts cover **recorded** operations, not every operation: occupied queue slots and the bounded persistent membership filter can suppress receipts under load. The membership filter favors silence on collisions and prevents replay inflation without retaining unbounded evidence identities. Queue loss never loses a checkpoint, archive or other operational write. Removing activity state resets these counters and display budgets.

Delivery claims use a zero-wait atomic state transaction. A busy or failed state write emits nothing and leaves the queue recoverable. Routine displays share a project-wide five-minute interval and a maximum of three per turn; startup recovery is limited to one per retained session. Turn/startup bookkeeping retains the latest 256 identities. Repeated actions of the selected kind are aggregated. Existing update notices remain once per project/release/state and take precedence over an activity receipt. Headless failures do not retry into repeated warnings or model turns.

### Validation

Automated tests cover simultaneous process claims, resume/retry deduplication, bounded history, exact display budgets, quiet/off/verbose, private text, failed commits, archive previews versus committed counts, checkpoint lock contention, missing/rejecting toast SDKs, actual Claude/Codex/Grok-shaped hook subprocesses, session-scoped status-line output and preservation of custom status commands. The authenticated daemon API and Chrome dashboard were exercised with synthetic handover operations; history expanded correctly and the count refreshed without reload.

Final local verification on macOS / Node 24.15.0 (2026-09-14): production build passed; 322 tests / 72 suites passed, with no failures or skips; package dry run contained all visibility runtime and documentation files. The 1,000-per-mode benchmark measured:

| Measurement | Off p50 / p95 | Quiet p50 / p95 | Added p50 / p95 |
| --- | --- | --- | --- |
| Receipt bookkeeping | 0.012 / 0.016 ms | 0.327 / 0.389 ms | 0.315 / 0.373 ms |
| Full pre-write hook process | 32.494 / 36.624 ms | 33.041 / 38.203 ms | 0.547 / 1.579 ms |

These measurements meet the 2 ms added-bookkeeping target in this fixture. They are not a guarantee of zero overhead on every machine or under a large boundary backlog, and do not measure native rendering or model calls. The receipt implementation starts no model calls.

Run `pnpm build`, `node --test tests/visibility.test.ts`, and `node scripts/benchmark-visibility.mjs --hooks`. The benchmark compares 1,000 invocations per mode after warmup, alternating modes for the full pre-write hook. It measures local runtime cost, not model-token savings. The 2.5.2 checks passed Linux/macOS/Windows CI and include Bun plugin execution and native Codex/OpenCode displays. Claude status-line rendering and user-attention evaluation remain outstanding.

## Experience

Show a short, factual receipt when OpenWolf changes an outcome. Do not ask the model to advertise OpenWolf, add filler to its replies, or narrate every `.wolf` read. No questions, approval dialogs, new agent turns or model calls.

Examples (only when backed by a completed operation):

| Completed operation | Receipt |
| --- | --- |
| A relevant previous fix was retrieved | `OpenWolf · Found a previous fix for this error` |
| A duplicate read was actually prevented | `OpenWolf · Reused an unchanged file` |
| A context checkpoint was persisted and verified | `OpenWolf · Saved context for handover` |
| Old memory was archived | `OpenWolf · Archived 4 old sessions · restorable` |
| A partial anatomy scan preserved existing entries | `OpenWolf · Kept the last complete project map` |
| A new runtime passed verification | `OpenWolf 2.6.0 · Ready for new sessions` |
| A durable rule was accepted by the protected verifier | `OpenWolf · Applied a reviewed project rule` |

Never claim a bug was prevented because a search ran, a duplicate read was saved when a warning was ignored, or exact token savings from character estimates. Pending writes do not count as successful persistence. Do not display filenames, transcript excerpts, private rule text or task titles by default.

## Delivery by harness

| Harness | Preferred surface | Important boundary |
| --- | --- | --- |
| Claude Code | A composed status-line segment for routine activity; a rare synchronous hook `systemMessage` for update availability or meaningful recovery | `systemMessage` is styled as a warning. Async hook messages reach the model on its next turn and are not a reliable user-visible receipt. Compaction events discard these messages. Never replace an existing custom status-line command automatically. |
| Codex | Existing hook `statusMessage` while work runs, plus rare supported `systemMessage` receipts at turn boundaries | `systemMessage` appears as a warning. Prefer a native status/footer integration if a supported extension surface becomes available; do not inject ANSI control sequences or fabricate assistant messages. Gate each event by supported hook capabilities. |
| OpenCode | Nonblocking SDK informational toast, replaced/coalesced where supported; persistent details in the dashboard | Pin the adapter to the tested SDK. Missing/headless TUI support silently falls back to dashboard history. A toast must not start a model turn. |
| Grok Build | An adapter using its documented settings-file hook contract; start with dashboard receipts until a user-visible informational surface is verified | Grok reads Claude-compatible configuration, but event names, payload fields and ignored passive output must be tested rather than assumed equivalent. No unsupported `systemMessage` fallback or assistant narration. |

Sources checked 2026-09-14: [Claude hooks](https://code.claude.com/docs/en/hooks), [Codex hooks](https://learn.chatgpt.com/docs/hooks), [OpenCode plugins](https://opencode.ai/docs/plugins/), [Grok hook contract](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/10-hooks.md), and [Grok compatibility](https://docs.x.ai/build/features/skills-plugins-marketplaces). These are capability constraints, not claims of completed native-harness validation.

## Noise budget

Default to `quiet`; optional `off` and `verbose` modes belong in configuration, not interactive prompts.

- One startup receipt only if context was restored or an update changed state.
- At most one routine activity receipt per five minutes and three per turn, whichever permits fewer. Deduplicate by actual operation/evidence identity across retries, subagents and session resume.
- Aggregate repeated operations: `OpenWolf · Reused 6 unchanged files` rather than six messages. Persist counts; emit at an existing turn boundary.
- Update notices occur once per project/release/state, with no repeated warning each session. Network failures stay in diagnostic status.
- Task-relevant protection failures retain their existing functional messages; the visibility layer must not hide or duplicate them.
- No periodic “OpenWolf is working” banner, animations, sound, desktop alerts, loading delay or interruption of streaming output.

## Implementation sequence

1. Add a small receipt schema: event id, session/agent, operation, outcome, timestamp, evidence pointer, optional measured counts, and visibility category. Emit only after successful commits through existing persistence paths.
2. Reduce receipts into a bounded, deduplicated local queue and cumulative counters. Use the daemon where available; hooks add immutable events without waiting on a shared lock. The existing dashboard reads the same materialized state.
3. Implement a budgeted delivery reducer at existing session/turn boundaries. It chooses one useful receipt and marks it delivered atomically. Keep operational messages separate from model context.
4. Add capability-tested transports in the order OpenCode, Claude, Codex, then Grok. For unsupported transports, retain dashboard history and stay silent in the terminal. Installing Grok support must avoid registering the same Claude-compatible hooks twice.
5. Add a compact dashboard activity panel: last useful action, actual counts, runtime version, update status and diagnostic detail on expansion. Do not present “work done” counts as token savings.
6. Validate in real interactive and headless sessions, with concurrent sessions and resume. Record a short terminal capture per supported harness before calling the integration complete.

## Performance and acceptance

The enforceable requirement is **no network or model requests and no waiting for rendering on a tool's critical path**. Literal zero CPU/I/O cost cannot be promised. Reuse already-computed facts; do not rescan anatomy, hash extra files or tokenize text solely for a receipt.

Benchmark enabled versus disabled over 1,000 hook invocations after warmup and report p50/p95 overhead. Target under 2 ms additional local bookkeeping per existing hook and no measurable increase in model calls. If that budget fails, defer receipt work to the daemon or turn boundary. Verify exact rate limits, retry deduplication, successful-write-only receipts, silent missing-TUI behavior, privacy-safe text and unchanged tool decisions. User attention should be the scarce resource, not a metric to maximize.
