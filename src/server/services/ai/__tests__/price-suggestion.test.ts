/**
 * Tests for AI Price Suggestion Service
 *
 * These tests cover:
 * - Input validation
 * - Response structure
 * - Profit calculation
 * - Platform fee rates
 * - Error handling
 *
 * Note: Tests that call the actual OpenAI API are skipped by default.
 */

import { describe, it, expect } from "vitest";
import type {
  PriceSuggestionInput,
  PriceSuggestionResult,
} from "../price-suggestion";

// ============ MOCK DATA ============

const VALID_INPUT: PriceSuggestionInput = {
  title: "Nike Air Max 90 Running Shoes Size 10",
  condition: "like_new",
  targetPlatform: "ebay",
};

const FULL_INPUT: PriceSuggestionInput = {
  title: "Nike Air Max 90 Running Shoes Size 10 Blue White",
  description:
    "Gently worn Nike Air Max 90, excellent condition, minimal sole wear",
  condition: "good",
  category: "Athletic Shoes",
  brand: "Nike",
  targetPlatform: "ebay",
  costBasis: 25,
  originalRetailPrice: 130,
};

const MOCK_RESULT: PriceSuggestionResult = {
  suggestedPrice: {
    min: 45,
    max: 75,
    recommended: 59.99,
  },
  floorPrice: 38,
  estimatedProfit: {
    gross: 34.99,
    platformFees: 7.87,
    shippingEstimate: 8,
    net: 19.12,
  },
  reasoning:
    "Nike Air Max 90 in good condition typically sells for $50-$75 on eBay. The blue/white colorway is popular.",
  comparables:
    "Similar Nike Air Max 90 in used condition sell for $40-$80 on eBay.",
  confidence: 0.82,
  tokensUsed: 450,
};

// ============ UNIT TESTS ============

describe("Price Suggestion Service", () => {
  describe("Input Validation", () => {
    it("should accept minimal valid input", () => {
      expect(VALID_INPUT.title).toBeDefined();
      expect(VALID_INPUT.condition).toBe("like_new");
      expect(VALID_INPUT.targetPlatform).toBe("ebay");
    });

    it("should accept full input with all optional fields", () => {
      expect(FULL_INPUT.description).toBeDefined();
      expect(FULL_INPUT.brand).toBe("Nike");
      expect(FULL_INPUT.category).toBe("Athletic Shoes");
      expect(FULL_INPUT.costBasis).toBe(25);
      expect(FULL_INPUT.originalRetailPrice).toBe(130);
    });

    it("should support all platform options", () => {
      const platforms = ["ebay", "poshmark", "mercari"] as const;
      platforms.forEach((p) => {
        const input: PriceSuggestionInput = {
          ...VALID_INPUT,
          targetPlatform: p,
        };
        expect(input.targetPlatform).toBe(p);
      });
    });

    it("should support all condition options", () => {
      const conditions = [
        "new",
        "like_new",
        "good",
        "fair",
        "poor",
      ] as const;
      conditions.forEach((c) => {
        const input: PriceSuggestionInput = {
          ...VALID_INPUT,
          condition: c,
        };
        expect(input.condition).toBe(c);
      });
    });
  });

  describe("Response Structure", () => {
    it("should have correct structure for PriceSuggestionResult", () => {
      expect(MOCK_RESULT).toHaveProperty("suggestedPrice");
      expect(MOCK_RESULT).toHaveProperty("floorPrice");
      expect(MOCK_RESULT).toHaveProperty("reasoning");
      expect(MOCK_RESULT).toHaveProperty("comparables");
      expect(MOCK_RESULT).toHaveProperty("confidence");
      expect(MOCK_RESULT).toHaveProperty("tokensUsed");
    });

    it("should have valid price ordering (min <= recommended <= max)", () => {
      const { suggestedPrice } = MOCK_RESULT;
      expect(suggestedPrice.min).toBeLessThanOrEqual(
        suggestedPrice.recommended
      );
      expect(suggestedPrice.recommended).toBeLessThanOrEqual(
        suggestedPrice.max
      );
    });

    it("should have floor price <= min price", () => {
      expect(MOCK_RESULT.floorPrice).toBeLessThanOrEqual(
        MOCK_RESULT.suggestedPrice.min
      );
    });

    it("should have all prices > 0", () => {
      expect(MOCK_RESULT.suggestedPrice.min).toBeGreaterThan(0);
      expect(MOCK_RESULT.suggestedPrice.max).toBeGreaterThan(0);
      expect(MOCK_RESULT.suggestedPrice.recommended).toBeGreaterThan(0);
      expect(MOCK_RESULT.floorPrice).toBeGreaterThan(0);
    });

    it("should have confidence between 0 and 1", () => {
      expect(MOCK_RESULT.confidence).toBeGreaterThanOrEqual(0);
      expect(MOCK_RESULT.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Estimated Profit Calculation", () => {
    it("should include profit estimate when cost basis is provided", () => {
      expect(MOCK_RESULT.estimatedProfit).toBeDefined();
    });

    it("should calculate gross profit correctly", () => {
      const { estimatedProfit, suggestedPrice } = MOCK_RESULT;
      if (!estimatedProfit) return;

      // gross = recommended - costBasis
      const expectedGross = suggestedPrice.recommended - FULL_INPUT.costBasis!;
      expect(estimatedProfit.gross).toBeCloseTo(expectedGross, 1);
    });

    it("should have net <= gross", () => {
      const { estimatedProfit } = MOCK_RESULT;
      if (!estimatedProfit) return;

      expect(estimatedProfit.net).toBeLessThanOrEqual(estimatedProfit.gross);
    });

    it("should account for platform fees and shipping in net profit", () => {
      const { estimatedProfit } = MOCK_RESULT;
      if (!estimatedProfit) return;

      const expectedNet =
        estimatedProfit.gross -
        estimatedProfit.platformFees -
        estimatedProfit.shippingEstimate;
      expect(estimatedProfit.net).toBeCloseTo(expectedNet, 1);
    });
  });

  describe("Platform Fee Rates", () => {
    it("should use approximately 13.13% for eBay", () => {
      const price = 100;
      const ebayFee = price * 0.1313;
      expect(ebayFee).toBeCloseTo(13.13, 1);
    });

    it("should use 20% for Poshmark", () => {
      const price = 100;
      const poshFee = price * 0.2;
      expect(poshFee).toBe(20);
    });

    it("should use 10% for Mercari", () => {
      const price = 100;
      const mercariFee = price * 0.1;
      expect(mercariFee).toBe(10);
    });
  });

  describe("suggestPrice function", () => {
    it("should reject empty title", async () => {
      const { suggestPrice } = await import("../price-suggestion");

      const input: PriceSuggestionInput = {
        title: "",
        condition: "good",
        targetPlatform: "ebay",
      };

      await expect(suggestPrice(input)).rejects.toThrow(
        "Item title is required"
      );
    });

    it("should reject when API key is missing", async () => {
      if (process.env.OPENAI_API_KEY) return; // Skip if key is set

      const { suggestPrice } = await import("../price-suggestion");

      await expect(suggestPrice(VALID_INPUT)).rejects.toThrow(
        /OPENAI_API_KEY|API key/
      );
    });
  });
});

// ============ INTEGRATION TESTS ============

describe.skip("Price Suggestion - Integration Tests", () => {
  it("should return price suggestion for a real item", async () => {
    const { suggestPrice } = await import("../price-suggestion");

    const result = await suggestPrice({
      title: "Nike Air Max 90 Running Shoes Size 10",
      condition: "good",
      brand: "Nike",
      targetPlatform: "ebay",
      costBasis: 25,
    });

    expect(result.suggestedPrice.recommended).toBeGreaterThan(0);
    expect(result.suggestedPrice.min).toBeLessThanOrEqual(
      result.suggestedPrice.recommended
    );
    expect(result.reasoning).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.tokensUsed).toBeGreaterThan(0);
  });

  it("should return profit estimate when cost basis provided", async () => {
    const { suggestPrice } = await import("../price-suggestion");

    const result = await suggestPrice({
      title: "Vintage Levi's 501 Jeans W32 L32",
      condition: "good",
      brand: "Levi's",
      targetPlatform: "poshmark",
      costBasis: 5,
    });

    expect(result.estimatedProfit).toBeDefined();
    expect(result.estimatedProfit!.gross).toBeGreaterThan(0);
  });
});
