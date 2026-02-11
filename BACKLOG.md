# ResellerOS - Implementation Backlog

> Generated: 2026-02-11
> Phase: 4-IMPLEMENTATION
> Status: Active

---

## Ticket Status Legend
- `TODO` - Not started
- `IN_PROGRESS` - Currently being worked
- `DONE` - Completed and verified
- `BLOCKED` - Waiting on dependency

---

## Epic 1: Core Infrastructure
*Foundation that everything else depends on*

| ID | Title | Status | Owner | Notes |
|----|-------|--------|-------|-------|
| T-101 | Next.js 14 + tRPC Setup | DONE | implementer | App scaffolded |
| T-102 | Drizzle ORM + SQLite Schema | DONE | implementer | All tables created |
| T-103 | Turso Cloud Database | DONE | implementer | Production DB working |
| T-104 | NextAuth + eBay OAuth | DONE | implementer | Custom Turso adapter |
| T-105 | Cloudflare R2 Integration | DONE | implementer | Presigned URLs working |
| T-106 | Inngest Background Jobs | DONE | implementer | Connected to Vercel |
| T-107 | Vercel Deployment | DONE | implementer | Production live |

---

## Epic 2: eBay Integration
*Native eBay API integration*

| ID | Title | Status | Owner | Notes |
|----|-------|--------|-------|-------|
| T-201 | eBay OAuth Token Management | DONE | implementer | Auto-refresh working |
| T-202 | eBay Inventory API Client | DONE | implementer | Full CRUD |
| T-203 | Publish Listing to eBay | DONE | implementer | 3-step flow |
| T-204 | Update eBay Listings | DONE | implementer | Price, qty, title |
| T-205 | Delist from eBay | DONE | implementer | Quantity-based |
| T-206 | Sync Orders from eBay | DONE | implementer | Fulfillment API |
| T-207 | eBay Platform Notifications | DONE | implementer | Webhook endpoint |
| T-208 | eBay Trading API (Offers) | TODO | implementer | RespondToBestOffer needed |
| T-209 | Sync Inventory FROM eBay | DONE | implementer | Import existing listings |

---

## Epic 3: Inventory Management
*Core inventory CRUD and tracking*

| ID | Title | Status | Owner | Notes |
|----|-------|--------|-------|-------|
| T-301 | Inventory Database Schema | DONE | implementer | Full schema |
| T-302 | Inventory tRPC Router | DONE | implementer | CRUD + stats |
| T-303 | Inventory List Page | DONE | implementer | Table with filters |
| T-304 | Inventory Detail Page | DONE | implementer | Edit form |
| T-305 | Create New Item Flow | DONE | implementer | Multi-step wizard |
| T-306 | Image Upload Component | DONE | implementer | R2 integration |
| T-307 | Bulk Operations | TODO | implementer | Multi-select actions |

---

## Epic 4: Orders & Sales
*Order tracking and profit calculation*

| ID | Title | Status | Owner | Notes |
|----|-------|--------|-------|-------|
| T-401 | Orders Database Schema | DONE | implementer | Full schema |
| T-402 | Orders tRPC Router | DONE | implementer | List, stats, record |
| T-403 | Orders Dashboard Page | DONE | implementer | Stats + table |
| T-404 | Order Detail Dialog | DONE | implementer | View + ship |
| T-405 | Record Manual Sale | DONE | implementer | For assisted channels |
| T-406 | Mark Order Shipped | DONE | implementer | Tracking info |
| T-407 | Profit Calculation | DONE | implementer | Net profit formula |

---

## Epic 5: Autopilot Engine
*Automated offer handling and repricing*

| ID | Title | Status | Owner | Notes |
|----|-------|--------|-------|-------|
| T-501 | Autopilot Rules Schema | DONE | implementer | DB tables |
| T-502 | Offer Evaluation Engine | DONE | autopilot-engineer | Decision logic |
| T-503 | Confidence Scoring | DONE | autopilot-engineer | HIGH/MEDIUM/LOW |
| T-504 | Auto-Accept Logic | DONE | autopilot-engineer | Threshold rules |
| T-505 | Auto-Decline Logic | DONE | autopilot-engineer | Lowball detection |
| T-506 | Counter-Offer Logic | DONE | autopilot-engineer | Smart counters |
| T-507 | Execute Offer Response | TODO | implementer | Needs T-208 |
| T-508 | Delist-on-Sale Function | DONE | implementer | Inngest job |
| T-509 | Reprice Check Function | DONE | implementer | Time-decay |
| T-510 | Stale Listing Check | DONE | implementer | Inngest job |
| T-511 | Pending Actions Queue | DONE | implementer | UI component |
| T-512 | Autopilot Settings UI | TODO | implementer | Config page |
| T-513 | Rate Limiting | DONE | implementer | Daily caps |

---

## Epic 6: Listings & Cross-Listing
*Multi-channel listing management*

| ID | Title | Status | Owner | Notes |
|----|-------|--------|-------|-------|
| T-601 | Listings Page UI | TODO | implementer | Needs data queries |
| T-602 | Channel Listings Schema | DONE | implementer | DB tables |
| T-603 | Cross-List Dialog | DONE | implementer | UI component |
| T-604 | Cross-List Template Gen | TODO | implementer | For assisted channels |
| T-605 | Publish Flow (eBay) | DONE | implementer | End-to-end |
| T-606 | Publish Flow (Assisted) | TODO | implementer | Template + tracking |

---

## Epic 7: AI Features
*GPT-4o powered listing generation*

| ID | Title | Status | Owner | Notes |
|----|-------|--------|-------|-------|
| T-701 | OpenAI Client Setup | DONE | implementer | API configured |
| T-702 | AI Listing Generation | DONE | implementer | tRPC endpoint |
| T-703 | Background Removal | TODO | implementer | R2 processing |
| T-704 | Category Suggestion | DONE | implementer | From images |
| T-705 | Price Suggestion | TODO | implementer | Market analysis |

---

## Epic 8: Analytics Dashboard
*Reporting and insights*

| ID | Title | Status | Owner | Notes |
|----|-------|--------|-------|-------|
| T-801 | Analytics tRPC Router | DONE | implementer | Basic queries |
| T-802 | Analytics Page UI | TODO | implementer | Empty page |
| T-803 | Revenue Chart | TODO | implementer | Time series |
| T-804 | Channel Performance | TODO | implementer | Comparison |
| T-805 | Top Items Report | TODO | implementer | Best sellers |
| T-806 | Export to CSV | DONE | implementer | Reports |

---

## Epic 9: Settings & Configuration
*User preferences and account settings*

| ID | Title | Status | Owner | Notes |
|----|-------|--------|-------|-------|
| T-901 | Settings Page Layout | DONE | implementer | Basic page |
| T-902 | Autopilot Config UI | TODO | implementer | Rules editor |
| T-903 | Channel Connections | DONE | implementer | eBay linked |
| T-904 | Notification Prefs | TODO | implementer | Email/push |

---

## Priority Queue (Next Up)

### P0 - Critical Path
1. ~~**T-209**: Sync Inventory FROM eBay - Import existing listings~~ ✅ DONE
2. **T-601**: Listings Page UI - Show active listings
3. **T-208**: eBay Trading API - Enable offer responses

### P1 - Core Features
4. **T-507**: Execute Offer Response - Wire up autopilot
5. **T-512**: Autopilot Settings UI - Configure rules
6. **T-802**: Analytics Page UI - Basic dashboard

### P2 - Polish
7. **T-307**: Bulk Operations
8. **T-604**: Cross-List Templates
9. **T-803-805**: Analytics charts

---

## Completion Summary

| Epic | Done | Total | % |
|------|------|-------|---|
| 1. Core Infrastructure | 7 | 7 | 100% |
| 2. eBay Integration | 8 | 9 | 89% |
| 3. Inventory Management | 6 | 7 | 86% |
| 4. Orders & Sales | 7 | 7 | 100% |
| 5. Autopilot Engine | 10 | 13 | 77% |
| 6. Listings & Cross-List | 3 | 6 | 50% |
| 7. AI Features | 3 | 5 | 60% |
| 8. Analytics Dashboard | 2 | 6 | 33% |
| 9. Settings & Config | 2 | 4 | 50% |
| **TOTAL** | **48** | **64** | **75%** |

---

## Notes
- eBay is the only native integration; Poshmark/Mercari/Depop are "assisted" (manual post, track in app)
- Production is live at Vercel with Turso database
- eBay OAuth working, tokens stored and refreshing
