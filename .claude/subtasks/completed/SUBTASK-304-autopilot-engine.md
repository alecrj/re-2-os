# SUBTASK-304: Autopilot Engine

## Metadata
- **ID**: 304
- **Phase**: PHASE-3-ARCHITECTURE
- **Owner**: autopilot-engineer
- **Status**: COMPLETE
- **Created**: 2026-02-03
- **Blocked By**: None (301 complete)
- **Blocks**: None

## Objective
Validate and finalize the autopilot engine design in docs/02_ARCHITECTURE.md Section 8.

## Deliverables
- Complete autopilot engine architecture
- Confidence scoring algorithm
- Rate limiting strategy
- Job definitions for Inngest

## Acceptance Criteria
- [x] Event flow fully documented (Section 8.1)
- [x] Confidence scoring algorithm complete (Section 8.2)
- [x] All rule types covered (offer, reprice, stale, delist) (Section 5.2, 8.4)
- [x] Rate limiting respects eBay 250/day limit (Section 8.3: 200 safe limit)
- [x] Undo system designed (Section 5.4, Schema Section 7)
- [x] Aligns with docs/04_AUTOPILOT_RULES.md (Validated with minor gaps documented)

## Progress Log
| Date | Update |
|------|--------|
| 2026-02-03 | Created |
| 2026-02-03 | Validation complete - architecture aligns with rulebook. Minor gaps documented below. |

## Validation Results

### Checklist Status
- [x] Event flow matches the requirements in 04_AUTOPILOT_RULES.md
- [x] Confidence scoring algorithm covers: item value, pattern match, historical accuracy, user activity
- [x] All rule types covered: offer accept/decline/counter, reprice, stale/relist, delist-on-sale
- [x] Rate limiting respects eBay 250/day (using 200 safe limit)
- [x] Undo system has 24-hour window (via undoDeadline field)
- [x] Inngest job definitions are complete (5 jobs defined)
- [x] Alert/notification triggers defined (critical alert on delist failure)

### Architecture-Rulebook Alignment

| Rulebook Section | Architecture Section | Status |
|------------------|---------------------|--------|
| Confidence Thresholds | 8.2 Confidence Scoring | ALIGNED |
| Offer Automation | 5.2 AutopilotEngine Interface, OfferRules | ALIGNED |
| Repricing Automation | 5.2 RepriceRules | ALIGNED |
| Stale Inventory Recovery | ActionType enum (RELIST, ARCHIVE) | ALIGNED |
| Delist on Sale (Critical) | 8.4 Delist-on-Sale Job | ALIGNED |
| Audit & Undo System | 5.4 Audit Service, Section 7 Schema | ALIGNED |
| Rate Limits | 8.3 Rate Limiting | ALIGNED |

### Minor Gaps for Implementation Phase

| Gap | Rulebook Reference | Recommendation |
|-----|-------------------|----------------|
| HIGH vs MEDIUM confidence behavior | Section: Confidence Thresholds | Add notifyUser flag for MEDIUM confidence in engine.ts |
| autoDeclines rate limit missing | Section 8: 100/day | Add autoDeclines to RateLimits interface |
| Delists should be unlimited | Section 8: "Critical function" | Remove delist from rate limiter or set to Infinity |
| Undo time limits per action type | Section 7: 24h/30d/unlimited | Implement getUndoDeadline(actionType) helper |
| Notification priority levels | Section 6: CRITICAL/HIGH/MEDIUM/LOW | Implement NotificationPriority enum with channel mapping |

### Conclusion

The autopilot engine design in docs/02_ARCHITECTURE.md Section 8 is **validated and complete**. The architecture correctly implements:

1. **Event-driven flow** via Inngest with proper retry/failure handling
2. **Confidence scoring** with all four required factors (value, pattern, history, activity)
3. **All rule types** via ActionType enum and dedicated interfaces
4. **Rate limiting** respecting eBay's 250/day limit with 200 safe ceiling
5. **Undo capability** via reversible flag and undoDeadline tracking
6. **Audit logging** with full before/after state capture

The minor gaps identified are implementation details that can be addressed in Phase 4 without architectural changes.
