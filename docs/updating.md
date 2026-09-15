# Update and restore

There are two update paths. A package update changes the CLI installed on your machine. A session runtime update prepares hooks and plugin code for new sessions in one project.

## Update the package and registered projects

```bash
npm install -g openwolf
openwolf --version
openwolf update --list
openwolf update --dry-run
openwolf update
```

This installs the version currently published on npm. OpenWolf 2.5.2 is available on [npm](https://www.npmjs.com/package/openwolf/v/2.5.2), with [release notes on GitHub](https://github.com/cytostack/openwolf/releases/tag/v2.5.2).

`openwolf update` refreshes registered projects from the installed package. Use `--project my-app` to select a project by partial name. Review the dry run before updating several projects.

The update creates a backup, merges new configuration defaults, refreshes OpenWolf runtime files and agent registrations, and checks that the installed hooks can load. It preserves existing custom settings where supported and reports malformed files for repair. Selected migrations can change generated state, so review the update result and backup.

Restart each project's daemon and start new agent sessions to load the new code. Existing 2.5.1 installations need this package refresh once to acquire the 2.5.2 runtime updater.

## Automatic session runtime updates

The default `compatible` policy checks npm in the background and prepares supported stable releases in the same major version. For a 0.x release, the minor version must also match. Major updates produce a notice.

A new session can use the verified runtime. A running or resumed session keeps its selected version. These updates do not replace the global CLI, restart a daemon or replace a custom Claude status-line command.

```bash
openwolf self-update --status
openwolf self-update
```

The first command reads cached status. The second checks the registry under the configured policy. Network or verification failures retain the working runtime. See [automatic update details](automatic-updates.md).

## Restore a backup

```bash
openwolf restore
openwolf restore BACKUP_NAME
```

The first command lists backups. Replace `BACKUP_NAME` with a listed snapshot. Restoration can replace newer `.wolf/` data and backed-up Claude settings, so inspect the snapshot before proceeding.

For a single archived memory block, use `openwolf memory restore ARCHIVE_ID` instead of restoring the whole project snapshot.

## Check which CLI is running

Multiple Node installations can expose different OpenWolf versions.

```bash
openwolf --version
```

Use `command -v openwolf` on Linux or macOS, `where.exe openwolf` in Windows Command Prompt, or `Get-Command openwolf` in PowerShell. Update the package associated with the Node installation you intend to use. Do not delete an executable solely because its version differs from another installation.

Protected administrator-managed runtimes have a separate update process. Project settings cannot authorise replacement of that protected runtime.
