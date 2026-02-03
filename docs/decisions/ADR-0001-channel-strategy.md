# ADR-0001: Channel Strategy for MVP and Beyond

## Status
**Accepted** - 2026-02-03

## Context

ResellerOS aims to be a comprehensive reselling automation platform. The core promise is "user only takes photos and ships" - everything else automated. However, different marketplaces have vastly different API availability and Terms of Service constraints.

**The Problem**: How do we integrate with multiple marketplaces when only eBay has a comprehensive official API, while others (Poshmark, Mercari, Depop) have restrictive ToS against automation?

**Key Constraints**:
1. User account safety is paramount - getting users banned would be catastrophic
2. Competitors (Vendoo, List Perfectly) support 11+ marketplaces
3. Poshmark and Mercari are critical channels for fashion resellers (our target market)
4. We cannot deliver the "photos + ship only" promise without multi-channel support

## Options Considered

### Option A: eBay Only (Native API)
- **Pros**: 
  - Zero ToS risk
  - Full automation possible
  - Simplest to build
- **Cons**: 
  - Missing 50%+ of resale market
  - Fashion sellers need Poshmark/Mercari
  - Non-competitive with existing tools

### Option B: Full Automation All Channels (via browser automation)
- **Pros**: 
  - True "photos + ship only" experience
  - Feature parity with competitors
- **Cons**: 
  - HIGH ban risk on Poshmark/Mercari/Depop
  - ToS violations on every non-eBay platform
  - User accounts at risk
  - Potential legal exposure (CFAA concerns)

### Option C: Native + Assisted Hybrid
- **Pros**: 
  - eBay fully automated (largest market, best API)
  - Other channels supported via safer methods
  - Honest with users about capabilities and risks
  - Can evolve as platforms change
- **Cons**: 
  - Not true "full automation" on all channels
  - More complex UX
  - May require cross-listing partner dependencies

### Option D: Partner-Only for Non-eBay
- **Pros**: 
  - Liability on partners (Vendoo, etc.)
  - Established relationships with marketplaces
- **Cons**: 
  - Full dependency on third parties
  - Cost pass-through
  - No direct relationship with platforms
  - UX complexity (multiple logins)

## Decision

**We choose Option C: Native + Assisted Hybrid**

**MVP Channels**:
- **eBay**: Native API integration (full automation)
- **Poshmark**: Assisted mode (manual-assist with templates, inventory tracking)
- **Mercari**: Assisted mode (manual-assist + guidance for official eBay import)

**Why This Decision**:
1. **Safety first**: We will not risk user accounts for feature parity
2. **Honest positioning**: "Assisted > Sketchy" is a differentiator, not a weakness
3. **Room to evolve**: Can add partner integration later if demand justifies
4. **Minimum viable**: Covers the top 3 resale channels with acceptable UX

**Why Not Full Automation (Option B)**:
- Poshmark ToS explicitly prohibits automation
- Users have experienced "share jail" and worse from aggressive tools
- We cannot in good conscience ship features that risk user livelihoods

**Why Not eBay Only (Option A)**:
- Fashion resellers (our target) need Poshmark and Mercari
- Would be a non-starter competitively

## Consequences

### Positive
1. Users can trust ResellerOS will not get them banned
2. Clear differentiation from competitors who push ToS limits
3. Simpler initial build (no complex browser automation)
4. Foundation for safe expansion as platforms evolve

### Negative
1. UX is not fully automated for Poshmark/Mercari
2. Users must complete final listing steps manually on some channels
3. May lose users who want "set it and forget it" (and accept the risk)
4. Inventory sync across manual channels is harder

### Follow-up Work Needed
1. Design excellent manual-assist UX (one-click copy, templates)
2. Investigate cross-listing partner APIs for v1.1
3. Build clear per-channel documentation for users
4. Create monitoring for platform ToS changes

## Rollback Plan

If this approach fails (users demand full automation, churn is high):

1. **Option 1**: Add cross-listing partner integration (Vendoo API, etc.)
   - Keeps liability on partner
   - Adds automation without direct ToS violation

2. **Option 2**: Add opt-in "advanced automation" with strong disclaimers
   - User explicitly accepts risk
   - We document exactly what we do
   - User can disable at any time

**We will NOT** add hidden automation that risks user accounts without explicit consent.

---

## References
- docs/03_CHANNELS.md - Full channel research and ToS constraints
- docs/discovery/competitors.md - Competitor analysis
- SUBTASK-104 - ToS Constraints research
- SUBTASK-204 - Channel Strategy decision
