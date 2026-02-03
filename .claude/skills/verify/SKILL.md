---
name: verify
description: Run verification checks on code and docs.
allowed-tools: Read, Grep, Glob, Bash
---

Run verification:

1. If package.json exists:
   - Run npm test (if configured)
   - Run npm run lint (if configured)
   - Run npm run typecheck (if configured)
   - Report results

2. Check documentation:
   - Scan for TODO/TBD markers in docs/
   - Verify docs/INDEX.md is current
   - Check for any .md files outside allowed locations

3. Check structure:
   - Verify no unauthorized .md files exist

4. Report summary:
   - Tests: [X passed / Y failed] or [not configured]
   - Lint: [clean / X issues] or [not configured]
   - Types: [clean / X errors] or [not configured]
   - Docs: [current / stale items found]
   - Structure: [clean / issues found]
   - Overall: PASS / FAIL
