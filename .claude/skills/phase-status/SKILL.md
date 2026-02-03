---
name: phase-status
description: Show current phase status and next actions. Run at start of every session.
allowed-tools: Read, Grep, Glob
---

Report current status:

1. Read SOURCE_OF_TRUTH.md
2. Read current phase doc (.claude/phases/PHASE-X-*.md)
3. List active subtasks from .claude/subtasks/active/
4. Check agent progress files
5. Report:
   - Current phase and status
   - Active subtasks (ID, title, owner, status)
   - Blocked items
   - Next recommended actions
   - Validation checkpoint status
