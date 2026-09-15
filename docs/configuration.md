# Configuration

Project settings are stored in `.wolf/config.json` under `openwolf`. A package update adds new defaults while preserving existing values. Use the installed template as the complete reference.

## Read guidance

| Setting | Default | Effect |
| --- | --- | --- |
| `reads.duplicate_mode` | `warn` | Advise on eligible repeated full reads. `deny` denies once with a retry path. `off` disables the check. |
| `reads.skeleton_hints` | `true` | Offer symbol outlines for eligible large indexed files. |

Ranged reads and changed files are handled separately from unchanged full reads. Results depend on the agent delivering the relevant tool event.

## Command output

| Setting | Default | Effect |
| --- | --- | --- |
| `bash.filter_mode` | `suggest` | Suggest output limits before selected commands. |
| `bash.governor.mode` | `replace` | Request supported output replacement. Alternatives are `suggest` and `off`. |
| `bash.governor.threshold_tokens` | `2000` | Estimated output size above which controls may apply. |

Default command-family settings:

```json
{
  "grep_flood": "replace",
  "file_print": "replace",
  "git_show": "replace",
  "test": "suggest",
  "build": "suggest",
  "unknown": "suggest"
}
```

Place these values under `openwolf.bash.governor.families`. Replacement depends on supported Claude hook output. A cache pointer accompanies a preserved original. Standard error is not rewritten.

## Context and project notes

| Setting | Default | Effect |
| --- | --- | --- |
| `context.session_digest_budget_tokens` | `1500` | Estimated size limit for the startup digest. |
| `context.budgets` | Per agent | Override the digest budget for a named agent. |
| `context.reinjection_interval` | `25` | Interval for selected approved rules on supported tool-batch events. `0` disables it. |
| `context.state_budgets` | Cerebrum: 2000; STATUS: 1000 | Estimated budgets used for size warnings. |
| `memory.consolidation_after_days` | `7` | Age used by configured memory maintenance tasks. |
| `cerebrum.max_tokens` | `2000` | Target size for candidate convention notes. |

Archival retains the latest block, pinned notes and tracked active sessions. It keeps restore pointers rather than deleting their history. The explicit `memory archive --days` command sets the age for that run. Protected approval is required for automatic durable instruction injection.

## Project scanning

| Setting | Default | Effect |
| --- | --- | --- |
| `anatomy.auto_scan_on_init` | `true` | Scan during initial setup. |
| `anatomy.rescan_interval_hours` | `6` | Scheduled rescan interval. |
| `anatomy.max_description_length` | `100` | Maximum description length in characters. |
| `anatomy.max_files` | `500` | Scan limit. A limited scan must not be reported as complete. |
| `anatomy.exclude_patterns` | Template list | Exclude specified paths and patterns. |
| `anatomy.respect_gitignore` | `true` | Apply repository ignore rules. |

Built-in exclusions also cover common generated files, caches and agent configuration paths. Review the resulting index before sharing it.

## Usage estimates

`token_audit.chars_per_token_code` defaults to `3.5`; `chars_per_token_prose` defaults to `4.0`. These ratios estimate local content size. They do not change recorded provider counters. The dashboard keeps estimates and recorded usage separate.

## Activity and updates

```json
{
  "openwolf": {
    "visibility": { "mode": "quiet" },
    "updates": { "mode": "compatible" }
  }
}
```

This is a partial example. Merge it into the existing configuration.

Visibility modes are `quiet`, `verbose` and `off`. `OPENWOLF_VISIBILITY=off` disables new receipts and notices for that process. Functional protection and update policy are separate settings.

Update modes are `compatible`, `all`, `notify` and `off`. The default prepares compatible stable runtimes for new sessions and reports major upgrades without installing them. `OPENWOLF_NO_UPDATE=1` disables checks and new runtime selection for that process. Existing session pins remain in place. See [automatic updates](automatic-updates.md).

## Daemon and dashboard

The dashboard is enabled by default and binds to `127.0.0.1`. Port settings are `dashboard.port` and `daemon.port`; setup and launch can select available project ports. Keep the project token private.

`cron.enabled` controls scheduled tasks. Retry and heartbeat settings are in `cron`. Restart the daemon after changes that affect its runtime configuration. Data polling does not apply every configuration change to a running process.
