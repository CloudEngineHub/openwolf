# Troubleshooting

Start with the installed version and project health:

```bash
openwolf --version
openwolf status
openwolf operations doctor
```

## A documented command is missing

These pages describe OpenWolf 2.5.2. Compare your installed version with the [npm package](https://www.npmjs.com/package/openwolf) and [release record](release-2.5.2.md). Older installations may not include all commands described here.

## Hooks are not running

Confirm that the project was initialised for the intended agent. Check the agent's project trust, hook settings and version support. Inspect `.wolf/hooks/_heartbeat.json` and the agent's own logs.

After installing the intended package, use `openwolf update --dry-run`, refresh the selected project and begin a new session. If settings contain invalid JSON or TOML, repair the reported file without discarding unrelated settings. See [hook coverage](hooks.md).

## No OpenWolf notice appears

Quiet mode limits frequency and shows only selected completed actions. Several operations may be combined into one notice. A custom Claude status line is preserved. Grok and headless sessions use dashboard history rather than terminal activity notices.

Check `openwolf.visibility.mode` and the dashboard activity card. No notice does not, by itself, mean that a hook failed. See [session visibility](session-visibility-plan.md).

## Token totals differ from the agent's summary

Check whether the summary separates cached input from fresh input. OpenWolf's recorded input total includes both. Reasoning is included in output where reported, so adding it again would count it twice.

Run `openwolf usage report --json` and review coverage diagnostics. Missing records, an unknown model or a changed transcript format can produce partial totals. Local file-size estimates are not provider usage counters.

## Costs differ from a bill or subscription allowance

OpenWolf estimates current API list-price costs for recorded models. Subscription limits, negotiated prices, historical rates, tools and taxes can differ. Review the stated pricing assumptions and unpriced records in the dashboard.

## A handover import is rejected

Check the selected project, source session, branch and packet. Changed or deleted source records prevent verification. Repository changes can make a packet historical. Inspect the evidence before using `--allow-drift`; that option does not override source-integrity checks.

OpenWolf cannot recover a conversation that the source agent never saved. It cannot access private model reasoning. Read [handover limits](claude-codex-handoff-plan.md).

## Memory authority is unavailable

This is expected in a normal user-owned npm installation. Durable instruction authority requires an independent administrator, protected runtime files and managed agent settings. A review manifest is preparation material, not approval. Regular checkpoints and project maps remain usable.

## The project map is empty or incomplete

Confirm the project root, exclude rules and scan limits in `.wolf/config.json`. Run `openwolf scan` and inspect the result. A partial scan can keep earlier entries without declaring the map complete. Very small files may have a description without extracted symbols.

## Shortened output lacks a needed detail

Use the original-output pointer included in the result when the cache copy is available. Change the relevant `bash.governor.families` value to `suggest` or `off` if shortening is unsuitable. Test and build output are advisory-only by default.

## The dashboard shows an error or old content

Reopen it with `openwolf dashboard` from the correct project. Check the project identity and token in that launch. After a package update, restart the project daemon to load the new backend and pages.

A port already in use may belong to another project or application. OpenWolf checks daemon ownership before stopping a process. Do not stop an unrelated process only because it uses the expected port. Inspect `openwolf daemon status` and `openwolf daemon logs`.

## A runtime update fails

Check `openwolf self-update --status`. The current runtime is retained if the registry is unavailable, npm cannot be found beside Node, or verification fails. A resumed session intentionally keeps its selected version. Do not delete a release directory that an active session may use.

## A legacy scheduled task reports `ai_task is no longer supported`

Old projects may contain retired model-based maintenance tasks. Preview a project update and inspect the affected cron entries. Current OpenWolf memory maintenance uses local operations without background model calls.

When reporting a problem, include the OpenWolf and agent versions, operating system, command, expected result and a minimal reproduction. Remove tokens, credentials and private project content from logs.
