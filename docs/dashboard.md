# Dashboard

A real-time local dashboard for everything OpenWolf tracks. React SPA served
by the daemon, bound to localhost, token-authenticated.

## Launch

```bash
openwolf dashboard
```

Starts the daemon if needed and opens your browser with a per-project token.
Each project gets its own port, so multiple dashboards never collide.

## Design

A monochrome dot-matrix system with a single signal-red accent reserved for
live, measured, and attention states. Dark and light modes via the top-nav
pill. Panels are deep-linkable (`#tokens`).

## Overview

The home screen leads with what can be proven:

- **Tokens kept out of context**: the hero tile. The Bash governor's
  original-versus-entered delta, measured at the rewrite point, plus any
  denied duplicate reads. Never an estimate.
- **Measured usage** from transcripts: input, output, cache reads, API calls
- **Hook health**: heartbeat status per hook; a failing hook shows its
  consecutive-failure count and the actual error
- **Context health**: index freshness, duplicate-read mode, always-on
  context estimate, and audit findings (oversized instruction files, missing
  config)
- **Stat row**: sessions, files tracked, reads and writes, re-read warnings,
  anatomy hit rate, bugs on file
- **Next phase** from STATUS.md and a weekly sessions chart

## Tokens

Measured, verified, and estimated usage side by side:

- Headline tiles: measured lifetime, cache reads, OpenWolf's own injection
  overhead, and tokens kept out of context
- **Measured across all project transcripts**: totals per model, subagent
  share, scan timestamp (written by the daemon)
- Usage over time per session, with the measured line overlaid where
  transcript data exists
- Per-agent table: sessions, estimated, measured in/out, cache reads
- A verification footnote: how many hook runs the transcripts confirm, how
  many failed, and how many injections provably entered the conversation
- Waste alerts from the pattern detector

Estimates are always labeled. Measured figures come from transcripts.
Verified figures come from the harness's own hook records.

## Activity

Chronological log of agent actions with timestamps, files, and token
estimates. Filter by date, search, group by session.

## Cron

All scheduled tasks with schedule, last run, next run, and a Run Now button.
Dead letter queue with retry, and execution history.

## Cerebrum

Structured view of the learning memory: Do-Not-Repeat cards (red-tinted,
dated), preferences, learnings, and the decision log. Searchable.

## Memory

Sessions as collapsible cards with the full action table. The most recent
session opens by default.

## Anatomy

Interactive file tree from the index. Files show descriptions and token
badges; large files list their symbols with line ranges. Search by filename
or description.

## Bugs

The searchable bug database: error, root cause, fix, tags, occurrence
counts. Quick-filter by tag.
