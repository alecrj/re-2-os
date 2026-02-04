/**
 * Repricing Service Tests
 *
 * Tests for the time decay repricing strategy and guardrails.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  evaluateReprice,
  calculateNewPrice,
  calculateTimeDecayDrop,
  checkRepriceLimit,
  incrementRepriceCount,
  type RepricingContext,
  type RepriceRules,
} from "../repricing";

// Mock the database
vi.mock("@/server/db/client", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Repricing Service", () => {
  // ============ CALCULATE TIME DECAY DROP ============

  describe("calculateTimeDecayDrop", () => {
    it("should return 0% drop for items within initial period", () => {
      const result = calculateTimeDecayDrop(7, 14);
      expect(result.dropPercent).toBe(0);
      expect(result.dropReason).toContain("initial listing period");
    });

    it("should return 0% drop at exactly the threshold day", () => {
      const result = calculateTimeDecayDrop(14, 14);
      expect(result.dropPercent).toBe(0);
    });

    it("should return 5% drop for items 15-29 days old (first tier)", () => {
      const result = calculateTimeDecayDrop(20, 14);
      expect(result.dropPercent).toBe(5);
      expect(result.dropReason).toContain("First price drop");
    });

    it("should return 10% drop for items 30-44 days old (second tier)", () => {
      const result = calculateTimeDecayDrop(35, 14);
      expect(result.dropPercent).toBe(10);
      expect(result.dropReason).toContain("tier 2");
    });

    it("should return 15% drop for items 45-59 days old (third tier)", () => {
      const result = calculateTimeDecayDrop(50, 14);
      expect(result.dropPercent).toBe(15);
      expect(result.dropReason).toContain("tier 3");
    });

    it("should return 20% drop for items 60-74 days old (fourth tier)", () => {
      const result = calculateTimeDecayDrop(65, 14);
      expect(result.dropPercent).toBe(20);
      expect(result.dropReason).toContain("tier 4");
    });

    it("should cap drops at 50% for very old items", () => {
      const result = calculateTimeDecayDrop(200, 14);
      expect(result.dropPercent).toBe(50);
      expect(result.dropReason).toContain("Extended time decay");
    });

    it("should respect custom days before first drop", () => {
      const result = calculateTimeDecayDrop(7, 7);
      expect(result.dropPercent).toBe(0);

      const result2 = calculateTimeDecayDrop(10, 7);
      expect(result2.dropPercent).toBe(5);
    });
  });

  // ============ CALCULATE NEW PRICE ============

  describe("calculateNewPrice", () => {
    it("should calculate correct new price with percentage drop", () => {
      const newPrice = calculateNewPrice(100, undefined, 10);
      expect(newPrice).toBe(90);
    });

    it("should round to 2 decimal places", () => {
      const newPrice = calculateNewPrice(99.99, undefined, 10);
      expect(newPrice).toBe(89.99);
    });

    it("should respect floor price", () => {
      const newPrice = calculateNewPrice(100, 95, 10);
      expect(newPrice).toBe(95);
    });

    it("should never go below $1", () => {
      const newPrice = calculateNewPrice(1.5, undefined, 80);
      expect(newPrice).toBe(1);
    });

    it("should handle undefined floor price", () => {
      const newPrice = calculateNewPrice(50, undefined, 20);
      expect(newPrice).toBe(40);
    });

    it("should not reduce below floor even with large drop", () => {
      const newPrice = calculateNewPrice(100, 90, 50);
      expect(newPrice).toBe(90);
    });
  });

  // ============ RATE LIMITING ============

  describe("checkRepriceLimit", () => {
    beforeEach(() => {
      // Clear the rate limit map by checking with a fresh user each test
    });

    it("should allow repricing for a new user", () => {
      const userId = `test-user-${Date.now()}-${Math.random()}`;
      const result = checkRepriceLimit(userId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100);
    });

    it("should track increments correctly", () => {
      const userId = `test-user-increment-${Date.now()}`;

      // Initial check
      let result = checkRepriceLimit(userId);
      expect(result.remaining).toBe(100);

      // Increment once
      incrementRepriceCount(userId);
      result = checkRepriceLimit(userId);
      expect(result.remaining).toBe(99);

      // Increment again
      incrementRepriceCount(userId);
      result = checkRepriceLimit(userId);
      expect(result.remaining).toBe(98);
    });

    it("should have a reset time in the future", () => {
      const userId = `test-user-reset-${Date.now()}`;
      const result = checkRepriceLimit(userId);

      expect(result.resetsAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  // ============ EVALUATE REPRICE ============

  describe("evaluateReprice", () => {
    const defaultRules: RepriceRules = {
      strategy: "time_decay",
      maxDailyDropPercent: 0.1, // 10%
      maxWeeklyDropPercent: 0.2, // 20%
      respectFloorPrice: true,
      highValueThreshold: 200,
      daysBeforeFirstDrop: 14,
    };

    function createContext(overrides: Partial<RepricingContext> = {}): RepricingContext {
      return {
        item: {
          id: "item-1",
          title: "Test Item",
          askingPrice: 100,
          floorPrice: 70,
          listedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          costBasis: 50,
        },
        listing: {
          id: "listing-1",
          channel: "ebay",
          externalId: "ext-123",
          price: 100,
          publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
        currentPrice: 100,
        floorPrice: 70,
        daysListed: 30,
        offers: 0,
        lastRepriceAt: null,
        ...overrides,
      };
    }

    it("should not reprice items in initial period", async () => {
      const context = createContext({ daysListed: 10 });
      const result = await evaluateReprice(context, defaultRules);

      expect(result.shouldReprice).toBe(false);
      expect(result.reason).toContain("initial listing period");
    });

    it("should reprice items past initial period", async () => {
      const context = createContext({ daysListed: 20 });
      const result = await evaluateReprice(context, defaultRules);

      expect(result.shouldReprice).toBe(true);
      expect(result.newPrice).toBeDefined();
      expect(result.newPrice!).toBeLessThan(context.currentPrice);
    });

    it("should not go below floor price", async () => {
      const context = createContext({
        daysListed: 100,
        currentPrice: 75,
        floorPrice: 70,
      });
      const result = await evaluateReprice(context, defaultRules);

      if (result.newPrice) {
        expect(result.newPrice).toBeGreaterThanOrEqual(70);
      }
    });

    it("should have lower confidence for high-value items", async () => {
      const context = createContext({
        daysListed: 30,
        currentPrice: 500,
        floorPrice: 300,
      });
      const result = await evaluateReprice(context, defaultRules);

      expect(result.confidence).toBeLessThanOrEqual(0.5);
      expect(result.confidenceLevel).not.toBe("HIGH");
    });

    it("should skip if already at floor price", async () => {
      const context = createContext({
        daysListed: 60,
        currentPrice: 70,
        floorPrice: 70,
      });
      const result = await evaluateReprice(context, defaultRules);

      expect(result.shouldReprice).toBe(false);
      expect(result.reason).toContain("floor price");
    });

    it("should apply daily drop limit", async () => {
      const rules: RepriceRules = {
        ...defaultRules,
        maxDailyDropPercent: 0.05, // 5% max daily
      };
      const context = createContext({ daysListed: 100 }); // Would normally be large drop

      const result = await evaluateReprice(context, rules);

      if (result.dropPercent) {
        expect(result.dropPercent).toBeLessThanOrEqual(5);
      }
    });

    it("should skip if repriced recently", async () => {
      const context = createContext({
        daysListed: 30,
        lastRepriceAt: new Date(), // Repriced just now
      });
      const result = await evaluateReprice(context, defaultRules);

      expect(result.shouldReprice).toBe(false);
      expect(result.reason).toContain("Already repriced today");
    });

    it("should return HIGH confidence for normal time decay", async () => {
      const context = createContext({ daysListed: 20 });
      const result = await evaluateReprice(context, defaultRules);

      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.confidenceLevel).toBe("HIGH");
    });

    it("should handle performance strategy fallback", async () => {
      const rules: RepriceRules = {
        ...defaultRules,
        strategy: "performance",
      };
      const context = createContext({ daysListed: 30 });
      const result = await evaluateReprice(context, rules);

      // Should still work (falls back to time decay)
      expect(result.reason).toContain("performance strategy pending");
    });

    it("should handle competitive strategy fallback", async () => {
      const rules: RepriceRules = {
        ...defaultRules,
        strategy: "competitive",
      };
      const context = createContext({ daysListed: 30 });
      const result = await evaluateReprice(context, rules);

      // Should still work (falls back to time decay)
      expect(result.reason).toContain("competitive strategy pending");
    });
  });

  // ============ EDGE CASES ============

  describe("Edge Cases", () => {
    const rules: RepriceRules = {
      strategy: "time_decay",
      maxDailyDropPercent: 0.1,
      maxWeeklyDropPercent: 0.2,
      respectFloorPrice: true,
      highValueThreshold: 200,
    };

    it("should handle items with no floor price", async () => {
      const context: RepricingContext = {
        item: {
          id: "item-1",
          title: "Test Item",
          askingPrice: 100,
          floorPrice: null,
          listedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          costBasis: null,
        },
        listing: {
          id: "listing-1",
          channel: "ebay",
          externalId: "ext-123",
          price: 100,
          publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
        currentPrice: 100,
        floorPrice: undefined,
        daysListed: 30,
        offers: 0,
        lastRepriceAt: null,
      };

      const result = await evaluateReprice(context, rules);

      // Should still reprice
      expect(result.shouldReprice).toBe(true);
    });

    it("should handle zero days listed", async () => {
      const result = calculateTimeDecayDrop(0, 14);
      expect(result.dropPercent).toBe(0);
    });

    it("should handle very small prices", async () => {
      const newPrice = calculateNewPrice(2.5, 1, 10);
      expect(newPrice).toBeGreaterThanOrEqual(1);
    });

    it("should handle price equal to floor", () => {
      const newPrice = calculateNewPrice(50, 50, 10);
      expect(newPrice).toBe(50);
    });
  });
});
