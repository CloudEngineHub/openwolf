# How OpenWolf works

OpenWolf uses local project files, agent hooks and an optional background daemon. It does not run a second model to maintain memory or generate summaries.

## Project files

| Location inside `.wolf/` | Purpose |
| --- | --- |
| `anatomy-index.json` | File descriptions, hashes, symbols and import relationships |
| `anatomy.md` | Readable view of the project index |
| `memory.md` | Session notes and recorded actions |
| `STATUS.md` | Current project status and next work |
| `cerebrum.md` | Candidate conventions, preferences and corrections |
| `buglog.json` | Known problems, causes and fixes |
| `handoff/` | Task checkpoints, saved evidence and handover packets |
| `archive/` | Older notes with restore pointers |
| `usage/` | Reconciled usage observations |
| `token-ledger.json` | Session tracking and separate operational estimates |
| `activity/` | Completed OpenWolf actions for notices and dashboard history |
| `hooks/` | Installed runtime, session state and hook health |
| `config.json` | Project configuration |

Project notes can be shared through version control after review. Local usage, runtime and session data follow the generated ignore rules.

## Context during a coding session

Supported hooks load a short project index and relevant saved task context. Before a read, they can offer file descriptions and symbol ranges. After an edit, they record an observation and refresh the affected index entry.

A checkpoint records task state separately from the full conversation. At supported prompt, startup or compaction boundaries, OpenWolf can return changed context without repeatedly loading every old note. The agent still needs to save useful semantic summaries; OpenWolf cannot infer every decision from a file edit.

Saved evidence is marked as untrusted context. Durable instructions are loaded automatically only when the independent protected-memory verifier approves them.

## Handover between Claude and Codex

OpenWolf reads saved session records. It can also inspect Codex through a read-only app-server interface. It does not call a model or resume a thread while inspecting a source.

An exported packet includes selected public messages and results, source references, project identity and repository state. Import verifies those records and checks for changes. The receiving agent uses the packet as historical task evidence.

Claude's `/resume` command belongs to Claude Code. OpenWolf gives Codex access to supported saved Claude records, not the command itself or private internal reasoning. Missing or truncated records produce coverage limits. See the [handover workflow](claude-codex-handoff-plan.md).

## Project maps and repeated reads

The index helps an agent find relevant code before opening files. `openwolf find` searches file and symbol entries. `openwolf map` provides a focused overview within an estimated size budget.

The daemon monitors source and Git changes. A partial scan keeps earlier entries and reports incomplete coverage. Read tracking distinguishes full reads from ranged reads and checks whether a file has changed before reporting a duplicate.

## Large command output

The Bash output governor is available through supported Claude hooks. It can shorten selected large search results, file output and Git output. When a shortened result is emitted, it includes a pointer to the saved original. If the original cannot be preserved within the configured limits, OpenWolf must report that condition.

Test and build output use suggestions by default. Standard error is not rewritten. The agent's runtime must support the output channel for a replacement to take effect. Local output-size calculations remain estimates, separate from provider token counters.

## Memory retention

Eligible old session blocks move into verified archives. The latest block, pinned notes and tracked active sessions are retained. Restore pointers keep older information available without loading it into every session.

Concurrent writes use locks and recoverable event records. If a write cannot be completed immediately, retained observations can be reconciled later. These controls reduce lost updates; they do not replace a backup.

## Recorded usage and costs

OpenWolf reads available provider counters from Claude transcripts, Codex rollouts and OpenCode plugin records. It reconciles repeated records and reports coverage by agent. Missing counters remain unavailable.

Input totals include cached input. Output includes reasoning where reported. Pricing separates the relevant input categories and uses each recorded provider and model. The result is an API list-price estimate with stated assumptions, not a subscription invoice or a measurement of remaining quota.

## Background work

The optional daemon serves the dashboard and performs local maintenance. Supported session events can also schedule an npm update worker. That worker checks the registry and prepares a verified compatible runtime for new sessions. Running sessions keep their selected runtime.

This adds local processing and optional update traffic. It does not add model calls for memory maintenance. See [automatic updates](automatic-updates.md) and [activity notices](session-visibility-plan.md).
