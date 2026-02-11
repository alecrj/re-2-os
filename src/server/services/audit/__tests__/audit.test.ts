/**
 * Audit Service Tests
 *
 * Tests for the audit logging and undo functionality.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("@/server/db/client", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

// Import after mocking
import {
  isActionReversible,
  calculateUndoDeadline,
  UNDO_DEADLINES,
} from "../index";
import { undoService } from "../undo";

// ============ UNIT TESTS ============

describe("Audit Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isActionReversible", () => {
    it("should return true for PRICE_CHANGE", () => {
      expect(isActionReversible("PRICE_CHANGE")).toBe(true);
    });

    it("should return true for LISTING_DELIST", () => {
      expect(isActionReversible("LISTING_DELIST")).toBe(true);
    });

    it("should return true for ITEM_ARCHIVE (unlimited)", () => {
      expect(isActionReversible("ITEM_ARCHIVE")).toBe(true);
    });

    it("should return false for OFFER_ACCEPT", () => {
      expect(isActionReversible("OFFER_ACCEPT")).toBe(false);
    });

    it("should return false for OFFER_DECLINE", () => {
      expect(isActionReversible("OFFER_DECLINE")).toBe(false);
    });

    it("should return false for ORDER_CREATE", () => {
      expect(isActionReversible("ORDER_CREATE")).toBe(false);
    });

    it("should return false for ITEM_DELETE", () => {
      expect(isActionReversible("ITEM_DELETE")).toBe(false);
    });

    it("should return false for unknown action types", () => {
      expect(isActionReversible("UNKNOWN_ACTION")).toBe(false);
    });
  });

  describe("calculateUndoDeadline", () => {
    it("should calculate 24 hour deadline for PRICE_CHANGE", () => {
      const before = new Date();
      const deadline = calculateUndoDeadline("PRICE_CHANGE");
      const after = new Date();

      expect(deadline).toBeInstanceOf(Date);
      // Deadline should be roughly 24 hours from now
      const expectedMin = before.getTime() + 24 * 60 * 60 * 1000 - 1000;
      const expectedMax = after.getTime() + 24 * 60 * 60 * 1000 + 1000;
      expect(deadline!.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(deadline!.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it("should calculate 30 day deadline for LISTING_DELIST", () => {
      const deadline = calculateUndoDeadline("LISTING_DELIST");
      expect(deadline).toBeInstanceOf(Date);

      const hoursUntil = (deadline!.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(hoursUntil).toBeGreaterThanOrEqual(719); // ~30 days
      expect(hoursUntil).toBeLessThanOrEqual(721);
    });

    it("should return far future date for ITEM_ARCHIVE (unlimited)", () => {
      const deadline = calculateUndoDeadline("ITEM_ARCHIVE");
      expect(deadline).toBeInstanceOf(Date);

      const yearsUntil =
        (deadline!.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365);
      expect(yearsUntil).toBeGreaterThan(99);
    });

    it("should return undefined for non-reversible actions", () => {
      expect(calculateUndoDeadline("OFFER_ACCEPT")).toBeUndefined();
      expect(calculateUndoDeadline("ORDER_CREATE")).toBeUndefined();
      expect(calculateUndoDeadline("ITEM_DELETE")).toBeUndefined();
    });
  });

  describe("UNDO_DEADLINES", () => {
    it("should have correct deadline for PRICE_CHANGE", () => {
      expect(UNDO_DEADLINES.PRICE_CHANGE).toBe(24);
    });

    it("should have correct deadline for LISTING_DELIST", () => {
      expect(UNDO_DEADLINES.LISTING_DELIST).toBe(720);
    });

    it("should have null for unlimited ITEM_ARCHIVE", () => {
      expect(UNDO_DEADLINES.ITEM_ARCHIVE).toBeNull();
    });

    it("should have 0 for non-reversible actions", () => {
      expect(UNDO_DEADLINES.OFFER_ACCEPT).toBe(0);
      expect(UNDO_DEADLINES.OFFER_DECLINE).toBe(0);
      expect(UNDO_DEADLINES.ORDER_CREATE).toBe(0);
    });
  });
});

describe("Undo Service", () => {
  describe("getTimeRemaining", () => {
    it("should return null for non-reversible entries", () => {
      const entry = {
        id: "test-1",
        userId: "user-1",
        actionType: "OFFER_ACCEPT",
        actionId: null,
        itemId: null,
        channel: null,
        source: "USER" as const,
        beforeState: null,
        afterState: null,
        metadata: null,
        reversible: false,
        undoDeadline: null,
        reversedAt: null,
        reversedByAuditId: null,
        timestamp: new Date(),
      };

      expect(undoService.getTimeRemaining(entry)).toBeNull();
    });

    it("should return null for already reversed entries", () => {
      const entry = {
        id: "test-1",
        userId: "user-1",
        actionType: "PRICE_CHANGE",
        actionId: null,
        itemId: "item-1",
        channel: null,
        source: "USER" as const,
        beforeState: { askingPrice: 100 },
        afterState: { askingPrice: 90 },
        metadata: null,
        reversible: true,
        undoDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        reversedAt: new Date(),
        reversedByAuditId: "undo-1",
        timestamp: new Date(),
      };

      expect(undoService.getTimeRemaining(entry)).toBeNull();
    });

    it("should return null for expired deadlines", () => {
      const entry = {
        id: "test-1",
        userId: "user-1",
        actionType: "PRICE_CHANGE",
        actionId: null,
        itemId: "item-1",
        channel: null,
        source: "USER" as const,
        beforeState: { askingPrice: 100 },
        afterState: { askingPrice: 90 },
        metadata: null,
        reversible: true,
        undoDeadline: new Date(Date.now() - 1000), // Past deadline
        reversedAt: null,
        reversedByAuditId: null,
        timestamp: new Date(),
      };

      expect(undoService.getTimeRemaining(entry)).toBeNull();
    });

    it("should return hours and minutes for valid entries", () => {
      const entry = {
        id: "test-1",
        userId: "user-1",
        actionType: "PRICE_CHANGE",
        actionId: null,
        itemId: "item-1",
        channel: null,
        source: "USER" as const,
        beforeState: { askingPrice: 100 },
        afterState: { askingPrice: 90 },
        metadata: null,
        reversible: true,
        undoDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000), // 2h 30m
        reversedAt: null,
        reversedByAuditId: null,
        timestamp: new Date(),
      };

      const result = undoService.getTimeRemaining(entry);
      expect(result).not.toBeNull();
      expect(result!.hours).toBe(2);
      expect(result!.minutes).toBeGreaterThanOrEqual(29);
      expect(result!.minutes).toBeLessThanOrEqual(30);
    });
  });
});

describe("Audit Entry Types", () => {
  it("should have all required action types defined", () => {
    const requiredTypes = [
      "PRICE_CHANGE",
      "LISTING_DELIST",
      "ITEM_ARCHIVE",
      "LISTING_RELIST",
      "OFFER_ACCEPT",
      "OFFER_DECLINE",
      "ORDER_CREATE",
      "ORDER_SHIP",
      "ITEM_DELETE",
    ];

    requiredTypes.forEach((type) => {
      expect(UNDO_DEADLINES).toHaveProperty(type);
    });
  });

  it("should have valid deadline values", () => {
    Object.entries(UNDO_DEADLINES).forEach(([_actionType, deadline]) => {
      expect(
        deadline === null || typeof deadline === "number"
      ).toBe(true);
      if (typeof deadline === "number") {
        expect(deadline).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

describe("Audit Business Logic", () => {
  it("should correctly identify reversible vs non-reversible actions", () => {
    // Reversible actions (have positive deadline or null for unlimited)
    const reversibleActions = ["PRICE_CHANGE", "LISTING_DELIST", "ITEM_ARCHIVE", "LISTING_RELIST"];
    reversibleActions.forEach((action) => {
      expect(isActionReversible(action)).toBe(true);
    });

    // Non-reversible actions (deadline is 0 or undefined)
    const nonReversibleActions = ["OFFER_ACCEPT", "OFFER_DECLINE", "ORDER_CREATE", "ORDER_SHIP", "ITEM_DELETE"];
    nonReversibleActions.forEach((action) => {
      expect(isActionReversible(action)).toBe(false);
    });
  });

  it("should handle state before/after comparison correctly", () => {
    const beforeState = {
      askingPrice: 100,
      floorPrice: 80,
      title: "Test Item",
    };

    const afterState = {
      askingPrice: 90,
      floorPrice: 80,
      title: "Test Item",
    };

    // Detect changed fields
    const changedFields: string[] = [];
    Object.keys(beforeState).forEach((key) => {
      if (JSON.stringify(beforeState[key as keyof typeof beforeState]) !==
          JSON.stringify(afterState[key as keyof typeof afterState])) {
        changedFields.push(key);
      }
    });

    expect(changedFields).toContain("askingPrice");
    expect(changedFields).not.toContain("floorPrice");
    expect(changedFields).not.toContain("title");
  });

  it("should calculate profit impact from price changes", () => {
    const calculateProfitImpact = (
      originalPrice: number,
      newPrice: number,
      costBasis: number
    ) => {
      const originalProfit = originalPrice - costBasis;
      const newProfit = newPrice - costBasis;
      return {
        profitChange: newProfit - originalProfit,
        marginChange: ((newProfit / newPrice) - (originalProfit / originalPrice)) * 100,
      };
    };

    const impact = calculateProfitImpact(100, 90, 50);
    expect(impact.profitChange).toBe(-10);
    expect(impact.marginChange).toBeCloseTo(-5.56, 1);
  });
});

describe("Undo Operations", () => {
  it("should validate undo requirements", () => {
    interface UndoRequirements {
      hasBeforeState: boolean;
      isReversible: boolean;
      isNotReversed: boolean;
      isWithinDeadline: boolean;
    }

    const canUndo = (requirements: UndoRequirements): boolean => {
      return (
        requirements.hasBeforeState &&
        requirements.isReversible &&
        requirements.isNotReversed &&
        requirements.isWithinDeadline
      );
    };

    // All requirements met
    expect(
      canUndo({
        hasBeforeState: true,
        isReversible: true,
        isNotReversed: true,
        isWithinDeadline: true,
      })
    ).toBe(true);

    // Missing before state
    expect(
      canUndo({
        hasBeforeState: false,
        isReversible: true,
        isNotReversed: true,
        isWithinDeadline: true,
      })
    ).toBe(false);

    // Not reversible
    expect(
      canUndo({
        hasBeforeState: true,
        isReversible: false,
        isNotReversed: true,
        isWithinDeadline: true,
      })
    ).toBe(false);

    // Already reversed
    expect(
      canUndo({
        hasBeforeState: true,
        isReversible: true,
        isNotReversed: false,
        isWithinDeadline: true,
      })
    ).toBe(false);

    // Deadline expired
    expect(
      canUndo({
        hasBeforeState: true,
        isReversible: true,
        isNotReversed: true,
        isWithinDeadline: false,
      })
    ).toBe(false);
  });

  it("should format time remaining correctly", () => {
    const formatTimeRemaining = (
      hours: number,
      minutes: number
    ): string => {
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days}d remaining`;
      } else if (hours > 0) {
        return `${hours}h ${minutes}m remaining`;
      } else {
        return `${minutes}m remaining`;
      }
    };

    expect(formatTimeRemaining(48, 30)).toBe("2d remaining");
    expect(formatTimeRemaining(12, 45)).toBe("12h 45m remaining");
    expect(formatTimeRemaining(0, 30)).toBe("30m remaining");
  });
});
