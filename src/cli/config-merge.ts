/**
 * Config deep-merge: bring an existing project's .wolf/config.json up to date
 * with the shipped template by ADDING missing keys only.
 *
 * config.json is user data (ports, budgets, exclude patterns), so update/init
 * must never overwrite an existing value — but new releases add new config
 * blocks (e.g. openwolf.reads.duplicate_mode), and without a merge an upgraded
 * project can never discover them.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

type JsonObject = Record<string, unknown>;

// Self-contained JSON IO (mirrors utils/fs-safe.ts) so this module has no
// value imports and tests can load it straight from source.
function readJSONFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function writeJSONFile(filePath: string, data: unknown): void {
  const tmp = filePath + "." + crypto.randomBytes(4).toString("hex") + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, filePath);
  } catch {
    // On Windows, rename can fail if another process holds a handle.
    try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8"); } catch {}
    try { fs.unlinkSync(tmp); } catch {}
  }
}

function isPlainObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Copy keys from `defaults` into `target` when `target` lacks them; recurse
 * into objects present on both sides. Existing values (including arrays and
 * user-emptied strings/numbers) are never touched — arrays are leaves, since
 * merging into a customized exclude_patterns list would resurrect entries the
 * user deliberately removed.
 *
 * Returns true if `target` was modified.
 */
export function deepMergeMissing(target: JsonObject, defaults: JsonObject): boolean {
  let changed = false;
  for (const [key, defVal] of Object.entries(defaults)) {
    if (!(key in target)) {
      target[key] = structuredClone(defVal);
      changed = true;
    } else if (isPlainObject(target[key]) && isPlainObject(defVal)) {
      if (deepMergeMissing(target[key] as JsonObject, defVal)) changed = true;
    }
    // Present but different shape/value: user's value wins, leave it alone.
  }
  return changed;
}

/**
 * Merge the shipped template config into an existing project config, adding
 * missing keys only. No-op (returns false) when the project config does not
 * exist, the template is unreadable, or nothing was missing.
 */
export function mergeConfigDefaults(cfgPath: string, templatesDir: string): boolean {
  if (!fs.existsSync(cfgPath)) return false;
  const template = readJSONFile(path.join(templatesDir, "config.json"));
  if (!isPlainObject(template) || Object.keys(template).length === 0) return false;
  const cfg = readJSONFile(cfgPath);
  if (!isPlainObject(cfg)) return false;
  if (!deepMergeMissing(cfg, template)) return false;
  writeJSONFile(cfgPath, cfg);
  return true;
}
