---
name: subtask-complete
description: Mark subtask complete with validation. Only marks done if ALL criteria pass.
allowed-tools: Read, Grep, Glob, Edit
argument-hint: [subtask-id]
---

Complete subtask $ARGUMENTS:

1. Read subtask doc from .claude/subtasks/active/SUBTASK-[ID]-*.md
2. For each acceptance criterion:
   - Check if met
   - Document evidence
3. If ALL criteria met:
   - Update subtask status to ✅ Complete
   - Move file to .claude/subtasks/completed/
   - Update SOURCE_OF_TRUTH.md (move to completed table)
   - Update owner's progress file
   - Report: COMPLETE with evidence for each criterion
4. If ANY criterion NOT met:
   - Report: INCOMPLETE
   - List what's missing with specifics
   - Do NOT change status
   - Do NOT move file
