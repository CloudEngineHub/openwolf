import type { RealUsage } from "./shared.js";

// ─────────────────────────────────────────────────────────────────────────────
// Pure token-ledger math: types, folds, lifetime derivation, migrations.
// Deliberately free of value imports so tests (and any consumer) can load it
// straight from source under Node's type stripping. IO and session assembly
// live in ledger.ts.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_LEDGER_SESSIONS = 200;

export interface SessionFileRead {
  count: number;
  tokens: number;
  first_read: string;
  read_mtime?: number;
  anatomy_hit?: boolean;
}

export interface SessionData {
  session_id: string;
  started: string;
  files_read: Record<string, SessionFileRead>;
  files_written: Array<{ file: string; action: string; tokens: number; at: string }>;
  edit_counts: Record<string, number>;
  anatomy_hits: number;
  anatomy_misses: number;
  repeated_reads_warned: number;
  reads_denied?: number;
  denied_tokens_saved?: number;
  cerebrum_warnings: number;
  stop_count: number;
  reminders_sent: Record<string, number>;
  pending_reminders?: string[];
  [key: string]: unknown;
}

export interface SessionEntry {
  id: string;
  agent: string;
  started: string;
  ended: string;
  reads: Array<{
    file: string;
    tokens_estimated: number;
    was_repeated: boolean;
    anatomy_had_description: boolean;
  }>;
  writes: Array<{ file: string; tokens_estimated: number; action: string }>;
  totals: {
    input_tokens_estimated: number;
    output_tokens_estimated: number;
    reads_count: number;
    writes_count: number;
    repeated_reads_blocked: number;
    repeated_reads_warned?: number;
    anatomy_lookups: number;
    anatomy_misses?: number;
    savings_estimated?: number;
  };
  real_usage?: RealUsage;
}

export interface LifetimeTotals {
  total_tokens_estimated: number;
  total_reads: number;
  total_writes: number;
  total_sessions: number;
  anatomy_hits: number;
  anatomy_misses: number;
  repeated_reads_blocked: number;
  repeated_reads_warned: number;
  estimated_savings_vs_bare_cli: number;
  [key: string]: number;
}

export interface LedgerData {
  version: number;
  created_at: string;
  lifetime: LifetimeTotals;
  /** Totals folded out of sessions that were rolled off the retained window. */
  lifetime_baseline?: Partial<LifetimeTotals>;
  sessions: SessionEntry[];
  [key: string]: unknown;
}

export function emptyLedger(): LedgerData {
  return {
    version: 1,
    created_at: "",
    lifetime: {
      total_tokens_estimated: 0,
      total_reads: 0,
      total_writes: 0,
      total_sessions: 0,
      anatomy_hits: 0,
      anatomy_misses: 0,
      repeated_reads_blocked: 0,
      repeated_reads_warned: 0,
      estimated_savings_vs_bare_cli: 0,
    },
    sessions: [],
    daemon_usage: [],
    waste_flags: [],
    optimization_report: { last_generated: null, patterns: [] },
  };
}

/** The totals block of a session entry, derived from live session state. */
export function buildSessionTotals(
  session: SessionData,
  reads: SessionEntry["reads"],
  writes: SessionEntry["writes"]
): SessionEntry["totals"] {
  return {
    input_tokens_estimated: reads.reduce((sum, r) => sum + r.tokens_estimated, 0),
    output_tokens_estimated: writes.reduce((sum, w) => sum + w.tokens_estimated, 0),
    reads_count: reads.length,
    writes_count: writes.length,
    // Honest accounting: only reads the hook actually denied count as
    // blocked (warnings do not prevent the read from happening).
    repeated_reads_blocked: session.reads_denied ?? 0,
    repeated_reads_warned: session.repeated_reads_warned ?? 0,
    anatomy_lookups: session.anatomy_hits,
    anatomy_misses: session.anatomy_misses,
    // Honest savings: tokens of reads that were denied, nothing else.
    savings_estimated: session.denied_tokens_saved ?? 0,
  };
}

export function addInto(target: Record<string, number>, key: string, value: number | undefined): void {
  if (typeof value !== "number" || !isFinite(value)) return;
  target[key] = (target[key] ?? 0) + value;
}

/** Copy only real numeric fields out of a possibly-partial totals object. */
export function numericFields(source: Record<string, number | undefined> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(source ?? {})) {
    if (typeof v === "number" && isFinite(v)) out[k] = v;
  }
  return out;
}

export function foldEntry(acc: Record<string, number>, e: SessionEntry): void {
  addInto(acc, "total_tokens_estimated", e.totals.input_tokens_estimated + e.totals.output_tokens_estimated);
  addInto(acc, "total_reads", e.totals.reads_count);
  addInto(acc, "total_writes", e.totals.writes_count);
  addInto(acc, "anatomy_hits", e.totals.anatomy_lookups);
  addInto(acc, "anatomy_misses", e.totals.anatomy_misses);
  addInto(acc, "repeated_reads_blocked", e.totals.repeated_reads_blocked);
  addInto(acc, "repeated_reads_warned", e.totals.repeated_reads_warned);
  addInto(acc, "estimated_savings_vs_bare_cli", e.totals.savings_estimated);
  if (e.real_usage) {
    addInto(acc, "real_input_tokens", e.real_usage.input_tokens);
    addInto(acc, "real_output_tokens", e.real_usage.output_tokens);
    addInto(acc, "real_cache_read_tokens", e.real_usage.cache_read_input_tokens);
    addInto(acc, "real_cache_creation_tokens", e.real_usage.cache_creation_input_tokens);
    addInto(acc, "real_api_calls", e.real_usage.api_calls);
  }
}

/**
 * Derive lifetime = baseline + fold(sessions). total_sessions is intentionally
 * NOT derived here — session-start counts it once per new session.
 */
export function recomputeLifetime(ledger: LedgerData): void {
  const acc = numericFields(ledger.lifetime_baseline);
  delete acc.total_sessions;
  for (const e of ledger.sessions) foldEntry(acc, e);
  const totalSessions = ledger.lifetime?.total_sessions ?? 0;
  ledger.lifetime = {
    total_tokens_estimated: 0,
    total_reads: 0,
    total_writes: 0,
    anatomy_hits: 0,
    anatomy_misses: 0,
    repeated_reads_blocked: 0,
    repeated_reads_warned: 0,
    estimated_savings_vs_bare_cli: 0,
    ...acc,
    total_sessions: totalSessions,
  } as LifetimeTotals;
}

/**
 * One-time legacy migration: sessions written before 2.0.5 stored the number
 * of duplicate-read WARNINGS in totals.repeated_reads_blocked (the field
 * predates deny mode). Under the current semantics a blocked read always
 * credits savings_estimated > 0 (a denial saves the previous read's tokens,
 * and denyEligible requires tokens > 0), so blocked > 0 with zero savings can
 * only be legacy data. Move those counts to repeated_reads_warned and zero
 * the blocked field. Also migrates the lifetime_baseline, which may hold
 * folded-off legacy sessions. Returns the number of records rewritten.
 * Caller is responsible for recomputeLifetime() and persisting.
 */
export function migrateLegacyBlockedCounts(ledger: LedgerData): number {
  let migrated = 0;
  for (const s of ledger.sessions ?? []) {
    const t = s?.totals;
    if (!t) continue;
    if ((t.repeated_reads_blocked ?? 0) > 0 && !((t.savings_estimated ?? 0) > 0)) {
      t.repeated_reads_warned = (t.repeated_reads_warned ?? 0) + t.repeated_reads_blocked;
      t.repeated_reads_blocked = 0;
      migrated++;
    }
  }
  const base = ledger.lifetime_baseline;
  if (
    base &&
    (base.repeated_reads_blocked ?? 0) > 0 &&
    !((base.estimated_savings_vs_bare_cli ?? 0) > 0)
  ) {
    base.repeated_reads_warned = (base.repeated_reads_warned ?? 0) + (base.repeated_reads_blocked ?? 0);
    base.repeated_reads_blocked = 0;
    migrated++;
  }
  return migrated;
}
