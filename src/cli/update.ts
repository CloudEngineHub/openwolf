/**
 * openwolf update — Update all registered OpenWolf projects.
 *
 * For each project:
 * 1. Creates a timestamped backup in .wolf/backups/
 * 2. Updates hooks, templates, protocol files, and claude rules
 * 3. Preserves all user data (cerebrum, memory, anatomy, buglog, ledger)
 * 4. Reports results per project
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { getRegisteredProjects, registerProject, type RegisteredProject } from "./registry.js";
import { findProjectRoot } from "../scanner/project-root.js";
import { readJSON, writeJSON, readText, writeText, safeCopyFile } from "../utils/fs-safe.js";
import { ensureDir } from "../utils/paths.js";
import { resolveAgents, availableAgents } from "../agents/index.js";
import { newStore, importFromMarkdown, saveStore, STORE_FILE, sha256 as storeSha256 } from "../hooks/anatomy-store.js";
import { installSkills } from "../agents/skills.js";
import { HOOK_SETTINGS, HOOK_FILES } from "./hook-manifest.js";
import { emptyLedger, recomputeLifetime, migrateLegacyBlockedCounts, type LedgerData } from "../hooks/ledger.js";
import { mergeConfigDefaults } from "./config-merge.js";
import { syncCerebrumToClaudeMemory } from "./memory-migrate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, "../../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

// Files that are safe to overwrite (protocol docs only — never user-edited config)
const ALWAYS_OVERWRITE = ["OPENWOLF.md", "reframe-frameworks.md"];

// Files that contain user data — NEVER overwrite, only create if missing.
//
// `config.json` is user data: it holds per-project port assignments
// (`openwolf.daemon.port`, `openwolf.dashboard.port`), scan intervals,
// exclude patterns, and any other tunables a user has customized.
// Overwriting it on `openwolf update` resets every registered project to
// the same default ports (18790 / 18791), at which point only the first
// daemon to start can bind and the rest crash-loop on EADDRINUSE.
// Keep it in BACKUP_FILES (via the spread below) so `openwolf restore`
// can still recover it.
const USER_DATA_FILES = [
  "config.json",
  "identity.md", "cerebrum.md", "memory.md", "anatomy.md", "anatomy-index.json", "STATUS.md",
  "token-ledger.json", "buglog.json", "cron-manifest.json", "cron-state.json",
  "suggestions.json",
];

// Files to include in backup
const BACKUP_FILES = [
  ...ALWAYS_OVERWRITE,
  ...USER_DATA_FILES,
];


interface UpdateResult {
  project: RegisteredProject;
  status: "updated" | "skipped" | "error";
  backupDir?: string;
  message: string;
}

export async function updateCommand(options: { dryRun?: boolean; force?: boolean; project?: string }): Promise<void> {
  const version = getVersion();
  const projects = getRegisteredProjects(true);

  if (projects.length === 0) {
    console.log("No registered OpenWolf projects found.");
    console.log("Run 'openwolf init' in a project directory to register it.");
    return;
  }

  // Filter to specific project if requested
  let targets = projects;
  if (options.project) {
    const search = options.project.toLowerCase();
    targets = projects.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.root.toLowerCase().includes(search)
    );
    if (targets.length === 0) {
      console.log(`No registered project matching "${options.project}".`);
      console.log("Registered projects:");
      for (const p of projects) {
        console.log(`  - ${p.name} (${p.root})`);
      }
      return;
    }
  }

  console.log(`OpenWolf v${version} — updating ${targets.length} project(s)${options.dryRun ? " (dry run)" : ""}...\n`);

  const results: UpdateResult[] = [];

  for (const project of targets) {
    const result = await updateProject(project, version, options.dryRun ?? false);
    results.push(result);
  }

  // Summary
  console.log("\n─── Update Summary ───");
  const updated = results.filter(r => r.status === "updated");
  const skipped = results.filter(r => r.status === "skipped");
  const errors = results.filter(r => r.status === "error");

  if (updated.length > 0) {
    console.log(`\n  ✓ Updated (${updated.length}):`);
    for (const r of updated) {
      console.log(`    ${r.project.name} — ${r.message}`);
    }
  }
  if (skipped.length > 0) {
    console.log(`\n  ○ Skipped (${skipped.length}):`);
    for (const r of skipped) {
      console.log(`    ${r.project.name} — ${r.message}`);
    }
  }
  if (errors.length > 0) {
    console.log(`\n  ✗ Errors (${errors.length}):`);
    for (const r of errors) {
      console.log(`    ${r.project.name} — ${r.message}`);
    }
  }
  console.log("");
}

async function updateProject(
  project: RegisteredProject,
  version: string,
  dryRun: boolean
): Promise<UpdateResult> {
  const { root, name } = project;
  const wolfDir = path.join(root, ".wolf");

  // Validate project still exists
  if (!fs.existsSync(wolfDir)) {
    return { project, status: "skipped", message: ".wolf/ directory not found" };
  }

  // Never update the openwolf source repo itself
  if (name === "openwolf") {
    return { project, status: "skipped", message: "openwolf source repo — skipped" };
  }

  console.log(`  ${name} (${root})`);

  // Already at this version?
  if (project.version === version) {
    console.log(`    Already at v${version} — updating hooks/templates anyway`);
  }

  if (dryRun) {
    console.log(`    [dry run] Would backup, update hooks, templates, rules`);
    return { project, status: "updated", message: `would update to v${version}` };
  }

  try {
    // 1. Create backup
    const backupDir = createBackup(wolfDir);
    console.log(`    ✓ Backup: ${path.basename(backupDir)}`);

    // 2. Update template files (OPENWOLF.md, config.json)
    const templatesDir = findTemplatesDir();
    for (const file of ALWAYS_OVERWRITE) {
      const srcPath = path.join(templatesDir, file);
      const destPath = path.join(wolfDir, file);
      if (fs.existsSync(srcPath)) {
        safeCopyFile(srcPath, destPath);
      }
    }
    console.log(`    ✓ Templates updated (${ALWAYS_OVERWRITE.join(", ")})`);

    // 2b. Merge new config defaults (add missing keys only, never overwrite):
    // upgraded projects must be able to discover new tunables such as
    // openwolf.reads.duplicate_mode. Runs before the port-collision pass so a
    // merged-in default port can still be reassigned.
    if (mergeConfigDefaults(path.join(wolfDir, "config.json"), templatesDir)) {
      console.log(`    ✓ Config defaults merged (new keys added, existing values preserved)`);
    }

    // 3. Update hook scripts
    copyHookScripts(wolfDir);
    console.log(`    ✓ Hook scripts updated`);

    // 4. Update .claude/settings.json hooks
    const claudeDir = path.join(root, ".claude");
    ensureDir(claudeDir);
    const settingsPath = path.join(claudeDir, "settings.json");
    if (fs.existsSync(settingsPath)) {
      const existing = readJSON<Record<string, unknown>>(settingsPath, {});
      const merged = replaceOpenWolfHooks(existing, HOOK_SETTINGS);
      writeJSON(settingsPath, merged);
    } else {
      writeJSON(settingsPath, HOOK_SETTINGS);
    }
    console.log(`    ✓ Claude settings updated`);

    // 5. Update .claude/rules/openwolf.md
    const rulesDir = path.join(claudeDir, "rules");
    ensureDir(rulesDir);
    const rulesContent = readTemplateContent("claude-rules-openwolf.md", templatesDir);
    writeText(path.join(rulesDir, "openwolf.md"), rulesContent);
    console.log(`    ✓ Claude rules updated`);

    // 5a2. One-time anatomy store migration (projects predating the durable
    // store): bootstrap anatomy-index.json from the existing anatomy.md.
    try {
      if (!fs.existsSync(path.join(wolfDir, STORE_FILE))) {
        const md = readText(path.join(wolfDir, "anatomy.md"));
        if (md) {
          const store = newStore();
          importFromMarkdown(store, md, root);
          store.meta.renderedHash = storeSha256(md);
          saveStore(wolfDir, store);
          console.log(`    ✓ anatomy-index.json created (migrated from anatomy.md)`);
        }
      }
    } catch {}

    // 5a2b. One-time ledger repair: earlier stop hooks appended one CUMULATIVE
    // session entry per turn and re-added totals to lifetime each time, so a
    // 10-turn session shows as 10 duplicate entries with quadratically
    // inflated lifetime numbers. Dedupe by session id (keep the last, most
    // complete entry) and rebuild lifetime from the deduped sessions.
    try {
      const ledgerPath = path.join(wolfDir, "token-ledger.json");
      if (fs.existsSync(ledgerPath)) {
        const ledger = readJSON<LedgerData>(ledgerPath, emptyLedger());
        let ledgerChanged = false;
        if (Array.isArray(ledger.sessions) && ledger.sessions.length > 0) {
          const before = ledger.sessions.length;
          const byId = new Map<string, (typeof ledger.sessions)[number]>();
          for (const s of ledger.sessions) {
            if (s && s.id) byId.set(s.id, s);
          }
          if (byId.size < before || !ledger.lifetime_baseline) {
            ledger.sessions = [...byId.values()];
            ledger.lifetime_baseline = ledger.lifetime_baseline ?? {};
            // total_sessions was also inflated (counted again on resume and
            // never tied to real entries): reset it to the sessions we can
            // actually account for.
            ledger.lifetime.total_sessions = byId.size;
            ledgerChanged = true;
            console.log(`    ✓ Token ledger repaired (${before} entries -> ${byId.size} sessions, lifetime recomputed)`);
          }
        }
        // 5a2c. Pre-2.0.5 sessions stored duplicate-read WARNING counts in
        // repeated_reads_blocked; relabel them so blocked only ever means
        // actual denials (see migrateLegacyBlockedCounts).
        const migrated = migrateLegacyBlockedCounts(ledger);
        if (migrated > 0) {
          ledgerChanged = true;
          console.log(`    ✓ Token ledger migrated (${migrated} legacy blocked-counts relabeled as warnings)`);
        }
        if (ledgerChanged) {
          recomputeLifetime(ledger);
          writeJSON(ledgerPath, ledger);
        }
      }
    } catch {}

    // 5a3. Resolve port collisions across registered projects. Projects
    // upgraded from 1.x share the old default ports (18790/18791); when more
    // than one is registered their daemons and dashboards collide, which is
    // why the dashboard used to only ever open the first project. Reassign a
    // free pair when this project's ports overlap another registered project.
    try {
      const reassigned = reassignCollidingPorts(root, wolfDir);
      if (reassigned) console.log(`    ✓ Ports reassigned to ${reassigned} (avoids collision with another project)`);
    } catch {}

    // 5b. Create STATUS.md if missing (projects predating the handoff doc)
    const statusPath = path.join(wolfDir, "STATUS.md");
    if (!fs.existsSync(statusPath)) {
      const statusContent = readTemplateContent("STATUS.md", templatesDir);
      if (statusContent) {
        writeText(statusPath, seedStatusPlaceholders(statusContent, root));
        console.log(`    ✓ STATUS.md created`);
      }
    }

    // 5c. Re-run the agent adapters this project was initialized with, so
    // Codex/OpenCode/Gemini/Cursor wiring picks up new hooks and templates.
    const cfg = readJSON<{ openwolf?: { agents?: string[] } }>(path.join(wolfDir, "config.json"), {});
    const agentNames = cfg.openwolf?.agents ?? ["claude"];
    const known = new Set(availableAgents());
    const extras = agentNames.filter((a) => a !== "claude");
    const unknown = extras.filter((a) => !known.has(a));
    for (const u of unknown) {
      console.log(`    ⚠ unknown agent "${u}" in config.openwolf.agents — skipped`);
    }
    const adapters = resolveAgents(extras.filter((a) => known.has(a)));
    const ctx = { projectRoot: root, wolfDir, templatesDir };
    for (const adapter of adapters) {
      const result = adapter.install(ctx);
      for (const line of result.actions) console.log(`    ✓ ${line}`);
      for (const warn of result.warnings) console.log(`    ⚠ ${adapter.displayName}: ${warn}`);
    }

    // 5d. Refresh bundled skills for every configured agent.
    for (const line of installSkills(root, templatesDir, agentNames)) {
      console.log(`    ✓ ${line}`);
    }

    // 5e. Mirror cerebrum into Claude Code auto-memory (kills the digest's
    // double injection of Do-Not-Repeat on Claude; other agents keep it).
    try {
      const sync = syncCerebrumToClaudeMemory(root, wolfDir);
      if (sync.synced.length > 0) {
        console.log(`    ✓ cerebrum synced to Claude auto-memory (${sync.synced.join(", ")})`);
      }
    } catch {}

    // 6. Update the CLAUDE.md snippet. A legacy shipped snippet (matched
    // byte-identically, so user customizations are never touched) is replaced
    // with the current stub; the old snippet @-inlined the whole protocol
    // into every session, which the stub + skill now cover on demand.
    const claudeMdPath = path.join(root, "CLAUDE.md");
    const snippetContent = readTemplateContent("claude-md-snippet.md", templatesDir);
    if (fs.existsSync(claudeMdPath)) {
      const existing = readText(claudeMdPath);
      if (!existing.includes("OpenWolf")) {
        writeText(claudeMdPath, snippetContent + "\n\n" + existing);
        console.log(`    ✓ CLAUDE.md updated`);
      } else {
        const migrated = replaceLegacySnippet(existing, snippetContent);
        if (migrated !== null) {
          writeText(claudeMdPath, migrated);
          console.log(`    ✓ CLAUDE.md snippet replaced with the lean stub (protocol moved to the openwolf skill)`);
        } else if (existing.includes("@.wolf/OPENWOLF.md")) {
          console.log(`    ⚠ CLAUDE.md still @-imports .wolf/OPENWOLF.md but was customized; consider trimming it yourself (the openwolf skill now carries the protocol)`);
        }
      }
    }

    // 7. Clean up stale .tmp files
    try {
      const files = fs.readdirSync(wolfDir);
      let cleaned = 0;
      for (const f of files) {
        if (f.endsWith(".tmp")) {
          try { fs.unlinkSync(path.join(wolfDir, f)); cleaned++; } catch {}
        }
      }
      if (cleaned > 0) console.log(`    ✓ Cleaned ${cleaned} stale .tmp file(s)`);
    } catch {}

    // 8. Update registry entry
    registerProject(root, name, version);

    return {
      project,
      status: "updated",
      backupDir,
      message: `v${project.version} → v${version}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { project, status: "error", message: msg };
  }
}

/**
 * If this project's dashboard/daemon ports collide with another registered
 * project, allocate a free pair. Returns "daemon/dashboard" if reassigned,
 * else null. Mirrors the free-port logic in cli/init.ts reconcileConfig.
 */
function reassignCollidingPorts(root: string, wolfDir: string): string | null {
  const cfgPath = path.join(wolfDir, "config.json");
  const cfg = readJSON<any>(cfgPath, null as any);
  if (!cfg?.openwolf?.dashboard) return null;

  const norm = (p: string) => (process.platform === "win32" ? path.resolve(p).toLowerCase() : path.resolve(p));
  const mine = norm(root);
  const used = new Set<number>();
  for (const proj of getRegisteredProjects(false)) {
    if (norm(proj.root) === mine) continue;
    const oc = readJSON<any>(path.join(proj.root, ".wolf", "config.json"), null as any)?.openwolf;
    if (typeof oc?.daemon?.port === "number") used.add(oc.daemon.port);
    if (typeof oc?.dashboard?.port === "number") used.add(oc.dashboard.port);
  }

  const myDash = cfg.openwolf.dashboard.port;
  const myDaemon = cfg.openwolf.daemon?.port;
  if (!used.has(myDash) && (typeof myDaemon !== "number" || !used.has(myDaemon))) return null;

  const nextFree = (base: number): number => { let p = base; while (used.has(p)) p++; used.add(p); return p; };
  cfg.openwolf.daemon = cfg.openwolf.daemon || {};
  cfg.openwolf.dashboard = cfg.openwolf.dashboard || {};
  cfg.openwolf.daemon.port = nextFree(18790);
  cfg.openwolf.dashboard.port = nextFree(18791);
  writeJSON(cfgPath, cfg);
  return `${cfg.openwolf.daemon.port}/${cfg.openwolf.dashboard.port}`;
}

/** Fill STATUS.md template placeholders — mirrors seedStatus in init.ts. */
function seedStatusPlaceholders(content: string, projectRoot: string): string {
  let projectName = path.basename(projectRoot);
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"));
    if (typeof pkg.name === "string" && pkg.name) projectName = pkg.name;
  } catch {}
  return content
    .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
    .replace(/\{\{DATE\}\}/g, new Date().toISOString().slice(0, 10));
}

/**
 * Create a timestamped backup of all .wolf files into .wolf/backups/YYYY-MM-DD_HHMMSS/
 */
function createBackup(wolfDir: string): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "").slice(0, 15); // 20260315T013000
  const backupDir = path.join(wolfDir, "backups", stamp);
  ensureDir(backupDir);

  // Backup all relevant files
  for (const file of BACKUP_FILES) {
    const src = path.join(wolfDir, file);
    if (fs.existsSync(src)) {
      safeCopyFile(src, path.join(backupDir, file));
    }
  }

  // Also backup hooks
  const hooksDir = path.join(wolfDir, "hooks");
  if (fs.existsSync(hooksDir)) {
    const hooksBackup = path.join(backupDir, "hooks");
    ensureDir(hooksBackup);
    try {
      const hookFiles = fs.readdirSync(hooksDir);
      for (const f of hookFiles) {
        const src = path.join(hooksDir, f);
        if (fs.statSync(src).isFile()) {
          safeCopyFile(src, path.join(hooksBackup, f));
        }
      }
    } catch {}
  }

  // Also backup .claude/settings.json and rules
  const projectRoot = path.dirname(wolfDir);
  const claudeSettings = path.join(projectRoot, ".claude", "settings.json");
  if (fs.existsSync(claudeSettings)) {
    const claudeBackup = path.join(backupDir, ".claude");
    ensureDir(claudeBackup);
    safeCopyFile(claudeSettings, path.join(claudeBackup, "settings.json"));
  }
  const claudeRules = path.join(projectRoot, ".claude", "rules", "openwolf.md");
  if (fs.existsSync(claudeRules)) {
    const rulesBackup = path.join(backupDir, ".claude", "rules");
    ensureDir(rulesBackup);
    safeCopyFile(claudeRules, path.join(rulesBackup, "openwolf.md"));
  }

  return backupDir;
}

// Every CLAUDE.md snippet OpenWolf has ever shipped, verbatim (trimmed).
// Replacement happens only on a byte-identical match of one of these blocks,
// so anything the user edited is theirs and stays untouched.
const LEGACY_CLAUDE_SNIPPETS = [
  "# OpenWolf\n\n@.wolf/OPENWOLF.md\n\nThis project uses OpenWolf for context management. The imported protocol above applies every session.",
  "# OpenWolf\n\n@.wolf/OPENWOLF.md\n\nThis project uses OpenWolf for context management. Read and follow .wolf/OPENWOLF.md every session. Check .wolf/cerebrum.md before generating code. Check .wolf/anatomy.md before reading files.",
];

/**
 * Replace a legacy shipped snippet inside CLAUDE.md with the current stub.
 * Returns the new content, or null when no shipped snippet matches verbatim.
 */
export function replaceLegacySnippet(existing: string, stub: string): string | null {
  const stubTrimmed = stub.trim();
  for (const legacy of LEGACY_CLAUDE_SNIPPETS) {
    if (legacy === stubTrimmed) continue;
    const idx = existing.indexOf(legacy);
    if (idx !== -1) {
      return existing.slice(0, idx) + stubTrimmed + existing.slice(idx + legacy.length);
    }
  }
  return null;
}

// ─── Shared helpers (extracted from init.ts patterns) ─────────────

function findTemplatesDir(): string {
  const candidates = [
    path.resolve(__dirname, "..", "..", "..", "src", "templates"),
    path.resolve(__dirname, "..", "..", "src", "templates"),
    path.resolve(__dirname, "..", "templates"),
    path.resolve(__dirname, "templates"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

function readTemplateContent(filename: string, templatesDir: string): string {
  const filePath = path.join(templatesDir, filename);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf-8");
  }
  const templates: Record<string, string> = {
    "claude-md-snippet.md": `# OpenWolf\n\nThis project uses OpenWolf for context management. The always-on rules live in \`.claude/rules/openwolf.md\`; the hooks handle bookkeeping (anatomy index, memory log, read tracking) automatically.\n\nFor the full operating protocol (session handoff, memory discipline, bug logging), load the \`openwolf\` skill, or read \`.wolf/OPENWOLF.md\`. Regenerate the session handoff with \`/handoff\`.`,
    "claude-rules-openwolf.md": `---\ndescription: OpenWolf protocol enforcement, active on all files\nglobs: **/*\n---\n\n- Before reading an unfamiliar project file, grep .wolf/anatomy.md for its path (one-line description + token estimate). Never read anatomy.md whole; it is an index.\n- Check .wolf/cerebrum.md Do-Not-Repeat list before generating code; after a user correction, update cerebrum.md immediately.\n- Do NOT manually update .wolf/anatomy.md or .wolf/memory.md; the OpenWolf hooks maintain them.\n- BEFORE fixing any bug: grep .wolf/buglog.json for the error message or filename. AFTER fixing one: log it there (error_message, root_cause, fix, tags).\n- When resuming a session, read .wolf/STATUS.md first; regenerate it with /handoff when a quest finishes.`,
  };
  return templates[filename] ?? "";
}

function copyHookScripts(wolfDir: string): void {
  const hooksDir = path.join(wolfDir, "hooks");
  ensureDir(hooksDir);

  const candidates = [
    path.join(__dirname, "..", "hooks"),
    path.resolve(__dirname, "..", "..", "hooks"),
    path.resolve(__dirname, "..", "..", "dist", "hooks"),
  ];

  let sourceDir = "";
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, "shared.js"))) {
      sourceDir = candidate;
      break;
    }
  }

  const hookFiles = HOOK_FILES;

  if (sourceDir) {
    for (const file of hookFiles) {
      const src = path.join(sourceDir, file);
      if (fs.existsSync(src)) {
        safeCopyFile(src, path.join(hooksDir, file));
      }
    }
  }

  // Always ensure package.json with type:module
  const hooksPkgPath = path.join(hooksDir, "package.json");
  fs.writeFileSync(hooksPkgPath, JSON.stringify({ type: "module" }, null, 2) + "\n", "utf-8");
}

function replaceOpenWolfHooks(
  existing: Record<string, unknown>,
  hookSettings: typeof HOOK_SETTINGS
): Record<string, unknown> {
  const merged = { ...existing };
  if (!merged.hooks) merged.hooks = {};
  const hooks = merged.hooks as Record<string, Array<{ matcher: string; hooks: Array<{ command?: string; type: string }> }>>;

  for (const [event, newMatchers] of Object.entries(hookSettings.hooks)) {
    if (!hooks[event]) hooks[event] = [];

    // Remove existing OpenWolf hook entries
    hooks[event] = hooks[event].filter((entry) => {
      const isOpenWolfHook = entry.hooks?.some(
        (h) => h.command && h.command.includes(".wolf/hooks/")
      );
      return !isOpenWolfHook;
    });

    // Add new OpenWolf hooks
    for (const matcher of newMatchers) {
      hooks[event].push(matcher);
    }
  }

  return merged;
}

/**
 * List all registered projects (for `openwolf update --list`)
 */
export function listProjects(): void {
  const projects = getRegisteredProjects(true);

  if (projects.length === 0) {
    console.log("No registered OpenWolf projects.");
    console.log("Run 'openwolf init' in a project directory to register it.");
    return;
  }

  console.log(`Registered OpenWolf projects (${projects.length}):\n`);
  for (const p of projects) {
    const age = Math.floor((Date.now() - new Date(p.last_updated).getTime()) / (1000 * 60 * 60 * 24));
    console.log(`  ${p.name}`);
    console.log(`    Path: ${p.root}`);
    console.log(`    Version: ${p.version} | Updated: ${age}d ago`);
    console.log("");
  }
}

/**
 * Restore a project's .wolf from a backup
 */
export function restoreCommand(backupName?: string): void {
  // findProjectRoot, not cwd: run from a subdirectory, cwd has no .wolf and
  // restore reported "No backups found" while every other command worked.
  const wolfDir = path.join(findProjectRoot(), ".wolf");
  const backupsDir = path.join(wolfDir, "backups");

  if (!fs.existsSync(backupsDir)) {
    console.log("No backups found for this project.");
    return;
  }

  const backups = fs.readdirSync(backupsDir)
    .filter(d => fs.statSync(path.join(backupsDir, d)).isDirectory())
    .sort()
    .reverse();

  if (backups.length === 0) {
    console.log("No backups found.");
    return;
  }

  if (!backupName) {
    console.log(`Available backups (${backups.length}):\n`);
    for (const b of backups) {
      const files = fs.readdirSync(path.join(backupsDir, b)).filter(f => !fs.statSync(path.join(backupsDir, b, f)).isDirectory());
      console.log(`  ${b} (${files.length} files)`);
    }
    console.log(`\nTo restore: openwolf restore <backup-name>`);
    return;
  }

  const backupDir = path.join(backupsDir, backupName);
  if (!fs.existsSync(backupDir)) {
    console.log(`Backup "${backupName}" not found.`);
    return;
  }

  // Restore files
  const files = fs.readdirSync(backupDir).filter(f => fs.statSync(path.join(backupDir, f)).isFile());
  for (const file of files) {
    safeCopyFile(path.join(backupDir, file), path.join(wolfDir, file));
  }

  // Restore hooks if present
  const hooksBackup = path.join(backupDir, "hooks");
  if (fs.existsSync(hooksBackup)) {
    const hookFiles = fs.readdirSync(hooksBackup);
    const hooksDir = path.join(wolfDir, "hooks");
    ensureDir(hooksDir);
    for (const f of hookFiles) {
      safeCopyFile(path.join(hooksBackup, f), path.join(hooksDir, f));
    }
  }

  // Restore .claude settings if present
  const claudeBackup = path.join(backupDir, ".claude");
  if (fs.existsSync(claudeBackup)) {
    const projectRoot = path.dirname(wolfDir);
    const settingsBackup = path.join(claudeBackup, "settings.json");
    if (fs.existsSync(settingsBackup)) {
      const dest = path.join(projectRoot, ".claude", "settings.json");
      ensureDir(path.dirname(dest));
      safeCopyFile(settingsBackup, dest);
    }
    const rulesBackup = path.join(claudeBackup, "rules", "openwolf.md");
    if (fs.existsSync(rulesBackup)) {
      const dest = path.join(projectRoot, ".claude", "rules", "openwolf.md");
      ensureDir(path.dirname(dest));
      safeCopyFile(rulesBackup, dest);
    }
  }

  console.log(`Restored ${files.length} files from backup "${backupName}".`);
}
