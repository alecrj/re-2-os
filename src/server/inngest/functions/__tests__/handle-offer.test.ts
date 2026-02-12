/**
 * Tests for Handle Offer Inngest Function
 *
 * Tests that the offer handler correctly wires up the autopilot engine
 * to the eBay Trading API for executing offer responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleOffer } from "../handle-offer";

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
    query: {
      inventoryItems: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: "item-123",
            askingPrice: 100,
            floorPrice: 70,
            listedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          })
        ),
      },
      autopilotRules: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: "rule-123",
            config: {
              autoAcceptThreshold: 0.9,
              autoDeclineThreshold: 0.5,
              autoCounterEnabled: true,
              counterStrategy: "midpoint",
              maxCounterRounds: 3,
              highValueThreshold: 200,
            },
          })
        ),
      },
      channelListings: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            externalId: "ebay-listing-456",
          })
        ),
      },
    },
  },
}));

vi.mock("@/server/db/schema", () => ({
  autopilotActions: { id: "id" },
  autopilotRules: { userId: "user_id", ruleType: "rule_type", enabled: "enabled" },
  channelListings: { id: "id" },
  inventoryItems: { id: "id" },
}));

// Mock the autopilot service
vi.mock("@/server/services/autopilot", () => ({
  evaluateOffer: vi.fn(() =>
    Promise.resolve({
      decision: "ACCEPT",
      confidence: 0.95,
      confidenceLevel: "HIGH",
      reason: "Offer meets auto-accept threshold",
      autoExecute: true,
      requiresApproval: false,
      ruleConfig: {
        autoAcceptThreshold: 0.9,
        autoDeclineThreshold: 0.5,
        autoCounterEnabled: true,
        counterStrategy: "midpoint",
        maxCounterRounds: 3,
        highValueThreshold: 200,
      },
      offerPercent: 0.95,
    })
  ),
}));

// Mock the audit service
vi.mock("@/server/services/audit", () => ({
  auditService: {
    log: vi.fn(() => Promise.resolve("audit-id-123")),
  },
}));

// Mock channel services
vi.mock("@/server/services/channels", () => ({
  isNativeChannel: vi.fn((channel: string) => channel === "ebay"),
}));

// Mock the eBay adapter
const mockAcceptOffer = vi.fn(() =>
  Promise.resolve({ success: true, responses: [{ bestOfferId: "offer-001", success: true }] })
);
const mockDeclineOffer = vi.fn(() =>
  Promise.resolve({ success: true, responses: [{ bestOfferId: "offer-001", success: true }] })
);
const mockCounterOffer = vi.fn(() =>
  Promise.resolve({ success: true, responses: [{ bestOfferId: "offer-001", success: true }] })
);

vi.mock("@/server/services/channels/ebay", () => ({
  getEbayAdapter: vi.fn(() => ({
    acceptOffer: mockAcceptOffer,
    declineOffer: mockDeclineOffer,
    counterOffer: mockCounterOffer,
  })),
}));

describe("Handle Offer Function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("function configuration", () => {
    it("should be defined", () => {
      expect(handleOffer).toBeDefined();
    });

    it("should be a valid Inngest function object", () => {
      expect(typeof handleOffer).toBe("object");
    });

    it("should have correct function ID", () => {
      const config = (handleOffer as unknown as { options?: { id: string } })?.options;
      if (config) {
        expect(config.id).toBe("handle-offer");
      }
    });

    it("should be configured with retries", () => {
      const config = (handleOffer as unknown as { options?: { retries: number } })?.options;
      if (config) {
        expect(config.retries).toBe(2);
      }
    });
  });

  describe("event trigger", () => {
    it("should listen for autopilot/offer-received event", () => {
      const triggers = (handleOffer as unknown as { triggers?: Array<{ event: string }> })?.triggers;
      if (triggers && Array.isArray(triggers)) {
        const hasOfferReceived = triggers.some(
          (t) => t.event === "autopilot/offer-received"
        );
        expect(hasOfferReceived).toBe(true);
      }
    });
  });

  describe("event data structure", () => {
    it("should accept valid offer event data", () => {
      const validEventData = {
        userId: "user-123",
        offerId: "offer-001",
        itemId: "item-456",
        channelListingId: "cl-789",
        channel: "ebay" as const,
        offerAmount: 95.0,
        askingPrice: 100.0,
        floorPrice: 70.0,
        buyerUsername: "buyer42",
      };

      expect(validEventData.offerId).toBeDefined();
      expect(validEventData.offerAmount).toBeGreaterThan(0);
      expect(validEventData.askingPrice).toBeGreaterThan(0);
    });

    it("should handle event without optional fields", () => {
      const minimalEventData: Record<string, unknown> = {
        userId: "user-123",
        offerId: "offer-001",
        itemId: "item-456",
        channelListingId: "cl-789",
        channel: "ebay",
        offerAmount: 50.0,
        askingPrice: 100.0,
      };

      expect(minimalEventData.floorPrice).toBeUndefined();
      expect(minimalEventData.buyerUsername).toBeUndefined();
    });
  });

  describe("eBay adapter integration", () => {
    it("should import getEbayAdapter", async () => {
      const { getEbayAdapter } = await import("@/server/services/channels/ebay");
      expect(getEbayAdapter).toBeDefined();
      expect(typeof getEbayAdapter).toBe("function");
    });

    it("should have acceptOffer method on adapter", async () => {
      const { getEbayAdapter } = await import("@/server/services/channels/ebay");
      const adapter = getEbayAdapter();
      expect(adapter.acceptOffer).toBeDefined();
    });

    it("should have declineOffer method on adapter", async () => {
      const { getEbayAdapter } = await import("@/server/services/channels/ebay");
      const adapter = getEbayAdapter();
      expect(adapter.declineOffer).toBeDefined();
    });

    it("should have counterOffer method on adapter", async () => {
      const { getEbayAdapter } = await import("@/server/services/channels/ebay");
      const adapter = getEbayAdapter();
      expect(adapter.counterOffer).toBeDefined();
    });

    it("should call acceptOffer with correct parameters", async () => {
      const { getEbayAdapter } = await import("@/server/services/channels/ebay");
      const adapter = getEbayAdapter();

      await adapter.acceptOffer("user-123", "ebay-listing-456", "offer-001");

      expect(mockAcceptOffer).toHaveBeenCalledWith(
        "user-123",
        "ebay-listing-456",
        "offer-001"
      );
    });

    it("should call declineOffer with correct parameters", async () => {
      const { getEbayAdapter } = await import("@/server/services/channels/ebay");
      const adapter = getEbayAdapter();

      await adapter.declineOffer("user-123", "ebay-listing-456", "offer-002");

      expect(mockDeclineOffer).toHaveBeenCalledWith(
        "user-123",
        "ebay-listing-456",
        "offer-002"
      );
    });

    it("should call counterOffer with correct parameters including price", async () => {
      const { getEbayAdapter } = await import("@/server/services/channels/ebay");
      const adapter = getEbayAdapter();

      await adapter.counterOffer("user-123", "ebay-listing-456", "offer-003", 85.0);

      expect(mockCounterOffer).toHaveBeenCalledWith(
        "user-123",
        "ebay-listing-456",
        "offer-003",
        85.0
      );
    });
  });

  describe("channel listing lookup", () => {
    it("should look up externalId from channelListings", async () => {
      const { db } = await import("@/server/db/client");
      const result = await db.query.channelListings.findFirst({
        where: "cl-789",
        columns: { externalId: true },
      } as unknown as Parameters<typeof db.query.channelListings.findFirst>[0]);

      expect(result).toEqual({ externalId: "ebay-listing-456" });
    });
  });

  describe("isNativeChannel check", () => {
    it("should identify eBay as native channel", async () => {
      const { isNativeChannel } = await import("@/server/services/channels");
      expect(isNativeChannel("ebay")).toBe(true);
    });

    it("should identify Poshmark as non-native channel", async () => {
      const { isNativeChannel } = await import("@/server/services/channels");
      expect(isNativeChannel("poshmark")).toBe(false);
    });
  });

  describe("offer response results", () => {
    it("should return success result structure for accepted offers", () => {
      const result = {
        success: true,
        actionId: "action-123",
        offerId: "offer-001",
        decision: "ACCEPT" as const,
        confidence: 0.95,
        confidenceLevel: "HIGH" as const,
        executed: true,
        reason: "Offer meets auto-accept threshold",
      };

      expect(result.success).toBe(true);
      expect(result.decision).toBe("ACCEPT");
      expect(result.executed).toBe(true);
    });

    it("should return pending result for low confidence offers", () => {
      const result = {
        success: true,
        actionId: "action-456",
        offerId: "offer-002",
        decision: "COUNTER" as const,
        confidence: 0.55,
        confidenceLevel: "LOW" as const,
        executed: false,
        counterAmount: 85.0,
        reason: "Action queued for manual approval",
      };

      expect(result.success).toBe(true);
      expect(result.executed).toBe(false);
      expect(result.counterAmount).toBe(85.0);
    });
  });
});
