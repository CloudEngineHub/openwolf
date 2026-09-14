# Repair operation and verification

For the package upgrade smoke tests, native harness results and outstanding activation checks, see the [2.5.2 release verification record](release-2.5.2.md).

## Recorded usage and API pricing

`openwolf usage report --json` reads project-attributed Claude transcripts, Codex rollouts and OpenCode usage records. `--agent claude|codex|opencode` narrows the report. `openwolf usage reconcile` also drains recoverable observations and persists the shared dashboard report. No model calls are made.

Input totals include fresh input, cache reads and cache writes. Output includes reasoning where the source reports it separately. Missing counters stay null; no tokenizer estimate is substituted. Per-model prices are applied to the actual records before aggregation. Unknown providers, models and unsupported price categories remain unpriced. Duplicate records and cumulative-counter replays are reconciled by source identities.

The rate catalogue was verified on 2026-09-14 against [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing), [OpenAI pricing](https://developers.openai.com/api/docs/pricing), and the linked model pages for GPT-5.5, GPT-5.4, GPT-5.4 mini/nano, GPT-5.3-Codex, GPT-5.2-Codex, GPT-5.1-Codex-Max and GPT-5 mini/nano. It includes Fable 5/5.1, Opus, Sonnet and Haiku, Astra and GPT-5.6 variants. Older GPT-5.1/5.2 and Pro entries use [OpenAI's published model pricing](https://openai.com/index/introducing-gpt-5-2/).

The displayed amount is a **current API list-price equivalent**, not an invoice or subscription quota estimate. Missing service tier, request context size or cache TTL is explicitly disclosed as an assumption. Known Astra fast/batch/flex and long-context rates, cache-write rates and Claude 1h writes are applied where the source exposes the necessary fields. Historical rates, tools, taxes, negotiated prices and other providers are not inferred.

Claude reasoning counts are unavailable when its transcript does not expose them separately. Codex intervals without sufficient model attribution retain their token counters but use an unknown model. OpenCode backfill reads the installed SDK's session/message data; inaccessible or deleted pre-install history cannot be reconstructed. “Recorded” means counters were read from supported records, not a guarantee that a harness persisted every internal operation.

## Memory and recovery

`openwolf memory log --session <id> --summary "what changed and why" --files "paths" --outcome "tests or blocker"` writes semantic task memory tied to that session. Parallel sessions cannot satisfy each other's summary checks.

`openwolf memory archive --dry-run` previews archival. `openwolf memory archive --days 7` replaces eligible old session blocks with verified archive pointers, retaining the full original indefinitely. Latest, active and pinned (`<!-- pinned -->`) sessions remain. `openwolf memory restore <sha256>` verifies and restores an archived block. The dashboard Memory view can read and restore archives.

`openwolf maintenance --dry-run` previews the default maintenance work. Omit `--dry-run` to archive and reconcile. The daemon performs startup catch-up, scheduled archival, source/Git watching, and recovery during usage reconciliation. A partial or changing anatomy scan preserves unvisited entries and does not advance certified freshness. Pending reads and writes, bug observations, ledger snapshots and memory appends survive lock contention.

## Durable instruction approval

Repository Markdown is candidate knowledge. `openwolf memory review --json` emits the exact content and hashes to review. Automatic durable rule injection and Claude auto-memory mirroring read approved snapshots only.

Enforcement requires an independently installed, root-owned, non-writable OpenWolf runtime and a managed harness whose settings, verifier path and permissions the coding agent cannot alter. A user-owned npm install or `.wolf/hooks` copy is **not** that deployment. The verifier fails closed there. Windows is unavailable until equivalent ACL validation is implemented. These deployment prerequisites have not been provisioned by this change.

After reviewing an exported candidate, a human administrator using the protected installation can run `openwolf memory approve <candidate.json> --reviewer <name> --store <protected-directory>`. The command refuses ordinary-user execution and validates hashes, root ownership, ancestor permissions and symlinks. Default store: `/Library/Application Support/OpenWolf/trust` on macOS, `/var/lib/openwolf/trust` on Linux. `OPENWOLF_TRUST_STORE` may select another equally protected store; it cannot bypass validation.

The administrator must independently configure the managed harness to invoke the protected hooks. The coding agent must not have sudo or permission to mutate that installation or managed configuration. Existing native harness memories/rules are separate inputs and must be managed under the same policy. The snapshot's managed-deployment field records the administrator's attestation; it cannot itself enforce the whole harness. Replacing/revoking snapshots and removing old auto-memory mirrors are operational responsibilities of that authority.

Approval snapshots can list explicitly reviewed worktree roots. Each root receives the same approved durable documents. Bug observations share the main checkout's `.wolf/buglog.json`; anatomical indexes, sessions, STATUS, usage and daemon identity remain worktree-local. Shared-store permission failures retain queued observations and appear as recovery errors.

## Configuration and local files

Use `openwolf.claude.settings_file`, `rules_dir` and `instructions_file` in `.wolf/config.json` for custom project-relative locations. Existing `.claude/CLAUDE.md` is honored. Paths escaping the project, including symlink escapes, are rejected. Malformed settings are preserved rather than overwritten.

Commit reviewed project documentation and intentional configuration. Keep raw transcripts, usage reports, token ledgers, session state, archive contents, approval candidates containing private context, recovery queues and local daemon credentials out of Git. The audit snapshots under `docs/audit` contain public GitHub data and can be committed. `openwolf status --all --json` inspects registered project/worktree identities without deleting temporarily unavailable registrations.

Install/update the built package to refresh a project's copied hooks and OpenCode plugin; restart its daemon to load backend changes. Dashboard static assets are included by `pnpm build`. Existing daemons do not hot-reload executable code.


## Handover and deployment readiness

`openwolf operations doctor` returns project runtime completeness, settings parse status, the independently verified durable-memory authority state, update policy and handover readiness. Settings parsing does not certify that a harness delivered a hook; use a real session for that check. The dashboard Handover tab shows the same readiness data.

`openwolf operations prepare --output <new-directory>` creates `deployment-review.json` containing this build's compiled-file hashes, proposed protected runtime location, current readiness and the administrator's required checks. It fails rather than overwriting an existing review file. This is review material, not an installation or an approval. Dependencies and the package provenance also need independent review; compiled-file hashes alone do not establish trust.

The separate administrator must install the reviewed package and dependencies under protected ownership, independently configure managed harness settings to invoke its hooks, confirm that the coding agent cannot mutate the runtime/settings or obtain sudo, and then review/approve the exact durable-memory candidate. The coding agent cannot perform its own independent approval. Do not enable repository-driven automatic runtime updates for that protected deployment.

`openwolf memory revoke --reviewer <name> --store <protected-directory>` revokes the current project's approval. Like approval, this is administrator-only. Replacement approvals retain prior snapshots under the protected store's `history/` directory and record their supersession hash. Revocation records the reviewer/time and makes future durable injection fail closed. Existing context already loaded by an agent cannot be erased retroactively; start a fresh session after revoking sensitive instructions and remove separately managed native memory mirrors.

For handover commands and local-storage limits, see the [implemented handover workflow](claude-codex-handoff-plan.md). Imported evidence can be used without durable approval, but it never becomes an approved rule. Source changes/deletion block import; branch/diff drift requires explicit historical-evidence review. This separation applies equally in CLI and dashboard.

## Activation checklist

1. Build and install the reviewed package, then refresh each intended project's copied hooks/plugin using the installed `openwolf update` command. This source checkout intentionally has no `.wolf` runtime; generating deployment review material does not initialize it.
2. Restart the project's daemon to serve the new Handover dashboard/backend. Existing daemon processes cannot load new executable code through data polling.
3. In Claude and Codex, verify one session start, tool observation and compaction/next-turn checkpoint delivery. Use `handoff recover` for persisted history if an event was not delivered. Native compatibility and permissions vary by harness/version.
4. Perform an explicit packet round trip between real sessions and compare the received objective, unresolved work and evidence with the source. Keep automatic import off during rollout.
5. Provision protected durable memory through the independent administrator. Until then, the dashboard correctly reports that authority as unavailable while ordinary evidence/checkpoint features remain usable.


## Session visibility operations

Visibility is implemented in the installed hook files, copied OpenCode helpers and dashboard. Use `openwolf.visibility.mode: "quiet"` (default), `"verbose"` or `"off"` in `.wolf/config.json`; this setting changes informational receipts, not functional protection decisions. See [session visibility](session-visibility-plan.md) for transports, rate limits, privacy, bounded storage and validation limits.

After deploying this build, run the normal `openwolf update` in each initialized project to refresh copied hooks, plugin helpers and safe settings defaults, then restart its daemon and begin a new agent session. Staged automatic runtime updates apply to new sessions and do not replace an already running daemon or retrofit a custom Claude status line. Existing custom/inherited status commands are preserved. The dashboard activity card polls authenticated local state and shows successful recorded actions even when a terminal cannot display receipts.

`openwolf operations doctor` reports visibility mode and runtime completeness. Verify a completed checkpoint appears in dashboard history, then test one actual native session per harness before claiming terminal display certification. Grok relies on enabled Claude-compatible hook discovery and project trust; it registers no duplicate hooks and its receipts stay in the dashboard. No protected-memory administrator setup is needed for activity receipts. A reviewed-memory receipt remains conditional on the independent protected verifier accepting that memory.
