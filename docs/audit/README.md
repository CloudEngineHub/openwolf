# Open issue and PR audit: 2026-09-14

28 open issues and 26 open PRs. This is a review snapshot, not a declaration that GitHub items are closed. Changes were implemented locally; no PR was merged or commented on. Original commit identities are preserved in `pr-commits.json`. “Adapted” credits the reported problem or proposed approach; it does not claim an upstream commit was cherry-picked.

## Issues

| Issue | Reporter | Analysis / disposition |
|---|---|---|
| [#119](https://github.com/cytostack/openwolf/issues/119) docs: openwolf init --agent opencode doesn't exit | @andig | Verify packaged --agent opencode help; source already supports the flag. |
| [#116](https://github.com/cytostack/openwolf/issues/116) pre-write hook crashes (ERR_INVALID_ARG_TYPE) + decay_reinjection has no token cap - v2.4.1 | @pereirajo | Guard missing bug file and bound reinjection bytes. |
| [#114](https://github.com/cytostack/openwolf/issues/114) Anatomy hit-rate counts unindexable reads as misses (scratchpad, /tmp, transcripts, external paths) | @Noboxer | Preserve incomplete scans; watch editor/Git changes; isolate worktree anatomy. |
| [#97](https://github.com/cytostack/openwolf/issues/97) durable memory has no provenance boundary: a one-session injection becomes cross-agent persistence | @cytostack | Protected review snapshots; attribute original proposal to kantorcodes (Michael Kantor). |
| [#75](https://github.com/cytostack/openwolf/issues/75) cron tasks report Status: enabled when the daemon cannot run (pm2 missing), so they silently never fire | @Esturban | Report disabled scheduler correctly; validate cron state. |
| [#73](https://github.com/cytostack/openwolf/issues/73) v2.0.1: auto-detected buglog entries name no file, and a substring match files false bugs | @spignataro | Harden malformed bug fields and reduce OpenCode false detections. |
| [#68](https://github.com/cytostack/openwolf/issues/68) v2: missing symbol-extractor.js silently disables post-write hook (+3 related defects) | @Laptopcorei7 | Ship every compiled hook dependency; preserve stdin and native path handling. |
| [#62](https://github.com/cytostack/openwolf/issues/62) Stop hook always reports "no semantic summary written": countSemanticEntries() expects a date prefix that timeShort() never emits | @statik1 | Explicit session-keyed semantic memory, independent of the latest global heading. |
| [#61](https://github.com/cytostack/openwolf/issues/61) `parseAnatomy`/`serializeAnatomy` silently drop legitimate entries sized in anything other than `tok` (e.g. large model/asset directories): not just on CRLF (related to #50/#24/#51) | @prghbla | Preserve curated preambles and unvisited anatomy entries; laihenyi supplied a preamble reproduction. |
| [#49](https://github.com/cytostack/openwolf/issues/49) feat: multi-project dashboard with in-page project switcher | @bluesky8318 | Duplicate of #47; multi-project switcher deferred. |
| [#48](https://github.com/cytostack/openwolf/issues/48) feat: multi-project dashboard with in-page project switcher | @bluesky8318 | Duplicate of #47; multi-project switcher deferred. |
| [#47](https://github.com/cytostack/openwolf/issues/47) feat: multi-project dashboard with in-page project switcher | @bluesky8318 | Deferred dashboard project switcher; retain per-project dashboards and add status --all. |
| [#45](https://github.com/cytostack/openwolf/issues/45) Add buglog.json to default contextto enable deduplication | @victor-luyunning | Relevant bug retrieval and shared worktree bug knowledge; avoid full-log injection. |
| [#41](https://github.com/cytostack/openwolf/issues/41) `pre-read` hook blocks re-reads even after the file was modified during the session | @1re2turn1 | Content fingerprints and repeat-read invalidation; credit elifarley for gist versus exact-content analysis. |
| [#25](https://github.com/cytostack/openwolf/issues/25) Feature Request: Git worktree support: hooks, `.wolf/` state, and path resolution | @briansumma | Distinct worktree runtime identity; share bug knowledge and explicitly approved memory snapshots. |
| [#23](https://github.com/cytostack/openwolf/issues/23) Add a configurable CLAUDE.md location | @nathanlong85 | Configurable Claude settings/rules/instructions paths and malformed-file preservation. |
| [#22](https://github.com/cytostack/openwolf/issues/22) Enhancement Request: Add Gemini CLI Support | @Mantene | Existing Gemini adapter retained; native harness validation deferred. |
| [#21](https://github.com/cytostack/openwolf/issues/21) Opus 4.7 Updates affecting OpenWolf | @rickb-bs | Explicit memory log with session, summary, files and outcome. |
| [#20](https://github.com/cytostack/openwolf/issues/20) Multi-project hygiene: init walks up into $HOME, port collisions, and global Claude Code hooks fail in non-openwolf projects | @shikyo13 | Home/root safeguards and hashed daemon names; readiness and collision checks. |
| [#19](https://github.com/cytostack/openwolf/issues/19) Invalid signature in thinking | @jpmorby | Not proven caused by OpenWolf; requires enabled/disabled Claude transcript reproduction. |
| [#15](https://github.com/cytostack/openwolf/issues/15) `openwolf init` doesn't completely respect the `.gitignore` | @VimCommando | Nested gitignore matching via maintained ignore library; cdgriffith corroborated. |
| [#14](https://github.com/cytostack/openwolf/issues/14) Dashboard not built in npm package | @somofola | Build dashboard into the published artifact; verify npm package contents. |
| [#13](https://github.com/cytostack/openwolf/issues/13) Add documentation for what to store in source repository | @a-schild | Document commit policy; runtime, usage and transcript-derived artifacts remain local. |
| [#12](https://github.com/cytostack/openwolf/issues/12) Cursor Support | @fmancardi | Existing Cursor adapter retained; native harness validation deferred. |
| [#8](https://github.com/cytostack/openwolf/issues/8) openwolf dashboard defaults to only one project | @neo-wanderer | Project identity in API/status and root-specific daemon names. |
| [#7](https://github.com/cytostack/openwolf/issues/7) Hook Errors all the time -> PostToolUse:Edit hook error & PostToolUse:Edit hook error | @eswarsubra | Bundle completeness and root handling; adalfa provided root diagnosis. |
| [#6](https://github.com/cytostack/openwolf/issues/6) OpenCode support? | @fabiopolimeni | OpenCode lifecycle and recorded usage integration. |
| [#5](https://github.com/cytostack/openwolf/issues/5) Support for opencode | @mdnmdn | OpenCode lifecycle and recorded usage integration. |

## Pull requests

| PR | Submitter | Commit authors (GitHub mapping) | Disposition |
|---|---|---|---|
| [#118](https://github.com/cytostack/openwolf/pull/118) fix(hooks): cap decay_reinjection note size in post-batch | @pereirajo | lojasmm-jonathan | Adapted bounded whole-rule reinjection. |
| [#117](https://github.com/cytostack/openwolf/pull/117) fix(hooks): guard pre-write basename against missing bug.file | @pereirajo | lojasmm-jonathan | Adapted guards for missing legacy bug paths. |
| [#104](https://github.com/cytostack/openwolf/pull/104) 2.6.0: multi-writer safety for shared .wolf + opt-in extra_roots | @smasoftware | smasoftware | Adapted bug locking; extra_roots deferred. |
| [#96](https://github.com/cytostack/openwolf/pull/96) Fix per-project accounting when SessionStart is missed | @davdittrich | davdittrich | Adapted hook loading, Codex shell mapping and build-before-test. |
| [#95](https://github.com/cytostack/openwolf/pull/95) Fix dashboard rendering for nullable cron state | @davdittrich | davdittrich | Adapted nullable cron-state parsing. |
| [#74](https://github.com/cytostack/openwolf/pull/74) fix(hooks): install every hook module, not a hardcoded list | @goashem | goashem | Adapted complete compiled hook enumeration. |
| [#72](https://github.com/cytostack/openwolf/pull/72) fix(install): derive the hook list from what ships, and detect unloadable hooks | @liveoakwag | liveoakwag | Adapted complete compiled hook enumeration; overlaps #74. |
| [#71](https://github.com/cytostack/openwolf/pull/71) fix(session): scope write tracking by session, and stop wiping live sessions | @liveoakwag | liveoakwag | Superseded session isolation approach; regression intent retained. |
| [#70](https://github.com/cytostack/openwolf/pull/70) fix(anatomy): never delete entries a capped scan did not reach | @liveoakwag | liveoakwag | Adapted non-destructive partial scan merging. |
| [#69](https://github.com/cytostack/openwolf/pull/69) fix(buglog): allocate bug ids from the high-water mark, not the array length | @liveoakwag | liveoakwag | Adapted monotonic bug ID allocation. |
| [#67](https://github.com/cytostack/openwolf/pull/67) fix(deps): patch ws/qs CVEs and pin GitHub Actions to commit SHAs | @OlgaCheraneva | Olga Cheraneva (unmapped) | Updated compatible dependencies and CI validation; verify individual advisories before asserting vulnerability fixes. |
| [#66](https://github.com/cytostack/openwolf/pull/66) fix(anatomy): stop silently dropping entries: tolerant parse + symlink-safe section keys | @liveoakwag | liveoakwag | Retain tolerant anatomy parsing and curate scanner regressions. |
| [#65](https://github.com/cytostack/openwolf/pull/65) feat(cron): add configurable inference provider for AI tasks | @octo-patch | octo-patch | Deferred: AI-provider cron conflicts with zero-model-call architecture. |
| [#60](https://github.com/cytostack/openwolf/pull/60) fix(pre-read): skip repeated-read warning when file was modified since last read | @AdarshJ173 | AdarshJ173 | Adapted content-aware repeat-read invalidation. |
| [#59](https://github.com/cytostack/openwolf/pull/59) store project-relative paths for cross-environment portability | @lshgdut | lshgdut | Retain portable paths; project and worktree identity now explicit. |
| [#58](https://github.com/cytostack/openwolf/pull/58) fix: allow rereads after file changes | @oiahoon | oiahoon | Overlaps #60; repeat-read behavior checked together. |
| [#51](https://github.com/cytostack/openwolf/pull/51) fix: parseAnatomy tolerates CRLF line endings (fixes #50) | @albertomenache | albertomenache | CRLF parsing already present; retain compatibility. |
| [#42](https://github.com/cytostack/openwolf/pull/42) feat(windows): wrap .wolf hook commands in wscript+VBS to hide console flash | @mann1x | Mizuho0329 | Windows wrapper proposal reviewed; native Windows execution still requires CI. |
| [#39](https://github.com/cytostack/openwolf/pull/39) feat: multi-agent runtime + 8 new agents (Hermes via PyPI plugin) | @ChasLui | ChasLui | Adapter architecture already adopted; extra agents deferred. |
| [#36](https://github.com/cytostack/openwolf/pull/36) feat: add codex hook integration | @nottyjay | Nottyjay (unmapped), nottyjay (unmapped) | Codex architecture partly incorporated; shell and lifecycle wiring extended. |
| [#35](https://github.com/cytostack/openwolf/pull/35)  feat: Hippocampus Memory System: Phases 1, 2, 3 | @yhyu13 | yhxd123, yhyu13 | Deferred large Hippocampus/spec subsystem; do not merge as a correctness repair. |
| [#34](https://github.com/cytostack/openwolf/pull/34) security: patch command injection, path traversal, and unauthorized access | @riverwolf67 | riverwolf67 | Earlier security changes partly incorporated; retain auth/containment checks. |
| [#32](https://github.com/cytostack/openwolf/pull/32) init/update: tag hook entries with `_managedBy: "openwolf"` (fixes #31) | @mann1x | mann1x | Managed hook merging retained; no blanket settings replacement. |
| [#26](https://github.com/cytostack/openwolf/pull/26) fix: safe config access with defaults (prevents crash on older .wolf/config.json) | @whydoyouwork | pixelbacon | Partial configuration merge already incorporated; preserve malformed settings. |
| [#9](https://github.com/cytostack/openwolf/pull/9) feat: add OpenCode plugin support (closes #6) | @alfasin | alfasin | OpenCode adapter already incorporated; current lifecycle/usage repaired. |
| [#4](https://github.com/cytostack/openwolf/pull/4) Fix dashboard bugs: Run Now, AI Insights, token chart, Design QC, project switching, cron logging | @MyEditHub | MyEditHub | Dashboard packaging/cron ideas reviewed; removed AI and DesignQC features excluded. |

## Attribution corrections

PRs #117/#118 were submitted by pereirajo; GitHub maps their commits to lojasmm-jonathan (Jonathan Pereira). PR #42 was submitted by mann1x, with commits attributed to Mizuho0329. PR #26 was submitted by whydoyouwork, with commits attributed to pixelbacon. Preserve these distinct roles rather than asserting that accounts are the same person. PR #35 includes yhyu13 and yhxd123 attribution. Issue #97 was filed by cytostack, but the original provenance proposal is credited to kantorcodes / Michael Kantor.

Additional reproduction and analysis credits: laihenyi (#61), elifarley (#41), cdgriffith (#15), wjramos and ezwep (#20), adalfa (#7). Automated assistants listed in commit metadata are not silently relabeled as human collaborators.

## Remaining verification boundaries

Native Claude, Codex and OpenCode UI counters can only be certified against the source records each installed version exposes. Missing telemetry remains unavailable/partial. Pricing is a current API list-price equivalent, not a subscription invoice. Enforced durable-memory approval requires a separately protected runtime, authority store and managed harness deployment. Current platform/native-session results and remaining checks are recorded in the [2.5.2 release verification](../release-2.5.2.md). The explicitly deferred features above remain follow-up work.

## Explicit coauthor trailers

Names below are taken verbatim from Co-authored-by trailers; they are not inferred GitHub identities.

- [PR #104](https://github.com/cytostack/openwolf/pull/104): Claude Fable 5
- [PR #74](https://github.com/cytostack/openwolf/pull/74): Claude Opus 5
- [PR #72](https://github.com/cytostack/openwolf/pull/72): Claude Opus 5 (1M context)
- [PR #71](https://github.com/cytostack/openwolf/pull/71): Claude Opus 5 (1M context)
- [PR #70](https://github.com/cytostack/openwolf/pull/70): Claude Opus 5 (1M context)
- [PR #69](https://github.com/cytostack/openwolf/pull/69): Claude Opus 5 (1M context)
- [PR #35](https://github.com/cytostack/openwolf/pull/35): Claude, Claude Opus 4.7
- [PR #26](https://github.com/cytostack/openwolf/pull/26): Claude Opus 4.7 (1M context)
