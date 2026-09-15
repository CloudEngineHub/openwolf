import {recordReceipt} from './visibility.js';
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { withFileLock, CLI_LOCK_BUDGET_MS } from "./anatomy-lock.js";

const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export interface ArchiveResult { archived: string[]; retained: number; dry_run: boolean; }
export function archiveMemory(wolfDir: string, days = 7, dryRun = false, now = Date.now()): ArchiveResult {
  if (!Number.isFinite(days) || days < 1) throw new Error("Retention must be at least one day");
  const file = path.join(wolfDir, "memory.md");
  const work = (): ArchiveResult => {
    let original: string;
    try { original = fs.readFileSync(file, "utf8"); } catch { return { archived: [], retained: 0, dry_run: dryRun }; }
    if (!dryRun) {
      const pending = file + ".pending";
      let names: string[] = [];
      try { names = fs.readdirSync(pending).filter(n => n.endsWith(".json")).sort(); } catch {}
      for (const name of names) {
        const marker = `<!-- recovered-memory:${name} -->`;
        const event = JSON.parse(fs.readFileSync(path.join(pending,name), "utf8"));
        if (typeof event.line !== "string") throw new Error("Invalid pending memory event; retained for review");
        if (!original.includes(marker)) {
          const next = original + `\n${marker}\n` + event.line;
          const tmp = file + "." + crypto.randomUUID() + ".tmp";
          try { fs.writeFileSync(tmp,next); fs.renameSync(tmp,file); original = next; }
          finally { try { fs.unlinkSync(tmp); } catch {} }
        }
        fs.unlinkSync(path.join(pending,name));
      }
    }
    const blocks = original.split(/(?=^## Session: )/m);
    const archived: string[] = [];
    let retained = 0;
    const replacement = blocks.map((block, index) => {
      const date = block.match(/^## Session: (\d{4}-\d{2}-\d{2})(?: ([\d:]+))?/);
      // Retain the latest session, unknown dates, pinned entries and existing markers.
      if (!date || index === blocks.length - 1 || /<!--\s*pin(?:ned)?\s*-->|> Archived session/.test(block)) { retained++; return block; }
      const time = Date.parse(date[1] + "T" + (date[2]?.length === 5 ? date[2] + ":00" : date[2] ?? "00:00:00") + "Z");
      if (!Number.isFinite(time) || now - time < days * 86400000) { retained++; return block; }
      // If a tracked session with that day is not explicitly ended, keep it.
      const sessions = path.join(wolfDir, "hooks", "sessions");
      try {
        for (const name of fs.readdirSync(sessions).filter(n => n.endsWith(".json"))) {
          const s = JSON.parse(fs.readFileSync(path.join(sessions, name), "utf8"));
          if (!s.ended && (typeof s.started !== "string" || s.started.startsWith(date[1]))) { retained++; return block; }
        }
      } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") { retained++; return block; } }
      const id = hash(block);
      archived.push(id);
      if (!dryRun) {
        const archive = path.join(wolfDir, "archive", "memory", id + ".md");
        fs.mkdirSync(path.dirname(archive), { recursive: true });
        try {
          const fd = fs.openSync(archive, "wx", 0o600);
          try { fs.writeFileSync(fd, block); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
        if (hash(fs.readFileSync(archive, "utf8")) !== id) throw new Error("Archive verification failed; memory retained");
      }
      return block.slice(0, block.indexOf("\n") + 1) + `\n> Archived session: ${id}\n\n`;
    }).join("");
    if (!dryRun && archived.length) {
      if (fs.readFileSync(file, "utf8") !== original) throw new Error("Memory changed during archival; retry later");
      const tmp = file + "." + crypto.randomUUID() + ".tmp";
      try { fs.writeFileSync(tmp, replacement); fs.renameSync(tmp, file); } finally { try { fs.unlinkSync(tmp); } catch {} }
    }
    return { archived, retained, dry_run: dryRun };
  };
  if (dryRun || !fs.existsSync(wolfDir)) return work();
  const result = withFileLock(file + ".lock", CLI_LOCK_BUDGET_MS, work);
  if (result === null) throw new Error("Memory busy; archival deferred");
  if(result.archived.length)recordReceipt(path.dirname(wolfDir),{operation:"memory-archived",evidence:result.archived.slice().sort().join(":"),count:result.archived.length});
  return result;
}

export function restoreMemory(wolfDir: string, id: string): void {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid archive id");
  const block = fs.readFileSync(path.join(wolfDir, "archive", "memory", id + ".md"), "utf8");
  if (hash(block) !== id) throw new Error("Archive checksum mismatch");
  const file = path.join(wolfDir, "memory.md");
  const ok = withFileLock(file + ".lock", CLI_LOCK_BUDGET_MS, () => {
    const content = fs.readFileSync(file, "utf8");
    if (content.includes(block)) return true;
    const pattern = new RegExp(`^## Session: [^\\n]+\\n\\n> Archived session: ${id}\\n\\n`, "m");
    if (!pattern.test(content)) throw new Error("Archive marker not found; active memory was left unchanged");
    const tmp = file + "." + crypto.randomUUID() + ".tmp";
    try { fs.writeFileSync(tmp, content.replace(pattern, () => block)); fs.renameSync(tmp, file); }
    finally { try { fs.unlinkSync(tmp); } catch {} }
    return true;
  });
  if (ok === null) throw new Error("Memory busy; restore deferred");
}
