# OpenWolf

**Project memory and context tools for coding agents.**

OpenWolf keeps task notes, project maps and known fixes in a local `.wolf/` folder. Claude Code, Codex and OpenCode can use this information across coding sessions. It helps an agent find relevant code, recover saved work and avoid repeating unnecessary reads.

The dashboard shows project memory, recorded token usage, model cost estimates and OpenWolf activity. You can inspect the files behind each feature.

[Website](https://openwolf.com) · [Getting started](https://openwolf.com/getting-started) · [Commands](docs/commands.md) · [Contributor credits](CREDITS.md)

[![npm version](https://img.shields.io/npm/v/openwolf?color=cb3837&label=npm)](https://www.npmjs.com/package/openwolf)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![Node.js 20 or later](https://img.shields.io/badge/node-%3E%3D20-2ea44f)](https://nodejs.org)

> This README describes the 2.5.2 release candidate. The npm badge shows the published version. Handover packets, recorded usage reports, session updates and activity notices described here require 2.5.2. See the [release checks and limits](docs/release-2.5.2.md).

## How OpenWolf helps

### Continue work in another session

Save the task objective, completed work, open problems and next action in a checkpoint. Supported Claude Code and Codex hooks can return that saved context at the next relevant session boundary, including after compaction.

For a handover between Claude and Codex, select a saved session, export a packet and import it into the receiving session. OpenWolf checks the project, source records and repository changes before import. This reduces the need to explain the same project again.

A handover uses saved messages and tool results. It does not access private reasoning or reproduce every part of another agent's live context. Imports are explicit and do not approve actions.

### Find the relevant code before reading files

OpenWolf builds a project map with file descriptions, symbols, line ranges and import relationships. An agent can look up a function or inspect a focused map before opening large files.

```bash
openwolf find validateToken
openwolf find --file src/auth.ts
openwolf map --focus auth
```

The index refreshes after supported file edits and through background monitoring. A partial scan preserves earlier entries and reports incomplete coverage.

### Reduce repeated context

Read hooks can identify repeated full reads of unchanged files. On supported Claude Code hooks, the Bash output governor can shorten selected large command results and keep the original output in a local cache. Test and build output are advisory-only by default.

These features can reduce the amount of repeated text in a session. Their effect depends on the agent, task and configuration. Output-size estimates are separate from recorded provider tokens. OpenWolf does not promise a fixed percentage of token savings.

### Keep useful memory and archive old sessions

Project notes, conventions and bug fixes remain available between sessions. Relevant previous fixes can be retrieved before an edit. Eligible older session notes are archived with verified restore pointers. The latest session, pinned notes and tracked active sessions are retained.

Saved notes are evidence. Automatic injection of approved durable instructions requires a protected installation reviewed by an independent administrator. A normal user-owned npm installation does not enable that authority.

### See token usage by agent and model

```bash
openwolf usage report --json
openwolf dashboard
```

OpenWolf reads available usage counters from Claude transcripts, Codex session records and the OpenCode plugin. It reconciles repeated records and separates fresh input, cached input, cache writes and output for pricing.

The report applies the relevant provider's model rates. The amount is a current API list-price estimate, not a subscription bill. Missing counters, unknown models and pricing assumptions are shown. Reading a file or estimating a checkpoint's size is not treated as a provider usage record.

### Notice useful work without repeated messages

OpenWolf can show a short notice after a completed operation, such as restoring task context or archiving old notes. The default mode limits message frequency. Claude status-line commands are preserved, Codex can show recovery notices, and OpenCode can show an informational toast. Grok activity stays in the dashboard.

Compatible stable hook and plugin updates can be prepared in the background for new sessions. Major upgrades are notification-only by default. A running session keeps its selected runtime. This does not replace the global CLI or a running dashboard daemon.

## Install

You need Node.js 20 or later and a supported coding agent. OpenWolf runs on Linux, macOS and Windows.

```bash
npm install -g openwolf
cd your-project
openwolf init
```

This installs the version currently published on npm. `init` detects installed agents. You can also select them:

```bash
openwolf init --agent claude codex opencode
openwolf status
```

Accept any project or hook trust review shown by your agent. OpenWolf does not bypass those controls. Then start a new agent session.

## Agent support

| Agent | Integration and limits |
| --- | --- |
| Claude Code | Lifecycle hooks, read guidance, Bash output controls and skills. Durable instruction injection requires protected approval. |
| Codex CLI | Project hooks and `AGENTS.md`. Supports saved task recovery and session tracking where the installed Codex version delivers the relevant events. |
| OpenCode | Native plugin for session and tool events, recorded usage and activity toasts. It does not provide all Claude hook behaviour. |
| Grok Build | Uses enabled Claude-compatible hook discovery. No duplicate hook registration. Activity notices are dashboard-only. |
| Cursor, Gemini CLI, Antigravity | Project instructions only. They do not receive the full hook integration. |

Support depends on the agent version, enabled features and tool payloads. See [hook coverage](docs/hooks.md) and [native validation results](docs/release-2.5.2.md).

## What is stored

| Location inside `.wolf/` | Purpose |
| --- | --- |
| `anatomy-index.json`, `anatomy.md` | Structured project map and its readable view |
| `memory.md`, `STATUS.md` | Session notes and current project status |
| `cerebrum.md` | Candidate conventions, preferences and recurring corrections |
| `buglog.json` | Known problems, causes and fixes |
| `handoff/` | Saved checkpoints, source references and handover packets |
| `archive/` | Restorable older memory |
| `usage/`, `token-ledger.json` | Recorded usage and separate operational estimates |
| `activity/`, `hooks/` | Local activity receipts, hook runtime and session state |
| `config.json` | Project settings |

The generated `.gitignore` excludes local runtime data. Review project notes and indexed content before committing or sharing them. Credentials and sensitive paths are excluded where detected; automatic filtering is not a guarantee that all private information has been removed.

## Daily commands

| Command | Use |
| --- | --- |
| `openwolf status` | Check the current project's installation and health |
| `openwolf scan` | Refresh the project map |
| `openwolf handoff list` | Find saved Claude and Codex sessions for this project |
| `openwolf handoff search "query"` | Retrieve relevant saved evidence |
| `openwolf bug search "error"` | Search previous problems and fixes |
| `openwolf usage reconcile` | Refresh the shared recorded-usage report |
| `openwolf dashboard` | Open the local dashboard |
| `openwolf operations doctor` | Check runtime, memory authority and update readiness |

The [command reference](docs/commands.md) covers checkpoints, handover import, archives and backups.

## Update an existing project

After installing a new package version, preview and apply the project refresh:

```bash
npm install -g openwolf
openwolf update --dry-run
openwolf update
```

Restart project daemons and start new agent sessions. Existing 2.5.1 installations need this refresh once to acquire the 2.5.2 updater. Review [update and restore instructions](docs/updating.md) before changing several registered projects.

## Local processing and control

OpenWolf's memory, indexing and usage reports run locally. They do not send project content to an OpenWolf service or make extra model calls. The optional update worker contacts the npm registry. Your coding agent still uses its own model provider.

The dashboard binds to the local machine by default and requires a project token. Tool permissions remain with the agent and the user. Protected durable memory needs independent administrator setup; project files cannot approve themselves.

## Validation

The 2.5.2 candidate passed 322 tests on Linux, macOS and Windows, plus package installation, upgrade and daemon checks. Native Codex checkpoint recovery was checked through resume and compaction. OpenCode notifications and Grok startup were also checked.

A full live Claude to Codex to Claude coding handover and broader long-session quality and token-saving comparisons remain unverified. See the [release record](docs/release-2.5.2.md) for the exact scope.

## Contributing and credits

[Report a problem](https://github.com/cytostack/openwolf/issues) or read the [contribution guide](CONTRIBUTING.md).

OpenWolf was created by Farhan Palathinkal at [Cytostack](https://github.com/cytostack). [CREDITS.md](CREDITS.md) and the [issue and PR audit](docs/audit/README.md) distinguish reporters, PR submitters, original authors and co-authors. Adapted work is not described as a merged PR.

The contributor links below are retained from the repository's existing acknowledgements. They are not a list of current repository access permissions.

| | | | | |
|:-:|:-:|:-:|:-:|:-:|
| [<img src="https://github.com/fsener.png" width="60"/>](https://github.com/fsener)<br/>**fsener** | [<img src="https://github.com/albertomenache.png" width="60"/>](https://github.com/albertomenache)<br/>**albertomenache** | [<img src="https://github.com/whydoyouwork.png" width="60"/>](https://github.com/whydoyouwork)<br/>**whydoyouwork** | [<img src="https://github.com/mann1x.png" width="60"/>](https://github.com/mann1x)<br/>**mann1x** | [<img src="https://github.com/GordongWang.png" width="60"/>](https://github.com/GordongWang)<br/>**GordongWang** |
| [<img src="https://github.com/WeathermanTony.png" width="60"/>](https://github.com/WeathermanTony)<br/>**WeathermanTony** | [<img src="https://github.com/goashem.png" width="60"/>](https://github.com/goashem)<br/>**goashem** | [<img src="https://github.com/bryandent.png" width="60"/>](https://github.com/bryandent)<br/>**bryandent** | [<img src="https://github.com/levnikmyskin.png" width="60"/>](https://github.com/levnikmyskin)<br/>**levnikmyskin** | [<img src="https://github.com/svanack404.png" width="60"/>](https://github.com/svanack404)<br/>**svanack404** |
| [<img src="https://github.com/riverwolf67.png" width="60"/>](https://github.com/riverwolf67)<br/>**riverwolf67** | [<img src="https://github.com/nottyjay.png" width="60"/>](https://github.com/nottyjay)<br/>**nottyjay** | [<img src="https://github.com/alfasin.png" width="60"/>](https://github.com/alfasin)<br/>**alfasin** | [<img src="https://github.com/ChasLui.png" width="60"/>](https://github.com/ChasLui)<br/>**ChasLui** | [<img src="https://github.com/JarrodAI.png" width="60"/>](https://github.com/JarrodAI)<br/>**JarrodAI** |
| [<img src="https://github.com/meketreve.png" width="60"/>](https://github.com/meketreve)<br/>**meketreve** | [<img src="https://github.com/Laptopcorei7.png" width="60"/>](https://github.com/Laptopcorei7)<br/>**Laptopcorei7** | [<img src="https://github.com/statik1.png" width="60"/>](https://github.com/statik1)<br/>**statik1** | [<img src="https://github.com/spignataro.png" width="60"/>](https://github.com/spignataro)<br/>**spignataro** | [<img src="https://github.com/Esturban.png" width="60"/>](https://github.com/Esturban)<br/>**Esturban** |
| [<img src="https://github.com/prghbla.png" width="60"/>](https://github.com/prghbla)<br/>**prghbla** | [<img src="https://github.com/1re2turn1.png" width="60"/>](https://github.com/1re2turn1)<br/>**1re2turn1** | [<img src="https://github.com/aevnar.png" width="60"/>](https://github.com/aevnar)<br/>**aevnar** | [<img src="https://github.com/davdittrich.png" width="60"/>](https://github.com/davdittrich)<br/>**davdittrich** | [<img src="https://github.com/krsfer.png" width="60"/>](https://github.com/krsfer)<br/>**krsfer** |
| [<img src="https://github.com/kantorcodes.png" width="60"/>](https://github.com/kantorcodes)<br/>**kantorcodes** | | | | |

## License

[AGPL-3.0-only](LICENSE). Copyright 2026 Cytostack Pvt Ltd.
