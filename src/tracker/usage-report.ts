import {updateState,installedVersion,updatePolicy} from "../hooks/runtime-updates.js";
import { reconcileReads } from "../hooks/event-journal.js";
import { reconcileBugs } from "../hooks/bug-journal.js";
import * as fs from "node:fs";
import { reconcileLedger } from "../hooks/ledger.js";
import { memoryTrust } from "../hooks/trusted-memory.js";
import { archiveMemory } from "../hooks/memory-archive.js";
import * as path from 'node:path';
import { collectUsage, type UsageAgent } from './usage.js';
import { costOfRecords } from './pricing.js';
import { writeJSON } from '../utils/fs-safe.js';

export function usageReport(root: string, agent?: UsageAgent) {
  const report = collectUsage(root, {agent});
  const costs = costOfRecords(report.records);
  // Dashboard receives counters and provenance, never conversation text.
  const {records, ...summary} = report;
  const trust = memoryTrust(root);
  let active = "";try {active=fs.readFileSync(path.join(root,".wolf","memory.md"),"utf8");} catch {}
  let archives: Array<{id:string;title:string;bytes:number;restorable:boolean}> = [];
  const archiveDir=path.join(root,".wolf","archive","memory");
  try {archives=fs.readdirSync(archiveDir).filter(n=>/^[a-f0-9]{64}\.md$/.test(n)).map(n=>{
    const content=fs.readFileSync(path.join(archiveDir,n),"utf8");const id=n.slice(0,-3);
    return {id,title:content.split("\n")[0],bytes:Buffer.byteLength(content),restorable:active.includes(`> Archived session: ${id}`)};
  });} catch {}
  return {...summary, updates:{installed:installedVersion(root),policy:updatePolicy(root),...updateState(root)}, costs, record_count: records.length, memory: {archives,trust:{status:trust.status,reason:trust.reason,approved_by:trust.approval?.approved_by,approved_at:trust.approval?.approved_at},archive_preview:archiveMemory(path.join(root,".wolf"),7,true)}};
}
export function reconcileUsage(root: string) {
  const errors:string[]=[];
  const wolf=path.join(root,".wolf");
  for (const [name,recover] of [["ledger",()=>reconcileLedger(wolf)],["bugs",()=>reconcileBugs(wolf)]] as const) {
    try {if (!recover()) errors.push(`${name}: pending observations await lock recovery`);} catch(error) {errors.push(`${name}: ${error}`);}
  }
  try {
    const sessions=path.join(wolf,"hooks","sessions");
    for (const name of fs.readdirSync(sessions).filter(n=>n.endsWith(".json.events"))) {
      if (!reconcileReads(path.join(sessions,name.slice(0,-7)))) errors.push(`reads: ${name} remains pending`);
    }
  } catch(error) {if ((error as NodeJS.ErrnoException).code !== "ENOENT") errors.push(String(error));}
  const report = {...usageReport(root),maintenance:{errors}};
  writeJSON(path.join(root,'.wolf','usage-report.json'), report);
  return report;
}
