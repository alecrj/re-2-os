# SUBTASK-T601: Listings Page UI

## Metadata
- **ID**: T-601
- **Phase**: PHASE-4-IMPLEMENTATION
- **Owner**: implementer
- **Status**: 🔄 Active
- **Created**: 2026-02-11
- **Blocked By**: None
- **Blocks**: None

## Objective
Build a functional Listings page that shows all active channel listings across marketplaces. Currently the page is empty/placeholder.

## Deliverables
1. tRPC query to fetch all channel listings with item details
2. Listings table showing: item, channel, status, price, external link
3. Filter by channel (eBay, Poshmark, Mercari, Depop)
4. Filter by status (active, ended, draft)
5. Stats cards showing counts per channel

## Acceptance Criteria
- [ ] Listings page shows real data from channel_listings table
- [ ] Each listing shows: item title, image, channel, status, price, link to external listing
- [ ] Can filter by channel
- [ ] Can filter by status
- [ ] Stats cards show active listing counts per channel
- [ ] Loading and empty states handled

## Technical Notes
- Query joins channel_listings with inventory_items and item_images
- Follow patterns from Orders page for table/filtering
- External URL links should open in new tab

## Progress Log
| Date | Update |
|------|--------|
| 2026-02-11 | Created, assigned to implementer |
