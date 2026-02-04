/**
 * Channel Adapter Types for ResellerOS
 *
 * Defines the interface for marketplace channel integrations.
 * Channels can be "native" (full API integration) or "assisted" (manual with helpers).
 */

import type { Channel, Condition } from "@/lib/constants";

// ============ CHANNEL CONFIGURATION ============

export type ChannelId = Channel;

export type IntegrationMode = "native" | "assisted" | "manual";

export interface ChannelCapabilities {
  canPublish: boolean;
  canReprice: boolean;
  canDelist: boolean;
  canSyncOrders: boolean;
  canSyncInventory: boolean;
  requiresManualAction: boolean;
}

// ============ LISTING DATA ============

/**
 * eBay condition codes mapped from our internal conditions
 */
export type EbayCondition =
  | "NEW"
  | "LIKE_NEW"
  | "NEW_OTHER"
  | "NEW_WITH_DEFECTS"
  | "MANUFACTURER_REFURBISHED"
  | "CERTIFIED_REFURBISHED"
  | "EXCELLENT_REFURBISHED"
  | "VERY_GOOD_REFURBISHED"
  | "GOOD_REFURBISHED"
  | "SELLER_REFURBISHED"
  | "USED_EXCELLENT"
  | "USED_VERY_GOOD"
  | "USED_GOOD"
  | "USED_ACCEPTABLE"
  | "FOR_PARTS_OR_NOT_WORKING";

/**
 * Map internal conditions to eBay condition codes
 */
export const CONDITION_TO_EBAY: Record<Condition, EbayCondition> = {
  new: "NEW",
  like_new: "LIKE_NEW",
  good: "USED_GOOD",
  fair: "USED_ACCEPTABLE",
  poor: "FOR_PARTS_OR_NOT_WORKING",
};

export interface ListingData {
  title: string;
  description: string;
  price: number;
  quantity: number;
  condition: Condition;
  category?: string;
  imageUrls: string[];
  itemSpecifics?: Record<string, string>;
  sku: string;
}

// ============ OPERATION RESULTS ============

export interface PublishResult {
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  error?: string;
  errorCode?: string;
  requiresManualAction?: boolean;
  manualInstructions?: string;
}

export interface DelistResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  requiresManualAction?: boolean;
}

export interface UpdateResult {
  success: boolean;
  error?: string;
  errorCode?: string;
}

// ============ ORDER TYPES ============

export interface ChannelOrder {
  externalOrderId: string;
  channel: ChannelId;
  buyerUsername?: string;
  status: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
  salePrice: number;
  shippingPaid?: number;
  platformFees?: number;
  shippingAddress?: {
    name?: string;
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  lineItems: Array<{
    sku: string;
    title: string;
    quantity: number;
    price: number;
    externalListingId?: string;
  }>;
  orderedAt: Date;
  paidAt?: Date;
  shippedAt?: Date;
}

// ============ CROSS-LIST TEMPLATE ============

export interface CrossListTemplate {
  title: string;
  description: string;
  price: number;
  copyableFields: Record<string, string>;
  instructions: string[];
}

// ============ CHANNEL ADAPTER INTERFACE ============

export interface ChannelAdapter {
  readonly channelId: ChannelId;
  readonly mode: IntegrationMode;
  readonly capabilities: ChannelCapabilities;

  // Authentication
  isConnected(userId: string): Promise<boolean>;
  getAuthUrl(userId: string): Promise<string>;
  handleCallback(userId: string, code: string): Promise<void>;
  refreshToken(userId: string): Promise<boolean>;

  // Listing Operations
  publish(userId: string, listing: ListingData): Promise<PublishResult>;
  update(
    userId: string,
    externalId: string,
    updates: Partial<ListingData>
  ): Promise<UpdateResult>;
  updatePrice(userId: string, externalId: string, newPrice: number): Promise<UpdateResult>;
  delist(userId: string, externalId: string): Promise<DelistResult>;

  // Sync Operations (if supported)
  syncOrders?(userId: string, since: Date): Promise<ChannelOrder[]>;

  // Assisted Mode Helpers
  generateTemplate?(listing: ListingData): CrossListTemplate;
}

// ============ RATE LIMIT TYPES ============

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetsAt: Date;
  percentUsed: number;
}

export interface RateLimitConfig {
  maxRevisions: number;
  resetAt: "midnight_pt" | "midnight_utc" | "24h_rolling";
}

// ============ ERROR TYPES ============

export class ChannelApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = "ChannelApiError";
  }
}

export class RateLimitError extends ChannelApiError {
  constructor(message: string, resetsAt: Date) {
    super(message, "RATE_LIMIT_EXCEEDED", 429, true, resetsAt.getTime() - Date.now());
    this.name = "RateLimitError";
  }
}

export class AuthenticationError extends ChannelApiError {
  constructor(message: string) {
    super(message, "AUTHENTICATION_FAILED", 401, false);
    this.name = "AuthenticationError";
  }
}

export class TokenExpiredError extends ChannelApiError {
  constructor() {
    super("Token has expired", "TOKEN_EXPIRED", 401, true);
    this.name = "TokenExpiredError";
  }
}
