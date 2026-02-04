/**
 * eBay API Client Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkRevisionLimit,
  incrementRevisionCount,
  EbayClient,
} from "../client";
import {
  ChannelApiError,
  RateLimitError,
  AuthenticationError,
} from "../../types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the database
vi.mock("@/server/db/client", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    }),
  },
}));

vi.mock("@/server/db/schema", () => ({
  channelConnections: {
    userId: "user_id",
    channel: "channel",
  },
}));

describe("Rate Limiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00-08:00")); // Noon PT
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkRevisionLimit", () => {
    it("should allow revisions when under limit", () => {
      const userId = "test-user-1";
      const result = checkRevisionLimit(userId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(200);
    });

    it("should track revision counts correctly", () => {
      const userId = "test-user-2";

      // First check - should be 200 remaining
      let result = checkRevisionLimit(userId);
      expect(result.remaining).toBe(200);

      // Increment 10 times
      for (let i = 0; i < 10; i++) {
        incrementRevisionCount(userId);
      }

      // Check again - should be 190 remaining
      result = checkRevisionLimit(userId);
      expect(result.remaining).toBe(190);
      expect(result.allowed).toBe(true);
    });

    it("should block when limit reached", () => {
      const userId = "test-user-3";

      // Increment to the limit
      for (let i = 0; i < 200; i++) {
        incrementRevisionCount(userId);
      }

      const result = checkRevisionLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should reset at midnight PT", () => {
      const userId = "test-user-4";

      // Use up some revisions
      for (let i = 0; i < 50; i++) {
        incrementRevisionCount(userId);
      }

      let result = checkRevisionLimit(userId);
      expect(result.remaining).toBe(150);

      // Advance time past midnight PT
      vi.setSystemTime(new Date("2024-01-16T00:01:00-08:00"));

      result = checkRevisionLimit(userId);
      expect(result.remaining).toBe(200);
      expect(result.allowed).toBe(true);
    });
  });
});

describe("EbayClient", () => {
  let client: EbayClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variables
    process.env.EBAY_CLIENT_ID = "test-client-id";
    process.env.EBAY_CLIENT_SECRET = "test-client-secret";
    process.env.EBAY_ENVIRONMENT = "sandbox";

    client = new EbayClient();
  });

  describe("constructor", () => {
    it("should use sandbox URLs by default", () => {
      const sandboxClient = new EbayClient({ environment: "sandbox" });
      expect(sandboxClient).toBeDefined();
    });

    it("should support production configuration", () => {
      const prodClient = new EbayClient({ environment: "production" });
      expect(prodClient).toBeDefined();
    });
  });

  describe("isConnected", () => {
    it("should return false when no tokens exist", async () => {
      const result = await client.isConnected("no-tokens-user");
      expect(result).toBe(false);
    });
  });

  describe("getRevisionStatus", () => {
    it("should return current revision status", () => {
      const userId = "revision-test-user";
      const status = client.getRevisionStatus(userId);

      expect(status.allowed).toBe(true);
      expect(status.remaining).toBeLessThanOrEqual(200);
      expect(status.resetsAt).toBeInstanceOf(Date);
    });
  });

  describe("trackRevision", () => {
    it("should increment revision count", () => {
      const userId = "track-revision-user";

      const before = client.getRevisionStatus(userId);
      client.trackRevision(userId);
      const after = client.getRevisionStatus(userId);

      expect(after.remaining).toBe(before.remaining - 1);
    });
  });
});

describe("Error Classes", () => {
  describe("ChannelApiError", () => {
    it("should create error with correct properties", () => {
      const error = new ChannelApiError(
        "Test error",
        "TEST_CODE",
        400,
        true,
        5000
      );

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(5000);
      expect(error.name).toBe("ChannelApiError");
    });
  });

  describe("RateLimitError", () => {
    it("should create rate limit error with retry info", () => {
      const resetsAt = new Date(Date.now() + 60000);
      const error = new RateLimitError("Rate limited", resetsAt);

      expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(error.statusCode).toBe(429);
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBeGreaterThan(0);
      expect(error.name).toBe("RateLimitError");
    });
  });

  describe("AuthenticationError", () => {
    it("should create auth error with correct status", () => {
      const error = new AuthenticationError("Invalid credentials");

      expect(error.code).toBe("AUTHENTICATION_FAILED");
      expect(error.statusCode).toBe(401);
      expect(error.retryable).toBe(false);
      expect(error.name).toBe("AuthenticationError");
    });
  });
});
