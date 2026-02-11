/**
 * eBay Channel Module Exports
 */

export { EbayClient, getEbayClient, checkRevisionLimit, incrementRevisionCount } from "./client";
export { EbayAdapter, getEbayAdapter } from "./adapter";

// Re-export types
export type { EbayClientConfig } from "./client";
export type { EbayInventoryItemData } from "./adapter";
