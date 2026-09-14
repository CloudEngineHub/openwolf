import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";

export type UsageAgent = "claude" | "codex" | "opencode";
export interface UsageTotals {
  /** Inclusive input: fresh + cached reads + cache writes. */
  input_tokens: number | null;
  /** Inclusive output: visible + reasoning. */
  output_tokens: number | null;
  cached_input_tokens: number | null;
  cache_write_tokens: number | null;
  reasoning_tokens: number | null;
  total_tokens: number | null;
}
export interface UsageRecord {
  version: 1;
  id: string;
  agent: UsageAgent;
  provider: string;
  model: string;
  session_id: string;
  project_root: string;
  source: string;
  timestamp: string;
  sidechain: boolean;
  raw: Record<string, unknown>;
  totals: UsageTotals;
  pricing?: { service_tier?: string; input_tokens?: number; inference_geo?: string };
}
export interface UsageCoverage {
  status: "recorded" | "partial" | "unavailable";
  records: number;
  sources: number;
  diagnostics: string[];
}
export interface UsageReport {
  version: 1;
  project_root: string;
  scanned_at: string;
  totals: UsageTotals;
  by_agent: Record<string, UsageTotals>;
  by_model: Record<string, UsageTotals>;
  by_session: Record<string, UsageTotals>;
  coverage: Record<UsageAgent, UsageCoverage>;
  records: UsageRecord[];
}
const keys: Array<keyof UsageTotals> = ["input_tokens", "output_tokens", "cached_input_tokens", "cache_write_tokens", "reasoning_tokens", "total_tokens"];
const empty = (): UsageTotals => Object.fromEntries(keys.map(k => [k, 0])) as unknown as UsageTotals;
const n = (v: unknown): number | null => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
const sum = (...values: Array<number | null>): number | null => values.some(v => v === null) ? null : n(values.reduce<number>((s, v) => s + v!, 0));
const digest = (v: unknown) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
const canonical = (p: string): string => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };

export function normalizeUsage(agent: UsageAgent, u: any): UsageTotals {
  if (agent === "claude") {
    const input = sum(n(u.input_tokens), n(u.cache_read_input_tokens), n(u.cache_creation_input_tokens));
    const output = n(u.output_tokens);
    return { input_tokens: input, output_tokens: output, cached_input_tokens: n(u.cache_read_input_tokens), cache_write_tokens: n(u.cache_creation_input_tokens), reasoning_tokens: n(u.reasoning_tokens), total_tokens: sum(input, output) };
  }
  if (agent === "codex") {
    return { input_tokens: n(u.input_tokens), output_tokens: n(u.output_tokens), cached_input_tokens: n(u.cached_input_tokens), cache_write_tokens: n(u.cache_write_input_tokens), reasoning_tokens: n(u.reasoning_output_tokens), total_tokens: n(u.total_tokens) };
  }
  const input = sum(n(u.input), n(u.cache?.read), n(u.cache?.write));
  const output = sum(n(u.output), n(u.reasoning));
  return { input_tokens: input, output_tokens: output, cached_input_tokens: n(u.cache?.read), cache_write_tokens: n(u.cache?.write), reasoning_tokens: n(u.reasoning), total_tokens: sum(input, output) };
}

function aggregate(records: UsageRecord[]): UsageTotals {
  if (!records.length) return Object.fromEntries(keys.map(k => [k, null])) as unknown as UsageTotals;
  const out = empty();
  for (const r of records) for (const k of keys) out[k] = sum(out[k], r.totals[k]);
  return out;
}
function belongs(cwd: string, root: string): boolean {
  let current = canonical(cwd);
  if (current === root) return true;
  const rel = path.relative(root, current);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return false;
  while (current !== root) {
    if (fs.existsSync(path.join(current, ".git"))) return false;
    current = path.dirname(current);
  }
  return true;
}
function walk(dir: string, extension: string, errors: string[], out: string[] = []): string[] {
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, extension, errors, out);
      else if (e.isFile() && e.name.endsWith(extension)) out.push(p);
    }
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") errors.push(`Unreadable source directory: ${dir}`); }
  return out.sort();
}
function lines(file: string, errors: string[]): any[] {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const rows = raw.split("\n");
    return rows.flatMap((row, i) => {
      if (!row.trim()) return [];
      try { return [JSON.parse(row)]; }
      catch { errors.push(`${file}:${i + 1}: ${i === rows.length - 1 ? "incomplete" : "invalid"} JSON record`); return []; }
    });
  } catch { errors.push(`Unreadable source: ${file}`); return []; }
}

/** Full source reconciliation is intentional: replay, truncation and late records
 * cannot be hidden by a stale byte offset. The persisted report is a cache only.
 * No model API calls, transcript mutation, or estimates in this channel.
 */
export function collectUsage(projectRoot: string, options: { home?: string; claudeDir?: string; codexDir?: string; opencodeDir?: string; agent?: UsageAgent } = {}): UsageReport {
  const root = canonical(projectRoot);
  const home = options.home ?? os.homedir();
  const coverage = Object.fromEntries((["claude", "codex", "opencode"] as const).map(a => [a, { status: "unavailable", records: 0, sources: 0, diagnostics: [] }])) as unknown as Record<UsageAgent, UsageCoverage>;
  const records = new Map<string, UsageRecord>();
  const put = (r: UsageRecord) => {
    const previous = records.get(r.id);
    if (!previous || r.timestamp >= previous.timestamp) records.set(r.id, r);
  };
  if (!options.agent || options.agent === "claude") {
    const c = coverage.claude;
    const dir = options.claudeDir ?? path.join(home, ".claude", "projects", root.replace(/[^a-zA-Z0-9]/g, "-"));
    for (const file of walk(dir, ".jsonl", c.diagnostics)) {
      const rows = lines(file, c.diagnostics);
      const cwd = rows.find(r => typeof r?.cwd === "string")?.cwd;
      if (cwd && !belongs(cwd, root)) continue;
      if (!cwd && rows.some(r => r?.message?.usage)) c.diagnostics.push(`${file}: project attribution inferred from transcript directory`);
      let contributed = false;
      for (const row of rows) {
        const u = row?.message?.usage;
        if (!u || typeof u !== "object") continue;
        const mid = row.message.id;
        if (typeof mid !== "string") { c.diagnostics.push(`${file}: usage without message identity`); continue; }
        const totals = normalizeUsage("claude", u);
        if (totals.input_tokens === null || totals.output_tokens === null) c.diagnostics.push(`${file}: missing or invalid usage counters for ${mid}`);
        put({ version: 1, id: `claude:${mid}:${row.requestId ?? ""}`, agent: "claude", provider: "anthropic", model: typeof row.message.model === "string" ? row.message.model : "unknown", session_id: row.sessionId ?? path.basename(file, ".jsonl"), project_root: root, source: file, timestamp: row.timestamp ?? "", sidechain: row.isSidechain === true || file.includes(`${path.sep}subagents${path.sep}`), raw: u, totals, pricing: { service_tier: u.service_tier, input_tokens: totals.input_tokens ?? undefined, inference_geo: u.inference_geo } });
        contributed = true;
      }
      if (contributed) c.sources++;
    }
  }
  if (!options.agent || options.agent === "codex") {
    const c = coverage.codex;
    const base = options.codexDir ?? process.env.CODEX_HOME ?? path.join(home, ".codex");
    const files = options.codexDir ? walk(base, ".jsonl", c.diagnostics) : [...walk(path.join(base, "sessions"), ".jsonl", c.diagnostics), ...walk(path.join(base, "archived_sessions"), ".jsonl", c.diagnostics)];
    // Select the most complete cumulative history per session, not every replayed file.
    const sessions = new Map<string, { rows: any[]; file: string; total: number }>();
    for (const file of files) {
      const errors: string[] = [];
      const rows = lines(file, errors);
      const meta = rows.find(r => r?.type === "session_meta")?.payload;
      if (typeof meta?.cwd !== "string" || !belongs(meta.cwd, root)) continue;
      c.diagnostics.push(...errors);
      if (typeof meta.id !== "string") { c.diagnostics.push(`${file}: session identity unavailable`); continue; }
      const total = rows.reduce((max,r)=>Math.max(max,n(r?.payload?.info?.total_token_usage?.total_tokens) ?? 0),0);
      const prev = sessions.get(meta.id);
      if (!prev || total > prev.total || (total === prev.total && rows.length > prev.rows.length)) sessions.set(meta.id, { rows, file, total });
    }
    for (const [sid, { rows, file }] of sessions) {
      const meta = rows.find(r=>r?.type === "session_meta")?.payload;
      const parentId = meta?.forked_from_id ?? meta?.forkedFromId;
      const parent = typeof parentId === "string" ? sessions.get(parentId) : undefined;
      const inherited = new Set((parent?.rows ?? []).filter(r=>r?.payload?.type === "token_count" && r.payload.info?.total_token_usage).map(r=>`${r.timestamp}:${digest(r.payload.info?.total_token_usage)}`));
      if (parentId && !parent) c.diagnostics.push(`${file}: fork parent unavailable; inherited usage cannot be certified`);
      let model = "unknown";
      let serviceTier: string | undefined;
      let previous: UsageTotals = empty();
      let first = true;
      const seen = new Set<string>();
      let contributed = false;
      for (const row of rows) {
        if (row?.type === "turn_context" && typeof row.payload?.model === "string") { model = row.payload.model; serviceTier = row.payload.service_tier; }
        if (row?.payload?.type !== "token_count") continue;
        const u = row.payload.info?.total_token_usage;
        if (!u) { c.diagnostics.push(`${file}: token event without cumulative usage`); continue; }
        const totals = normalizeUsage("codex", u);
        // The historical Codex schema defines absent cache-write as zero.
        if (u.cache_write_input_tokens === undefined) totals.cache_write_tokens = 0;
        const key = digest(u);
        if (seen.has(key)) continue;
        seen.add(key);
        if (totals.total_tokens === null || totals.input_tokens === null || totals.output_tokens === null) { c.diagnostics.push(`${file}: invalid cumulative usage`); continue; }
        if (keys.some(k => totals[k] !== null && previous[k] !== null && totals[k]! < previous[k]!)) {
          c.diagnostics.push(`${file}: unexplained counter reset; session cannot be certified`);
          continue;
        }
        const delta = Object.fromEntries(keys.map(k => [k, totals[k] === null || previous[k] === null ? null : totals[k]! - previous[k]!])) as unknown as UsageTotals;
        const last = row.payload.info?.last_token_usage;
        if (inherited.has(`${row.timestamp}:${key}`)) { previous=totals; first=false; continue; }
        const attributedModel = last?.total_tokens !== delta.total_tokens ? "unknown" : model;
        if (attributedModel === "unknown") c.diagnostics.push(`${file}: model attribution unavailable for cumulative interval`);
        put({ version: 1, id: `codex:${sid}:${key}`, agent: "codex", provider: "openai", model: attributedModel, session_id: sid, project_root: root, source: file, timestamp: row.timestamp ?? "", sidechain: Boolean(rows.find(r => r?.type === "session_meta")?.payload?.source?.subagent), raw: u, totals: delta, pricing: { service_tier: serviceTier, input_tokens: n(last?.input_tokens) ?? undefined } });
        previous = totals; first = false; contributed = true;
      }
      if (contributed) c.sources++;
    }
  }
  if (!options.agent || options.agent === "opencode") {
    const c = coverage.opencode;
    const dir = options.opencodeDir ?? path.join(root, ".wolf", "usage", "opencode");
    for (const file of walk(dir, ".json", c.diagnostics)) {
      let row: any;
      try { row = JSON.parse(fs.readFileSync(file, "utf8")); } catch { c.diagnostics.push(`${file}: invalid usage record`); continue; }
      if (typeof row.directory !== "string" || !belongs(row.directory, root)) continue;
      const m = row.message;
      if (m?.role !== "assistant" || !m.tokens || typeof m.id !== "string" || typeof m.sessionID !== "string") { c.diagnostics.push(`${file}: unsupported OpenCode message shape`); continue; }
      const totals = normalizeUsage("opencode", m.tokens);
      if (totals.total_tokens === null) c.diagnostics.push(`${file}: incomplete usage fields`);
      put({ version: 1, id: `opencode:${m.sessionID}:${m.id}`, agent: "opencode", provider: typeof m.providerID === "string" ? m.providerID : "unknown", model: typeof m.modelID === "string" ? m.modelID : "unknown", session_id: m.sessionID, project_root: root, source: file, timestamp: new Date(n(m.time?.completed) ?? n(m.time?.created) ?? 0).toISOString(), sidechain: Boolean(row.parentID), raw: m.tokens, totals, pricing: { input_tokens: totals.input_tokens ?? undefined } });
      c.sources++;
    }
    if (!c.sources) c.diagnostics.push("OpenCode usage requires the installed plugin; pre-install history is not inferred from hook estimates.");
  }
  const all = [...records.values()].sort((a, b) => a.id.localeCompare(b.id));
  for (const agent of ["claude", "codex", "opencode"] as const) {
    const c = coverage[agent];
    const agentRecords=all.filter(r=>r.agent===agent);
    c.records = agentRecords.length;
    for (const r of agentRecords) {
      const t=r.totals;
      if (t.input_tokens !== null && t.cached_input_tokens !== null && t.cache_write_tokens !== null && t.cached_input_tokens+t.cache_write_tokens>t.input_tokens) c.diagnostics.push(`${r.source}: cache subsets exceed input`);
      if (t.output_tokens !== null && t.reasoning_tokens !== null && t.reasoning_tokens>t.output_tokens) c.diagnostics.push(`${r.source}: reasoning exceeds output`);
      if (t.input_tokens !== null && t.output_tokens !== null && t.total_tokens !== null && t.input_tokens+t.output_tokens!==t.total_tokens) c.diagnostics.push(`${r.source}: provider total differs from input plus output`);
    }
    c.diagnostics = [...new Set(c.diagnostics)];
    c.status = c.records ? c.diagnostics.length ? "partial" : "recorded" : "unavailable";
  }
  const group = (key: (r: UsageRecord) => string): Record<string, UsageTotals> => {
    const groups = new Map<string, UsageRecord[]>();
    for (const r of all) { const k = key(r); let group=groups.get(k); if (!group) {group=[];groups.set(k,group);} group.push(r); }
    return Object.fromEntries([...groups].map(([k, rs]) => [k, aggregate(rs)]));
  };
  return { version: 1, project_root: root, scanned_at: new Date().toISOString(), totals: aggregate(all), by_agent: group(r => r.agent), by_model: group(r => `${r.agent}:${r.provider}:${r.model}`), by_session: group(r => `${r.agent}:${r.session_id}`), coverage, records: all };
}
