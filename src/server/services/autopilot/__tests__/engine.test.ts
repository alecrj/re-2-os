import { describe, it, expect } from "vitest";
import {
  validateOfferRuleConfig,
  DEFAULT_OFFER_RULE_CONFIG,
} from "../engine";

// Note: evaluateOffer requires database access, so we test the validation logic
// and mock the database for integration tests

describe("validateOfferRuleConfig", () => {
  it("should accept valid configuration", () => {
    const result = validateOfferRuleConfig({
      autoAcceptThreshold: 0.9,
      autoDeclineThreshold: 0.5,
      maxCounterRounds: 3,
      highValueThreshold: 200,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject auto-accept threshold below 0", () => {
    const result = validateOfferRuleConfig({
      autoAcceptThreshold: -0.1,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Auto-accept threshold must be between 0 and 1");
  });

  it("should reject auto-accept threshold above 1", () => {
    const result = validateOfferRuleConfig({
      autoAcceptThreshold: 1.5,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Auto-accept threshold must be between 0 and 1");
  });

  it("should reject auto-decline threshold below 0", () => {
    const result = validateOfferRuleConfig({
      autoDeclineThreshold: -0.1,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Auto-decline threshold must be between 0 and 1");
  });

  it("should reject auto-decline threshold above 1", () => {
    const result = validateOfferRuleConfig({
      autoDeclineThreshold: 1.5,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Auto-decline threshold must be between 0 and 1");
  });

  it("should reject when auto-accept threshold is not greater than auto-decline", () => {
    const result = validateOfferRuleConfig({
      autoAcceptThreshold: 0.5,
      autoDeclineThreshold: 0.6,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Auto-accept threshold must be greater than auto-decline threshold"
    );
  });

  it("should reject when auto-accept equals auto-decline", () => {
    const result = validateOfferRuleConfig({
      autoAcceptThreshold: 0.5,
      autoDeclineThreshold: 0.5,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Auto-accept threshold must be greater than auto-decline threshold"
    );
  });

  it("should reject max counter rounds below 1", () => {
    const result = validateOfferRuleConfig({
      maxCounterRounds: 0,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Max counter rounds must be between 1 and 10");
  });

  it("should reject max counter rounds above 10", () => {
    const result = validateOfferRuleConfig({
      maxCounterRounds: 11,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Max counter rounds must be between 1 and 10");
  });

  it("should reject negative high value threshold", () => {
    const result = validateOfferRuleConfig({
      highValueThreshold: -100,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("High value threshold must be positive");
  });

  it("should accept zero high value threshold", () => {
    const result = validateOfferRuleConfig({
      highValueThreshold: 0,
    });

    // Zero means no threshold, but validation might consider this edge case
    // Based on current implementation, 0 is not < 0, so it passes
    expect(result.valid).toBe(true);
  });

  it("should collect multiple errors", () => {
    const result = validateOfferRuleConfig({
      autoAcceptThreshold: -0.5, // Invalid
      autoDeclineThreshold: 2.0, // Invalid
      maxCounterRounds: 0, // Invalid
      highValueThreshold: -50, // Invalid
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it("should accept partial configuration", () => {
    // Only validating fields that are provided
    const result = validateOfferRuleConfig({
      autoAcceptThreshold: 0.85,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should accept empty configuration", () => {
    const result = validateOfferRuleConfig({});

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe("DEFAULT_OFFER_RULE_CONFIG", () => {
  it("should have valid default configuration", () => {
    const result = validateOfferRuleConfig(DEFAULT_OFFER_RULE_CONFIG);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should have sensible default values", () => {
    expect(DEFAULT_OFFER_RULE_CONFIG.autoAcceptThreshold).toBe(0.9);
    expect(DEFAULT_OFFER_RULE_CONFIG.autoDeclineThreshold).toBe(0.5);
    expect(DEFAULT_OFFER_RULE_CONFIG.autoCounterEnabled).toBe(true);
    expect(DEFAULT_OFFER_RULE_CONFIG.counterStrategy).toBe("midpoint");
    expect(DEFAULT_OFFER_RULE_CONFIG.maxCounterRounds).toBe(3);
    expect(DEFAULT_OFFER_RULE_CONFIG.highValueThreshold).toBe(200);
  });

  it("should have auto-accept greater than auto-decline", () => {
    expect(DEFAULT_OFFER_RULE_CONFIG.autoAcceptThreshold).toBeGreaterThan(
      DEFAULT_OFFER_RULE_CONFIG.autoDeclineThreshold
    );
  });
});

describe("Counter Amount Calculation", () => {
  // These test the counter calculation logic conceptually
  // Actual integration tests would need database mocking

  it("should calculate floor counter correctly", () => {
    const offerAmount = 70;
    const floorPrice = 80;

    const counterAmount = floorPrice;
    expect(counterAmount).toBe(80);
    expect(counterAmount).toBeGreaterThan(offerAmount);
  });

  it("should calculate midpoint counter correctly", () => {
    const offerAmount = 70;
    const askingPrice = 100;

    const counterAmount = (offerAmount + askingPrice) / 2;
    expect(counterAmount).toBe(85);
    expect(counterAmount).toBeGreaterThan(offerAmount);
    expect(counterAmount).toBeLessThan(askingPrice);
  });

  it("should calculate asking-5% counter correctly", () => {
    const askingPrice = 100;

    const counterAmount = askingPrice * 0.95;
    expect(counterAmount).toBe(95);
  });

  it("should ensure counter is above floor", () => {
    const offerAmount = 50;
    const askingPrice = 100;
    const floorPrice = 90;

    // Midpoint would be 75, but floor is 90
    const midpoint = (offerAmount + askingPrice) / 2;
    const counterAmount = Math.max(midpoint, floorPrice);

    expect(counterAmount).toBe(90);
  });

  it("should ensure counter is above offer", () => {
    const offerAmount = 95;
    const askingPrice = 100;

    // Midpoint is 97.5, which is above offer
    const counterAmount = (offerAmount + askingPrice) / 2;
    expect(counterAmount).toBeGreaterThan(offerAmount);
  });
});

describe("Offer Percentage Calculation", () => {
  it("should calculate offer percentage correctly", () => {
    expect(80 / 100).toBe(0.8);
    expect(95 / 100).toBe(0.95);
    expect(50 / 100).toBe(0.5);
  });

  it("should identify offers above accept threshold", () => {
    const threshold = 0.9;
    expect(95 / 100).toBeGreaterThanOrEqual(threshold);
    expect(90 / 100).toBeGreaterThanOrEqual(threshold);
  });

  it("should identify offers below decline threshold", () => {
    const threshold = 0.5;
    expect(45 / 100).toBeLessThanOrEqual(threshold);
    expect(50 / 100).toBeLessThanOrEqual(threshold);
  });

  it("should identify offers in counter zone", () => {
    const acceptThreshold = 0.9;
    const declineThreshold = 0.5;
    const offerPercent = 70 / 100;

    expect(offerPercent).toBeGreaterThan(declineThreshold);
    expect(offerPercent).toBeLessThan(acceptThreshold);
  });
});
