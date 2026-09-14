import {hookReceipt} from './visibility.js';
import {activeContext} from "./handoff-state.js";
import {updateNotice} from "./runtime-updates.js";
import * as path from "node:path";
import { detectAgent, getProjectDir, ensureWolfDir, readJSON, writeJSON, emitHookJSON, recordInjection, readStdin, hookMain, getSessionFilePath } from "./shared.js";
import { mutateJSON, HOOK_LOCK_BUDGET_MS } from "./anatomy-lock.js";

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

async function main(): Promise<void> {
  ensureWolfDir();
  let input: { session_id?: string } = {};
  try {
    input = JSON.parse(await readStdin());
  } catch {}
  const sessionFile = getSessionFilePath(input);
  // Drain-and-clear: read and clear must be one transaction or a concurrent
  // writer's reminder is dropped without ever being shown (#83).
  let drained: string[] = [];
  mutateJSON<SessionData>(sessionFile, {}, HOOK_LOCK_BUDGET_MS, (session) => {
    drained = session.pending_reminders ?? [];
    if (drained.length === 0) return;
    session.pending_reminders = [];
    recordInjection(session, "reminders", drained.join("\n\n"));
  });

  const active=activeContext(getProjectDir(),detectAgent(),input.session_id ?? "");
  if(active)drained.push(active);
  const notice=(detectAgent()==="claude"||detectAgent()==="codex" ? updateNotice(getProjectDir(),input.session_id ?? "") : undefined) ?? hookReceipt(getProjectDir(),detectAgent(),{...input,prompt_id:String(readJSON<Record<string,unknown>>(sessionFile,{}).stop_count??0)});
  if (!drained.length && !notice) return;
  process.stdout.write(JSON.stringify({...(notice?{systemMessage:notice}:{}),...(drained.length?{hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:drained.join("\n\n")}}:{})}));
}

hookMain("user-prompt-submit", main);
