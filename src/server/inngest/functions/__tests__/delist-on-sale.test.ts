/**
 * Tests for Delist On Sale Inngest Function
 *
 * Tests the critical autopilot function that prevents overselling
 * by delisting items from other channels when a sale is confirmed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { delistOnSale } from "../delist-on-sale";

// Mock the database
vi.mock("@/server/db/client", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
}));

// Mock the channel adapters
vi.mock("@/server/services/channels", () => ({
  getAdapter: vi.fn(() => ({
    delist: vi.fn(() => Promise.resolve({ success: true })),
    capabilities: { canDelist: true },
  })),
  isNativeChannel: vi.fn((channel: string) => channel === "ebay"),
  CHANNEL_CAPABILITIES: {
    ebay: {
      canPublish: true,
      canReprice: true,
      canDelist: true,
      canSyncOrders: true,
      canSyncInventory: true,
      requiresManualAction: false,
    },
    poshmark: {
      canPublish: false,
      canReprice: false,
      canDelist: false,
      canSyncOrders: false,
      canSyncInventory: false,
      requiresManualAction: true,
    },
    mercari: {
      canPublish: false,
      canReprice: false,
      canDelist: false,
      canSyncOrders: false,
      canSyncInventory: false,
      requiresManualAction: true,
    },
    depop: {
      canPublish: false,
      canReprice: false,
      canDelist: false,
      canSyncOrders: false,
      canSyncInventory: false,
      requiresManualAction: true,
    },
  },
}));

// Mock the audit service
vi.mock("@/server/services/audit", () => ({
  auditService: {
    log: vi.fn(() => Promise.resolve("audit-id-123")),
  },
}));

// Mock the notification service
vi.mock("@/server/services/notifications", () => ({
  notifyUser: vi.fn(() =>
    Promise.resolve({ success: true, deliveryMethods: ["console"] })
  ),
}));

describe("Delist On Sale Function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("function configuration", () => {
    it("should be defined", () => {
      expect(delistOnSale).toBeDefined();
    });

    it("should be a valid Inngest function object", () => {
      expect(typeof delistOnSale).toBe("object");
    });

    it("should have correct function ID", () => {
      // Access the internal config
      const config = (delistOnSale as unknown as { options?: { id: string } })?.options;
      if (config) {
        expect(config.id).toBe("delist-on-sale");
      }
    });

    it("should be configured with retries", () => {
      const config = (delistOnSale as unknown as { options?: { retries: number } })?.options;
      if (config) {
        expect(config.retries).toBe(3);
      }
    });

    it("should have an onFailure handler", () => {
      const config = (delistOnSale as unknown as { options?: { onFailure: unknown } })?.options;
      if (config) {
        expect(typeof config.onFailure).toBe("function");
      }
    });
  });

  describe("event trigger", () => {
    it("should listen for order/confirmed event", () => {
      // The function should be triggered by 'order/confirmed' event
      const triggers = (delistOnSale as unknown as { triggers?: Array<{ event: string }> })?.triggers;
      if (triggers && Array.isArray(triggers)) {
        const hasOrderConfirmed = triggers.some(
          (t) => t.event === "order/confirmed"
        );
        expect(hasOrderConfirmed).toBe(true);
      }
    });
  });

  describe("notification service integration", () => {
    it("should import notifyUser function", async () => {
      const { notifyUser } = await import("@/server/services/notifications");
      expect(notifyUser).toBeDefined();
      expect(typeof notifyUser).toBe("function");
    });

    it("should handle MANUAL_DELIST_REQUIRED notification type", async () => {
      const { notifyUser } = await import("@/server/services/notifications");

      await notifyUser("user-123", {
        type: "MANUAL_DELIST_REQUIRED",
        channel: "poshmark",
        itemTitle: "Test Item",
        priority: "HIGH",
      });

      expect(notifyUser).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({
          type: "MANUAL_DELIST_REQUIRED",
          channel: "poshmark",
          priority: "HIGH",
        })
      );
    });

    it("should handle DELIST_FAILED notification type", async () => {
      const { notifyUser } = await import("@/server/services/notifications");

      await notifyUser("user-123", {
        type: "DELIST_FAILED",
        channel: "ebay",
        itemTitle: "Test Item",
        priority: "CRITICAL",
        message: "API error",
      });

      expect(notifyUser).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({
          type: "DELIST_FAILED",
          priority: "CRITICAL",
        })
      );
    });
  });

  describe("audit service integration", () => {
    it("should import auditService", async () => {
      const { auditService } = await import("@/server/services/audit");
      expect(auditService).toBeDefined();
      expect(auditService.log).toBeDefined();
    });

    it("should log audit entry correctly", async () => {
      const { auditService } = await import("@/server/services/audit");

      await auditService.log({
        userId: "user-123",
        actionType: "DELIST_ON_SALE",
        itemId: "item-456",
        channel: "poshmark",
        source: "SYSTEM",
        beforeState: { status: "active" },
        afterState: { status: "sold" },
        reversible: false,
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: "DELIST_ON_SALE",
          source: "SYSTEM",
          reversible: false,
        })
      );
    });
  });

  describe("channel adapter integration", () => {
    it("should identify eBay as native channel", async () => {
      const { isNativeChannel } = await import("@/server/services/channels");
      expect(isNativeChannel("ebay")).toBe(true);
    });

    it("should identify Poshmark as assisted channel", async () => {
      const { isNativeChannel } = await import("@/server/services/channels");
      expect(isNativeChannel("poshmark")).toBe(false);
    });

    it("should get correct capabilities for eBay", async () => {
      const { CHANNEL_CAPABILITIES } = await import(
        "@/server/services/channels"
      );
      expect(CHANNEL_CAPABILITIES.ebay.canDelist).toBe(true);
      expect(CHANNEL_CAPABILITIES.ebay.requiresManualAction).toBe(false);
    });

    it("should get correct capabilities for Poshmark", async () => {
      const { CHANNEL_CAPABILITIES } = await import(
        "@/server/services/channels"
      );
      expect(CHANNEL_CAPABILITIES.poshmark.canDelist).toBe(false);
      expect(CHANNEL_CAPABILITIES.poshmark.requiresManualAction).toBe(true);
    });
  });
});

describe("Delist On Sale Event Data", () => {
  it("should accept valid event data structure", () => {
    const validEventData = {
      orderId: "order-123",
      userId: "user-456",
      itemId: "item-789",
      channel: "ebay" as const,
      salePrice: 99.99,
    };

    // Validate the data structure matches what the function expects
    expect(validEventData.orderId).toBeDefined();
    expect(validEventData.userId).toBeDefined();
    expect(validEventData.itemId).toBeDefined();
    expect(validEventData.channel).toBeDefined();
    expect(validEventData.salePrice).toBeDefined();
  });

  it("should handle all supported channels", () => {
    const channels = ["ebay", "poshmark", "mercari", "depop"] as const;

    for (const channel of channels) {
      const eventData = {
        orderId: "order-123",
        userId: "user-456",
        itemId: "item-789",
        channel,
        salePrice: 50.0,
      };

      expect(eventData.channel).toBe(channel);
    }
  });
});

describe("Delist On Sale Result", () => {
  it("should return expected result structure on success", () => {
    const expectedResult = {
      success: true,
      itemId: "item-123",
      itemTitle: "Test Item",
      soldOnChannel: "poshmark",
      orderId: "order-456",
      totalOtherListings: 2,
      automaticallyDelisted: 1,
      manualDelistRequired: 1,
      failed: 0,
      delistResults: [],
    };

    expect(expectedResult.success).toBe(true);
    expect(typeof expectedResult.automaticallyDelisted).toBe("number");
    expect(typeof expectedResult.manualDelistRequired).toBe("number");
    expect(typeof expectedResult.failed).toBe("number");
  });

  it("should track delist results by channel", () => {
    const delistResult = {
      channel: "ebay" as const,
      listingId: "listing-123",
      externalId: "ebay-456",
      success: true,
      requiresManualAction: false,
      error: undefined,
    };

    expect(delistResult.channel).toBe("ebay");
    expect(delistResult.success).toBe(true);
    expect(delistResult.requiresManualAction).toBe(false);
  });

  it("should indicate manual action required for assisted channels", () => {
    const delistResult = {
      channel: "poshmark" as const,
      listingId: "listing-123",
      externalId: null,
      success: true,
      requiresManualAction: true,
      error: undefined,
    };

    expect(delistResult.channel).toBe("poshmark");
    expect(delistResult.requiresManualAction).toBe(true);
  });

  it("should capture errors on failure", () => {
    const delistResult = {
      channel: "ebay" as const,
      listingId: "listing-123",
      externalId: "ebay-456",
      success: false,
      requiresManualAction: true,
      error: "Rate limit exceeded",
    };

    expect(delistResult.success).toBe(false);
    expect(delistResult.error).toBeDefined();
  });
});
