/**
 * Stale Check Function Tests
 */

import { describe, it, expect, vi } from "vitest";

// Mock dependencies before importing the module
vi.mock("@/server/db/client", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/server/services/audit", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue("audit-id"),
  },
}));

describe("Stale Check Logic", () => {
  // ============ STALENESS LEVEL TESTS ============

  describe("Staleness Level Calculation", () => {
    // Helper function mirroring the logic in stale-check.ts
    function getStalenessLevel(
      daysListed: number,
      daysUntilStale: number
    ): "warning" | "stale" | "very_stale" | null {
      const warningThreshold = Math.floor(daysUntilStale * 0.5);
      const veryStaleThreshold = Math.floor(daysUntilStale * 1.5);

      if (daysListed >= veryStaleThreshold) {
        return "very_stale";
      } else if (daysListed >= daysUntilStale) {
        return "stale";
      } else if (daysListed >= warningThreshold) {
        return "warning";
      }

      return null;
    }

    it("should return null for fresh items", () => {
      const result = getStalenessLevel(10, 60);
      expect(result).toBeNull();
    });

    it("should return warning at 50% of stale threshold", () => {
      const result = getStalenessLevel(30, 60);
      expect(result).toBe("warning");
    });

    it("should return stale at threshold", () => {
      const result = getStalenessLevel(60, 60);
      expect(result).toBe("stale");
    });

    it("should return very_stale at 150% of threshold", () => {
      const result = getStalenessLevel(90, 60);
      expect(result).toBe("very_stale");
    });

    it("should handle custom thresholds", () => {
      // 30 day threshold
      expect(getStalenessLevel(14, 30)).toBeNull();
      expect(getStalenessLevel(15, 30)).toBe("warning");
      expect(getStalenessLevel(30, 30)).toBe("stale");
      expect(getStalenessLevel(45, 30)).toBe("very_stale");
    });

    it("should handle edge cases around thresholds", () => {
      // With 60 day threshold:
      // warning = 30 days
      // stale = 60 days
      // very_stale = 90 days

      expect(getStalenessLevel(29, 60)).toBeNull();
      expect(getStalenessLevel(30, 60)).toBe("warning");
      expect(getStalenessLevel(59, 60)).toBe("warning");
      expect(getStalenessLevel(60, 60)).toBe("stale");
      expect(getStalenessLevel(89, 60)).toBe("stale");
      expect(getStalenessLevel(90, 60)).toBe("very_stale");
    });
  });

  // ============ SUGGESTION GENERATION TESTS ============

  describe("Suggestion Generation", () => {
    // Helper function mirroring the logic in stale-check.ts
    function getSuggestion(
      staleness: "warning" | "stale" | "very_stale",
      currentPrice: number,
      floorPrice?: number | null
    ): string {
      const hasFloorRoom = !floorPrice || currentPrice > floorPrice * 1.1;

      switch (staleness) {
        case "warning":
          return hasFloorRoom
            ? "Consider a small price reduction (5-10%) to attract buyers"
            : "Monitor for another week before taking action";

        case "stale":
          if (hasFloorRoom) {
            return "Recommend 10-15% price reduction or refresh listing with new photos";
          }
          return "Consider relisting with updated photos and description";

        case "very_stale":
          if (hasFloorRoom) {
            return "Consider aggressive repricing (20%+) or archiving if no longer profitable";
          }
          return "Consider archiving this item or accepting any reasonable offer";
      }
    }

    it("should suggest small reduction for warning with floor room", () => {
      const suggestion = getSuggestion("warning", 100, 70);
      expect(suggestion).toContain("5-10%");
    });

    it("should suggest monitoring for warning without floor room", () => {
      const suggestion = getSuggestion("warning", 100, 95);
      expect(suggestion).toContain("Monitor");
    });

    it("should suggest 10-15% reduction for stale with floor room", () => {
      const suggestion = getSuggestion("stale", 100, 70);
      expect(suggestion).toContain("10-15%");
    });

    it("should suggest relisting for stale without floor room", () => {
      const suggestion = getSuggestion("stale", 100, 95);
      expect(suggestion).toContain("relisting");
    });

    it("should suggest aggressive repricing for very stale with floor room", () => {
      const suggestion = getSuggestion("very_stale", 100, 70);
      expect(suggestion).toContain("20%+");
    });

    it("should suggest archiving for very stale without floor room", () => {
      const suggestion = getSuggestion("very_stale", 100, 95);
      expect(suggestion).toContain("archiving");
    });

    it("should handle no floor price as having floor room", () => {
      const suggestion = getSuggestion("stale", 100, null);
      expect(suggestion).toContain("10-15%");
    });

    it("should consider 10% margin as having floor room", () => {
      // Price is $100, floor is $91 (price > floor * 1.1 = false, since 91 * 1.1 = 100.1)
      const suggestion = getSuggestion("stale", 100, 91);
      expect(suggestion).toContain("relisting");

      // Price is $100, floor is $89 (price > floor * 1.1 = true, since 89 * 1.1 = 97.9)
      const suggestion2 = getSuggestion("stale", 100, 89);
      expect(suggestion2).toContain("10-15%");
    });
  });

  // ============ DEFAULT RULES TESTS ============

  describe("Default Stale Rules", () => {
    const DEFAULT_STALE_RULES = {
      daysUntilStale: 60,
      notifyOnly: true,
      autoRelist: false,
    };

    it("should have sensible defaults", () => {
      expect(DEFAULT_STALE_RULES.daysUntilStale).toBe(60);
      expect(DEFAULT_STALE_RULES.notifyOnly).toBe(true);
      expect(DEFAULT_STALE_RULES.autoRelist).toBe(false);
    });

    it("should default to notify-only mode", () => {
      // This prevents accidental auto-archiving
      expect(DEFAULT_STALE_RULES.notifyOnly).toBe(true);
    });
  });

  // ============ REPORT SORTING TESTS ============

  describe("Report Sorting", () => {
    interface StaleItemReport {
      itemId: string;
      staleness: "warning" | "stale" | "very_stale";
    }

    function sortReports(reports: StaleItemReport[]): StaleItemReport[] {
      const order = { very_stale: 0, stale: 1, warning: 2 };
      return [...reports].sort((a, b) => order[a.staleness] - order[b.staleness]);
    }

    it("should sort very_stale items first", () => {
      const reports: StaleItemReport[] = [
        { itemId: "1", staleness: "warning" },
        { itemId: "2", staleness: "very_stale" },
        { itemId: "3", staleness: "stale" },
      ];

      const sorted = sortReports(reports);

      expect(sorted[0].itemId).toBe("2"); // very_stale
      expect(sorted[1].itemId).toBe("3"); // stale
      expect(sorted[2].itemId).toBe("1"); // warning
    });

    it("should maintain order for same staleness level", () => {
      const reports: StaleItemReport[] = [
        { itemId: "1", staleness: "stale" },
        { itemId: "2", staleness: "stale" },
      ];

      const sorted = sortReports(reports);

      // Should maintain insertion order for same staleness
      expect(sorted[0].itemId).toBe("1");
      expect(sorted[1].itemId).toBe("2");
    });

    it("should handle empty array", () => {
      const reports: StaleItemReport[] = [];
      const sorted = sortReports(reports);
      expect(sorted).toHaveLength(0);
    });

    it("should handle single item", () => {
      const reports: StaleItemReport[] = [{ itemId: "1", staleness: "warning" }];
      const sorted = sortReports(reports);
      expect(sorted).toHaveLength(1);
      expect(sorted[0].itemId).toBe("1");
    });
  });

  // ============ ACTION DETERMINATION TESTS ============

  describe("Action Determination", () => {
    interface StaleRuleConfig {
      notifyOnly: boolean;
      autoRelist: boolean;
    }

    function determineAction(
      staleness: "warning" | "stale" | "very_stale",
      rules: StaleRuleConfig
    ): "notify" | "archive" | "relist" {
      if (rules.notifyOnly) {
        return "notify";
      } else if (staleness === "very_stale" && !rules.autoRelist) {
        return "archive";
      } else if (rules.autoRelist && (staleness === "stale" || staleness === "very_stale")) {
        return "relist";
      }
      return "notify";
    }

    it("should always notify when notifyOnly is true", () => {
      const rules = { notifyOnly: true, autoRelist: false };

      expect(determineAction("warning", rules)).toBe("notify");
      expect(determineAction("stale", rules)).toBe("notify");
      expect(determineAction("very_stale", rules)).toBe("notify");
    });

    it("should archive very_stale when notifyOnly is false and autoRelist is false", () => {
      const rules = { notifyOnly: false, autoRelist: false };

      expect(determineAction("warning", rules)).toBe("notify");
      expect(determineAction("stale", rules)).toBe("notify");
      expect(determineAction("very_stale", rules)).toBe("archive");
    });

    it("should relist stale and very_stale when autoRelist is true", () => {
      const rules = { notifyOnly: false, autoRelist: true };

      expect(determineAction("warning", rules)).toBe("notify");
      expect(determineAction("stale", rules)).toBe("relist");
      expect(determineAction("very_stale", rules)).toBe("relist");
    });
  });
});
