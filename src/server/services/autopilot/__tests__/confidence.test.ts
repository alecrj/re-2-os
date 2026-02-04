import { describe, it, expect } from "vitest";
import {
  calculateConfidence,
  getConfidenceLevel,
  shouldAutoExecute,
  requiresApproval,
  logOnly,
  VALUE_THRESHOLDS,
  CONFIDENCE_LEVELS,
} from "../confidence";

describe("calculateConfidence", () => {
  it("should return high confidence for low-value items with experienced user", () => {
    const result = calculateConfidence({
      itemValue: 50,
      isFirstExecution: false,
      hoursSinceLastActivity: 1,
      ruleExecutionCount: 20,
    });

    expect(result.score).toBeGreaterThanOrEqual(CONFIDENCE_LEVELS.HIGH);
    expect(result.level).toBe("HIGH");
    expect(result.factors).toHaveLength(0);
  });

  it("should reduce confidence for high-value items", () => {
    const result = calculateConfidence({
      itemValue: VALUE_THRESHOLDS.HIGH + 50, // 250
      isFirstExecution: false,
      hoursSinceLastActivity: 1,
    });

    expect(result.score).toBeLessThan(1.0);
    expect(result.factors.some((f) => f.name === "high_value")).toBe(true);
  });

  it("should reduce confidence significantly for very high-value items", () => {
    const result = calculateConfidence({
      itemValue: VALUE_THRESHOLDS.VERY_HIGH + 100, // 600
      isFirstExecution: false,
      hoursSinceLastActivity: 1,
    });

    expect(result.score).toBeLessThanOrEqual(0.6);
    expect(result.factors.some((f) => f.name === "very_high_value")).toBe(true);
  });

  it("should reduce confidence for extreme value items", () => {
    const result = calculateConfidence({
      itemValue: VALUE_THRESHOLDS.EXTREME + 100, // 1100
      isFirstExecution: false,
      hoursSinceLastActivity: 1,
    });

    expect(result.score).toBeLessThanOrEqual(0.5);
    expect(result.factors.some((f) => f.name === "extreme_value")).toBe(true);
  });

  it("should reduce confidence for first-time rule execution", () => {
    const result = calculateConfidence({
      itemValue: 50,
      isFirstExecution: true,
      hoursSinceLastActivity: 1,
    });

    expect(result.score).toBeLessThan(1.0);
    expect(result.factors.some((f) => f.name === "first_execution")).toBe(true);
  });

  it("should reduce confidence for inactive users (24h+)", () => {
    const result = calculateConfidence({
      itemValue: 50,
      isFirstExecution: false,
      hoursSinceLastActivity: 30,
    });

    expect(result.score).toBeLessThan(1.0);
    expect(result.factors.some((f) => f.name === "user_inactive")).toBe(true);
  });

  it("should reduce confidence more for very inactive users (72h+)", () => {
    const result = calculateConfidence({
      itemValue: 50,
      isFirstExecution: false,
      hoursSinceLastActivity: 80,
    });

    expect(result.score).toBeLessThan(0.8);
    expect(result.factors.some((f) => f.name === "user_inactive_long")).toBe(true);
  });

  it("should slightly reduce confidence for new buyers", () => {
    const result = calculateConfidence({
      itemValue: 50,
      isFirstExecution: false,
      hoursSinceLastActivity: 1,
      isNewBuyer: true,
    });

    expect(result.score).toBeLessThan(1.0);
    expect(result.factors.some((f) => f.name === "new_buyer")).toBe(true);
  });

  it("should boost confidence for stale listings", () => {
    const result = calculateConfidence({
      itemValue: 50,
      isFirstExecution: false,
      hoursSinceLastActivity: 1,
      daysListed: 45,
    });

    // Score is clamped to 1.0 max, but the factor should still be present
    expect(result.score).toBe(1.0);
    expect(result.factors.some((f) => f.name === "stale_listing")).toBe(true);
    expect(result.factors.some((f) => f.impact > 0)).toBe(true); // Has a positive boost
  });

  it("should boost confidence for high historical accuracy", () => {
    const result = calculateConfidence({
      itemValue: 50,
      isFirstExecution: false,
      hoursSinceLastActivity: 1,
      historicalAccuracy: 0.98,
    });

    // Score is clamped to 1.0 max, but the factor should still be present
    expect(result.score).toBe(1.0);
    expect(result.factors.some((f) => f.name === "high_accuracy")).toBe(true);
    expect(result.factors.some((f) => f.impact > 0)).toBe(true); // Has a positive boost
  });

  it("should reduce confidence for low historical accuracy", () => {
    const result = calculateConfidence({
      itemValue: 50,
      isFirstExecution: false,
      hoursSinceLastActivity: 1,
      historicalAccuracy: 0.5,
    });

    expect(result.score).toBeLessThan(1.0);
    expect(result.factors.some((f) => f.name === "low_accuracy")).toBe(true);
  });

  it("should reduce confidence for outlier patterns", () => {
    const result = calculateConfidence({
      itemValue: 50,
      isFirstExecution: false,
      hoursSinceLastActivity: 1,
      isOutlier: true,
    });

    expect(result.score).toBeLessThan(0.7);
    expect(result.factors.some((f) => f.name === "outlier_pattern")).toBe(true);
  });

  it("should compound multiple penalties", () => {
    const result = calculateConfidence({
      itemValue: VALUE_THRESHOLDS.HIGH + 50, // High value penalty
      isFirstExecution: true, // First execution penalty
      hoursSinceLastActivity: 30, // Inactivity penalty
    });

    // Should have multiple factors
    expect(result.factors.length).toBeGreaterThanOrEqual(3);
    // Score should be significantly reduced
    expect(result.score).toBeLessThan(0.6);
  });

  it("should clamp score between 0 and 1", () => {
    // Very negative scenario
    const lowResult = calculateConfidence({
      itemValue: VALUE_THRESHOLDS.EXTREME + 500,
      isFirstExecution: true,
      hoursSinceLastActivity: 100,
      isOutlier: true,
      historicalAccuracy: 0.3,
    });

    expect(lowResult.score).toBeGreaterThanOrEqual(0);
    expect(lowResult.score).toBeLessThanOrEqual(1);

    // Very positive scenario (multiple boosts)
    const highResult = calculateConfidence({
      itemValue: 10,
      isFirstExecution: false,
      hoursSinceLastActivity: 1,
      daysListed: 60,
      historicalAccuracy: 0.99,
      ruleExecutionCount: 100,
    });

    expect(highResult.score).toBeGreaterThanOrEqual(0);
    expect(highResult.score).toBeLessThanOrEqual(1);
  });
});

describe("getConfidenceLevel", () => {
  it("should return HIGH for scores >= 0.9", () => {
    expect(getConfidenceLevel(0.9)).toBe("HIGH");
    expect(getConfidenceLevel(0.95)).toBe("HIGH");
    expect(getConfidenceLevel(1.0)).toBe("HIGH");
  });

  it("should return MEDIUM for scores >= 0.7 and < 0.9", () => {
    expect(getConfidenceLevel(0.7)).toBe("MEDIUM");
    expect(getConfidenceLevel(0.8)).toBe("MEDIUM");
    expect(getConfidenceLevel(0.89)).toBe("MEDIUM");
  });

  it("should return LOW for scores >= 0.5 and < 0.7", () => {
    expect(getConfidenceLevel(0.5)).toBe("LOW");
    expect(getConfidenceLevel(0.6)).toBe("LOW");
    expect(getConfidenceLevel(0.69)).toBe("LOW");
  });

  it("should return VERY_LOW for scores < 0.5", () => {
    expect(getConfidenceLevel(0.49)).toBe("VERY_LOW");
    expect(getConfidenceLevel(0.3)).toBe("VERY_LOW");
    expect(getConfidenceLevel(0)).toBe("VERY_LOW");
  });
});

describe("shouldAutoExecute", () => {
  it("should return true for HIGH confidence", () => {
    expect(shouldAutoExecute("HIGH")).toBe(true);
  });

  it("should return true for MEDIUM confidence", () => {
    expect(shouldAutoExecute("MEDIUM")).toBe(true);
  });

  it("should return false for LOW confidence", () => {
    expect(shouldAutoExecute("LOW")).toBe(false);
  });

  it("should return false for VERY_LOW confidence", () => {
    expect(shouldAutoExecute("VERY_LOW")).toBe(false);
  });
});

describe("requiresApproval", () => {
  it("should return false for HIGH confidence", () => {
    expect(requiresApproval("HIGH")).toBe(false);
  });

  it("should return false for MEDIUM confidence", () => {
    expect(requiresApproval("MEDIUM")).toBe(false);
  });

  it("should return true for LOW confidence", () => {
    expect(requiresApproval("LOW")).toBe(true);
  });

  it("should return false for VERY_LOW confidence", () => {
    expect(requiresApproval("VERY_LOW")).toBe(false);
  });
});

describe("logOnly", () => {
  it("should return false for HIGH confidence", () => {
    expect(logOnly("HIGH")).toBe(false);
  });

  it("should return false for MEDIUM confidence", () => {
    expect(logOnly("MEDIUM")).toBe(false);
  });

  it("should return false for LOW confidence", () => {
    expect(logOnly("LOW")).toBe(false);
  });

  it("should return true for VERY_LOW confidence", () => {
    expect(logOnly("VERY_LOW")).toBe(true);
  });
});
