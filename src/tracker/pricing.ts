export interface ModelUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  api_calls: number;
}

export interface ModelPrice {
  /** USD per million input tokens. */
  input: number;
  /** USD per million output tokens. */
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
  provider?: string;
  longContext?: number;
}

// Official standard USD / million-token rates, verified 2026-09-14.
export const PRICING_VERIFIED = "2026-09-14";
export const PRICING_SOURCES = [
  "https://platform.claude.com/docs/en/about-claude/pricing",
  "https://developers.openai.com/api/docs/pricing",
];
const PRICES: Array<[string, ModelPrice]> = [
  ["claude-fable-5-1", {input:10, output:50, cacheRead:0.25}],
  ["claude-mythos-5-1", {input:10, output:50, cacheRead:0.25}],
  ...["claude-fable-5", "claude-mythos-5"].map(id => [id, {input:10, output:50}] as [string, ModelPrice]),
  ...["claude-opus-5", "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6", "claude-opus-4-5"].map(id => [id, {input:5, output:25}] as [string, ModelPrice]),
  ...["claude-opus-4-1", "claude-opus-4"].map(id => [id, {input:15, output:75}] as [string, ModelPrice]),
  ["claude-sonnet-5", {input:2, output:10}],
  ...["claude-sonnet-4-6", "claude-sonnet-4-5", "claude-sonnet-4"].map(id => [id, {input:3, output:15}] as [string, ModelPrice]),
  ["claude-haiku-4-5", {input:1, output:5}],
  ["claude-haiku-3-5", {input:0.8, output:4}],
  ["gpt-6-astra", {input:10, output:50, cacheRead:1, cacheWrite:12.5, longContext:272000}],
  ["gpt-5.6-sol", {input:4, output:20, cacheRead:0.4, cacheWrite:5, longContext:272000}],
  ["gpt-5.6-terra", {input:2, output:12, cacheRead:0.2, cacheWrite:2.5, longContext:272000}],
  ["gpt-5.6-luna", {input:0.2, output:1.2, cacheRead:0.02, cacheWrite:0.25, longContext:272000}],
  ["gpt-5.6-cyber", {input:12.5, output:75, cacheRead:1.25, cacheWrite:15.625}],
  ["gpt-5.5", {input:5, output:30, cacheRead:0.5, cacheWrite:0, longContext:272000}],
  ["gpt-5.4-mini", {input:0.75,output:4.5,cacheRead:0.075,cacheWrite:0}],
  ["gpt-5.4-nano", {input:0.2,output:1.25,cacheRead:0.02,cacheWrite:0}],
  ["gpt-5.3-codex", {input:1.75,output:14,cacheRead:0.175,cacheWrite:0}],
  ["gpt-5.2-codex", {input:1.75,output:14,cacheRead:0.175,cacheWrite:0}],
  ["gpt-5.2", {input:1.75,output:14,cacheRead:0.175,cacheWrite:0}],
  ["gpt-5.2-chat-latest", {input:1.75,output:14,cacheRead:0.175,cacheWrite:0}],
  ["gpt-5.1-codex-max", {input:1.25,output:10,cacheRead:0.125,cacheWrite:0}],
  ["gpt-5.1", {input:1.25,output:10,cacheRead:0.125,cacheWrite:0}],
  ["gpt-5.1-chat-latest", {input:1.25,output:10,cacheRead:0.125,cacheWrite:0}],
  ["gpt-5-mini", {input:0.25,output:2,cacheRead:0.025,cacheWrite:0}],
  ["gpt-5-nano", {input:0.05,output:0.4,cacheRead:0.005,cacheWrite:0}],
  ["gpt-5.5-pro", {input:30,output:180,cacheRead:30,cacheWrite:0}],
  ["gpt-5.2-pro", {input:21,output:168,cacheRead:21,cacheWrite:0}],
  ["gpt-5-pro", {input:15,output:120,cacheRead:15,cacheWrite:0}],
  ["gpt-5", {input:1.25,output:10,cacheRead:0.125,cacheWrite:0}],
  ["gpt-5.4-pro", {input:30,output:180,cacheRead:30,cacheWrite:0,longContext:272000}],
  ["gpt-5.1-codex", {input:1.25,output:10,cacheRead:0.125,cacheWrite:0}],
  ["gpt-5.1-codex-mini", {input:0.25,output:2,cacheRead:0.025,cacheWrite:0}],
  ["gpt-5.3-chat-latest", {input:1.75,output:14,cacheRead:0.175,cacheWrite:0}],
  ["gpt-5.4", {input:2.5, output:15, cacheRead:0.25, cacheWrite:0, longContext:272000}],
];

/** Cache reads bill at ~0.1x the model's input rate. */
export const CACHE_READ_MULTIPLIER = 0.1;
/** Writing to the 5-minute ephemeral cache bills at ~1.25x the input rate. */
export const CACHE_WRITE_MULTIPLIER = 1.25;

export function priceFor(model: string): ModelPrice | null {
  const id = model.toLowerCase();
  let best: ModelPrice | null = null;
  let bestLen = -1;
  for (const [prefix, price] of PRICES) {
    if ((id === prefix || (id.startsWith(prefix + "-") && /^\d{4}-?\d{2}-?\d{2}$/.test(id.slice(prefix.length + 1)))) && prefix.length > bestLen) {
      best = price;
      bestLen = prefix.length;
    }
  }
  return best;
}

export interface CostBreakdown {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

const ZERO: CostBreakdown = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };

export function costOf(usage: ModelUsage, price: ModelPrice): CostBreakdown {
  const input = ((usage.input_tokens ?? 0) * price.input) / 1_000_000;
  const output = ((usage.output_tokens ?? 0) * price.output) / 1_000_000;
  const cacheRead = ((usage.cache_read_input_tokens ?? 0) * (price.cacheRead ?? price.input * CACHE_READ_MULTIPLIER)) / 1_000_000;
  const cacheWrite = ((usage.cache_creation_input_tokens ?? 0) * (price.cacheWrite ?? price.input * CACHE_WRITE_MULTIPLIER)) / 1_000_000;
  return { input, output, cacheRead, cacheWrite, total: input + output + cacheRead + cacheWrite };
}

export interface ProjectCost extends CostBreakdown {
  /** Per-model rows, most expensive first. Unpriced models are excluded. */
  byModel: Array<{ model: string; usage: ModelUsage; cost: CostBreakdown }>;
  /** Models with usage but no known price. Their tokens are NOT in the total. */
  unpriced: string[];
  /** True when at least one model was priced, i.e. the total means something. */
  priced: boolean;
}

/**
 * Price a whole project from its per-model usage map.
 *
 * `<synthetic>` and any other non-model key are skipped: synthetic entries are
 * transcript bookkeeping with zero token counts, not billable calls.
 */
export function costOfProject(perModel: Record<string, ModelUsage> | undefined): ProjectCost {
  const rows: ProjectCost["byModel"] = [];
  const unpriced: string[] = [];
  const acc: CostBreakdown = { ...ZERO };

  for (const [model, usage] of Object.entries(perModel ?? {})) {
    if (!usage) continue;
    const tokens =
      (usage.input_tokens ?? 0) +
      (usage.output_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0);
    if (tokens === 0) continue;
    const price = priceFor(model);
    if (!price) {
      unpriced.push(model);
      continue;
    }
    const cost = costOf(usage, price);
    rows.push({ model, usage, cost });
    acc.input += cost.input;
    acc.output += cost.output;
    acc.cacheRead += cost.cacheRead;
    acc.cacheWrite += cost.cacheWrite;
    acc.total += cost.total;
  }

  rows.sort((a, b) => b.cost.total - a.cost.total);
  return { ...acc, byModel: rows, unpriced, priced: rows.length > 0 };
}

/** "$84.12", "$1.20", "$0.04", "<$0.01" — never scientific notation. */
export function formatUsd(amount: number): string {
  if (!isFinite(amount) || amount <= 0) return "$0.00";
  if (amount < 0.01) return "<$0.01";
  if (amount >= 1000) return `$${Math.round(amount).toLocaleString("en-US")}`;
  return `$${amount.toFixed(2)}`;
}

export interface PricedRecord {
  agent: string; provider: string; model: string; session_id: string;
  totals: {input_tokens: number | null; output_tokens: number | null; cached_input_tokens: number | null; cache_write_tokens: number | null};
  raw: Record<string, any>;
  pricing?: {service_tier?: string; input_tokens?: number; inference_geo?: string};
}
/** Current list-price equivalent, never an invoice. Missing metadata is disclosed. */
export function costOfRecords(records: PricedRecord[]): ProjectCost & { assumptions: string[] } {
  const acc: CostBreakdown = {...ZERO};
  const rows = new Map<string, ProjectCost['byModel'][number]>();
  const unpriced = new Set<string>();
  const assumptions = new Set<string>();
  const longSessions = new Set(records.filter(r => /^gpt-5\.[45](?:-|$)/.test(r.model) && priceFor(r.model)?.longContext && (r.pricing?.input_tokens ?? 0) > 272000).map(r => r.agent + ':' + r.session_id + ':' + r.model));
  for (const r of records) {
    const key = `${r.agent}/${r.provider}/${r.model}`;
    const p = priceFor(r.model);
    const t = r.totals;
    const expectedProvider = r.model.startsWith('claude-') ? 'anthropic' : 'openai';
    if (!p || r.provider !== expectedProvider ||
        [t.input_tokens,t.output_tokens,t.cached_input_tokens,t.cache_write_tokens].some(n => n === null || !Number.isSafeInteger(n) || n < 0)) { unpriced.add(key); continue; }
    if (/^claude-(?:sonnet|opus)-4(?:-|$)/.test(r.model) && !/^claude-(?:sonnet|opus)-4-[678](?:-|$)/.test(r.model) && (r.pricing?.input_tokens ?? 0)>200000) {unpriced.add(key);assumptions.add('Legacy Claude extended-context rate is not verified.');continue;}
    const fresh = t.input_tokens! - t.cached_input_tokens! - t.cache_write_tokens!;
    if (fresh < 0 || (t.cache_write_tokens! > 0 && p.cacheWrite === 0)) { unpriced.add(key); continue; }
    const price = {...p};
    const tier = r.pricing?.service_tier;
    let multiplier = 1;
    if (!tier) assumptions.add('Service tier not recorded: standard rates assumed.');
    else if (tier === 'batch' || (tier === 'flex' && expectedProvider === 'openai')) multiplier = 0.5;
    else if (tier === 'priority' || tier === 'fast') {
      if (/^gpt-(6-astra|5\.6-)/.test(r.model) || /^claude-opus-(5|4-8)$/.test(r.model)) multiplier = 2;
      else { unpriced.add(key); continue; }
    } else if (!['standard','default','auto'].includes(tier)) { unpriced.add(key); continue; }
    if (price.longContext && (r.pricing?.input_tokens ?? 0) > price.longContext || longSessions.has(r.agent + ':' + r.session_id + ':' + r.model)) {
      price.input *= 2; price.output *= 1.5;
      if (price.cacheRead !== undefined) price.cacheRead *= 2;
      if (price.cacheWrite !== undefined) price.cacheWrite *= 2;
    } else if (price.longContext && r.pricing?.input_tokens === undefined) assumptions.add('Request context size missing: short-context rates assumed.');
    if (r.pricing?.inference_geo && r.pricing.inference_geo !== 'global') multiplier *= 1.1;
    const usage = {input_tokens:fresh, output_tokens:t.output_tokens!, cache_read_input_tokens:t.cached_input_tokens!, cache_creation_input_tokens:t.cache_write_tokens!, api_calls:1};
    const cost = costOf(usage, price);
    if (expectedProvider === 'anthropic' && t.cache_write_tokens! > 0) {
      const hour = r.raw.cache_creation?.ephemeral_1h_input_tokens;
      if (Number.isSafeInteger(hour) && hour >= 0 && hour <= t.cache_write_tokens!) {
        cost.cacheWrite += hour * price.input * 0.75 / 1e6;
        cost.total = cost.input + cost.output + cost.cacheRead + cost.cacheWrite;
      } else assumptions.add('Cache duration missing: 5-minute writes assumed.');
    }
    for (const k of Object.keys(acc) as Array<keyof CostBreakdown>) {cost[k] *= multiplier; acc[k] += cost[k];}
    const row = rows.get(key) ?? {model:key,usage:{input_tokens:0,output_tokens:0,cache_read_input_tokens:0,cache_creation_input_tokens:0,api_calls:0},cost:{...ZERO}};
    for (const k of Object.keys(usage) as Array<keyof ModelUsage>) row.usage[k] += usage[k];
    for (const k of Object.keys(acc) as Array<keyof CostBreakdown>) row.cost[k] += cost[k];
    rows.set(key,row);
  }
  assumptions.add(`Current rates verified ${PRICING_VERIFIED}; taxes, tool fees, negotiated discounts and subscription bills excluded.`);
  return {...acc,byModel:[...rows.values()].sort((a,b)=>b.cost.total-a.cost.total),unpriced:[...unpriced],priced:rows.size>0,assumptions:[...assumptions]};
}
