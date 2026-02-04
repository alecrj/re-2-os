/**
 * Shared type definitions
 */

import type {
  Channel,
  Condition,
  InventoryStatus,
  OrderStatus,
  ActionType,
  ConfidenceLevel,
} from "./constants";

// ============ INVENTORY ============

export interface InventoryItem {
  id: string;
  userId: string;
  sku: string;
  title: string;
  description: string;
  condition: Condition;
  askingPrice: number;
  floorPrice?: number;
  costBasis?: number;
  status: InventoryStatus;
  quantity: number;
  aiConfidence?: number;
  suggestedCategory?: string;
  itemSpecifics?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  listedAt?: Date;
  soldAt?: Date;
  images?: ItemImage[];
  channelListings?: ChannelListing[];
}

export interface ItemImage {
  id: string;
  itemId: string;
  originalUrl: string;
  processedUrl?: string;
  position: number;
  width?: number;
  height?: number;
  sizeBytes?: number;
  createdAt: Date;
}

// ============ CHANNEL LISTINGS ============

export interface ChannelListing {
  id: string;
  itemId: string;
  channel: Channel;
  externalId?: string;
  externalUrl?: string;
  price: number;
  status: "draft" | "pending" | "active" | "ended" | "sold" | "error";
  statusMessage?: string;
  requiresManualAction: boolean;
  createdAt: Date;
  publishedAt?: Date;
  endedAt?: Date;
}

// ============ ORDERS ============

export interface Order {
  id: string;
  userId: string;
  itemId: string;
  channelListingId?: string;
  channel: Channel;
  externalOrderId?: string;
  salePrice: number;
  shippingPaid?: number;
  platformFees?: number;
  shippingCost?: number;
  netProfit?: number;
  buyerUsername?: string;
  shippingAddress?: ShippingAddress;
  status: OrderStatus;
  orderedAt: Date;
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
}

export interface ShippingAddress {
  name?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

// ============ AUTOPILOT ============

export interface AutopilotRule {
  id: string;
  userId: string;
  ruleType: "offer" | "reprice" | "stale" | "delist";
  config: OfferRuleConfig | RepriceRuleConfig | StaleRuleConfig | DelistRuleConfig;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfferRuleConfig {
  autoAcceptThreshold: number;
  autoDeclineThreshold: number;
  autoCounterEnabled: boolean;
  counterStrategy: "floor" | "midpoint" | "asking-5%";
  maxCounterRounds: number;
  highValueThreshold: number;
}

export interface RepriceRuleConfig {
  strategy: "time_decay" | "performance" | "competitive";
  maxDailyDropPercent: number;
  maxWeeklyDropPercent: number;
  respectFloorPrice: boolean;
  highValueThreshold: number;
}

export interface StaleRuleConfig {
  daysUntilStale: number;
  notifyOnly: boolean;
  autoRelist: boolean;
}

export interface DelistRuleConfig {
  autoDelistOnSale: boolean;
  notifyForAssistedChannels: boolean;
}

export interface AutopilotAction {
  id: string;
  userId: string;
  itemId?: string;
  ruleId?: string;
  actionType: ActionType;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  status: "pending" | "approved" | "executed" | "failed" | "rejected" | "undone";
  requiresApproval: boolean;
  reversible: boolean;
  undoDeadline?: Date;
  createdAt: Date;
  executedAt?: Date;
  undoneAt?: Date;
  errorMessage?: string;
  retryCount: number;
}

// ============ ANALYTICS ============

export interface DashboardStats {
  totalListings: number;
  activeListings: number;
  soldThisMonth: number;
  revenueThisMonth: number;
  profitThisMonth: number;
  avgDaysToSell: number;
}

export interface ChartData {
  labels: string[];
  revenue: number[];
  profit: number[];
  cogs: number[];
}

export interface ChannelBreakdown {
  sales: number;
  revenue: number;
  fees: number;
}

// ============ AI SERVICE ============

export interface GeneratedListing {
  title: string;
  description: string;
  suggestedPrice: {
    min: number;
    max: number;
    recommended: number;
  };
  category: {
    suggested: string;
    confidence: number;
  };
  condition: {
    suggested: Condition;
    confidence: number;
  };
  itemSpecifics: Array<{
    name: string;
    value: string;
    confidence: number;
  }>;
  confidence: number;
  tokensUsed: number;
  model: string;
}

// ============ CROSS-LIST TEMPLATE ============

export interface CrossListTemplate {
  title: string;
  description: string;
  price: number;
  copyableFields: Record<string, string>;
  instructions: string[];
}
