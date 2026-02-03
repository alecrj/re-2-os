---
name: validate-phase
description: Run validation checkpoint for phase transition.
allowed-tools: Read, Grep, Glob, Edit
---

Run phase validation:

1. Read SOURCE_OF_TRUTH.md to get current phase
2. Read validation checkpoint doc (.claude/validation/checkpoints/CHECKPOINT-[PHASE].md)
3. For each checklist item:
   - Verify condition is met
   - Document pass/fail with evidence
4. If ALL items pass:
   - Update checkpoint doc with:
     - Date: [today]
     - Result: PASS
     - Issues: None
   - Update SOURCE_OF_TRUTH.md phase status to ✅ Complete
   - Report: READY for phase transition
5. If ANY item fails:
   - List all failures with specifics
   - Report: NOT READY
   - List exactly what needs fixing
   - Do NOT update status
