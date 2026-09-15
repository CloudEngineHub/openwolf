# Session-driven npm updates

OpenWolf checks npm without asking the model to run a command or requiring a user response. The default is `openwolf.updates.mode: "compatible"`: stable updates within the current major version are prepared automatically; for 0.x releases the minor version must also match. Major upgrades are reported without automatic installation. Supported alternatives are `all`, `notify`, and `off`. `OPENWOLF_NO_UPDATE=1` disables checks and new runtime selection for that process.

## What happens

1. Session start and user-prompt hooks read a small local cache and schedule a detached worker when the 24-hour check interval has elapsed. OpenCode schedules on startup/session events. No npm request or installation is awaited by a hook.
2. The worker checks the fixed official npm registry's `openwolf/latest` metadata, validates the stable version and runtime compatibility contract, then installs the exact version into an isolated staging directory. npm lifecycle scripts are disabled, engine compatibility is enforced, and network/install timeouts are bounded. npm verifies downloaded package integrity through its normal registry install path.
3. All standalone hook entry points must pass import selfchecks before the worker atomically publishes the release directory and selected-version pointer. Failed downloads, verification or permissions retain the previous runtime. Concurrent workers serialize installation; crash leftovers cannot select half-installed code.
4. Claude/Codex hook invocations pin a runtime by session id, including sessions already active before download. Resume retains that pin. The dispatcher imports the selected hook in the same Node process and forwards the original stdin; it does not spawn another Node process on each tool call. Sessions lacking an id keep the installed hooks. OpenCode pins its plugin for the server/plugin instance, taking a new release only on the next plugin load.
5. A cached, one-line update notice appears on a supported hook boundary (or an OpenCode informational toast). It is deduplicated per project/release/state. The dashboard shows installed bootstrap version, prepared runtime, npm latest version, policy and diagnostic state.

The installed bootstrap must first be refreshed once with this release using the existing npm installation and `openwolf update` workflow. Older releases cannot acquire a feature they do not contain. Future npm packages must publish `openwolfRuntime.protocol: 1` and maintain that protocol's hook/state compatibility; incompatible packages are reported for manual migration. Do not increment this contract casually.

## Scope and controls

This is an automatic update of the **agent hook/plugin runtime**, using a complete npm package stored under `.wolf/updates/releases`. It does not mutate the global npm installation, project dependency manifests, agent settings, existing memory, or running dashboard daemon. The shell command `openwolf --version` therefore remains the globally/local-installed CLI version; this can differ from the runtime used by new agent sessions. Dashboard executable updates and bootstrap/configuration migrations still use the normal package refresh and daemon restart. The dashboard's update card makes that distinction explicit.

`openwolf self-update --status` reports cached status with no network request. `openwolf self-update` checks immediately and applies the configured policy; it does not override a major-version or notify-only policy. Run it in an initialized project. For a bad prepared release, set mode to `off` to keep new sessions on installed hooks; already pinned sessions retain their version. Do not delete release directories while a session may reference them. Release/pin cleanup and global CLI self-replacement are deliberately outside this initial implementation.

The check cache and runtime directories are machine-local and ignored by Git. A disconnected or restricted environment stays on its working version without a blocking prompt. npm must be available alongside the Node installation for automatic staging; otherwise the dashboard records failure. Each project has its own update cache and lock.

Protected, administrator-managed runtimes never delegate to a repository-selected release; their updates remain the responsibility of the independently protected deployment mechanism. This feature must not weaken the durable-memory trust boundary. Setting project update preferences cannot grant OS permissions or bypass a harness's initial hook trust review.

An npm update adds background network and disk work. It adds no model calls, and no synchronous network wait to agent tools, but cannot truthfully guarantee zero CPU/I/O overhead. Routine visibility beyond update notices is specified in the [visibility plan](session-visibility-plan.md).

## Local verification

Regression coverage includes compatible/major version policy, concurrent workers, failed verification, offline backoff, malformed preferences/cache, untouched uninitialized projects, no downgrade after a bootstrap upgrade, original-stdin forwarding and stable session pins. The production build and npm package dry run include the worker, dispatcher and plugin helpers. Tests use synthetic npm metadata/packages; no real global installation was changed.

On this macOS/Node 24 workstation, 1,000 warm pinned-bootstrap lookups measured approximately 0.05 ms p50 and 0.07 ms p95. This measures only local dispatch bookkeeping, not total process startup, plugin loading or a universal latency guarantee. OpenWolf 2.5.2 passed Linux, macOS and Windows checks. Bun plugin execution and native Codex and OpenCode notices were also checked. Claude display verification remains unavailable. See the [release record](release-2.5.2.md) for the scope.
