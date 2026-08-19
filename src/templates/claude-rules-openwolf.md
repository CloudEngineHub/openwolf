---
description: OpenWolf protocol enforcement, active on all files
globs: **/*
---

- Before reading an unfamiliar project file, grep .wolf/anatomy.md for its path (one-line description + token estimate). Never read anatomy.md whole; it is an index.
- Check .wolf/cerebrum.md Do-Not-Repeat list before generating code; after a user correction, update cerebrum.md immediately.
- Do NOT manually update .wolf/anatomy.md or .wolf/memory.md; the OpenWolf hooks maintain them.
- BEFORE fixing any bug: grep .wolf/buglog.json for the error message or filename. AFTER fixing one: log it there (error_message, root_cause, fix, tags).
- When resuming a session, read .wolf/STATUS.md first; regenerate it with /handoff when a quest finishes.
