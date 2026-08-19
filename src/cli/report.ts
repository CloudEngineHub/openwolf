import * as path from "node:path";
import { findProjectRoot } from "../scanner/project-root.js";
import { readJSON } from "../utils/fs-safe.js";
import { scanProjectUsage } from "../tracker/transcript-usage.js";

// `openwolf report` — Workstream F1: the verifiable-numbers view.
// Estimated figures come from OpenWolf's char-ratio heuristics; real figures
// come from the harness transcripts (message usage summed by the stop hook).

interface RealUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  api_calls: number;
}

interface Ledger {
  lifetime: Record<string, number>;
  sessions: Array<{
    id: string;
    ended: string;
    totals: { input_tokens_estimated: number; output_tokens_estimated: number; reads_count: number; writes_count: number };
    real_usage?: RealUsage;
  }>;
}

const fmt = (n: number | undefined): string => (n ?? 0).toLocaleString("en-US");

export function reportCommand(): void {
  const projectRoot = findProjectRoot();
  const ledger = readJSON<Ledger>(path.join(projectRoot, ".wolf", "token-ledger.json"), {
    lifetime: {}, sessions: [],
  });
  const lt = ledger.lifetime;

  console.log("");
  console.log("  OpenWolf token report");
  console.log("  ─────────────────────");
  // Measured numbers lead: they come from the harness's own per-message
  // usage records and are the only figures worth trusting. Estimates follow,
  // clearly labeled as heuristics.
  //
  // Ground truth first (J1): a live scan of every transcript in the harness's
  // project directory, including subagent sidechains and headless runs the
  // Stop hook never saw.
  let scannedLive = false;
  try {
    const measured = scanProjectUsage(projectRoot);
    if (measured) {
      scannedLive = true;
      console.log("  Measured (all project transcripts, scanned now)");
      console.log(`    API calls:              ${fmt(measured.api_calls)}`);
      console.log(`    Input tokens:           ${fmt(measured.input_tokens)}`);
      console.log(`    Output tokens:          ${fmt(measured.output_tokens)}`);
      console.log(`    Cache reads:            ${fmt(measured.cache_read_input_tokens)}`);
      console.log(`    Cache writes:           ${fmt(measured.cache_creation_input_tokens)}`);
      if (measured.sidechain.api_calls > 0) {
        console.log(`    Subagent share:         in ${fmt(measured.sidechain.input_tokens)} | out ${fmt(measured.sidechain.output_tokens)} (${fmt(measured.sidechain.api_calls)} calls)`);
      }
      const models = Object.entries(measured.by_model);
      if (models.length > 1) {
        for (const [model, m] of models.sort((a, b) => b[1].output_tokens - a[1].output_tokens)) {
          console.log(`    ${model}: in ${fmt(m.input_tokens)} | out ${fmt(m.output_tokens)} | cache-read ${fmt(m.cache_read_input_tokens)}`);
        }
      }
    }
  } catch {}
  if (!scannedLive && lt.real_api_calls) {
    console.log("  Measured (from harness transcripts at session end)");
    console.log(`    API calls:              ${fmt(lt.real_api_calls)}`);
    console.log(`    Input tokens:           ${fmt(lt.real_input_tokens)}`);
    console.log(`    Output tokens:          ${fmt(lt.real_output_tokens)}`);
    console.log(`    Cache reads:            ${fmt(lt.real_cache_read_tokens)}`);
    console.log(`    Cache writes:           ${fmt(lt.real_cache_creation_tokens)}`);
  } else if (!scannedLive) {
    console.log("  Measured usage: none found yet — transcripts are scanned from");
    console.log("  the harness project directory and at session end by the Stop hook.");
  }
  console.log("");
  console.log(`  Sessions:                 ${fmt(lt.total_sessions)}`);
  console.log(`  Reads / writes:           ${fmt(lt.total_reads)} / ${fmt(lt.total_writes)}`);
  console.log(`  Anatomy hits / misses:    ${fmt(lt.anatomy_hits)} / ${fmt(lt.anatomy_misses)}`);
  console.log(`  Duplicate reads warned:   ${fmt(lt.repeated_reads_warned)}`);
  console.log(`  Duplicate reads denied:   ${fmt(lt.repeated_reads_blocked)}`);
  console.log("");
  console.log("  Estimated (char-ratio heuristic; treat as rough)");
  console.log(`    Total tokens tracked:   ${fmt(lt.total_tokens_estimated)}`);
  console.log(`    Saved by denied reads:  ${fmt(lt.estimated_savings_vs_bare_cli)}`);
  console.log(`    OpenWolf injected:      ${fmt(lt.injection_tokens_estimated)} (digests, hints, warnings)`);

  const withReal = ledger.sessions.filter((s) => s.real_usage);
  if (withReal.length > 0) {
    console.log("");
    console.log("  Last sessions (measured)");
    for (const s of withReal.slice(-5)) {
      const r = s.real_usage!;
      console.log(`    ${s.ended?.slice(0, 16) ?? "?"}  in ${fmt(r.input_tokens)} | out ${fmt(r.output_tokens)} | cache-read ${fmt(r.cache_read_input_tokens)} (${r.api_calls} calls)`);
    }
  }
  console.log("");
}
