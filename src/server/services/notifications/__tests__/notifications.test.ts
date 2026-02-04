/**
 * Tests for Notification Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  notifyUser,
  notifyUserBulk,
  type Notification,
  type NotificationType,
  type NotificationPriority,
} from "../index";

// Mock the database
vi.mock("@/server/db/client", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
}));

describe("Notification Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("notifyUser", () => {
    it("should send a basic notification", async () => {
      const result = await notifyUser("user-123", {
        type: "ACTION_REQUIRED",
        message: "Test notification",
      });

      expect(result.success).toBe(true);
      expect(result.deliveryMethods).toContain("console");
    });

    it("should include audit_log in delivery methods", async () => {
      const result = await notifyUser("user-123", {
        type: "SALE_CONFIRMED",
        itemTitle: "Test Item",
        channel: "ebay",
      });

      expect(result.deliveryMethods).toContain("audit_log");
    });

    it("should handle MANUAL_DELIST_REQUIRED type", async () => {
      const result = await notifyUser("user-123", {
        type: "MANUAL_DELIST_REQUIRED",
        channel: "poshmark",
        itemTitle: "Vintage Jacket",
        priority: "HIGH",
      });

      expect(result.success).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[NOTIFICATION\].*\[HIGH\].*poshmark/)
      );
    });

    it("should handle DELIST_FAILED type", async () => {
      const result = await notifyUser("user-123", {
        type: "DELIST_FAILED",
        channel: "ebay",
        itemTitle: "Vintage Jacket",
        message: "Rate limit exceeded",
        priority: "HIGH",
      });

      expect(result.success).toBe(true);
    });

    it("should handle DELIST_SUCCESS type", async () => {
      const result = await notifyUser("user-123", {
        type: "DELIST_SUCCESS",
        channel: "ebay",
        itemTitle: "Vintage Jacket",
      });

      expect(result.success).toBe(true);
    });

    it("should handle CRITICAL priority notifications", async () => {
      const result = await notifyUser("user-123", {
        type: "DELIST_FAILED",
        priority: "CRITICAL",
        message: "Failed after all retries",
      });

      expect(result.success).toBe(true);
      // Should log to error for CRITICAL
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/\[CRITICAL NOTIFICATION\]/)
      );
    });

    it("should default to MEDIUM priority", async () => {
      const result = await notifyUser("user-123", {
        type: "ACTION_REQUIRED",
      });

      expect(result.success).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/\[MEDIUM\]/)
      );
    });

    it("should include metadata in notifications", async () => {
      const metadata = {
        listingUrl: "https://example.com/listing/123",
        soldOnChannel: "mercari",
        salePrice: 49.99,
      };

      const result = await notifyUser("user-123", {
        type: "MANUAL_DELIST_REQUIRED",
        channel: "poshmark",
        metadata,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("notifyUserBulk", () => {
    it("should send multiple notifications", async () => {
      const notifications: Notification[] = [
        {
          type: "MANUAL_DELIST_REQUIRED",
          channel: "poshmark",
          itemTitle: "Item 1",
        },
        {
          type: "MANUAL_DELIST_REQUIRED",
          channel: "mercari",
          itemTitle: "Item 2",
        },
      ];

      const results = await notifyUserBulk("user-123", notifications);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it("should handle empty notification array", async () => {
      const results = await notifyUserBulk("user-123", []);
      expect(results).toHaveLength(0);
    });
  });

  describe("notification types", () => {
    const notificationTypes: NotificationType[] = [
      "MANUAL_DELIST_REQUIRED",
      "DELIST_FAILED",
      "DELIST_SUCCESS",
      "ACTION_REQUIRED",
      "OFFER_RECEIVED",
      "SALE_CONFIRMED",
      "SYNC_ERROR",
    ];

    it.each(notificationTypes)(
      "should handle %s notification type",
      async (type) => {
        const result = await notifyUser("user-123", { type });
        expect(result.success).toBe(true);
      }
    );
  });

  describe("notification priorities", () => {
    const priorities: NotificationPriority[] = [
      "CRITICAL",
      "HIGH",
      "MEDIUM",
      "LOW",
    ];

    it.each(priorities)("should handle %s priority", async (priority) => {
      const result = await notifyUser("user-123", {
        type: "ACTION_REQUIRED",
        priority,
      });

      expect(result.success).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`\\[${priority}\\]`))
      );
    });
  });

  describe("message formatting", () => {
    it("should format MANUAL_DELIST_REQUIRED message correctly", async () => {
      await notifyUser("user-123", {
        type: "MANUAL_DELIST_REQUIRED",
        channel: "poshmark",
        itemTitle: "Vintage Jacket",
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/Please manually delist "Vintage Jacket"/)
      );
    });

    it("should format DELIST_FAILED message correctly", async () => {
      await notifyUser("user-123", {
        type: "DELIST_FAILED",
        channel: "ebay",
        itemTitle: "Test Item",
        message: "API error",
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to automatically delist/)
      );
    });

    it("should format SYNC_ERROR message correctly", async () => {
      await notifyUser("user-123", {
        type: "SYNC_ERROR",
        channel: "ebay",
        message: "Token expired",
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/Sync error/)
      );
    });

    it("should handle missing itemTitle gracefully", async () => {
      await notifyUser("user-123", {
        type: "MANUAL_DELIST_REQUIRED",
        channel: "poshmark",
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/"item"/)
      );
    });

    it("should handle missing channel gracefully", async () => {
      await notifyUser("user-123", {
        type: "MANUAL_DELIST_REQUIRED",
        itemTitle: "Test Item",
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/the marketplace/)
      );
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      // Mock database error
      const { db } = await import("@/server/db/client");
      vi.mocked(db.insert).mockImplementationOnce(() => {
        throw new Error("Database connection failed");
      });

      // Should still succeed because we catch database errors
      const result = await notifyUser("user-123", {
        type: "ACTION_REQUIRED",
        message: "Test",
      });

      // Should still deliver via console
      expect(result.deliveryMethods).toContain("console");
    });
  });
});
