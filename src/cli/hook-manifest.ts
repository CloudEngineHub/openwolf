// Single source of truth for which hook scripts exist and how they are
// registered in Claude Code settings. init.ts and update.ts both consume this
// so the two can never drift (they used to carry hand-mirrored copies).

// Use the CLAUDE_PROJECT_DIR env var so hooks resolve correctly even if CWD
// changes during a session. The expansion syntax is platform-specific:
// $VAR never expands under cmd.exe, which silently disabled all hooks for
// Windows installs. Settings are generated per machine at init/update time,
// so baking in the local platform's syntax is safe.
const PROJECT_DIR_VAR = process.platform === "win32" ? "%CLAUDE_PROJECT_DIR%" : "$CLAUDE_PROJECT_DIR";
const cmd = (file: string, timeout: number) => ({
  type: "command" as const,
  command: `node "${PROJECT_DIR_VAR}/.wolf/hooks/${file}"`,
  timeout,
});

export const HOOK_SETTINGS = {
  hooks: {
    SessionStart: [{ matcher: "", hooks: [cmd("session-start.js", 5)] }],
    UserPromptSubmit: [{ matcher: "", hooks: [cmd("user-prompt-submit.js", 5)] }],
    PreToolUse: [
      { matcher: "Read", hooks: [cmd("pre-read.js", 5)] },
      { matcher: "Write|Edit|MultiEdit", hooks: [cmd("pre-write.js", 5)] },
      { matcher: "Bash", hooks: [cmd("pre-bash.js", 5)] },
    ],
    PostToolUse: [
      { matcher: "Read", hooks: [cmd("post-read.js", 5)] },
      { matcher: "Write|Edit|MultiEdit", hooks: [cmd("post-write.js", 10)] },
      { matcher: "Bash", hooks: [cmd("post-bash.js", 10)] },
    ],
    PreCompact: [{ matcher: "", hooks: [cmd("precompact.js", 5)] }],
    Stop: [{ matcher: "", hooks: [cmd("stop.js", 10)] }],
    SessionEnd: [{ matcher: "", hooks: [cmd("session-end.js", 10)] }],
  },
};

export type HookSettings = typeof HOOK_SETTINGS;

/** Compiled hook scripts installed into <project>/.wolf/hooks/. */
export const HOOK_FILES = [
  "session-start.js",
  "user-prompt-submit.js",
  "pre-read.js",
  "pre-write.js",
  "pre-bash.js",
  "post-bash.js",
  "bash-filter.js",
  "bash-output-governor.js",
  "bash-path-parser.js",
  "post-read.js",
  "post-write.js",
  "precompact.js",
  "stop.js",
  "session-end.js",
  "ledger.js",
  "ledger-math.js",
  "shared.js",
  "bug-index.js",
  "hook-attachments.js",
  "anatomy-store.js",
  "anatomy-lock.js",
  "symbol-extractor.js",
];
