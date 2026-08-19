// Pure classifier for the PreToolUse[Bash] output filter (Workstream J3).
// Dependency-free so tests can load it straight from source; the hook logic
// lives in pre-bash.ts.

// Exact prefixes of commands whose output is routinely huge. A command
// qualifies only when it *starts with* one of these, followed by end-of-string
// or a space (so "npm test" matches, "npm testify" does not).
export const VERBOSE_PREFIXES = [
  "npm test", "npm run test", "npm run build",
  "pnpm test", "pnpm run test", "pnpm run build", "pnpm build",
  "yarn test", "yarn build",
  "npx jest", "npx vitest run", "npx tsc",
  "pytest", "python -m pytest",
  "go test", "go build",
  "cargo test", "cargo build",
  "tsc", "tsc --noEmit",
  "make", "make test", "make build",
  "gradle build", "gradle test", "./gradlew build", "./gradlew test",
  "mvn test", "mvn package",
];

// Any shell metacharacter or existing output management means the user (or
// model) already shaped this command — never second-guess it.
const DISQUALIFIERS = /[|><;&`$]|\btail\b|\bhead\b|\bgrep\b|--silent|--quiet|-q\b/;

/** Should this command get an output-capping suggestion? */
export function shouldSuggestFilter(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed || DISQUALIFIERS.test(trimmed)) return false;
  return VERBOSE_PREFIXES.some(
    (p) => trimmed === p || trimmed.startsWith(p + " ")
  );
}
