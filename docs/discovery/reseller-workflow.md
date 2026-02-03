# Reseller Workflow Analysis

> Discovery Document - SUBTASK-103
> Created: 2026-02-03

## Executive Summary

Resellers spend 60-70% of their time on repetitive tasks that could be automated, leaving only 30-40% for high-value work like sourcing. This document maps workflows, pain points, and automation opportunities.

---

## Day-in-the-Life Workflow

### Full-Time Reseller (40-50 hrs/week)

| Time | Activity | Hours/Week | Value |
|------|----------|------------|-------|
| Morning | Sales review, messages, repricing | 2.5 | Medium |
| Midday | Sourcing (thrift, estate sales) | 15-20 | HIGH |
| Afternoon | Photography & processing | 10 | Medium |
| Late PM | Listing creation & cross-listing | 7-10 | Low (repetitive) |
| Evening | Shipping & packaging | 5-7 | Low (repetitive) |
| Night | Poshmark sharing, offers, relisting | 5-10 | Low (tedious) |

### The Core Loop

```
SOURCE -> PHOTOGRAPH -> LIST -> MANAGE -> SHIP -> TRACK
   ^                                              |
   |______________________________________________|
                    (reinvest profits)
```

---

## Key Pain Points (Ranked)

### CRITICAL

**P1: Cross-Listing Hell**
- Manual copying across platforms takes 30+ min per item
- Sellers skip platforms (losing sales) or burn hours on copy-paste

**P2: Inventory Sync / Double-Selling**
- Item sells on Mercari, forget to remove from Poshmark
- Results: Refunds, negative reviews, account damage

**P3: Profit Blindness**
- No clear picture of true net profit after ALL costs
- Sellers think they're profitable but aren't

**P4: Platform-Specific Requirements**
- Each platform has different categories, photo specs, description styles
- Listings underperform when not optimized per platform

### HIGH

**P5: Poshmark Sharing Tedium**
- Must share closet 3-5x daily for visibility
- 5-10 hours/week of mindless tapping
- Automation bots violate ToS

**P6: Stale Inventory Management**
- Items 60+ days need relisting, repricing, or liquidation
- Capital tied up in dead stock

**P7: Pricing Guesswork**
- No easy way to research comps, factor in fees, set floors

### MEDIUM

**P8: Photography Time Sink** - 6-10 min per item
**P9: Physical Storage Chaos** - Can't find items when sold
**P10: Message/Offer Management** - Spread across platforms

---

## Time Sinks (Quantified)

| Task | Time/Item | Weekly (100 items) | Automatable? |
|------|-----------|-------------------|--------------|
| Manual cross-listing | 30 min | 50 hrs | YES |
| Poshmark sharing | N/A | 5-10 hrs | RISKY (ToS) |
| Listing creation | 6 min | 10 hrs | PARTIAL |
| Inventory tracking | 2 min | 3 hrs | YES |
| Shipping prep | 5 min | 8 hrs | PARTIAL |
| Profit calculation | 5 min | 8 hrs | YES |

**Potential savings**: 90 sec/listing x 1,000 listings = 25 hours/month

---

## Automation Opportunities

### Tier 1: CRITICAL (Day-One Features)

| Feature | Pain Point | ToS Safe |
|---------|-----------|----------|
| Cross-list with one click | P1 | YES |
| Auto-delist on sale | P2 | YES |
| Real-time profit tracking | P3 | YES |
| Platform-optimized descriptions | P4 | YES |

### Tier 2: HIGH VALUE (Phase 2)

| Feature | Pain Point | ToS Safe |
|---------|-----------|----------|
| Smart repricing rules | P6, P7 | YES |
| Stale inventory alerts | P6 | YES |
| Comp sales lookup | P7 | YES |

### Tier 3: NICE-TO-HAVE (Phase 3+)

| Feature | Pain Point | ToS Safe |
|---------|-----------|----------|
| Photo enhancement/BG removal | P8 | YES |
| Smart storage/SKU system | P9 | YES |
| Message templates | P10 | YES |

### CANNOT Automate (ToS Risk)

| Feature | Platform | Risk |
|---------|----------|------|
| Auto-sharing | Poshmark | Account ban |
| Bot-based offers | All | Account ban |
| Auto-following | Poshmark | Account ban |

---

## Feature Prioritization

### Must Have (MVP)
1. **One-click cross-listing** - 30+ min savings per item
2. **Auto-delist on sale** - Prevents account damage
3. **True profit calculator** - Real net after ALL costs
4. **Photo-to-draft with AI** - 6 min -> 90 sec

### High Priority (v1.1)
5. Platform-specific optimization
6. Stale inventory dashboard
7. Smart repricing rules
8. Offer management

### Nice-to-Have (v2.0+)
9. Photo enhancement
10. Inventory location tracking
11. Shipping optimization
12. Analytics dashboard

---

## User Personas

### Side Hustle Sarah
- 10-15 hrs/week, 50-100 listings
- Pain: "No time for multiple platforms"
- Willingness to pay: $10-20/mo

### Full-Time Frank
- 40-50 hrs/week, 500-2000 listings
- Pain: "Can't keep up with inventory"
- Willingness to pay: $50-100/mo

### Power Seller Priya
- 60+ hrs/week with VAs, 5000+ listings
- Pain: "Systems are duct-taped together"
- Willingness to pay: $200+/mo

---

## The ResellerOS Promise (Validated)

> **User only does:**
> 1. Take photos
> 2. Ship sold orders
>
> **The app does everything else.**

**Achievable via automation:**
- Listing creation (AI from photos)
- Cross-listing (one-click)
- Inventory sync (auto-delist)
- Pricing (rule-based autopilot)
- Profit tracking (automatic)

**Requires human judgment:**
- Sourcing (what to buy)
- Photography (physical)
- Shipping (physical)
- Disputes (nuanced)

---

## Status
- **Completed**: 2026-02-03
- **Owner**: planner
