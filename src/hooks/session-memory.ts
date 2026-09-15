import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import {appendMarkdown} from './shared.js';
export function sessionMemoryPath(wolfDir: string, id: string): string {
  return path.join(wolfDir,'session-memory',crypto.createHash('sha256').update(id).digest('hex')+'.md');
}
export function logSessionMemory(wolfDir: string, id: string, summary: string, files: string, outcome: string): void {
  if (!id.trim() || !summary.trim()) throw new Error('Session id and a meaningful summary are required');
  const clean = (s: string) => s.replace(/[\r\n|]/g,' ').slice(0,4000);
  const line = `| ${new Date().toISOString()} | ${clean(summary)} | ${clean(files)} | ${clean(outcome)} |\n`;
  // The sidecar is the source of semantic completion, independent of which
  // concurrent session happened to append the most recent global heading.
  appendMarkdown(sessionMemoryPath(wolfDir,id),line);
  appendMarkdown(path.join(wolfDir,'memory.md'),`<!-- session:${Buffer.from(id).toString('base64url')} -->\n${line}`);
}
export function semanticSessionEntries(wolfDir: string, id: string): number {
  try { return fs.readFileSync(sessionMemoryPath(wolfDir,id),'utf8').split('\n').filter(l => l.startsWith('|')).length; }
  catch { return 0; }
}
