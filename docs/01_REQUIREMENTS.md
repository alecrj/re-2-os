# ResellerOS - Requirements

> This document defines what we're building.
> Last Updated: 2026-02-03 (Phase 2 - Planning)

## Target Users

### Primary: Full-Time Frank
- 40-50 hrs/week, 500-2000 active listings
- Pain: "Can't keep up with inventory sync"
- Value threshold: $50-100/mo

### Secondary: Side Hustle Sarah
- 10-15 hrs/week, 50-100 active listings
- Pain: "No time to manage multiple platforms"
- Value threshold: $10-20/mo

---

## MVP Scope

### Guiding Principle
Less is more. MVP ships when users can:
1. Take photos and get a publish-ready listing in under 90 seconds
2. Publish to eBay (native) with one click
3. Know their true profit on every sale
4. Trust that sold items auto-delist (no double-selling)

---

## User Stories - MVP

### US-1: AI Listing Generation
**As a** reseller
**I want to** take photos and get a publish-ready draft in under 90 seconds
**So that** I spend time sourcing, not typing

**Acceptance Criteria:**
- [ ] User uploads 1-4 photos
- [ ] AI extracts: title, description, category suggestion, condition
- [ ] User confirms/rejects suggestions (2 clicks max)
- [ ] Draft created with all required fields populated
- [ ] Time from photo upload to draft: < 90 seconds

---

### US-2: One-Click eBay Publishing
**As a** reseller
**I want to** publish my draft to eBay with one click
**So that** I don't waste time on manual form-filling

**Acceptance Criteria:**
- [ ] User reviews draft and clicks "Publish to eBay"
- [ ] Listing created via eBay Inventory API
- [ ] All required fields auto-populated
- [ ] User receives confirmation with listing link

---

### US-3: Cross-List Assist
**As a** reseller
**I want to** easily cross-list my eBay items to other platforms
**So that** I reach more buyers without repetitive data entry

**Acceptance Criteria:**
- [ ] User selects items to cross-list
- [ ] System generates platform-optimized listing data
- [ ] Copy-friendly format or guided workflow provided
- [ ] Listings tracked as "cross-listed" in inventory

---

### US-4: Auto-Delist on Sale
**As a** reseller
**I want** sold items to automatically delist from other platforms
**So that** I never oversell and damage my reputation

**Acceptance Criteria:**
- [ ] System detects eBay sale via webhook
- [ ] Inventory updated to 0 across all channels
- [ ] User notified of sale and sync status
- [ ] Audit log entry created

---

### US-5: True Profit Tracking
**As a** reseller
**I want to** see my real net profit per item and weekly summary
**So that** I know if I'm actually making money

**Acceptance Criteria:**
- [ ] User enters COGS per item
- [ ] System calculates: fees, shipping, net profit
- [ ] Display per-item: Gross, costs, net, ROI %
- [ ] Weekly summary dashboard

---

### US-6: Inventory Dashboard
**As a** reseller
**I want to** see all my listings in one place
**So that** I know what's listed where

**Acceptance Criteria:**
- [ ] Dashboard shows all items: Draft, Listed, Sold, Shipped
- [ ] Filter by platform
- [ ] Sort by date, price, days active
- [ ] Quick actions: Edit, delist, view

---

### US-7: Bulk Operations
**As a** reseller
**I want to** publish multiple drafts with one action
**So that** I can batch my workflow

**Acceptance Criteria:**
- [ ] Select multiple drafts (up to 25)
- [ ] One-click "Publish All to eBay"
- [ ] Progress indicator and summary

---

## Phase 2 Features (v1.1)

| Feature | Description |
|---------|-------------|
| Smart Repricing | Auto-adjust prices based on time decay rules |
| Stale Inventory Alerts | Notifications for 30/60/90 day items |
| Offer Management | Centralized offers with auto-accept rules |
| Photo Enhancement | Background removal |

---

## Non-Functional Requirements

### Performance
- AI listing: < 90 seconds (P95)
- eBay publish: < 5 seconds
- Dashboard load: < 2 seconds

### Security
- OAuth 2.0 for platforms
- Encrypted data at rest/transit
- Full audit logs

### ToS Compliance
- eBay: Native API only
- Poshmark/Mercari: Assisted workflows only

---

## Out of Scope

- Auto-sharing bots for Poshmark
- Auto-following/liking bots
- Direct Poshmark/Mercari API
- Shipping label generation
- Customer messaging automation

---

## Priority Matrix

| Priority | Feature |
|----------|---------|
| P0 | AI Listing Generation |
| P0 | eBay Publishing |
| P0 | Auto-Delist on Sale |
| P0 | True Profit Tracking |
| P1 | Cross-List Assist |
| P1 | Inventory Dashboard |
| P1 | Bulk Operations |

---

## MVP Validation

Complete when:
1. Photo to live eBay listing in < 2 minutes
2. Sold items auto-delist within 1 minute
3. True net profit visible for every sale
4. 3 beta users complete full flow

---

## Status
- **State**: COMPLETE
- **Updated**: 2026-02-03
- **Owner**: planner
