# OpenWolf 2.5.2 release verification

Release verification is in progress. This file records results against the final package; pending checks are not represented as passing.

Scope: context handover and recovery, recorded usage/pricing, durable journals and archival, safe anatomy refresh, compatible runtime updates, quiet activity receipts and synchronized dashboard content. Contributor roles and original commit attribution are retained in CREDITS.md and docs/audit/.

Protected durable memory remains disabled in ordinary user-owned npm installations. Independent administrator provisioning is required to activate protected instruction injection. Handover evidence, activity receipts, archival and usage reporting work without that provisioning.

Existing 2.5.1 installations require a package refresh and `openwolf update` once to acquire the updater/bootstrap changes. Restart project daemons and start new sessions. Later compatible runtime updates prepare hooks/plugins for new sessions; they do not update the global CLI or a running daemon.
