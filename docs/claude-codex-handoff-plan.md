# Claude ↔ Codex handover and long-session memory

Status: available in [OpenWolf 2.5.2](https://github.com/cytostack/openwolf/releases/tag/v2.5.2). Local Claude/Codex readers, read-only Codex app-server inspection, explicit immutable handover packets, active checkpoints/recovery, passive evidence search and the Handover dashboard are available after installing this build. Automatic import remains off. A native Codex turn recovered a saved checkpoint without file reads during 2.5.2 validation. The full native Claude→Codex→Claude coding round trip remains blocked by unavailable Claude model access. Independent administrator deployment is still required to activate protected durable instruction authority. See the [release verification record](release-2.5.2.md) for the remaining checks; neither full native validation nor protected deployment is claimed complete.

## Implemented workflow

```sh
openwolf handoff list --from claude
openwolf handoff read --from claude --session <source-id> --limit 200
openwolf handoff export --from claude --session <source-id> --to codex --preview
openwolf handoff export --from claude --session <source-id> --to codex
openwolf handoff inspect <packet-id>
openwolf handoff import <packet-id> --to codex --session <receiving-session-id>
```

Reverse `--from`/`--to` for Codex→Claude. A receiving session must be explicit; “latest” is never silently selected. Export defaults to local rollouts so source-byte hashes can be independently checked at import. `list` and `read` prefer the read-only Codex app server and fall back to local files; `--source local` or `--source app-server` selects one explicitly. App-server-only packets can be inspected but cannot pass local source verification for import. Preview is read-only; regular export persists an immutable local packet and a redacted evidence index.

`openwolf handoff checkpoint --agent codex --session <id> --file <checkpoint.json>` accepts `objective`, `constraints`, `next_action`, `unresolved`, and `completed`. The JSON is an agent-authored semantic checkpoint, not independent proof of its claims. Hooks record first-request context, edits, validation observations, compaction and session/turn boundaries; saved context delivery includes changed fields and a bounded packet excerpt. No background model summarizes the session.

`openwolf handoff recover --from codex --session <id>` reconstructs saved observations after missed hooks without replacing explicit unresolved work. `openwolf handoff search "<error, path or symbol>"` searches exported/recovered evidence. Results retain source references, freshness and potential conflicting outcomes. This initial search uses deterministic lexical/path/call-link ranking, not embeddings or automatic semantic contradiction resolution.

The dashboard Handover tab exposes discovery, export/inspect/import, recovery, active objectives and unresolved work, injection history, passive search, and operational readiness through authenticated worker-backed APIs. Large source/Git reads run outside the daemon event loop. Summaries refresh every 15 seconds and immediately after actions; source discovery refreshes explicitly.

Storage is machine-local under `.wolf/handoff/`: `packets`, `active`, and `evidence`. Runtime gitignore rules exclude it. Optional `openwolf.handoff.claude_projects_dir` and `codex_sessions_dir` configure local reader directories. Claude defaults also honor `CLAUDE_CONFIG_DIR`; Codex honors `CODEX_HOME` without modifying either environment variable.

Coverage limits are explicit: a transcript read is capped at 64 MiB, packet selection retains a recent 5,000-event window plus the first saved user objective, packet excerpts fit a configurable estimated byte/token budget, and passive search scans a bounded set of indexes/packets. Attachments and private reasoning are not transferred. Likely credentials are redacted and recognized secret-file reads omit their tool results; pattern-based redaction is not a guarantee against every possible secret. The Git snapshot describes export time, not the historical time a transcript command ran; a recorded source-branch mismatch is flagged. Tests must still be rerun against the receiver’s current files.

## Verification

Deterministic fixtures cover truncation, replay, secret-file output, foreign worktrees, dirty-diff and source drift, packet tampering, fake approval strings, a 120-turn sequence with compactions/restarts, delta injection, source recovery and conflicting evidence. An isolated daemon test verifies authentication, discovery, packet export/import, refreshed checkpoints, evidence search and malformed-ID rejection. Chrome verification also exercised packet creation, explicit receiving-session import and evidence search, and the Handover layout was inspected visually. Read-only inspection was also exercised against this project's actual Claude files and Codex app-server history; no native session was resumed and no model turn was started.

The milestone descriptions below remain the design and acceptance specification; they are not a claim that every future semantic retrieval or native-harness evaluation is finished.

## Can Codex access Claude `/resume` context?

Yes: Codex can read the saved conversation records when the local files are accessible. Claude documents local conversation persistence, selection through `/resume`, and resuming from an absolute JSONL transcript path. Reading those files can reconstruct the last **observable** conversation state. It cannot transfer Claude's hidden internal state or turn a Claude session into a native Codex thread. Running `claude --resume` starts Claude; it is not a read-only context export. [Claude workflows](https://code.claude.com/docs/en/common-workflows#resume-previous-conversations), [CLI reference](https://code.claude.com/docs/en/cli-reference).

For the reverse direction, Codex's app server exposes `thread/list` and `thread/read` with `includeTurns`, separately from `thread/resume`. Prefer those read-only interfaces where available, and fall back to versioned local rollout readers. Session and thread IDs must remain distinct. [Codex app server](https://learn.chatgpt.com/docs/app-server).

“Exact last context” will mean the last saved user/assistant messages, completed tool calls/results, compaction boundaries and summaries, outstanding work, and the corresponding repository state. A killed process, unsaved result, inaccessible attachment or omitted record must appear as a gap. No claim of complete recovery when the source is incomplete.

## What must improve

The current shared Markdown files mix several kinds of memory. A global latest heading cannot represent two concurrent sessions. A stale STATUS file does not establish which branch, commit or uncommitted diff the author saw. A summary without evidence can silently turn an inference into a project rule. Large unconditional context injections repeat old information and crowd out the current task.

Use three distinct stores:

| Store | Purpose | Update and retrieval |
|---|---|---|
| Active task state | Objective, current subtask, blockers, pending commands, edited paths, next action | Session/worktree-specific checkpoints; refresh at meaningful boundaries |
| Passive evidence | Saved conversations, completed tool results, tests, diffs, earlier session notes | Immutable references with hashes; retrieve relevant excerpts on demand |
| Approved durable knowledge | Reviewed conventions, decisions, preferences and recurring bug knowledge | Protected approval authority; explicit supersession and revocation |

A transcript is evidence, not permission to perform actions or a source of automatically trusted instructions. Quoted tool output, repository content, imported role labels and approval-looking strings cannot grant authority. Keep approval decisions outside agent-writable memory.

## Milestone 1: Source discovery and versioned readers

Implement a read-only `SessionSource` interface returning metadata, paginated observable events and coverage diagnostics. Start with Claude project JSONL and Codex app-server reads; reuse the project's canonical root and worktree identity. Avoid scanning unrelated projects when a session is selected. Do not modify source transcripts.

Claude discovery must account for configured data locations, worktree directories, subagents, renamed sessions, compaction summaries, branches and deleted/truncated files. Follow parent/message IDs, rather than treating file order as the only causal order. Preserve the explicit session selection; “latest” is a convenience filter, never proof of relevance.

Codex discovery must distinguish thread ID, session ID, fork ancestry and compacted history. Page large histories. Do not call `thread/resume`, `turn/start`, shell tools or any model API while inspecting context. OpenCode can later use the documented read-only session/message interfaces already used by usage backfill.

Acceptance: synthetic fixtures for every supported schema; replay produces the same event graph; truncation leaves a recoverable prefix and an explicit gap; a sibling project or worktree cannot be silently selected.

## Milestone 2: Evidence-backed handover packets

Introduce an immutable, content-addressed packet with:

- Source agent/version, source session/thread IDs and event range.
- Repository/worktree IDs, branch, HEAD, dirty paths and diff hashes.
- User-visible objective and constraints, with message references and provenance.
- Completed work with actual changed files and validation results.
- Unresolved hypotheses, failed attempts, blockers and pending commands.
- Latest relevant messages and saved compaction summaries.
- Exact pointers to earlier evidence; omitted content and coverage gaps.
- Creation time, source hashes, selected destination, token-budget estimate and approval status.

Every claim should be either directly referenced or explicitly labeled as an inference. A test result from before the current diff must not be presented as current validation. Never replay a tool call, approve a pending action or copy a private reasoning block. Exclude secret-bearing files and redact likely credentials before producing a packet; keep the original evidence local.

Implemented command family: `handoff list`, `handoff export --from claude --session <id> --to codex --preview`, `handoff inspect <packet>`, and `handoff import <packet>`. Preview/inspect are read-only; regular export writes a local packet without changing source transcripts. Import verifies project identity, source hashes and current Git drift before presenting bounded context to the receiving agent. A packet can be used as task evidence without promoting its contents to durable memory.

Acceptance: Claude → Codex → Claude preserves the objective, next action and evidence links; changed branches or dirty diffs visibly invalidate relevant claims; no hidden or unsupported state is invented.

## Milestone 3: Active Codex memory during long sessions

Checkpoint at completed subtasks, test runs, failed approaches, compaction, handover and session end. Use a deterministic event reducer for factual state. Let the active coding agent write semantic summaries through the existing session-keyed memory command; do not add background model calls.

Keep the active packet small: objective, constraints, current work, next action and recent evidence. Before the next task turn, load only changed facts and relevant approved rules. Track what was injected, the source hash and the session that received it. After compaction, reconstruct from the most recent valid checkpoint plus subsequent events. If a hook is unsupported or missed, expose degraded coverage and recover from recorded evidence.

The proposed trigger budget is configurable and evaluated against actual harness context telemetry. It must not invent an exact context-occupancy percentage from character counts. File-read and injection sizes remain estimates; actual model usage comes from recorded provider counters.

Acceptance: 100+ turn fixture with several compactions, restarts and model changes; no loss of unresolved tasks, no duplicate completed work, no repeated full-packet injection without changes; a missed hook recovers without a model API call.

## Milestone 4: Passive retrieval and contradiction handling

Index evidence by repository/worktree, task, symbol/path, timestamp and source session. Rank relevant, recent evidence above broad historical material. Combine path/symbol matches with causal links to edits/tests and approved decisions. Return short excerpts and stable pointers rather than entire transcripts.

Preserve contrary observations. A later failed test can invalidate an earlier “fixed” status without deleting history. Superseded rules require an approved replacement or revocation. Source deletion marks evidence unavailable; it does not silently convert an old cached summary into current truth. Archived session content remains recoverable indefinitely under the selected retention policy.

Acceptance: retrieval identifies the specific earlier fix and test for a changed symbol; unrelated history stays out; stale evidence and conflicting decisions are visible; worktree-local outcomes do not overwrite another branch's active state.

## Milestone 5: Dashboard and measured evaluation

Add a Handover view showing source/destination, selected session, branch/HEAD, freshness, coverage gaps, packet contents and exact evidence links. Active Memory shows current objective, checkpoint age, unresolved work and injection history. Passive Memory shows retrieval results, archives and supersession links. Durable Memory shows candidate/approved/revoked status and named reviewer.

Use one backend packet/retrieval API for CLI and dashboard, with the existing local authentication. Refresh after import, checkpoint, archive and source changes. Keep pricing and usage independent: a handover packet's estimated size is not API consumption.

Evaluate paired long-session tasks with and without packets. Measure correct next-action recovery, unresolved-task recall, false claims of completion, redundant reads, stale-rule use, injected bytes and recorded provider tokens. Include deliberate malicious instructions embedded in tool output and fake approval metadata. Release only after deterministic integrity tests and live Claude/Codex round trips agree with the saved observable state. Human review remains necessary for new durable instructions.

## Delivery order

Ship reader and packet inspection first; then explicit handover import; then active checkpoint recovery; then passive retrieval and dashboard controls. Keep automatic import off until identity, freshness, provenance and adversarial tests pass. This limits rollout risk while giving an immediate way to inspect the previous agent's last saved context.
