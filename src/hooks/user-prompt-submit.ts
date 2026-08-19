import * as path from "node:path";
import { getWolfDir, ensureWolfDir, readJSON, writeJSON, emitHookJSON, recordInjection } from "./shared.js";

// UserPromptSubmit hook: drains reminders the Stop hook queued last turn.
//
// Why here and not in the Stop hook itself: Stop-level additionalContext is
// "feedback that continues the conversation" — every reminder would force a
// full extra model turn. Delivering the same text alongside the user's next
// prompt costs zero extra turns and the model still sees it before acting.

interface SessionData {
  pending_reminders?: string[];
  [key: string]: unknown;
}

function main(): void {
  ensureWolfDir();
  const sessionFile = path.join(getWolfDir(), "hooks", "_session.json");
  const session = readJSON<SessionData>(sessionFile, {});
  const pending = session.pending_reminders ?? [];
  if (pending.length === 0) {
    process.exit(0);
    return;
  }
  session.pending_reminders = [];
  recordInjection(session, "reminders", pending.join("\n\n"));
  writeJSON(sessionFile, session);
  emitHookJSON("UserPromptSubmit", { additionalContext: pending.join("\n\n") });
  process.exit(0);
}

try {
  main();
} catch {
  process.exit(0);
}
