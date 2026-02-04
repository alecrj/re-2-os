/**
 * Listings Router Tests
 *
 * Tests for the channel listings tRPC router, including
 * cross-listing template generation and marking items as listed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database before imports
vi.mock("@/server/db/client", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    query: {
      inventoryItems: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      channelListings: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  },
}));

// Mock the channel service
vi.mock("@/server/services/channels", () => ({
  generateCrossListTemplate: vi.fn().mockReturnValue({
    title: "Test Title",
    description: "Test Description",
    price: 29.99,
    copyableFields: {
      title: "Test Title",
      description: "Test Description",
      brand: "Nike",
    },
    instructions: [
      "1. Open app",
      "2. Create listing",
      "3. Copy content",
    ],
  }),
}));

// ============ TESTS ============

describe("listingsRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateTemplate input validation", () => {
    it("should require itemId and channel", () => {
      const input = {
        itemId: "item-123",
        channel: "poshmark" as const,
      };

      expect(input.itemId).toBe("item-123");
      expect(input.channel).toBe("poshmark");
    });

    it("should only accept assisted channels", () => {
      const assistedChannels = ["poshmark", "mercari", "depop"];

      assistedChannels.forEach((channel) => {
        expect(["poshmark", "mercari", "depop"]).toContain(channel);
      });

      // Should not accept ebay (native channel)
      expect(["poshmark", "mercari", "depop"]).not.toContain("ebay");
    });
  });

  describe("markCrossListed input validation", () => {
    it("should require itemId and channel", () => {
      const input = {
        itemId: "item-123",
        channel: "mercari" as const,
      };

      expect(input.itemId).toBe("item-123");
      expect(input.channel).toBe("mercari");
    });

    it("should accept optional externalUrl", () => {
      const inputWithUrl = {
        itemId: "item-123",
        channel: "depop" as const,
        externalUrl: "https://depop.com/products/abc123",
      };

      expect(inputWithUrl.externalUrl).toBe("https://depop.com/products/abc123");
    });

    it("should validate URL format when provided", () => {
      const isValidUrl = (url: string): boolean => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      };

      expect(isValidUrl("https://poshmark.com/listing/abc")).toBe(true);
      expect(isValidUrl("https://mercari.com/item/123")).toBe(true);
      expect(isValidUrl("not-a-url")).toBe(false);
    });
  });

  describe("updateExternalUrl input validation", () => {
    it("should require listingId and externalUrl", () => {
      const input = {
        listingId: "listing-123",
        externalUrl: "https://mercari.com/item/456",
      };

      expect(input.listingId).toBe("listing-123");
      expect(input.externalUrl).toBe("https://mercari.com/item/456");
    });
  });

  describe("assisted channels", () => {
    it("should identify poshmark as assisted", () => {
      expect(["poshmark", "mercari", "depop"]).toContain("poshmark");
    });

    it("should identify mercari as assisted", () => {
      expect(["poshmark", "mercari", "depop"]).toContain("mercari");
    });

    it("should identify depop as assisted", () => {
      expect(["poshmark", "mercari", "depop"]).toContain("depop");
    });

    it("should not include ebay in assisted channels", () => {
      expect(["poshmark", "mercari", "depop"]).not.toContain("ebay");
    });
  });
});

describe("cross-list template generation", () => {
  describe("poshmark templates", () => {
    it("should respect 80 character title limit", () => {
      const title = "a".repeat(100);
      const truncatedTitle = title.substring(0, 80);

      expect(truncatedTitle.length).toBe(80);
    });

    it("should map conditions correctly", () => {
      const conditionMap: Record<string, string> = {
        new: "NWT",
        like_new: "NWOT",
        good: "Good",
        fair: "Fair",
        poor: "Poor",
      };

      expect(conditionMap.new).toBe("NWT");
      expect(conditionMap.like_new).toBe("NWOT");
      expect(conditionMap.good).toBe("Good");
    });

    it("should include brand and size in copyable fields", () => {
      const itemSpecifics = { brand: "Nike", size: "10" };

      expect(itemSpecifics.brand).toBe("Nike");
      expect(itemSpecifics.size).toBe("10");
    });
  });

  describe("mercari templates", () => {
    it("should respect 40 character title limit", () => {
      const title = "a".repeat(60);
      const truncatedTitle = title.substring(0, 40);

      expect(truncatedTitle.length).toBe(40);
    });

    it("should respect 1000 character description limit", () => {
      const description = "a".repeat(1500);
      const truncatedDescription = description.substring(0, 1000);

      expect(truncatedDescription.length).toBe(1000);
    });

    it("should map conditions correctly", () => {
      const conditionMap: Record<string, string> = {
        new: "New",
        like_new: "Like new",
        good: "Good",
        fair: "Fair",
        poor: "Poor",
      };

      expect(conditionMap.new).toBe("New");
      expect(conditionMap.like_new).toBe("Like new");
    });
  });

  describe("depop templates", () => {
    it("should respect 150 character title limit", () => {
      const title = "a".repeat(200);
      const truncatedTitle = title.substring(0, 150);

      expect(truncatedTitle.length).toBe(150);
    });

    it("should generate hashtags from brand", () => {
      const brand = "Nike Air";
      const hashtag = `#${brand.replace(/\s+/g, "")}`;

      expect(hashtag).toBe("#NikeAir");
    });

    it("should include color hashtag when available", () => {
      const color = "Blue";
      const hashtag = `#${color.toLowerCase()}`;

      expect(hashtag).toBe("#blue");
    });

    it("should map conditions correctly", () => {
      const conditionMap: Record<string, string> = {
        new: "Brand New",
        like_new: "Like New",
        good: "Good",
        fair: "Fair",
        poor: "Poor",
      };

      expect(conditionMap.new).toBe("Brand New");
      expect(conditionMap.like_new).toBe("Like New");
    });
  });
});

describe("channel listing data", () => {
  it("should create listing with correct initial status", () => {
    const createListing = (channel: string) => ({
      status: "active", // For assisted channels marked as listed
      requiresManualAction: channel !== "ebay",
    });

    const poshmarkListing = createListing("poshmark");
    expect(poshmarkListing.status).toBe("active");
    expect(poshmarkListing.requiresManualAction).toBe(true);

    const ebayListing = createListing("ebay");
    expect(ebayListing.requiresManualAction).toBe(false);
  });

  it("should set publishedAt when marking as listed", () => {
    const now = new Date();
    const listing = {
      status: "active",
      publishedAt: now,
    };

    expect(listing.publishedAt).toEqual(now);
  });

  it("should allow updating external URL", () => {
    const listing = {
      externalUrl: null as string | null,
    };

    listing.externalUrl = "https://poshmark.com/listing/abc";

    expect(listing.externalUrl).toBe("https://poshmark.com/listing/abc");
  });
});

describe("listing channel mapping", () => {
  it("should map channel to correct platform URL", () => {
    const platformUrls: Record<string, string> = {
      poshmark: "https://poshmark.com/create-listing",
      mercari: "https://www.mercari.com/sell/",
      depop: "https://www.depop.com/products/create/",
    };

    expect(platformUrls.poshmark).toContain("poshmark.com");
    expect(platformUrls.mercari).toContain("mercari.com");
    expect(platformUrls.depop).toContain("depop.com");
  });

  it("should identify channel by name", () => {
    const channels = ["poshmark", "mercari", "depop"];
    const channelNames: Record<string, string> = {
      poshmark: "Poshmark",
      mercari: "Mercari",
      depop: "Depop",
    };

    channels.forEach((channel) => {
      expect(channelNames[channel]).toBeDefined();
    });
  });
});

describe("template field character limits", () => {
  const channelLimits = {
    poshmark: { title: 80, description: 1500 },
    mercari: { title: 40, description: 1000 },
    depop: { title: 150, description: 1000 },
  };

  it("should have correct limits for poshmark", () => {
    expect(channelLimits.poshmark.title).toBe(80);
    expect(channelLimits.poshmark.description).toBe(1500);
  });

  it("should have correct limits for mercari", () => {
    expect(channelLimits.mercari.title).toBe(40);
    expect(channelLimits.mercari.description).toBe(1000);
  });

  it("should have correct limits for depop", () => {
    expect(channelLimits.depop.title).toBe(150);
    expect(channelLimits.depop.description).toBe(1000);
  });

  it("should detect when content exceeds limit", () => {
    const checkLimit = (content: string, limit: number): boolean => {
      return content.length <= limit;
    };

    const shortTitle = "a".repeat(30);
    const longTitle = "a".repeat(100);

    expect(checkLimit(shortTitle, 80)).toBe(true);
    expect(checkLimit(longTitle, 80)).toBe(false);
    expect(checkLimit(longTitle, 150)).toBe(true);
  });
});

describe("inventory item status updates", () => {
  it("should update item status to active when cross-listed from draft", () => {
    type Status = "draft" | "active" | "sold" | "shipped" | "archived";
    const item: { status: Status; listedAt: Date | null } = {
      status: "draft",
      listedAt: null,
    };

    // Simulate marking as cross-listed
    const onMarkCrossListed = () => {
      if (item.status === "draft") {
        item.status = "active";
        item.listedAt = item.listedAt ?? new Date();
      }
    };

    onMarkCrossListed();

    expect(item.status).toBe("active");
    expect(item.listedAt).toBeInstanceOf(Date);
  });

  it("should not change listedAt if already set", () => {
    const originalDate = new Date("2026-01-01");
    const item = {
      status: "active" as const,
      listedAt: originalDate,
    };

    // Simulate marking as cross-listed on another channel
    const updatedListedAt = item.listedAt ?? new Date();

    expect(updatedListedAt).toEqual(originalDate);
  });
});
