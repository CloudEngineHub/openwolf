import * as path from "node:path";
import { getWolfDir, ensureWolfDir, readJSON, writeJSON, readStdin, emitHookJSON, recordInjection } from "./shared.js";
import { shouldSuggestFilter } from "./bash-filter.js";

// ─────────────────────────────────────────────────────────────────────────────
// PreToolUse[Bash] filter (Workstream J3): verbose test/build output is one of
// the biggest uncacheable context costs — a failing test run can dump tens of
// thousands of tokens into the conversation. This hook recognizes a small,
// exact allowlist of such commands and SUGGESTS capping their output
// (log-to-file + tail) via additionalContext.
//
// Modes (config: openwolf.bash.filter_mode):
//   "suggest" (default) — inject a note; the model decides.
//   "off"               — do nothing.
//   "rewrite"           — EXPERIMENTAL, deliberately NOT implemented as an
//                         auto-approval: rewriting tool input rides
//                         hookSpecificOutput and may auto-approve the call,
//                         which OpenWolf refuses on principle (shared.ts).
//                         Until the platform offers input rewriting without
//                         bypassing the permission gate, "rewrite" behaves
//                         like "suggest" and says so once per session.
// ─────────────────────────────────────────────────────────────────────────────

type FilterMode = "suggest" | "rewrite" | "off";

function filterMode(wolfDir: string): FilterMode {
  const cfg = readJSON<{ openwolf?: { bash?: { filter_mode?: string } } }>(
    path.join(wolfDir, "config.json"), {}
  );
  const mode = cfg.openwolf?.bash?.filter_mode;
  return mode === "off" || mode === "rewrite" ? mode : "suggest";
}

async function main(): Promise<void> {
  ensureWolfDir();
  const wolfDir = getWolfDir();
  const mode = filterMode(wolfDir);
  if (mode === "off") { process.exit(0); return; }

  const raw = await readStdin();
  let input: { tool_input?: { command?: string } };
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
    return;
  }

  const command = input.tool_input?.command ?? "";
  if (!shouldSuggestFilter(command)) { process.exit(0); return; }

  const sessionFile = path.join(wolfDir, "hooks", "_session.json");
  // Once per session per command family: nagging every test run costs more
  // context than it saves.
  const family = command.trim().split(/\s+/).slice(0, 2).join(" ");
  const session = readJSON<{ bash_filter_suggested?: Record<string, boolean>; [k: string]: unknown }>(sessionFile, {});
  if (session.bash_filter_suggested?.[family]) { process.exit(0); return; }

  const note =
    `OpenWolf: "${family}" output can be very large and every line enters your context. ` +
    `Consider capping it yourself, e.g.: ${command.trim()} > .wolf/hooks/_last-bash.log 2>&1; ` +
    `s=$?; tail -n 150 .wolf/hooks/_last-bash.log; exit $s ` +
    `(full log stays on disk at .wolf/hooks/_last-bash.log). This note appears once per session.` +
    (mode === "rewrite"
      ? ` Note: filter_mode "rewrite" is configured but not active; automatic rewriting would bypass the permission gate, so OpenWolf caps at suggestions for now.`
      : "");

  session.bash_filter_suggested = { ...(session.bash_filter_suggested ?? {}), [family]: true };
  recordInjection(session, "bash_filter", note);
  writeJSON(sessionFile, session);

  emitHookJSON("PreToolUse", { additionalContext: note });
  process.exit(0);
}

main().catch(() => process.exit(0));
