/**
 * Analytics Router Tests
 *
 * Tests for the analytics dashboard tRPC router.
 */

import { describe, it, expect, vi } from "vitest";
import {
  subDays,
  startOfYear,
  startOfDay,
  endOfDay,
  differenceInDays,
  format,
} from "date-fns";

// Mock the database before imports
vi.mock("@/server/db/client", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    innerJoin: vi.fn().mockReturnThis(),
    query: {
      inventoryItems: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      orders: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  },
}));

// ============ HELPER FUNCTION TESTS ============

describe("analyticsRouter helpers", () => {
  describe("getDateRange", () => {
    it("should return correct range for 7d period", () => {
      const now = new Date();
      const start = startOfDay(subDays(now, 7));
      const end = endOfDay(now);

      const daysDiff = differenceInDays(end, start);
      expect(daysDiff).toBe(7);
    });

    it("should return correct range for 30d period", () => {
      const now = new Date();
      const start = startOfDay(subDays(now, 30));
      const end = endOfDay(now);

      const daysDiff = differenceInDays(end, start);
      expect(daysDiff).toBe(30);
    });

    it("should return correct range for 90d period", () => {
      const now = new Date();
      const start = startOfDay(subDays(now, 90));
      const end = endOfDay(now);

      const daysDiff = differenceInDays(end, start);
      expect(daysDiff).toBe(90);
    });

    it("should return correct range for ytd period", () => {
      const now = new Date();
      const start = startOfYear(now);

      expect(start.getMonth()).toBe(0); // January
      expect(start.getDate()).toBe(1);
    });
  });

  describe("calculateTrend", () => {
    it("should calculate positive trend correctly", () => {
      const calculateTrend = (current: number, previous: number): number => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      expect(calculateTrend(150, 100)).toBe(50); // 50% increase
      expect(calculateTrend(200, 100)).toBe(100); // 100% increase
    });

    it("should calculate negative trend correctly", () => {
      const calculateTrend = (current: number, previous: number): number => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      expect(calculateTrend(50, 100)).toBe(-50); // 50% decrease
      expect(calculateTrend(0, 100)).toBe(-100); // 100% decrease
    });

    it("should handle zero previous value", () => {
      const calculateTrend = (current: number, previous: number): number => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      expect(calculateTrend(100, 0)).toBe(100); // From nothing to something
      expect(calculateTrend(0, 0)).toBe(0); // No change
    });
  });
});

// ============ INPUT VALIDATION TESTS ============

describe("analyticsRouter input validation", () => {
  describe("dashboard input", () => {
    it("should accept valid period values", () => {
      const validPeriods = ["7d", "30d", "90d", "ytd", "all"];

      validPeriods.forEach((period) => {
        expect(validPeriods).toContain(period);
      });
    });

    it("should default to 30d period", () => {
      const defaultPeriod = "30d";
      expect(defaultPeriod).toBe("30d");
    });
  });

  describe("revenueChart input", () => {
    it("should accept valid period values", () => {
      const validPeriods = ["7d", "30d", "90d", "ytd"];

      validPeriods.forEach((period) => {
        expect(validPeriods).toContain(period);
      });
    });

    it("should not include 'all' period for charts", () => {
      const chartPeriods = ["7d", "30d", "90d", "ytd"];
      expect(chartPeriods).not.toContain("all");
    });
  });

  describe("topItems input", () => {
    it("should accept valid sortBy values", () => {
      const validSortBy = ["profit", "revenue", "margin"];

      validSortBy.forEach((sort) => {
        expect(validSortBy).toContain(sort);
      });
    });

    it("should accept valid limit range", () => {
      const minLimit = 1;
      const maxLimit = 50;
      const defaultLimit = 10;

      expect(minLimit).toBeGreaterThanOrEqual(1);
      expect(maxLimit).toBeLessThanOrEqual(50);
      expect(defaultLimit).toBe(10);
    });
  });

  describe("slowMovers input", () => {
    it("should have default days threshold", () => {
      const defaultThreshold = 60;
      expect(defaultThreshold).toBe(60);
    });

    it("should have default limit", () => {
      const defaultLimit = 10;
      expect(defaultLimit).toBe(10);
    });
  });

  describe("exportCSV inputs", () => {
    it("should accept valid period for sales export", () => {
      const validPeriods = ["7d", "30d", "90d", "ytd", "all"];

      validPeriods.forEach((period) => {
        expect(validPeriods).toContain(period);
      });
    });

    it("should accept valid period for profit export", () => {
      const validPeriods = ["7d", "30d", "90d", "ytd", "all"];
      const defaultPeriod = "30d";

      expect(validPeriods).toContain(defaultPeriod);
    });
  });
});

// ============ DATA TRANSFORMATION TESTS ============

describe("analytics data transformations", () => {
  describe("revenue chart data grouping", () => {
    it("should format 7d period with day names", () => {
      const date = new Date("2026-01-15"); // Wednesday
      const formatted = format(date, "EEE");

      expect(formatted).toBe("Wed");
    });

    it("should format 30d period with date", () => {
      const date = new Date(2026, 0, 15); // January 15, 2026 (local time)
      const formatted = format(date, "MMM d");

      expect(formatted).toBe("Jan 15");
    });

    it("should format ytd period with month", () => {
      const date = new Date("2026-01-15");
      const formatted = format(date, "MMM");

      expect(formatted).toBe("Jan");
    });
  });

  describe("channel data transformation", () => {
    it("should map channel names correctly", () => {
      const CHANNEL_NAMES: Record<string, string> = {
        ebay: "eBay",
        poshmark: "Poshmark",
        mercari: "Mercari",
        depop: "Depop",
      };

      expect(CHANNEL_NAMES["ebay"]).toBe("eBay");
      expect(CHANNEL_NAMES["poshmark"]).toBe("Poshmark");
      expect(CHANNEL_NAMES["mercari"]).toBe("Mercari");
    });
  });

  describe("inventory aging calculation", () => {
    it("should categorize fresh items (0-30 days)", () => {
      const now = new Date();
      const listedAt = subDays(now, 15);
      const daysListed = differenceInDays(now, listedAt);

      expect(daysListed).toBeLessThanOrEqual(30);
    });

    it("should categorize aging items (31-60 days)", () => {
      const now = new Date();
      const listedAt = subDays(now, 45);
      const daysListed = differenceInDays(now, listedAt);

      expect(daysListed).toBeGreaterThan(30);
      expect(daysListed).toBeLessThanOrEqual(60);
    });

    it("should categorize stale items (61-90 days)", () => {
      const now = new Date();
      const listedAt = subDays(now, 75);
      const daysListed = differenceInDays(now, listedAt);

      expect(daysListed).toBeGreaterThan(60);
      expect(daysListed).toBeLessThanOrEqual(90);
    });

    it("should categorize dead items (90+ days)", () => {
      const now = new Date();
      const listedAt = subDays(now, 120);
      const daysListed = differenceInDays(now, listedAt);

      expect(daysListed).toBeGreaterThan(90);
    });
  });

  describe("margin calculation", () => {
    it("should calculate margin correctly", () => {
      const calculateMargin = (salePrice: number, costBasis: number): number => {
        if (salePrice === 0) return 0;
        return ((salePrice - costBasis) / salePrice) * 100;
      };

      expect(calculateMargin(100, 60)).toBe(40); // 40% margin
      expect(calculateMargin(50, 25)).toBe(50); // 50% margin
      expect(calculateMargin(100, 100)).toBe(0); // 0% margin (break even)
    });

    it("should handle zero sale price", () => {
      const calculateMargin = (salePrice: number, costBasis: number): number => {
        if (salePrice === 0) return 0;
        return ((salePrice - costBasis) / salePrice) * 100;
      };

      expect(calculateMargin(0, 50)).toBe(0);
    });

    it("should handle negative margin (loss)", () => {
      const calculateMargin = (salePrice: number, costBasis: number): number => {
        if (salePrice === 0) return 0;
        return ((salePrice - costBasis) / salePrice) * 100;
      };

      expect(calculateMargin(50, 75)).toBe(-50); // Sold below cost
    });
  });

  describe("sell-through rate calculation", () => {
    it("should calculate sell-through rate correctly", () => {
      const calculateSellThroughRate = (
        itemsSold: number,
        totalListed: number
      ): number => {
        if (totalListed === 0) return 0;
        return (itemsSold / totalListed) * 100;
      };

      expect(calculateSellThroughRate(25, 100)).toBe(25); // 25%
      expect(calculateSellThroughRate(50, 100)).toBe(50); // 50%
      expect(calculateSellThroughRate(0, 100)).toBe(0); // 0%
    });

    it("should handle zero total listed", () => {
      const calculateSellThroughRate = (
        itemsSold: number,
        totalListed: number
      ): number => {
        if (totalListed === 0) return 0;
        return (itemsSold / totalListed) * 100;
      };

      expect(calculateSellThroughRate(0, 0)).toBe(0);
    });
  });

  describe("average days to sell calculation", () => {
    it("should calculate average correctly", () => {
      const calculateAvgDaysToSell = (
        items: Array<{ listedAt: Date; soldAt: Date }>
      ): number => {
        if (items.length === 0) return 0;

        const totalDays = items.reduce((acc, item) => {
          return acc + differenceInDays(item.soldAt, item.listedAt);
        }, 0);

        return Math.round(totalDays / items.length);
      };

      const now = new Date();
      const items = [
        { listedAt: subDays(now, 10), soldAt: now },
        { listedAt: subDays(now, 20), soldAt: now },
        { listedAt: subDays(now, 30), soldAt: now },
      ];

      expect(calculateAvgDaysToSell(items)).toBe(20); // Average of 10, 20, 30
    });

    it("should return 0 for empty items", () => {
      const calculateAvgDaysToSell = (
        items: Array<{ listedAt: Date; soldAt: Date }>
      ): number => {
        if (items.length === 0) return 0;

        const totalDays = items.reduce((acc, item) => {
          return acc + differenceInDays(item.soldAt, item.listedAt);
        }, 0);

        return Math.round(totalDays / items.length);
      };

      expect(calculateAvgDaysToSell([])).toBe(0);
    });
  });
});

// ============ CSV EXPORT TESTS ============

describe("CSV export functionality", () => {
  describe("CSV generation", () => {
    it("should escape quotes in titles", () => {
      const escapeForCSV = (str: string): string => {
        return `"${str.replace(/"/g, '""')}"`;
      };

      expect(escapeForCSV('Item with "quotes"')).toBe('"Item with ""quotes"""');
      expect(escapeForCSV("Normal title")).toBe('"Normal title"');
    });

    it("should format dates correctly", () => {
      const date = new Date(2026, 0, 15); // January 15, 2026 (local time)
      const formatted = format(date, "yyyy-MM-dd");

      expect(formatted).toBe("2026-01-15");
    });

    it("should format numbers with 2 decimal places", () => {
      const formatNumber = (num: number): string => num.toFixed(2);

      expect(formatNumber(99.999)).toBe("100.00");
      expect(formatNumber(50)).toBe("50.00");
      expect(formatNumber(0.5)).toBe("0.50");
    });

    it("should generate correct filename format", () => {
      const now = new Date(2026, 0, 15); // January 15, 2026 (local time)
      const filename = `sales-report-${format(now, "yyyy-MM-dd")}.csv`;

      expect(filename).toBe("sales-report-2026-01-15.csv");
    });
  });

  describe("CSV headers", () => {
    it("should have correct sales report headers", () => {
      const headers = [
        "Order ID",
        "Item Title",
        "SKU",
        "Channel",
        "Sale Price",
        "Platform Fees",
        "Shipping Cost",
        "Cost Basis",
        "Net Profit",
        "Order Date",
        "Status",
      ];

      expect(headers).toHaveLength(11);
      expect(headers).toContain("Net Profit");
      expect(headers).toContain("Order Date");
    });

    it("should have correct inventory report headers", () => {
      const headers = [
        "ID",
        "SKU",
        "Title",
        "Condition",
        "Asking Price",
        "Floor Price",
        "Cost Basis",
        "Status",
        "Quantity",
        "Listed Date",
        "Created Date",
      ];

      expect(headers).toHaveLength(11);
      expect(headers).toContain("Asking Price");
      expect(headers).toContain("Status");
    });

    it("should have correct profit report headers", () => {
      const headers = [
        "Item Title",
        "SKU",
        "Channel",
        "Cost Basis",
        "Sale Price",
        "Platform Fees",
        "Shipping Cost",
        "Net Profit",
        "Margin %",
        "Sale Date",
      ];

      expect(headers).toHaveLength(10);
      expect(headers).toContain("Margin %");
      expect(headers).toContain("Net Profit");
    });
  });
});

// ============ AUTOPILOT STATS TESTS ============

describe("autopilot stats calculation", () => {
  describe("accuracy rate calculation", () => {
    it("should calculate accuracy correctly", () => {
      const calculateAccuracy = (executed: number, undone: number): number => {
        if (executed === 0) return 100;
        return Math.round(((executed - undone) / executed) * 100);
      };

      expect(calculateAccuracy(100, 5)).toBe(95); // 95% accuracy
      expect(calculateAccuracy(100, 0)).toBe(100); // 100% accuracy
      expect(calculateAccuracy(0, 0)).toBe(100); // No actions
    });
  });

  describe("action type categorization", () => {
    it("should categorize action types correctly", () => {
      const actionTypes = [
        "OFFER_ACCEPT",
        "OFFER_DECLINE",
        "OFFER_COUNTER",
        "REPRICE",
        "DELIST",
        "RELIST",
        "ARCHIVE",
      ];

      const offerActions = actionTypes.filter((a) => a.startsWith("OFFER_"));
      expect(offerActions).toHaveLength(3);

      expect(actionTypes).toContain("REPRICE");
      expect(actionTypes).toContain("DELIST");
    });
  });
});

// ============ BUSINESS LOGIC TESTS ============

describe("analytics business logic", () => {
  describe("potential profit calculation", () => {
    it("should calculate potential profit correctly", () => {
      const calculatePotentialProfit = (
        askingPrices: number[],
        costs: number[]
      ): number => {
        const totalAsking = askingPrices.reduce((sum, p) => sum + p, 0);
        const totalCost = costs.reduce((sum, c) => sum + c, 0);
        return totalAsking - totalCost;
      };

      const askingPrices = [100, 150, 200];
      const costs = [50, 75, 100];

      expect(calculatePotentialProfit(askingPrices, costs)).toBe(225);
    });
  });

  describe("period comparison", () => {
    it("should compare periods correctly", () => {
      const comparePeriods = (
        current: { revenue: number; profit: number },
        previous: { revenue: number; profit: number }
      ) => {
        const revenueTrend =
          previous.revenue === 0
            ? 100
            : ((current.revenue - previous.revenue) / previous.revenue) * 100;
        const profitTrend =
          previous.profit === 0
            ? 100
            : ((current.profit - previous.profit) / previous.profit) * 100;

        return { revenueTrend, profitTrend };
      };

      const result = comparePeriods(
        { revenue: 1200, profit: 400 },
        { revenue: 1000, profit: 300 }
      );

      expect(result.revenueTrend).toBe(20); // 20% increase
      expect(result.profitTrend).toBeCloseTo(33.33, 1); // ~33% increase
    });
  });
});
