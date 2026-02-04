/**
 * Channel Adapters Index Tests
 */

import { describe, it, expect, vi } from "vitest";
import {
  getAdapter,
  isNativeChannel,
  isAssistedChannel,
  getChannelCapabilities,
  generateCrossListTemplate,
  CHANNEL_CAPABILITIES,
} from "../index";

// Mock the eBay adapter
vi.mock("../ebay", () => ({
  getEbayAdapter: vi.fn(() => ({
    channelId: "ebay",
    mode: "native",
    capabilities: {
      canPublish: true,
      canReprice: true,
      canDelist: true,
      canSyncOrders: true,
      canSyncInventory: true,
      requiresManualAction: false,
    },
  })),
  EbayAdapter: vi.fn(),
  EbayClient: vi.fn(),
  getEbayClient: vi.fn(),
}));

describe("Channel Capabilities", () => {
  it("should define capabilities for all channels", () => {
    expect(CHANNEL_CAPABILITIES).toHaveProperty("ebay");
    expect(CHANNEL_CAPABILITIES).toHaveProperty("poshmark");
    expect(CHANNEL_CAPABILITIES).toHaveProperty("mercari");
    expect(CHANNEL_CAPABILITIES).toHaveProperty("depop");
  });

  it("should have eBay with full native capabilities", () => {
    const ebay = CHANNEL_CAPABILITIES.ebay;
    expect(ebay.canPublish).toBe(true);
    expect(ebay.canReprice).toBe(true);
    expect(ebay.canDelist).toBe(true);
    expect(ebay.canSyncOrders).toBe(true);
    expect(ebay.requiresManualAction).toBe(false);
  });

  it("should have assisted channels require manual action", () => {
    const assistedChannels = ["poshmark", "mercari", "depop"] as const;

    for (const channel of assistedChannels) {
      expect(CHANNEL_CAPABILITIES[channel].requiresManualAction).toBe(true);
      expect(CHANNEL_CAPABILITIES[channel].canPublish).toBe(false);
    }
  });
});

describe("getAdapter", () => {
  it("should return eBay adapter for ebay channel", () => {
    const adapter = getAdapter("ebay");
    expect(adapter.channelId).toBe("ebay");
    expect(adapter.mode).toBe("native");
  });

  it("should throw error for assisted channels", () => {
    expect(() => getAdapter("poshmark")).toThrow("assisted mode");
    expect(() => getAdapter("mercari")).toThrow("assisted mode");
    expect(() => getAdapter("depop")).toThrow("assisted mode");
  });
});

describe("isNativeChannel", () => {
  it("should return true for eBay", () => {
    expect(isNativeChannel("ebay")).toBe(true);
  });

  it("should return false for assisted channels", () => {
    expect(isNativeChannel("poshmark")).toBe(false);
    expect(isNativeChannel("mercari")).toBe(false);
    expect(isNativeChannel("depop")).toBe(false);
  });
});

describe("isAssistedChannel", () => {
  it("should return true for Poshmark, Mercari, Depop", () => {
    expect(isAssistedChannel("poshmark")).toBe(true);
    expect(isAssistedChannel("mercari")).toBe(true);
    expect(isAssistedChannel("depop")).toBe(true);
  });

  it("should return false for eBay", () => {
    expect(isAssistedChannel("ebay")).toBe(false);
  });
});

describe("getChannelCapabilities", () => {
  it("should return capabilities for any channel", () => {
    const ebay = getChannelCapabilities("ebay");
    expect(ebay.canPublish).toBe(true);

    const poshmark = getChannelCapabilities("poshmark");
    expect(poshmark.requiresManualAction).toBe(true);
  });
});

describe("generateCrossListTemplate", () => {
  const testListing = {
    title: "Vintage Nike Air Max Sneakers Size 10",
    description:
      "Classic Nike Air Max sneakers in excellent condition. Minor wear on sole.",
    price: 75.0,
    condition: "good",
    itemSpecifics: {
      brand: "Nike",
      size: "10",
      color: "White",
    },
  };

  describe("Poshmark template", () => {
    it("should generate valid Poshmark template", () => {
      const template = generateCrossListTemplate("poshmark", testListing);

      expect(template.title).toBe(testListing.title);
      expect(template.price).toBe(75.0);
      expect(template.copyableFields.brand).toBe("Nike");
      expect(template.copyableFields.size).toBe("10");
      expect(template.instructions).toHaveLength(8);
      expect(template.instructions[0]).toContain("Poshmark");
    });

    it("should truncate title to 80 characters", () => {
      const longTitle = "A".repeat(100);
      const template = generateCrossListTemplate("poshmark", {
        ...testListing,
        title: longTitle,
      });

      expect(template.title.length).toBe(80);
    });

    it("should map conditions correctly", () => {
      const newTemplate = generateCrossListTemplate("poshmark", {
        ...testListing,
        condition: "new",
      });
      expect(newTemplate.copyableFields.condition).toBe("NWT");

      const likeNewTemplate = generateCrossListTemplate("poshmark", {
        ...testListing,
        condition: "like_new",
      });
      expect(likeNewTemplate.copyableFields.condition).toBe("NWOT");
    });
  });

  describe("Mercari template", () => {
    it("should generate valid Mercari template", () => {
      const template = generateCrossListTemplate("mercari", testListing);

      expect(template.title.length).toBeLessThanOrEqual(40);
      expect(template.price).toBe(75.0);
      expect(template.instructions.some((i) => i.includes("Mercari"))).toBe(true);
      expect(template.instructions.some((i) => i.includes("import"))).toBe(true);
    });

    it("should truncate title to 40 characters", () => {
      const template = generateCrossListTemplate("mercari", testListing);
      expect(template.title.length).toBeLessThanOrEqual(40);
    });
  });

  describe("Depop template", () => {
    it("should generate valid Depop template", () => {
      const template = generateCrossListTemplate("depop", testListing);

      expect(template.price).toBe(75.0);
      expect(template.copyableFields.hashtags).toContain("#Nike");
      expect(template.instructions.some((i) => i.includes("Depop"))).toBe(true);
    });

    it("should include brand hashtag", () => {
      const template = generateCrossListTemplate("depop", testListing);
      expect(template.copyableFields.hashtags).toContain("#Nike");
    });

    it("should include color hashtag when available", () => {
      const template = generateCrossListTemplate("depop", testListing);
      expect(template.copyableFields.hashtags).toContain("#white");
    });
  });

  it("should throw error for eBay (native channel)", () => {
    expect(() => generateCrossListTemplate("ebay", testListing)).toThrow(
      "not available"
    );
  });
});
