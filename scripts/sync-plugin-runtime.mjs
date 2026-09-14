// Generated plugin helpers have the exact same implementation as standalone hooks.
import { copyFileSync } from 'node:fs';
for (const name of ['anatomy-lock', 'bug-id', 'trusted-memory', 'shared', 'ledger', 'ledger-math', 'knowledge-root', 'bug-journal', 'session-state', 'event-journal', 'runtime-updates', 'handoff-state', 'visibility']) {
  copyFileSync(new URL(`../src/hooks/${name}.ts`, import.meta.url), new URL(`../src/templates/opencode-plugin/${name}.ts`, import.meta.url));
}

copyFileSync(new URL('../src/tracker/pricing.ts', import.meta.url), new URL('../src/dashboard/app/lib/pricing.ts', import.meta.url));
