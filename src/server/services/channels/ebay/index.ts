/**
 * eBay Channel Module Exports
 */

export { EbayClient, getEbayClient, checkRevisionLimit, incrementRevisionCount } from "./client";
export { EbayAdapter, getEbayAdapter } from "./adapter";
export { EbayTradingClient, getEbayTradingClient } from "./trading";

// Re-export types
export type { EbayClientConfig } from "./client";
export type { EbayInventoryItemData } from "./adapter";
export type {
  OfferAction,
  RespondToBestOfferInput,
  RespondToBestOfferResult,
} from "./trading";
