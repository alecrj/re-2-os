/**
 * eBay Channel Adapter Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EbayAdapter } from "../adapter";
import { EbayClient } from "../client";
import type { ListingData } from "../../types";

// Mock the eBay client
vi.mock("../client", () => ({
  EbayClient: vi.fn(),
  getEbayClient: vi.fn(),
}));

describe("EbayAdapter", () => {
  let adapter: EbayAdapter;
  let mockClient: {
    request: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
    getRevisionStatus: ReturnType<typeof vi.fn>;
    trackRevision: ReturnType<typeof vi.fn>;
  };

  const testUserId = "user-123";
  const testListing: ListingData = {
    sku: "TEST-SKU-001",
    title: "Test Product Title",
    description: "This is a test product description for testing.",
    price: 29.99,
    quantity: 1,
    condition: "new",
    imageUrls: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
    itemSpecifics: {
      brand: "TestBrand",
      size: "Medium",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock client
    mockClient = {
      request: vi.fn(),
      isConnected: vi.fn().mockResolvedValue(true),
      getRevisionStatus: vi.fn().mockReturnValue({
        allowed: true,
        remaining: 190,
        resetsAt: new Date(Date.now() + 86400000),
      }),
      trackRevision: vi.fn(),
    };

    // Create adapter with mock client
    adapter = new EbayAdapter(mockClient as unknown as EbayClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("capabilities", () => {
    it("should have correct channel ID", () => {
      expect(adapter.channelId).toBe("ebay");
    });

    it("should be in native mode", () => {
      expect(adapter.mode).toBe("native");
    });

    it("should have full native capabilities", () => {
      expect(adapter.capabilities).toEqual({
        canPublish: true,
        canReprice: true,
        canDelist: true,
        canSyncOrders: true,
        canSyncInventory: true,
        requiresManualAction: false,
      });
    });
  });

  describe("isConnected", () => {
    it("should return true when user has valid connection", async () => {
      mockClient.isConnected.mockResolvedValue(true);

      const result = await adapter.isConnected(testUserId);

      expect(result).toBe(true);
      expect(mockClient.isConnected).toHaveBeenCalledWith(testUserId);
    });

    it("should return false when user has no connection", async () => {
      mockClient.isConnected.mockResolvedValue(false);

      const result = await adapter.isConnected(testUserId);

      expect(result).toBe(false);
    });
  });

  describe("publish", () => {
    it("should successfully publish a listing", async () => {
      // Mock successful API responses
      mockClient.request
        // Create inventory item
        .mockResolvedValueOnce({})
        // Create offer
        .mockResolvedValueOnce({ offerId: "offer-123", sku: testListing.sku })
        // Publish offer
        .mockResolvedValueOnce({ listingId: "listing-456" });

      const result = await adapter.publish(testUserId, testListing);

      expect(result.success).toBe(true);
      expect(result.externalId).toBe("listing-456");
      expect(result.externalUrl).toContain("listing-456");

      // Should have called request 3 times
      expect(mockClient.request).toHaveBeenCalledTimes(3);

      // Should have tracked 3 revisions
      expect(mockClient.trackRevision).toHaveBeenCalledTimes(3);
    });

    it("should fail when rate limit is exceeded", async () => {
      mockClient.getRevisionStatus.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetsAt: new Date(Date.now() + 3600000),
      });

      const result = await adapter.publish(testUserId, testListing);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("RATE_LIMIT_EXCEEDED");
      expect(mockClient.request).not.toHaveBeenCalled();
    });

    it("should handle API errors gracefully", async () => {
      const apiError = new Error("eBay API error");
      (apiError as Error & { code: string }).code = "EBAY_ERROR";
      mockClient.request.mockRejectedValueOnce(apiError);

      const result = await adapter.publish(testUserId, testListing);

      expect(result.success).toBe(false);
      expect(result.error).toContain("eBay API error");
    });

    it("should truncate title to 80 characters", async () => {
      const longTitleListing = {
        ...testListing,
        title: "A".repeat(100), // 100 characters
      };

      mockClient.request
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ offerId: "offer-123" })
        .mockResolvedValueOnce({ listingId: "listing-456" });

      await adapter.publish(testUserId, longTitleListing);

      // Check the first call (create inventory item) has truncated title
      const inventoryCall = mockClient.request.mock.calls[0];
      const inventoryBody = inventoryCall[1].body;
      expect(inventoryBody.product.title.length).toBe(80);
    });
  });

  describe("delist", () => {
    const listingId = "listing-456";

    it("should successfully delist by setting quantity to 0", async () => {
      // Mock get offers response
      mockClient.request
        .mockResolvedValueOnce({
          offers: [{ offerId: "offer-123", sku: "TEST-SKU" }],
        })
        // Mock update offer response
        .mockResolvedValueOnce({});

      const result = await adapter.delist(testUserId, listingId);

      expect(result.success).toBe(true);
      expect(mockClient.request).toHaveBeenCalledTimes(2);

      // Check that quantity was set to 0
      const updateCall = mockClient.request.mock.calls[1];
      expect(updateCall[1].body).toEqual({ availableQuantity: 0 });
    });

    it("should fail when offer not found", async () => {
      mockClient.request.mockResolvedValueOnce({ offers: [] });

      const result = await adapter.delist(testUserId, listingId);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("OFFER_NOT_FOUND");
    });

    it("should fail when rate limit is exceeded", async () => {
      mockClient.getRevisionStatus.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetsAt: new Date(),
      });

      const result = await adapter.delist(testUserId, listingId);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("RATE_LIMIT_EXCEEDED");
    });
  });

  describe("updatePrice", () => {
    const listingId = "listing-456";
    const newPrice = 24.99;

    it("should successfully update price", async () => {
      mockClient.request
        .mockResolvedValueOnce({
          offers: [{ offerId: "offer-123", sku: "TEST-SKU" }],
        })
        .mockResolvedValueOnce({});

      const result = await adapter.updatePrice(testUserId, listingId, newPrice);

      expect(result.success).toBe(true);

      // Check price update payload
      const updateCall = mockClient.request.mock.calls[1];
      expect(updateCall[1].body).toEqual({
        pricingSummary: {
          price: {
            value: "24.99",
            currency: "USD",
          },
        },
      });
    });

    it("should fail when rate limit exceeded", async () => {
      mockClient.getRevisionStatus.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetsAt: new Date(),
      });

      const result = await adapter.updatePrice(testUserId, listingId, newPrice);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("RATE_LIMIT_EXCEEDED");
    });
  });

  describe("update", () => {
    const listingId = "listing-456";

    it("should update title and description", async () => {
      mockClient.request
        // Get offers
        .mockResolvedValueOnce({
          offers: [{ offerId: "offer-123", sku: "TEST-SKU" }],
        })
        // Get current inventory item
        .mockResolvedValueOnce({
          sku: "TEST-SKU",
          product: {
            title: "Old Title",
            description: "Old description",
            imageUrls: ["old-image.jpg"],
          },
          condition: "NEW",
        })
        // Update inventory item
        .mockResolvedValueOnce({});

      const result = await adapter.update(testUserId, listingId, {
        title: "New Title",
        description: "New description",
      });

      expect(result.success).toBe(true);

      // Verify the update call
      const updateCall = mockClient.request.mock.calls[2];
      expect(updateCall[1].body.product.title).toBe("New Title");
      expect(updateCall[1].body.product.description).toBe("New description");
    });

    it("should update price separately", async () => {
      mockClient.request
        .mockResolvedValueOnce({
          offers: [{ offerId: "offer-123", sku: "TEST-SKU" }],
        })
        .mockResolvedValueOnce({});

      const result = await adapter.update(testUserId, listingId, {
        price: 19.99,
      });

      expect(result.success).toBe(true);
      expect(mockClient.trackRevision).toHaveBeenCalled();
    });
  });

  describe("syncOrders", () => {
    const sinceDate = new Date("2024-01-01");

    it("should fetch and map orders correctly", async () => {
      mockClient.request.mockResolvedValueOnce({
        orders: [
          {
            orderId: "order-123",
            creationDate: "2024-01-15T10:00:00Z",
            orderFulfillmentStatus: "NOT_STARTED",
            orderPaymentStatus: "PAID",
            buyer: { username: "buyer123" },
            pricingSummary: {
              total: { value: "45.99", currency: "USD" },
              deliveryCost: { value: "5.99", currency: "USD" },
            },
            lineItems: [
              {
                lineItemId: "line-1",
                title: "Test Item",
                quantity: 1,
                lineItemCost: { value: "40.00", currency: "USD" },
                sku: "TEST-SKU",
                legacyItemId: "listing-456",
              },
            ],
            fulfillmentStartInstructions: [
              {
                shippingStep: {
                  shipTo: {
                    fullName: "John Doe",
                    contactAddress: {
                      addressLine1: "123 Main St",
                      city: "Anytown",
                      stateOrProvince: "CA",
                      postalCode: "12345",
                      countryCode: "US",
                    },
                  },
                },
              },
            ],
          },
        ],
        total: 1,
        offset: 0,
        limit: 50,
      });

      const orders = await adapter.syncOrders(testUserId, sinceDate);

      expect(orders).toHaveLength(1);
      expect(orders[0]).toMatchObject({
        externalOrderId: "order-123",
        channel: "ebay",
        buyerUsername: "buyer123",
        status: "PAID",
        salePrice: 45.99,
        shippingPaid: 5.99,
        shippingAddress: {
          name: "John Doe",
          street1: "123 Main St",
          city: "Anytown",
          state: "CA",
          postalCode: "12345",
          country: "US",
        },
      });
      expect(orders[0].lineItems).toHaveLength(1);
    });

    it("should return empty array on API error", async () => {
      mockClient.request.mockRejectedValueOnce(new Error("API Error"));

      const orders = await adapter.syncOrders(testUserId, sinceDate);

      expect(orders).toEqual([]);
    });
  });

  describe("getAuthUrl", () => {
    it("should generate a valid eBay OAuth URL", async () => {
      const url = await adapter.getAuthUrl(testUserId);

      expect(url).toContain("ebay.com/oauth2/authorize");
      expect(url).toContain("response_type=code");
    });
  });
});
