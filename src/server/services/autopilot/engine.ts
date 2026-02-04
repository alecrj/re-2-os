/**
 * Autopilot Engine
 *
 * Core decision-making engine for automated offer handling.
 * Evaluates incoming offers against user rules and calculates confidence.
 */

import { db } from "@/server/db/client";
import { autopilotRules, users, type OfferRuleConfig } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import {
  calculateConfidence,
  type ConfidenceContext,
  type ConfidenceLevel,
} from "./confidence";

// ============ TYPES ============

export interface OfferContext {
  /** User who owns the listing */
  userId: string;
  /** Inventory item ID */
  itemId: string;
  /** Unique offer ID from the marketplace */
  offerId: string;
  /** Amount the buyer is offering */
  offerAmount: number;
  /** Current asking price of the item */
  askingPrice: number;
  /** Minimum price the user will accept (optional) */
  floorPrice?: number;
  /** Estimated market value of the item */
  itemValue: number;
  /** Channel the offer came from */
  channel?: string;
  /** Buyer's username (optional) */
  buyerUsername?: string;
  /** Days the item has been listed (optional) */
  daysListed?: number;
}

export type OfferDecision = "ACCEPT" | "DECLINE" | "COUNTER" | "MANUAL_REVIEW";

export interface OfferEvaluationResult {
  /** The decision made */
  decision: OfferDecision;
  /** Counter offer amount (only if decision is COUNTER) */
  counterAmount?: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Confidence level (HIGH, MEDIUM, LOW, VERY_LOW) */
  confidenceLevel: ConfidenceLevel;
  /** Human-readable reason for the decision */
  reason: string;
  /** Whether the action should be auto-executed */
  autoExecute: boolean;
  /** Whether the action requires manual approval */
  requiresApproval: boolean;
  /** The rule configuration used for evaluation */
  ruleConfig: OfferRuleConfig;
  /** Offer percentage relative to asking price */
  offerPercent: number;
}

/** Default offer rule configuration */
export const DEFAULT_OFFER_RULE_CONFIG: OfferRuleConfig = {
  autoAcceptThreshold: 0.9, // Accept at 90%+ of asking
  autoDeclineThreshold: 0.5, // Decline at 50% or less
  autoCounterEnabled: true,
  counterStrategy: "midpoint",
  maxCounterRounds: 3,
  highValueThreshold: 200,
};

// ============ RULE LOADING ============

/**
 * Load the user's offer handling rules from the database
 */
export async function loadOfferRules(userId: string): Promise<OfferRuleConfig> {
  const rule = await db.query.autopilotRules.findFirst({
    where: and(
      eq(autopilotRules.userId, userId),
      eq(autopilotRules.ruleType, "offer"),
      eq(autopilotRules.enabled, true)
    ),
  });

  if (!rule) {
    return DEFAULT_OFFER_RULE_CONFIG;
  }

  return rule.config as OfferRuleConfig;
}

/**
 * Get the user's last activity timestamp
 */
export async function getUserLastActivity(userId: string): Promise<Date | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      updatedAt: true,
    },
  });

  return user?.updatedAt ?? null;
}

/**
 * Count how many times a specific rule has been successfully executed
 */
export async function getRuleExecutionCount(
  _userId: string,
  _ruleType: string
): Promise<number> {
  // For now, return a reasonable default. In production, query autopilotActions
  // where status = 'executed' and the rule type matches
  return 10; // Placeholder - indicates rule has been used before
}

// ============ OFFER EVALUATION ============

/**
 * Evaluate an incoming offer and determine the appropriate action
 *
 * Decision Flow:
 * 1. Load user's offer rules
 * 2. Calculate offer percentage of asking price
 * 3. Apply rules:
 *    - If offer >= autoAcceptThreshold: ACCEPT
 *    - If offer < autoDeclineThreshold: DECLINE
 *    - If counter enabled and between thresholds: COUNTER
 *    - Else: MANUAL_REVIEW
 * 4. Calculate confidence based on context
 * 5. Determine if action should be auto-executed
 */
export async function evaluateOffer(
  context: OfferContext
): Promise<OfferEvaluationResult> {
  // Step 1: Load user's offer rules
  const ruleConfig = await loadOfferRules(context.userId);

  // Step 2: Calculate offer percentage
  const offerPercent = context.offerAmount / context.askingPrice;
  const effectiveFloor = context.floorPrice ?? context.askingPrice * 0.7;

  // Step 3: Build confidence context
  const lastActivity = await getUserLastActivity(context.userId);
  const hoursSinceLastActivity = lastActivity
    ? (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60)
    : 24; // Default to 24 hours if unknown

  const ruleExecutionCount = await getRuleExecutionCount(context.userId, "offer");

  const confidenceContext: ConfidenceContext = {
    itemValue: context.itemValue,
    isFirstExecution: ruleExecutionCount === 0,
    hoursSinceLastActivity,
    ruleExecutionCount,
    daysListed: context.daysListed,
  };

  // Step 4: Determine decision based on thresholds
  let decision: OfferDecision;
  let reason: string;
  let counterAmount: number | undefined;

  // Check if high-value item requires manual review
  if (context.askingPrice >= ruleConfig.highValueThreshold) {
    decision = "MANUAL_REVIEW";
    reason = `High-value item ($${context.askingPrice}) requires manual review`;
  }
  // Check auto-accept threshold
  else if (offerPercent >= ruleConfig.autoAcceptThreshold) {
    decision = "ACCEPT";
    reason = `Offer (${(offerPercent * 100).toFixed(0)}%) meets auto-accept threshold (${(ruleConfig.autoAcceptThreshold * 100).toFixed(0)}%)`;
  }
  // Check auto-decline threshold or below floor
  else if (offerPercent <= ruleConfig.autoDeclineThreshold || context.offerAmount < effectiveFloor) {
    decision = "DECLINE";
    reason = context.offerAmount < effectiveFloor
      ? `Offer ($${context.offerAmount}) is below floor price ($${effectiveFloor})`
      : `Offer (${(offerPercent * 100).toFixed(0)}%) is below auto-decline threshold (${(ruleConfig.autoDeclineThreshold * 100).toFixed(0)}%)`;
  }
  // Check if counter is enabled
  else if (ruleConfig.autoCounterEnabled) {
    decision = "COUNTER";

    // Calculate counter amount based on strategy
    switch (ruleConfig.counterStrategy) {
      case "floor":
        counterAmount = effectiveFloor;
        break;
      case "midpoint":
        counterAmount = (context.offerAmount + context.askingPrice) / 2;
        break;
      case "asking-5%":
        counterAmount = context.askingPrice * 0.95;
        break;
      default:
        counterAmount = (context.offerAmount + context.askingPrice) / 2;
    }

    // Ensure counter is above floor and offer
    counterAmount = Math.max(counterAmount, effectiveFloor, context.offerAmount + 1);
    // Round to 2 decimal places
    counterAmount = Math.round(counterAmount * 100) / 100;

    reason = `Counter offer using ${ruleConfig.counterStrategy} strategy at $${counterAmount}`;
  }
  // No rule matched
  else {
    decision = "MANUAL_REVIEW";
    reason = "Offer between thresholds and counter is disabled";
  }

  // Step 5: Calculate confidence
  const confidenceResult = calculateConfidence(confidenceContext);

  // Step 6: Determine execution behavior
  const autoExecute =
    decision !== "MANUAL_REVIEW" &&
    (confidenceResult.level === "HIGH" || confidenceResult.level === "MEDIUM");

  const requiresApproval =
    decision !== "MANUAL_REVIEW" && confidenceResult.level === "LOW";

  return {
    decision,
    counterAmount,
    confidence: confidenceResult.score,
    confidenceLevel: confidenceResult.level,
    reason,
    autoExecute,
    requiresApproval,
    ruleConfig,
    offerPercent,
  };
}

/**
 * Validate that an offer rule configuration is valid
 */
export function validateOfferRuleConfig(config: Partial<OfferRuleConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.autoAcceptThreshold !== undefined) {
    if (config.autoAcceptThreshold < 0 || config.autoAcceptThreshold > 1) {
      errors.push("Auto-accept threshold must be between 0 and 1");
    }
  }

  if (config.autoDeclineThreshold !== undefined) {
    if (config.autoDeclineThreshold < 0 || config.autoDeclineThreshold > 1) {
      errors.push("Auto-decline threshold must be between 0 and 1");
    }
  }

  if (
    config.autoAcceptThreshold !== undefined &&
    config.autoDeclineThreshold !== undefined &&
    config.autoAcceptThreshold <= config.autoDeclineThreshold
  ) {
    errors.push("Auto-accept threshold must be greater than auto-decline threshold");
  }

  if (config.maxCounterRounds !== undefined) {
    if (config.maxCounterRounds < 1 || config.maxCounterRounds > 10) {
      errors.push("Max counter rounds must be between 1 and 10");
    }
  }

  if (config.highValueThreshold !== undefined) {
    if (config.highValueThreshold < 0) {
      errors.push("High value threshold must be positive");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
