# ResellerOS - Operating System

## Current State
> See SOURCE_OF_TRUTH.md for live status

## Prime Directive
Discovery before planning. Planning before building. Validation before completion.

## The Workflow
1. Read SOURCE_OF_TRUTH.md (always first)
2. Read current phase doc
3. Work active subtasks
4. Validate before marking complete
5. Update progress and SOURCE_OF_TRUTH.md

## Canonical Docs (7 max)
1. docs/00_NORTH_STAR.md - Vision
2. docs/01_REQUIREMENTS.md - What we're building
3. docs/02_ARCHITECTURE.md - System design
4. docs/03_CHANNELS.md - Marketplace integrations
5. docs/04_AUTOPILOT_RULES.md - Automation rules
6. docs/05_UNIT_ECON_PRICING.md - Pricing/costs
7. docs/06_ROADMAP.md - Build order

## The 6 Agents
- planner: Strategy, requirements, roadmap
- integrations-lead: APIs, ToS, channel strategy
- autopilot-engineer: Automation rules, guardrails
- implementer: Code (only after Phase 3)
- verifier: Tests, validation
- docs-librarian: Doc governance

## Key Skills
- /phase-status: Where are we?
- /subtask-create: Create new subtask
- /subtask-complete: Complete with validation
- /validate-phase: Run phase checkpoint
- /sync-docs: Reconcile docs
- /adr: Create decision record

## Rules
- NO subtask is complete without validation
- NO phase transition without checkpoint pass
- NO implementation before Phase 4
- All context in repo, not chat
