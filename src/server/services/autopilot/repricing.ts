/**
 * Repricing Service for ResellerOS
 *
 * Evaluates items for price adjustments based on configurable strategies.
 * Implements guardrails to prevent excessive price drops.
 *
 * Strategies:
 * - time_decay: Gradually reduce price based on days listed
 * - performance: Adjust based on views/watchers/offers (future)
 * - competitive: Match competitor pricing (future)
 */

import { db } from "@/server/db/client";
import { autopilotActions, inventoryItems, channelListings, autopilotRules } from "@/server/db/schema";
import type { RepriceRuleConfig } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { RATE_LIMITS, DEFAULT_REPRICE_RULES } from "@/lib/constants";

// ============ TYPES ============

export interface RepricingContext {
  item: {
    id: string;
    title: string;
    askingPrice: number;
    floorPrice?: number | null;
    listedAt?: Date | null;
    costBasis?: number | null;
  };
  listing: {
    id: string;
    channel: string;
    externalId?: string | null;
    price: number;
    publishedAt?: Date | null;
  };
  currentPrice: number;
  floorPrice?: number;
  daysListed: number;
  views?: number;
  watchers?: number;
  offers: number;
  lastRepriceAt?: Date | null;
}

export interface RepricingResult {
  shouldReprice: boolean;
  newPrice?: number;
  reason: string;
  confidence: number;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";
  dropPercent?: number;
}

export interface RepriceRules {
  strategy: "time_decay" | "performance" | "competitive";
  maxDailyDropPercent: number;
  maxWeeklyDropPercent: number;
  respectFloorPrice: boolean;
  highValueThreshold: number;
  daysBeforeFirstDrop?: number;
}

export interface RepriceHistoryEntry {
  id: string;
  itemId: string | null;
  actionType: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  confidence: number;
  status: string;
  createdAt: Date;
  executedAt: Date | null;
}

// ============ RATE LIMITING ============

/**
 * In-memory reprice count tracking (should be persisted in production)
 */
interface UserRepriceCount {
  count: number;
  resetsAt: Date;
}

const repriceCounts = new Map<string, UserRepriceCount>();

/**
 * Get the next midnight Pacific Time
 */
function getMidnightPT(): Date {
  const now = new Date();
  const ptString = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const ptDate = new Date(ptString);
  const midnight = new Date(ptDate);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  const ptOffset = now.getTime() - ptDate.getTime();
  return new Date(midnight.getTime() + ptOffset);
}

/**
 * Check if repricing is allowed under the daily limit
 */
export function checkRepriceLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetsAt: Date;
} {
  const now = new Date();
  let userCount = repriceCounts.get(userId);

  if (!userCount || now >= userCount.resetsAt) {
    userCount = {
      count: 0,
      resetsAt: getMidnightPT(),
    };
    repriceCounts.set(userId, userCount);
  }

  return {
    allowed: userCount.count < RATE_LIMITS.reprices,
    remaining: Math.max(0, RATE_LIMITS.reprices - userCount.count),
    resetsAt: userCount.resetsAt,
  };
}

/**
 * Increment the reprice count for a user
 */
export function incrementRepriceCount(userId: string): void {
  const now = new Date();
  let userCount = repriceCounts.get(userId);

  if (!userCount || now >= userCount.resetsAt) {
    userCount = {
      count: 1,
      resetsAt: getMidnightPT(),
    };
  } else {
    userCount.count++;
  }

  repriceCounts.set(userId, userCount);
}

// ============ CONFIDENCE CALCULATION ============

/**
 * Calculate confidence level based on numeric confidence score
 */
function getConfidenceLevel(confidence: number): "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW" {
  if (confidence >= 0.8) return "HIGH";
  if (confidence >= 0.6) return "MEDIUM";
  if (confidence >= 0.4) return "LOW";
  return "VERY_LOW";
}

// ============ PRICE CALCULATION ============

/**
 * Calculate the new price with guardrails
 */
export function calculateNewPrice(
  currentPrice: number,
  floorPrice: number | undefined,
  dropPercent: number
): number {
  const newPrice = currentPrice * (1 - dropPercent / 100);

  // Round to 2 decimal places
  const roundedPrice = Math.round(newPrice * 100) / 100;

  // Enforce floor price if set
  if (floorPrice !== undefined && roundedPrice < floorPrice) {
    return floorPrice;
  }

  // Never go below $1
  return Math.max(1, roundedPrice);
}

/**
 * Calculate recommended drop percentage based on time decay strategy
 *
 * Schedule:
 * - Days 0-14: No change (allow market to respond)
 * - Days 15-30: -5% (first drop)
 * - Days 31-45: -5% more (cumulative -10%)
 * - Days 46-60: -5% more (cumulative -15%)
 * - Days 60+: -5% every 15 days
 */
export function calculateTimeDecayDrop(
  daysListed: number,
  daysBeforeFirstDrop: number = 14
): { dropPercent: number; dropReason: string } {
  if (daysListed <= daysBeforeFirstDrop) {
    return { dropPercent: 0, dropReason: "Item is still in initial listing period" };
  }

  const daysAfterInitial = daysListed - daysBeforeFirstDrop;

  // Calculate which drop tier we're in (each tier is 15 days)
  const dropTier = Math.floor(daysAfterInitial / 15);

  // Each tier is a 5% drop from original price
  const dropPercent = Math.min(dropTier + 1, 10) * 5; // Cap at 50% total drop

  let dropReason: string;
  if (dropTier === 0) {
    dropReason = `First price drop: ${daysListed} days listed`;
  } else if (dropTier <= 3) {
    dropReason = `Time decay tier ${dropTier + 1}: ${daysListed} days listed`;
  } else {
    dropReason = `Extended time decay: ${daysListed} days listed`;
  }

  return { dropPercent, dropReason };
}

// ============ MAIN REPRICING LOGIC ============

/**
 * Evaluate whether an item should be repriced
 */
export async function evaluateReprice(
  context: RepricingContext,
  rules: RepriceRules
): Promise<RepricingResult> {
  const {
    currentPrice,
    floorPrice,
    daysListed,
    lastRepriceAt,
  } = context;

  const {
    strategy,
    maxDailyDropPercent,
    maxWeeklyDropPercent,
    respectFloorPrice,
    highValueThreshold,
    daysBeforeFirstDrop = 14,
  } = rules;

  // Check if item is at floor price already
  if (respectFloorPrice && floorPrice && currentPrice <= floorPrice) {
    return {
      shouldReprice: false,
      reason: "Already at floor price",
      confidence: 1.0,
      confidenceLevel: "HIGH",
    };
  }

  // Calculate suggested drop based on strategy
  let suggestedDropPercent = 0;
  let dropReason = "";

  switch (strategy) {
    case "time_decay": {
      const timeDecay = calculateTimeDecayDrop(daysListed, daysBeforeFirstDrop);
      suggestedDropPercent = timeDecay.dropPercent;
      dropReason = timeDecay.dropReason;
      break;
    }
    case "performance": {
      // Future: Analyze views, watchers, offers
      // For now, fall back to time decay
      const timeDecay = calculateTimeDecayDrop(daysListed, daysBeforeFirstDrop);
      suggestedDropPercent = timeDecay.dropPercent;
      dropReason = timeDecay.dropReason + " (performance strategy pending)";
      break;
    }
    case "competitive": {
      // Future: Compare to competitor pricing
      // For now, fall back to time decay
      const timeDecay = calculateTimeDecayDrop(daysListed, daysBeforeFirstDrop);
      suggestedDropPercent = timeDecay.dropPercent;
      dropReason = timeDecay.dropReason + " (competitive strategy pending)";
      break;
    }
  }

  // No price change needed
  if (suggestedDropPercent === 0) {
    return {
      shouldReprice: false,
      reason: dropReason,
      confidence: 1.0,
      confidenceLevel: "HIGH",
    };
  }

  // Apply daily drop limit
  const effectiveDropPercent = Math.min(suggestedDropPercent, maxDailyDropPercent * 100);

  // Check weekly drop limit if we repriced recently
  if (lastRepriceAt) {
    const daysSinceLastReprice = Math.floor(
      (Date.now() - lastRepriceAt.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysSinceLastReprice < 7) {
      // Within the same week, enforce weekly limit
      // For simplicity, we allow one drop per week
      if (daysSinceLastReprice < 1) {
        return {
          shouldReprice: false,
          reason: "Already repriced today",
          confidence: 1.0,
          confidenceLevel: "HIGH",
        };
      }

      // Check if weekly limit would be exceeded
      // This is simplified - in production, track actual weekly drops
      const cappedWeeklyDrop = Math.min(effectiveDropPercent, maxWeeklyDropPercent * 100);
      if (cappedWeeklyDrop < effectiveDropPercent) {
        dropReason += ` (capped by weekly limit)`;
      }
    }
  }

  // Calculate new price
  const newPrice = calculateNewPrice(currentPrice, floorPrice, effectiveDropPercent);

  // If price didn't change (likely at floor), skip
  if (newPrice >= currentPrice) {
    return {
      shouldReprice: false,
      reason: "No price reduction possible within guardrails",
      confidence: 1.0,
      confidenceLevel: "HIGH",
    };
  }

  // Calculate actual drop percent
  const actualDropPercent = ((currentPrice - newPrice) / currentPrice) * 100;

  // Calculate confidence
  let confidence = 0.9; // Base high confidence for time decay

  // Reduce confidence for high-value items
  if (currentPrice >= highValueThreshold) {
    confidence = 0.5;
  }

  // Reduce confidence for large drops
  if (actualDropPercent >= 15) {
    confidence = Math.max(confidence - 0.2, 0.3);
  }

  // Reduce confidence if close to floor
  if (respectFloorPrice && floorPrice && newPrice <= floorPrice * 1.1) {
    confidence = Math.max(confidence - 0.1, 0.4);
  }

  const confidenceLevel = getConfidenceLevel(confidence);

  // Require approval for low confidence
  const requiresApproval = confidenceLevel === "LOW" || confidenceLevel === "VERY_LOW";

  return {
    shouldReprice: !requiresApproval, // Auto-reprice only if confidence is sufficient
    newPrice,
    reason: dropReason,
    confidence,
    confidenceLevel,
    dropPercent: actualDropPercent,
  };
}

// ============ DATABASE OPERATIONS ============

/**
 * Get reprice rules for a user
 */
export async function getRepriceRules(userId: string): Promise<RepriceRules> {
  const rules = await db
    .select()
    .from(autopilotRules)
    .where(
      and(
        eq(autopilotRules.userId, userId),
        eq(autopilotRules.ruleType, "reprice"),
        eq(autopilotRules.enabled, true)
      )
    )
    .limit(1);

  if (rules.length === 0) {
    // Return default rules
    return {
      strategy: DEFAULT_REPRICE_RULES.strategy,
      maxDailyDropPercent: DEFAULT_REPRICE_RULES.maxDailyDropPercent,
      maxWeeklyDropPercent: DEFAULT_REPRICE_RULES.maxWeeklyDropPercent,
      respectFloorPrice: DEFAULT_REPRICE_RULES.respectFloorPrice,
      highValueThreshold: DEFAULT_REPRICE_RULES.highValueThreshold,
    };
  }

  const config = rules[0].config as RepriceRuleConfig;
  return {
    strategy: config.strategy,
    maxDailyDropPercent: config.maxDailyDropPercent,
    maxWeeklyDropPercent: config.maxWeeklyDropPercent,
    respectFloorPrice: config.respectFloorPrice,
    highValueThreshold: config.highValueThreshold,
  };
}

/**
 * Get active listings that may need repricing
 */
export async function getActiveListingsForRepricing(
  userId: string,
  itemId?: string
): Promise<RepricingContext[]> {
  // Build query conditions
  const conditions = [
    eq(inventoryItems.userId, userId),
    eq(inventoryItems.status, "active"),
  ];

  if (itemId) {
    conditions.push(eq(inventoryItems.id, itemId));
  }

  // Get items with their listings
  const items = await db
    .select({
      item: inventoryItems,
      listing: channelListings,
    })
    .from(inventoryItems)
    .innerJoin(channelListings, eq(inventoryItems.id, channelListings.itemId))
    .where(
      and(
        ...conditions,
        eq(channelListings.status, "active")
      )
    );

  // Get recent reprice actions for these items
  const itemIds = items.map((i) => i.item.id);

  const recentReprices = itemIds.length > 0
    ? await db
        .select()
        .from(autopilotActions)
        .where(
          and(
            eq(autopilotActions.actionType, "REPRICE"),
            eq(autopilotActions.status, "executed")
          )
        )
        .orderBy(desc(autopilotActions.executedAt))
    : [];

  // Map to RepricingContext
  return items.map((record) => {
    const { item, listing } = record;

    // Find last reprice for this item
    const lastReprice = recentReprices.find((r) => r.itemId === item.id);

    // Calculate days listed
    const listedAt = listing.publishedAt ?? item.listedAt ?? item.createdAt;
    const daysListed = Math.floor(
      (Date.now() - listedAt.getTime()) / (24 * 60 * 60 * 1000)
    );

    return {
      item: {
        id: item.id,
        title: item.title,
        askingPrice: item.askingPrice,
        floorPrice: item.floorPrice,
        listedAt: item.listedAt,
        costBasis: item.costBasis,
      },
      listing: {
        id: listing.id,
        channel: listing.channel,
        externalId: listing.externalId,
        price: listing.price,
        publishedAt: listing.publishedAt,
      },
      currentPrice: listing.price,
      floorPrice: item.floorPrice ?? undefined,
      daysListed,
      offers: 0, // TODO: Track offer count
      lastRepriceAt: lastReprice?.executedAt ?? null,
    };
  });
}

/**
 * Get reprice history for a user
 */
export async function getRepriceHistory(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    itemId?: string;
  } = {}
): Promise<RepriceHistoryEntry[]> {
  const { limit = 50, offset = 0, itemId } = options;

  const conditions = [
    eq(autopilotActions.userId, userId),
    eq(autopilotActions.actionType, "REPRICE"),
  ];

  if (itemId) {
    conditions.push(eq(autopilotActions.itemId, itemId));
  }

  const actions = await db
    .select()
    .from(autopilotActions)
    .where(and(...conditions))
    .orderBy(desc(autopilotActions.createdAt))
    .limit(limit)
    .offset(offset);

  return actions.map((action) => ({
    id: action.id,
    itemId: action.itemId,
    actionType: action.actionType,
    beforeState: action.beforeState,
    afterState: action.afterState,
    confidence: action.confidence,
    status: action.status,
    createdAt: action.createdAt,
    executedAt: action.executedAt,
  }));
}

/**
 * Create an autopilot action record for repricing
 */
export async function createRepriceAction(
  userId: string,
  context: RepricingContext,
  result: RepricingResult,
  ruleId?: string
): Promise<string> {
  const actionId = crypto.randomUUID();
  const now = new Date();

  // Calculate undo deadline (24 hours for price changes)
  const undoDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const requiresApproval =
    result.confidenceLevel === "LOW" ||
    result.confidenceLevel === "VERY_LOW";

  await db.insert(autopilotActions).values({
    id: actionId,
    userId,
    itemId: context.item.id,
    ruleId: ruleId ?? null,
    actionType: "REPRICE",
    confidence: result.confidence,
    confidenceLevel: result.confidenceLevel,
    beforeState: {
      price: context.currentPrice,
      listingId: context.listing.id,
      channel: context.listing.channel,
    },
    afterState: {
      price: result.newPrice,
      dropPercent: result.dropPercent,
    },
    payload: {
      reason: result.reason,
      daysListed: context.daysListed,
      floorPrice: context.floorPrice,
      externalId: context.listing.externalId,
    },
    status: requiresApproval ? "pending" : "approved",
    requiresApproval,
    reversible: true,
    undoDeadline,
    createdAt: now,
    executedAt: null,
    retryCount: 0,
  });

  return actionId;
}

/**
 * Mark a reprice action as executed
 */
export async function markRepriceExecuted(actionId: string): Promise<void> {
  await db
    .update(autopilotActions)
    .set({
      status: "executed",
      executedAt: new Date(),
    })
    .where(eq(autopilotActions.id, actionId));
}

/**
 * Mark a reprice action as failed
 */
export async function markRepriceFailed(
  actionId: string,
  errorMessage: string
): Promise<void> {
  await db
    .update(autopilotActions)
    .set({
      status: "failed",
      errorMessage,
    })
    .where(eq(autopilotActions.id, actionId));
}

/**
 * Update the listing price in the database
 */
export async function updateListingPrice(
  listingId: string,
  newPrice: number
): Promise<void> {
  await db
    .update(channelListings)
    .set({ price: newPrice })
    .where(eq(channelListings.id, listingId));
}

const repricingService = {
  evaluateReprice,
  calculateNewPrice,
  calculateTimeDecayDrop,
  checkRepriceLimit,
  incrementRepriceCount,
  getRepriceRules,
  getActiveListingsForRepricing,
  getRepriceHistory,
  createRepriceAction,
  markRepriceExecuted,
  markRepriceFailed,
  updateListingPrice,
};

export default repricingService;
