---
name: adr
description: Create Architecture Decision Record for significant decisions.
allowed-tools: Read, Glob, Write, Edit
argument-hint: [decision-title]
---

Create ADR for: $ARGUMENTS

1. Find next ADR number by scanning docs/decisions/
2. Create docs/decisions/ADR-[NNNN]-[slug].md:

   # ADR-[NNNN]: $ARGUMENTS

   ## Status
   Proposed

   ## Context
   [Why this decision is needed - what problem are we solving?]

   ## Options Considered

   ### Option A: [name]
   - Pros:
   - Cons:

   ### Option B: [name]
   - Pros:
   - Cons:

   ## Decision
   [What we chose and why]

   ## Consequences
   [Trade-offs, implications, follow-up work needed]

   ## Rollback Plan
   [How to reverse this decision if needed]

3. Update docs/INDEX.md with new ADR
4. If decision affects current work, note in SOURCE_OF_TRUTH.md
5. Report: ADR created at [path]
