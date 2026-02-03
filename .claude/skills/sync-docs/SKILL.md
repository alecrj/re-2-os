---
name: sync-docs
description: Reconcile all docs and update SOURCE_OF_TRUTH.md. Run at end of every session.
allowed-tools: Read, Grep, Glob, Edit
---

Sync all documentation:

1. Read SOURCE_OF_TRUTH.md
2. Scan .claude/subtasks/active/ for current subtask status
3. Scan .claude/progress/ for agent status
4. Check docs/ for any changes
5. Update SOURCE_OF_TRUTH.md:
   - Verify active subtasks list is current
   - Update Last Updated timestamp
   - Check for any blocking issues
6. Update docs/INDEX.md:
   - Verify all docs listed
   - Update timestamps for changed docs
7. Check for contradictions between docs
8. Report:
   - What was synced
   - Any issues found
   - Current state summary
