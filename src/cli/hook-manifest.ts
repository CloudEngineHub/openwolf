// Single source of truth for which hook scripts exist and how they are
// registered in Claude Code settings. init.ts and update.ts both consume this
// so the two can never drift (they used to carry hand-mirrored copies).

// Use $CLAUDE_PROJECT_DIR so hooks resolve correctly even if CWD changes during a session
const cmd = (file: string, timeout: number) => ({
  type: "command" as const,
  command: `node "$CLAUDE_PROJECT_DIR/.wolf/hooks/${file}"`,
  timeout,
});

export const HOOK_SETTINGS = {
  hooks: {
    SessionStart: [{ matcher: "", hooks: [cmd("session-start.js", 5)] }],
    UserPromptSubmit: [{ matcher: "", hooks: [cmd("user-prompt-submit.js", 5)] }],
    PreToolUse: [
      { matcher: "Read", hooks: [cmd("pre-read.js", 5)] },
      { matcher: "Write|Edit|MultiEdit", hooks: [cmd("pre-write.js", 5)] },
    ],
    PostToolUse: [
      { matcher: "Read", hooks: [cmd("post-read.js", 5)] },
      { matcher: "Write|Edit|MultiEdit", hooks: [cmd("post-write.js", 10)] },
    ],
    PreCompact: [{ matcher: "", hooks: [cmd("precompact.js", 5)] }],
    Stop: [{ matcher: "", hooks: [cmd("stop.js", 10)] }],
  },
};

export type HookSettings = typeof HOOK_SETTINGS;

/** Compiled hook scripts installed into <project>/.wolf/hooks/. */
export const HOOK_FILES = [
  "session-start.js",
  "user-prompt-submit.js",
  "pre-read.js",
  "pre-write.js",
  "post-read.js",
  "post-write.js",
  "precompact.js",
  "stop.js",
  "shared.js",
  "anatomy-store.js",
  "anatomy-lock.js",
  "symbol-extractor.js",
];
