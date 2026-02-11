# SUBTASK-T209: Sync Inventory FROM eBay

## Metadata
- **ID**: T-209
- **Phase**: PHASE-4-IMPLEMENTATION
- **Owner**: implementer
- **Status**: ✅ Complete
- **Created**: 2026-02-11
- **Blocked By**: None
- **Blocks**: T-601 (Listings Page needs inventory data)

## Objective
Import existing eBay listings into ResellerOS inventory database. This allows users who already have eBay listings to sync them into the app without manually re-entering everything.

## Deliverables
1. eBay Inventory API integration to fetch active listings
2. tRPC endpoint `inventory.syncFromEbay`
3. Mapping logic: eBay listing → ResellerOS inventory item
4. UI button to trigger sync on Inventory page
5. Progress/status feedback during sync

## Acceptance Criteria
- [x] Can fetch all active listings from user's eBay account
- [x] Creates inventory items with correct fields mapped:
  - title, description, price, quantity, condition
  - SKU preserved if exists
  - Images imported (URLs stored, optionally copied to R2)
- [x] Creates channel_listings records linking to eBay
- [x] Handles pagination (eBay returns max 200 per page)
- [x] Skips duplicates (items already synced)
- [x] Shows sync progress/results to user
- [x] Error handling for API failures

## Technical Notes
- Use eBay Inventory API `GET /sell/inventory/v1/inventory_item`
- Need to also fetch offers to get pricing: `GET /sell/inventory/v1/offer`
- Token available from channel_connections table
- Rate limit: 150 calls/day for inventory, be mindful

## Progress Log
| Date | Update |
|------|--------|
| 2026-02-11 | Created, assigned to implementer |
| 2026-02-11 | Implemented: eBay adapter syncInventory method, tRPC endpoint, UI button |
| 2026-02-11 | ✅ Complete - TypeScript and lint pass |
