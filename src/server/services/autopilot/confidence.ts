/**
 * Confidence Calculator for Autopilot Decisions
 *
 * Calculates a confidence score for automated actions based on various factors.
 * Higher confidence = safer to auto-execute without human review.
 */

// ============ TYPES ============

export interface ConfidenceContext {
  /** The item's current asking price */
  itemValue: number;
  /** Whether this is the first time executing this rule type for this user */
  isFirstExecution: boolean;
  /** Hours since user's last activity in the app */
  hoursSinceLastActivity: number;
  /** Whether the offer is from a buyer with no previous interactions */
  isNewBuyer?: boolean;
  /** Number of times this specific rule has been successfully executed */
  ruleExecutionCount?: number;
  /** Whether the item has been listed for a long time (might want to accept lower offers) */
  daysListed?: number;
  /** Historical accuracy of this rule (0-1 range) */
  historicalAccuracy?: number;
  /** Whether the offer is significantly outside normal patterns */
  isOutlier?: boolean;
}

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";

export interface ConfidenceResult {
  score: number;
  level: ConfidenceLevel;
  factors: ConfidenceFactor[];
}

export interface ConfidenceFactor {
  name: string;
  impact: number;
  reason: string;
}

// ============ THRESHOLDS ============

/** Price thresholds for confidence penalties */
export const VALUE_THRESHOLDS = {
  HIGH: 200,
  VERY_HIGH: 500,
  EXTREME: 1000,
} as const;

/** Confidence level thresholds */
export const CONFIDENCE_LEVELS = {
  HIGH: 0.9,
  MEDIUM: 0.7,
  LOW: 0.5,
} as const;

// ============ CORE FUNCTIONS ============

/**
 * Calculate confidence score for an autopilot decision
 *
 * @param context - Context factors affecting confidence
 * @returns Confidence result with score, level, and contributing factors
 */
export function calculateConfidence(context: ConfidenceContext): ConfidenceResult {
  let score = 1.0;
  const factors: ConfidenceFactor[] = [];

  // Item value penalty - higher value items need more scrutiny
  if (context.itemValue > VALUE_THRESHOLDS.EXTREME) {
    const impact = 0.5; // Multiply by 0.5 = halve the confidence
    score *= impact;
    factors.push({
      name: "extreme_value",
      impact: -0.5,
      reason: `Item value ($${context.itemValue}) exceeds $${VALUE_THRESHOLDS.EXTREME}`,
    });
  } else if (context.itemValue > VALUE_THRESHOLDS.VERY_HIGH) {
    const impact = 0.6;
    score *= impact;
    factors.push({
      name: "very_high_value",
      impact: -0.4,
      reason: `Item value ($${context.itemValue}) exceeds $${VALUE_THRESHOLDS.VERY_HIGH}`,
    });
  } else if (context.itemValue > VALUE_THRESHOLDS.HIGH) {
    const impact = 0.8;
    score *= impact;
    factors.push({
      name: "high_value",
      impact: -0.2,
      reason: `Item value ($${context.itemValue}) exceeds $${VALUE_THRESHOLDS.HIGH}`,
    });
  }

  // First-time rule execution penalty
  if (context.isFirstExecution) {
    const impact = 0.7;
    score *= impact;
    factors.push({
      name: "first_execution",
      impact: -0.3,
      reason: "First time executing this rule type",
    });
  }

  // User inactivity penalty
  if (context.hoursSinceLastActivity > 72) {
    const impact = 0.7;
    score *= impact;
    factors.push({
      name: "user_inactive_long",
      impact: -0.3,
      reason: `User inactive for ${Math.round(context.hoursSinceLastActivity)} hours`,
    });
  } else if (context.hoursSinceLastActivity > 24) {
    const impact = 0.9;
    score *= impact;
    factors.push({
      name: "user_inactive",
      impact: -0.1,
      reason: `User inactive for ${Math.round(context.hoursSinceLastActivity)} hours`,
    });
  }

  // New buyer penalty (optional factor)
  if (context.isNewBuyer) {
    const impact = 0.95;
    score *= impact;
    factors.push({
      name: "new_buyer",
      impact: -0.05,
      reason: "Offer from a buyer with no previous interactions",
    });
  }

  // Low rule execution count penalty
  if (context.ruleExecutionCount !== undefined && context.ruleExecutionCount < 5) {
    const impact = 0.9;
    score *= impact;
    factors.push({
      name: "low_execution_count",
      impact: -0.1,
      reason: `Rule has only been executed ${context.ruleExecutionCount} times`,
    });
  }

  // Long listing duration bonus (more willing to accept offers on stale items)
  if (context.daysListed !== undefined && context.daysListed > 30) {
    const impact = 1.05; // Slight bonus
    score *= impact;
    factors.push({
      name: "stale_listing",
      impact: 0.05,
      reason: `Item listed for ${context.daysListed} days`,
    });
  }

  // Historical accuracy bonus/penalty
  if (context.historicalAccuracy !== undefined) {
    if (context.historicalAccuracy >= 0.95) {
      const impact = 1.1;
      score *= impact;
      factors.push({
        name: "high_accuracy",
        impact: 0.1,
        reason: `Rule has ${(context.historicalAccuracy * 100).toFixed(0)}% historical accuracy`,
      });
    } else if (context.historicalAccuracy < 0.7) {
      const impact = 0.8;
      score *= impact;
      factors.push({
        name: "low_accuracy",
        impact: -0.2,
        reason: `Rule has only ${(context.historicalAccuracy * 100).toFixed(0)}% historical accuracy`,
      });
    }
  }

  // Outlier penalty
  if (context.isOutlier) {
    const impact = 0.6;
    score *= impact;
    factors.push({
      name: "outlier_pattern",
      impact: -0.4,
      reason: "Offer significantly outside normal patterns",
    });
  }

  // Clamp score between 0 and 1
  score = Math.max(0, Math.min(1, score));

  return {
    score,
    level: getConfidenceLevel(score),
    factors,
  };
}

/**
 * Convert numeric confidence score to discrete level
 *
 * @param score - Confidence score (0-1)
 * @returns Confidence level (HIGH, MEDIUM, LOW, VERY_LOW)
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_LEVELS.HIGH) return "HIGH";
  if (score >= CONFIDENCE_LEVELS.MEDIUM) return "MEDIUM";
  if (score >= CONFIDENCE_LEVELS.LOW) return "LOW";
  return "VERY_LOW";
}

/**
 * Determine if an action should be auto-executed based on confidence level
 *
 * @param level - Confidence level
 * @returns Whether the action should be auto-executed
 */
export function shouldAutoExecute(level: ConfidenceLevel): boolean {
  return level === "HIGH" || level === "MEDIUM";
}

/**
 * Determine if an action should require manual approval
 *
 * @param level - Confidence level
 * @returns Whether the action requires approval
 */
export function requiresApproval(level: ConfidenceLevel): boolean {
  return level === "LOW";
}

/**
 * Determine if an action should be logged only (not executed)
 *
 * @param level - Confidence level
 * @returns Whether the action should be logged only
 */
export function logOnly(level: ConfidenceLevel): boolean {
  return level === "VERY_LOW";
}

/**
 * Get a human-readable description of confidence level
 */
export function getConfidenceLevelDescription(level: ConfidenceLevel): string {
  switch (level) {
    case "HIGH":
      return "High confidence - safe to auto-execute";
    case "MEDIUM":
      return "Medium confidence - auto-execute with monitoring";
    case "LOW":
      return "Low confidence - requires manual approval";
    case "VERY_LOW":
      return "Very low confidence - logged only, no action taken";
  }
}
