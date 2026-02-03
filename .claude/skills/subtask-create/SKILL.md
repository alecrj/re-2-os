---
name: subtask-create
description: Create a new subtask from phase definition.
allowed-tools: Read, Glob, Write, Edit
argument-hint: [subtask-id] [title]
---

Create subtask $ARGUMENTS:

1. Parse ID and title from arguments
2. Read phase doc to get subtask definition
3. Create .claude/subtasks/active/SUBTASK-[ID]-[slug].md using template:

   # SUBTASK-[ID]: [Title]

   ## Metadata
   - **ID**: [ID]
   - **Phase**: [current phase]
   - **Owner**: [from phase doc]
   - **Status**: 🔄 Active
   - **Created**: [today]
   - **Blocked By**: [from phase doc or None]
   - **Blocks**: [from phase doc or None]

   ## Objective
   [from phase doc]

   ## Deliverables
   [from phase doc]

   ## Acceptance Criteria
   [from phase doc]

   ## Progress Log
   | Date | Update |
   |------|--------|
   | [today] | Created |

4. Update SOURCE_OF_TRUTH.md active subtasks
5. Update owner's progress file
6. Report: subtask created, assigned to [owner]
