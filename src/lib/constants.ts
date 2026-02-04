/**
 * Application-wide constants
 */

// Supported marketplace channels
export const CHANNELS = ["ebay", "poshmark", "mercari", "depop"] as const;
export type Channel = (typeof CHANNELS)[number];

// Channel display names
export const CHANNEL_NAMES: Record<Channel, string> = {
  ebay: "eBay",
  poshmark: "Poshmark",
  mercari: "Mercari",
  depop: "Depop",
};

// Item conditions
export const CONDITIONS = ["new", "like_new", "good", "fair", "poor"] as const;
export type Condition = (typeof CONDITIONS)[number];

// Condition display names
export const CONDITION_NAMES: Record<Condition, string> = {
  new: "New with Tags",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

// Inventory statuses
export const INVENTORY_STATUSES = [
  "draft",
  "active",
  "sold",
  "shipped",
  "archived",
] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

// Order statuses
export const ORDER_STATUSES = [
  "pending",
  "paid",
  "shipped",
  "delivered",
  "returned",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Autopilot action types
export const ACTION_TYPES = [
  "OFFER_ACCEPT",
  "OFFER_DECLINE",
  "OFFER_COUNTER",
  "REPRICE",
  "DELIST",
  "RELIST",
  "ARCHIVE",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

// Confidence levels
export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW", "VERY_LOW"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

// Rate limits (daily)
export const RATE_LIMITS = {
  ebayRevisions: 200, // eBay allows 250, we use 200 as safe limit
  reprices: 100,
  autoAccepts: 50,
  autoCounters: 100,
  relists: 25,
} as const;

// Pricing tiers
export const PRICING_TIERS = {
  free: {
    name: "Free",
    listings: 25,
    aiListings: 5,
    bgRemovals: 10,
  },
  starter: {
    name: "Starter",
    listings: 100,
    aiListings: 50,
    bgRemovals: 50,
    price: 9,
  },
  pro: {
    name: "Pro",
    listings: 500,
    aiListings: 200,
    bgRemovals: 200,
    price: 29,
  },
  power: {
    name: "Power Seller",
    listings: 2000,
    aiListings: 1000,
    bgRemovals: 1000,
    price: 79,
  },
  business: {
    name: "Business",
    listings: -1, // Unlimited
    aiListings: -1,
    bgRemovals: -1,
    price: 199,
  },
} as const;

// Default autopilot settings
export const DEFAULT_OFFER_RULES = {
  autoAcceptThreshold: 0.9, // 90% of asking price
  autoDeclineThreshold: 0.5, // 50% of asking price
  autoCounterEnabled: false,
  counterStrategy: "midpoint" as const,
  maxCounterRounds: 2,
  highValueThreshold: 200,
};

export const DEFAULT_REPRICE_RULES = {
  strategy: "time_decay" as const,
  maxDailyDropPercent: 0.1, // 10%
  maxWeeklyDropPercent: 0.2, // 20%
  respectFloorPrice: true,
  highValueThreshold: 200,
};
